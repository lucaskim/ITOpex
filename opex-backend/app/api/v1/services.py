# app/api/v1/services.py
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import uuid
import io
import pandas as pd

from app.core.database import get_db
from app.models.service import ServiceMaster
from app.schemas.service import Service, ServiceCreate

router = APIRouter()

# 1. 목록 조회
@router.get("/", response_model=List[Service])
def read_services(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(ServiceMaster).offset(skip).limit(limit).all()

# 2. 신규 등록
@router.post("/", response_model=Service)
def create_service(service: ServiceCreate, db: Session = Depends(get_db)):
    # ID 자동 생성 (SVC-0001 형식)
    new_id = f"SVC-{str(uuid.uuid4())[:4].upper()}"
    
    db_obj = ServiceMaster(
        svc_id=new_id,
        svc_name=service.svc_name,
        contract_type=service.contract_type,
        is_resident=service.is_resident,
        operator_names=service.operator_names,
        is_active=service.is_active
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


@router.post("/bulk-upload")
async def bulk_upload_services(file: UploadFile = File(...), db: Session = Depends(get_db)):
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
        svc_name = str(row.get("svc_name") or row.get("서비스명") or "").strip()
        contract_type = str(row.get("contract_type") or row.get("계약방식") or "").strip() or None
        is_resident = str(row.get("is_resident") or row.get("상주여부") or "N").strip().upper() or "N"
        operator_names = str(row.get("operator_names") or row.get("운영자") or "").strip() or None
        is_active = str(row.get("is_active") or "Y").strip().upper() or "Y"

        if not svc_name:
            results["skipped"] += 1
            continue

        exists = db.query(ServiceMaster).filter(ServiceMaster.svc_name == svc_name).first()
        if exists:
            results["skipped"] += 1
            continue

        new_id = f"SVC-{str(uuid.uuid4())[:4].upper()}"
        db_obj = ServiceMaster(
            svc_id=new_id,
            svc_name=svc_name,
            contract_type=contract_type,
            is_resident=is_resident,
            operator_names=operator_names,
            is_active=is_active
        )
        db.add(db_obj)
        results["inserted"] += 1

    db.commit()

    return {
        "status": "success",
        "message": f"총 {results['total']}건 중 {results['inserted']}건 등록, {results['skipped']}건 건너뜀",
    }