# app/models/service.py
from sqlalchemy import Column, String, CHAR, TIMESTAMP
from sqlalchemy.sql import func
from app.core.database import Base

class ServiceMaster(Base):
    __tablename__ = "tb_service_master"

    svc_id = Column(String(20), primary_key=True, index=True)
    svc_name = Column(String(100), nullable=False)
    contract_type = Column(String(20), nullable=True)
    is_resident = Column(CHAR(1), default='N')
    operator_names = Column(String(200), nullable=True)
    is_active = Column(CHAR(1), default='Y')
    created_at = Column(TIMESTAMP, server_default=func.now())