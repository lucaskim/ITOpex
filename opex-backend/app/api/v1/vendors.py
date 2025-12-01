# app/api/v1/vendors.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import uuid
import io
import pandas as pd

from app.core.database import get_db
from app.models.vendor import VendorMaster # (아래 3번에서 모델 만들 예정)
from app.schemas.vendor import Vendor, VendorCreate

router = APIRouter()

# 1. 업체 목록 조회 (GET /api/v1/vendors)
@router.get("/", response_model=List[Vendor])
def read_vendors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    vendors = db.query(VendorMaster).offset(skip).limit(limit).all()
    return vendors

# 2. 신규 업체 등록 (POST /api/v1/vendors)
@router.post("/", response_model=Vendor)
def create_vendor(vendor: VendorCreate, db: Session = Depends(get_db)):
    # 중복 체크 (사업자번호)
    db_vendor = db.query(VendorMaster).filter(VendorMaster.biz_reg_no == vendor.biz_reg_no).first()
    if db_vendor:
        raise HTTPException(status_code=400, detail="이미 등록된 사업자번호입니다.")
    
    # ID 자동 생성 (V + 난수 4자리 예시)
    new_id = f"V{str(uuid.uuid4())[:4].upper()}"
    
    db_obj = VendorMaster(
        vendor_id=new_id,
        vendor_name=vendor.vendor_name,
        biz_reg_no=vendor.biz_reg_no,
        sap_vendor_cd=vendor.sap_vendor_cd,
        vendor_alias=vendor.vendor_alias,
        is_active=vendor.is_active
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


@router.post("/bulk-upload")
async def bulk_upload_vendors(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename.lower()
    if not filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="엑셀 또는 CSV 파일만 업로드 가능합니다.")

    try:
        contents = await file.read()
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))

        df.columns = [str(col).strip().lower() for col in df.columns]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"파일을 읽는 중 오류가 발생했습니다: {str(e)}")

    if df.empty:
        raise HTTPException(status_code=400, detail="업로드할 데이터가 없습니다.")

    results = {"total": len(df), "inserted": 0, "skipped": 0}

    for _, row in df.iterrows():
        vendor_name = str(row.get("vendor_name") or row.get("업체명") or "").strip()
        biz_reg_no = str(row.get("biz_reg_no") or row.get("사업자번호") or "").strip()
        sap_vendor_cd = str(row.get("sap_vendor_cd") or row.get("sap코드") or "").strip() or None
        vendor_alias = str(row.get("vendor_alias") or row.get("별칭") or "").strip() or None
        is_active = str(row.get("is_active") or "Y").strip().upper() or "Y"

        if not vendor_name or not biz_reg_no:
            results["skipped"] += 1
            continue

        exists = db.query(VendorMaster).filter(VendorMaster.biz_reg_no == biz_reg_no).first()
        if exists:
            results["skipped"] += 1
            continue

        new_id = f"V{str(uuid.uuid4())[:4].upper()}"
        db_obj = VendorMaster(
            vendor_id=new_id,
            vendor_name=vendor_name,
            biz_reg_no=biz_reg_no,
            sap_vendor_cd=sap_vendor_cd,
            vendor_alias=vendor_alias,
            is_active=is_active or "Y"
        )
        db.add(db_obj)
        results["inserted"] += 1

    db.commit()

    return {
        "status": "success",
        "message": f"총 {results['total']}건 중 {results['inserted']}건 등록, {results['skipped']}건 건너뜀",
    }