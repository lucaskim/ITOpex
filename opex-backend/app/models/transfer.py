# app/models/transfer.py
from sqlalchemy import Column, String, Numeric, TIMESTAMP, Text, ForeignKey, Integer
from sqlalchemy.sql import func
from app.core.database import Base

class BudgetTransfer(Base):
    __tablename__ = "tb_budget_transfer"

    transfer_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 보내는 사업 (Source)
    from_proj_id = Column(String(20), ForeignKey("tb_project_master.proj_id"), nullable=False)
    # 받는 사업 (Target)
    to_proj_id = Column(String(20), ForeignKey("tb_project_master.proj_id"), nullable=False)
    
    transfer_amount = Column(Numeric(15, 0), nullable=False) # 전용 금액
    transfer_yyyymm = Column(String(6), nullable=False)      # 전용 발생 월
    
    reason = Column(Text, nullable=True)                     # 전용 사유
    status = Column(String(20), default='APPLIED')           # 상태 (REQUESTED, APPLIED)
    transferred_by = Column(String(50), nullable=True)       # 처리자 ID
    transferred_at = Column(TIMESTAMP, server_default=func.now())