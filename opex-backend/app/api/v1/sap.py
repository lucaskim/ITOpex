from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from pydantic import BaseModel
import pandas as pd
import io
import re

from app.core.database import get_db
# 모델 import (파일명이 projects.py 인지 project.py 인지 확인하여 맞게 수정하세요)
from app.models.sap import SapUploadRaw
from app.models.project import ProjectMaster, MonthlyData 

# ▼▼▼ 이 줄이 반드시 @router 데코레이터보다 위에 있어야 합니다! ▼▼▼
router = APIRouter() 

# ==========================================
# 1. SAP 엑셀 업로드 API
# ==========================================
@router.post("/upload")
async def upload_sap_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="엑셀 파일만 업로드 가능합니다.")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df = df.where(pd.notnull(df), None)

        results = {"total": 0, "inserted": 0, "skipped": 0}
        
        for _, row in df.iterrows():
            if not row.get('전표 번호') or row.get('금액(현지 통화)') is None:
                continue
            
            # 파싱 로직
            slip_no = str(row.get('전표 번호'))
            posting_date = str(row.get('전기일', ''))
            if len(posting_date) >= 7:
                yyyymm = posting_date.replace('-', '').replace('.', '')[:6]
            else:
                yyyymm = '999912'

            try:
                raw_amt = str(row.get('금액(현지 통화)', 0))
                amount = float(raw_amt.replace(',', ''))
            except:
                amount = 0
            
            try:
                line_item = int(row.get('개별 항목', 0))
            except:
                line_item = 0

            fiscal_year = str(row.get('회계연도', ''))
            
            # 중복 체크
            exists = db.query(SapUploadRaw).filter(
                SapUploadRaw.fiscal_year == fiscal_year,
                SapUploadRaw.slip_no == slip_no,
                SapUploadRaw.line_item == line_item
            ).first()
            
            if not exists:
                db_raw = SapUploadRaw(
                    yyyymm=yyyymm,
                    fiscal_year=fiscal_year,
                    slip_no=slip_no,
                    line_item=line_item,
                    gl_account=str(row.get('G/L 계정', '')),
                    gl_desc=str(row.get('G/L 계정과목명', '')),
                    header_text=str(row.get('텍스트', '')),
                    amt_val=amount,
                    currency=str(row.get('현지 통화', 'KRW')),
                    vendor_text=str(row.get('상계계정 명칭', '')),
                    ref_key=str(row.get('참조 키(헤더) 1', '')),
                    cost_center=str(row.get('코스트 센터', ''))
                )
                db.add(db_raw)
                results["inserted"] += 1
            else:
                results["skipped"] += 1
            
            results["total"] += 1
            
        db.commit()
        return {"status": "success", "message": f"총 {results['total']}건 처리 (신규: {results['inserted']}, 중복제외: {results['skipped']})"}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"업로드 실패: {str(e)}")


# ==========================================
# 2. 자동 매핑 실행 API
# ==========================================
@router.post("/run-mapping")
def run_auto_mapping(db: Session = Depends(get_db)):
    """
    Raw 데이터의 텍스트를 분석하여 Project와 매핑하고,
    결과를 MonthlyData(실적)에 반영합니다.
    """
    # 미매핑 데이터 조회
    unmapped_rows = db.query(SapUploadRaw).filter(SapUploadRaw.mapping_status == 'UNMAPPED').all()
    
    mapped_count = 0
    
    for row in unmapped_rows:
        target_proj_id = None
        
        # 정규표현식: 대괄호 있거나 없거나 + 알파벳1자리 + 하이픈 + 숫자3자리 (예: A-001)
        match = re.search(r"\[?([A-Z]-\d{3})\]?", row.header_text or "")
        
        if match:
            extracted_id = match.group(1) # A-001 추출
            
            # 실제 존재하는 프로젝트인지 확인
            proj = db.query(ProjectMaster).filter(ProjectMaster.proj_id == extracted_id).first()
            if proj:
                target_proj_id = extracted_id

        # 매핑 성공 시 업데이트
        if target_proj_id:
            row.mapped_proj_id = target_proj_id
            row.mapping_status = 'MAPPED'
            mapped_count += 1
        else:
            # 매핑 실패했지만 시도는 했음을 표시 (계속 재시도 안 하게 하려면 IGNORED 처리 등 고려)
            pass 
            
    db.commit()
    
    # 매핑 결과를 월별 실적 테이블에 반영
    if mapped_count > 0:
        sync_monthly_actuals(db)
    
    return {"status": "success", "message": f"{mapped_count}건 자동 매핑 완료"}


def sync_monthly_actuals(db: Session):
    """
    Raw 데이터(MAPPED)를 집계하여 TB_MONTHLY_DATA.actual_amt 업데이트
    """
    # 1. Raw 테이블에서 프로젝트별/월별 합계 계산
    aggs = db.query(
        SapUploadRaw.mapped_proj_id,
        SapUploadRaw.yyyymm,
        func.sum(SapUploadRaw.amt_val).label("total_amt")
    ).filter(
        SapUploadRaw.mapping_status == 'MAPPED'
    ).group_by(
        SapUploadRaw.mapped_proj_id,
        SapUploadRaw.yyyymm
    ).all()
    
    # 2. TB_MONTHLY_DATA 업데이트
    for proj_id, yyyymm, total_amt in aggs:
        # 해당 월 데이터 조회
        m_data = db.query(MonthlyData).filter(
            MonthlyData.proj_id == proj_id,
            MonthlyData.yyyymm == yyyymm
        ).first()
        
        if m_data:
            m_data.actual_amt = total_amt
        else:
            # 데이터가 없으면 생성
            new_data = MonthlyData(
                proj_id=proj_id,
                yyyymm=yyyymm,
                plan_amt=0,
                est_amt=0,
                actual_amt=total_amt
            )
            db.add(new_data)
            
    db.commit()




# ---------------------------------------------------------
# 3. 미매핑 데이터 조회 및 수동 매핑
# ---------------------------------------------------------

# 미매핑된 SAP 전표 조회
@router.get("/unmapped")
def get_unmapped_data(db: Session = Depends(get_db)):
    return db.query(SapUploadRaw)\
             .filter(SapUploadRaw.mapping_status == 'UNMAPPED')\
             .order_by(SapUploadRaw.slip_no)\
             .all()

# 수동 매핑 요청 구조
class ManualMapRequest(BaseModel):
    raw_ids: List[int]  # 선택한 전표 ID들
    target_proj_id: str # 연결할 사업 ID

# 수동 매핑 실행
@router.post("/manual-map")
def manual_map_sap_data(req: ManualMapRequest, db: Session = Depends(get_db)):
    # 1. Raw 데이터 업데이트
    db.query(SapUploadRaw)\
      .filter(SapUploadRaw.raw_id.in_(req.raw_ids))\
      .update({
          "mapped_proj_id": req.target_proj_id,
          "mapping_status": "MAPPED"
      }, synchronize_session=False)
    
    db.commit()
    
    # 2. 월별 실적 집계 갱신 (중요!)
    sync_monthly_actuals(db)
    
    return {"status": "success", "message": "수동 매핑 완료"}