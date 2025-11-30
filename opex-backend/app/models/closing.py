# app/models/closing.py
from sqlalchemy import Column, String, TIMESTAMP
from sqlalchemy.sql import func
from app.core.database import Base

class MonthlyClose(Base):
    __tablename__ = "tb_monthly_close"

    yyyymm = Column(String(6), primary_key=True, index=True) # 202501
    close_status = Column(String(20), default='OPEN')       # OPEN, CLOSED
    closed_by = Column(String(50), nullable=True)           # 마감 처리자
    closed_at = Column(TIMESTAMP, server_default=func.now())