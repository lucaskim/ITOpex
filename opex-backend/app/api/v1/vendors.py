# app/api/v1/vendors.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

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