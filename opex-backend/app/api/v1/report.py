# app/api/v1/report.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Dict, Any

from app.core.database import get_db
from app.models.project import ProjectMaster, MonthlyData

router = APIRouter()

@router.get("/budget-vs-actual")
def get_budget_vs_actual(year: str = "2025", db: Session = Depends(get_db)):
    """
    부서별/사업별 예실 대비 현황 집계
    """
    # 1. 데이터 조회 (Project + MonthlyData Join)
    # 월별 데이터를 연간 합계로 집계
    results = db.query(
        ProjectMaster.dept_code,
        ProjectMaster.proj_id,
        ProjectMaster.proj_name,
        func.sum(MonthlyData.plan_amt).label("total_plan"),
        func.sum(MonthlyData.actual_amt).label("total_actual"),
        func.sum(MonthlyData.est_amt).label("total_est")
    ).join(
        MonthlyData, ProjectMaster.proj_id == MonthlyData.proj_id
    ).filter(
        MonthlyData.yyyymm.like(f"{year}%") # 해당 연도만
    ).group_by(
        ProjectMaster.dept_code,
        ProjectMaster.proj_id,
        ProjectMaster.proj_name
    ).all()

    # 2. 데이터 가공 (JSON 변환)
    data = []
    for r in results:
        # 실적이 있으면 실적, 없으면 추정치를 사용해 집행액 계산 (Forecast View)
        forecast_spend = int(r.total_actual or 0) # 여기선 확정 실적만 봄 (필요시 est 합산)
        plan = int(r.total_plan or 0)
        
        rate = 0.0
        if plan > 0:
            rate = (forecast_spend / plan) * 100

        data.append({
            "dept_code": r.dept_code,
            "proj_id": r.proj_id,
            "proj_name": r.proj_name,
            "plan_amt": plan,
            "actual_amt": forecast_spend,
            "diff_amt": plan - forecast_spend, # 잔여 예산
            "burn_rate": round(rate, 1)
        })
    
    return data