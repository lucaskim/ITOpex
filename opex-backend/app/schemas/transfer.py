# app/schemas/transfer.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TransferRequest(BaseModel):
    from_proj_id: str
    to_proj_id: str
    transfer_amount: int
    transfer_yyyymm: str
    reason: Optional[str] = None
    transferred_by: Optional[str] = "admin" # 임시 사용자 ID

class TransferLog(BaseModel):
    transfer_id: int
    from_proj_id: str
    to_proj_id: str
    transfer_amount: int
    transfer_yyyymm: str
    transferred_at: datetime

    class Config:
        from_attributes = True