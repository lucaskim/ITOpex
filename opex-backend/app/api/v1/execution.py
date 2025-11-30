# app/api/v1/execution.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
# ★ 중요: 모델 파일명이 project.py면 project, projects.py면 projects로 맞춰주세요.
from app.models.project import ProjectMaster, MonthlyData 
from app.api.v1.closing import is_month_closed

router = APIRouter()

# 1. 화면에 보여줄 데이터 구조 (DTO)
class MonthlyStatusDTO(BaseModel):
    proj_id: str
    proj_name: str
    dept_code: str
    vendor_name: Optional[str] = None
    plan_amt: int
    actual_amt: int
    est_amt: int
    
    class Config:
        from_attributes = True

# 2. 월별 현황 조회 API (GET /api/v1/execution/{yyyymm})
@router.get("/{yyyymm}", response_model=List[MonthlyStatusDTO])
def get_monthly_status(yyyymm: str, db: Session = Depends(get_db)):
    # Project와 MonthlyData를 조인(Join)해서 가져옴
    results = db.query(
        ProjectMaster.proj_id,
        ProjectMaster.proj_name,
        ProjectMaster.dept_code,
        ProjectMaster.vendor_id, # 실제로는 Vendor 테이블 조인해서 이름을 가져와야 하지만 일단 ID 사용
        MonthlyData.plan_amt,
        MonthlyData.actual_amt,
        MonthlyData.est_amt
    ).outerjoin(MonthlyData, (ProjectMaster.proj_id == MonthlyData.proj_id) & (MonthlyData.yyyymm == yyyymm))\
     .all()
    
    # 조회된 데이터를 DTO 리스트로 변환
    response_data = []
    for r in results:
        # MonthlyData가 없는 경우(신규사업 등) 0으로 처리
        response_data.append(MonthlyStatusDTO(
            proj_id=r.proj_id,
            proj_name=r.proj_name,
            dept_code=r.dept_code,
            vendor_name=r.vendor_id, 
            plan_amt=int(r.plan_amt or 0),
            actual_amt=int(r.actual_amt or 0),
            est_amt=int(r.est_amt or 0)
        ))
        
    return response_data

# 3. 추정 금액 수정 API (POST /api/v1/execution/update-forecast)
class ForecastUpdate(BaseModel):
    proj_id: str
    yyyymm: str
    est_amt: int

@router.post("/update-forecast")
def update_forecast(data: ForecastUpdate, db: Session = Depends(get_db)):
    # ▼▼▼ [통제 로직 추가] 마감된 월은 수정 불가 ▼▼▼
    if is_month_closed(db, data.yyyymm):
        raise HTTPException(status_code=403, detail="해당 월은 마감되어 수정할 수 없습니다.")
    # ▲▲▲ ▲▲▲ ▲▲▲
    
    
    # 해당 월 데이터가 있는지 확인
    monthly_data = db.query(MonthlyData).filter(
        MonthlyData.proj_id == data.proj_id,
        MonthlyData.yyyymm == data.yyyymm
    ).first()
    
    if monthly_data:
        # 있으면 업데이트
        monthly_data.est_amt = data.est_amt
    else:
        # 없으면 새로 생성 (방어 로직)
        new_data = MonthlyData(
            proj_id=data.proj_id,
            yyyymm=data.yyyymm,
            est_amt=data.est_amt,
            plan_amt=0,
            actual_amt=0
        )
        db.add(new_data)
        
    db.commit()
    return {"status": "success"}



##특정 월의 모든 실적을 **"최종 승인"*
class MonthlyFinalizeRequest(BaseModel):
    yyyymm: str
    user_id: Optional[str] = "admin" # 확정 처리자 ID

@router.post("/finalize-month")
def finalize_monthly_actuals(req: MonthlyFinalizeRequest, db: Session = Depends(get_db)):
    """
    특정 월의 실적 데이터를 최종 확정하고 플래그를 'Y'로 설정합니다.
    """
    # 1. 해당 월의 모든 MonthlyData를 조회
    # (실무적으로는 is_actual_finalized != 'Y' 인 건만 찾아야 하지만, 여기서는 전체를 갱신)
    
    db.query(MonthlyData)\
      .filter(MonthlyData.yyyymm == req.yyyymm)\
      .update(
          {
              MonthlyData.is_actual_finalized: 'Y',
              # 나중에 Actuals Finalized Date 컬럼도 추가 가능
          },
          synchronize_session=False
      )
      
    db.commit()
    
    return {"status": "success", "message": f"{req.yyyymm} 실적 최종 확정 완료."}