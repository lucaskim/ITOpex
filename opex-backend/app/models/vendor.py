# app/models/vendor.py
from sqlalchemy import Column, String, CHAR, TIMESTAMP
from sqlalchemy.sql import func
from app.core.database import Base

class VendorMaster(Base):
    __tablename__ = "tb_vendor_master"

    vendor_id = Column(String(20), primary_key=True, index=True)
    biz_reg_no = Column(String(20), unique=True, nullable=False)
    vendor_name = Column(String(100), nullable=False)
    sap_vendor_cd = Column(String(20), nullable=True)
    vendor_alias = Column(String(200), nullable=True)
    is_active = Column(CHAR(1), default='Y')
    created_at = Column(TIMESTAMP, server_default=func.now())