# app/api/v1/closing.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.models.closing import MonthlyClose

router = APIRouter()

class ClosingStatusUpdate(BaseModel):
    yyyymm: str
    status: str
    user_id: Optional[str] = "admin" # 임시 사용자 ID

# 1. 특정 월 마감 상태 조회 (GET /closing/{yyyymm})
@router.get("/status/{yyyymm}")
def get_closing_status(yyyymm: str, db: Session = Depends(get_db)):
    status = db.query(MonthlyClose).filter(MonthlyClose.yyyymm == yyyymm).first()
    
    return {
        "yyyymm": yyyymm,
        "status": status.close_status if status else "OPEN",
        "closed_at": status.closed_at if status else None
    }

# 2. 마감/해제 처리 (POST /closing/update)
@router.post("/update")
def update_closing_status(req: ClosingStatusUpdate, db: Session = Depends(get_db)):
    # 기존 레코드 조회
    status_record = db.query(MonthlyClose).filter(MonthlyClose.yyyymm == req.yyyymm).first()
    
    if status_record:
        # 상태 업데이트 (OPEN 또는 CLOSED)
        status_record.close_status = req.status
        status_record.closed_by = req.user_id
    else:
        # 레코드가 없으면 새로 생성 (CLOSED 상태로 바로 생성 가능)
        if req.status == 'CLOSED':
            status_record = MonthlyClose(
                yyyymm=req.yyyymm,
                close_status=req.status,
                closed_by=req.user_id
            )
            db.add(status_record)
        elif req.status == 'OPEN':
            # OPEN은 기본값이므로, OPEN으로 새로 만들 필요는 없음
            return {"status": "success", "message": f"{req.yyyymm}은 이미 OPEN 상태입니다."}
    
    db.commit()
    return {"status": "success", "message": f"{req.yyyymm}가 {req.status}로 처리되었습니다."}


#마감된 월의 데이터 수정을 막도록
def is_month_closed(db: Session, yyyymm: str) -> bool:
    """해당 월이 마감되었는지 확인합니다."""
    status = db.query(MonthlyClose).filter(MonthlyClose.yyyymm == yyyymm).first()
    return status and status.close_status == 'CLOSED'