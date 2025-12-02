from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import io
import logging
from datetime import datetime

from app.core.database import get_db
from app.models.vendor import VendorMaster
from app.schemas.vendor import Vendor, VendorCreate, BulkUploadResult

router = APIRouter()
logger = logging.getLogger(__name__)

# [기존] 1. 업체 목록 조회 (GET /)
@router.get("/", response_model=List[Vendor])
def read_vendors(db: Session = Depends(get_db)):
    """등록된 모든 계약 업체 목록을 조회합니다."""
    vendors = db.query(VendorMaster).order_by(VendorMaster.vendor_name).all()
    return vendors

# [신규] 2. 신규 업체 등록 (POST /) - 단건 등록용
@router.post("/", response_model=Vendor)
def create_vendor(vendor: VendorCreate, db: Session = Depends(get_db)):
    """단건 계약 업체 정보를 등록합니다."""
    # 중복 체크 (vendor_id 기준)
    existing_vendor = db.query(VendorMaster).filter(VendorMaster.vendor_id == vendor.vendor_id).first()
    if existing_vendor:
        raise HTTPException(status_code=400, detail=f"이미 존재하는 업체 ID (사업자번호/법인번호): {vendor.vendor_id}")

    db_vendor = VendorMaster(
        vendor_id=vendor.vendor_id,
        vendor_name=vendor.vendor_name,
        biz_reg_no=vendor.vendor_id,
        # is_active는 모델에서 기본값(True)을 가질 것입니다.
    )
    
    try:
        db.add(db_vendor)
        db.commit()
        db.refresh(db_vendor)
        return db_vendor
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"업체 등록 실패: {str(e)}")


# [신규] 3. 업체 일괄 등록 (POST /bulk-upload)
@router.post("/bulk-upload", response_model=BulkUploadResult)
def upload_bulk_vendor(
    file: UploadFile = File(...), 
    overwrite_duplicates: bool = Form(False), 
    db: Session = Depends(get_db)
):
    """Excel 파일을 이용해 계약 업체 정보를 일괄 등록합니다."""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="엑셀 파일 (.xlsx, .xls)만 업로드 가능합니다.")

    try:
        # 1. 파일 읽기
        contents = file.file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # 2. 필수 컬럼명 검증 및 정리 (템플릿 헤더: '업체 ID', '업체명')
        required_cols = {'업체 ID': 'vendor_id', '업체명': 'vendor_name'}
        
        df.columns = [col.strip().replace(' ', '').upper() for col in df.columns]
        
        df = df[[k.strip().replace(' ', '').upper() for k in required_cols.keys()]].rename(columns={k.strip().replace(' ', '').upper(): v for k, v in required_cols.items()})
        df.dropna(subset=['vendor_id', 'vendor_name'], inplace=True)
        
        # 3. 데이터 검증 및 Pydantic 객체 생성
        uploaded_vendors = []
        
        for index, row in df.iterrows():
            rec = row.to_dict()
            try:
                vendor_id_val = str(rec.get('vendor_id'))
                
                # VendorCreate 객체 생성 시 biz_reg_no에 vendor_id 복사 (NOT NULL 충족)
                vendor_data_with_biz_reg = {
                    'vendor_id': vendor_id_val,
                    'vendor_name': str(rec.get('vendor_name')),
                    'biz_reg_no': vendor_id_val, # ID를 biz_reg_no에 복사 (NOT NULL 충족)
                }
                
                uploaded_vendors.append(VendorCreate(**vendor_data_with_biz_reg))
            except Exception as e:
                logger.warning(f"Invalid record skipped: {rec}, Error: {e}")
        
        # ▼▼▼ [핵심 수정] NameError를 해결하기 위한 uploaded_ids 셋 생성 ▼▼▼
        uploaded_ids = {v.vendor_id for v in uploaded_vendors}
        
        # 4. 중복 식별
        existing_db_ids = {
            v.vendor_id for v in db.query(VendorMaster.vendor_id)
            .filter(VendorMaster.vendor_id.in_(uploaded_ids)).all()
        }
        
        duplicates_in_file = [v for v in uploaded_vendors if v.vendor_id in existing_db_ids]
        
        if duplicates_in_file and not overwrite_duplicates:
            # 중복이 있지만 덮어쓰기 옵션이 없으면 중복 목록만 반환
            return BulkUploadResult(
                total_count=len(uploaded_vendors),
                success_count=0,
                duplicate_count=len(duplicates_in_file),
                message="업로드 파일에 중복된 업체 ID가 발견되었습니다. 덮어쓰기 여부를 결정해 주세요.",
                duplicates=duplicates_in_file
            )

        # 5. 등록/업데이트 실행
        success_count = 0
        
        for vendor_data in uploaded_vendors:
            data_dict = vendor_data.model_dump()
            
            if vendor_data.vendor_id in existing_db_ids and overwrite_duplicates:
                # 덮어쓰기 (Update)
                db.query(VendorMaster).filter(VendorMaster.vendor_id == vendor_data.vendor_id).update(
                    {'vendor_name': data_dict['vendor_name'], 'biz_reg_no': data_dict['biz_reg_no']}, 
                    synchronize_session=False
                )
                success_count += 1
            elif vendor_data.vendor_id not in existing_db_ids:
                # 신규 등록 (Create)
                db_vendor = VendorMaster(**data_dict) 
                db.add(db_vendor)
                success_count += 1
        
        db.commit()
        
        return BulkUploadResult(
            total_count=len(uploaded_vendors),
            success_count=success_count,
            duplicate_count=len(duplicates_in_file),
            message=f"총 {len(uploaded_vendors)}건 중 {success_count}건 등록/갱신 완료되었습니다. 중복 {len(duplicates_in_file)}건 처리됨."
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Vendor bulk upload failed")
        raise HTTPException(status_code=500, detail=f"일괄 등록 처리 중 예기치 않은 오류 발생: {str(e)}")