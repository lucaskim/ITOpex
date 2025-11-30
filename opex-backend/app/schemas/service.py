# app/schemas/service.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ServiceBase(BaseModel):
    svc_name: str
    contract_type: Optional[str] = None  # 예: 직계약, 재계약
    is_resident: Optional[str] = 'N'     # Y/N
    operator_names: Optional[str] = None # 예: 홍길동, 김철수 (단순 텍스트)
    is_active: Optional[str] = 'Y'

class ServiceCreate(ServiceBase):
    pass

class Service(ServiceBase):
    svc_id: str
    created_at: Optional[datetime] = None # SQLite 호환성을 위해 Optional

    class Config:
        from_attributes = True