# app/api/v1/services.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

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