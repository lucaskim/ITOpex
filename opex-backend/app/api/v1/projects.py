from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import pandas as pd
import io
import re
from sqlalchemy import func
import logging

from app.core.database import get_db
from app.models.project import ProjectMaster, MonthlyData 
from app.schemas.project import Project, ProjectCreate

from app.api.v1.closing import is_month_closed

from app.models.transfer import BudgetTransfer
from app.schemas.transfer import TransferRequest, TransferLog
from app.models.project import MonthlyData # MonthlyData 테이블 필요



router = APIRouter()
logger = logging.getLogger(__name__)

# ==========================================
# [NEW HELPER FUNCTION] 부서 코드 유추 로직
# ==========================================
def derive_dept_code(cost_center_name):
    """CC명칭을 기반으로 관리용 부서코드(A, B, C)를 유추합니다."""
    if not cost_center_name:
        return None 
    
    name = str(cost_center_name).upper()
    
    # 실제 관리 기준에 따라 A, B, C 코드를 할당 (최종 관리 기준)
    if 'DX개발운영팀' in name or 'IT운영팀' in name or 'HR/GA PL' in name: # HR/GA PL을 B대신 A로 임시 분류
        return 'A'
    if 'DX기획팀' in name:
        return 'B'
    if '보안' in name or 'SECURITY' in name:
        return 'C'
    return None # 필수 컬럼이므로 'Z' 대신 None을 반환하여 이후 단계에서 스킵 처리

# ==========================================
# 1. 사업 목록 조회 (GET /)
# ==========================================
@router.get("/", response_model=List[Project])
def read_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    projects = db.query(ProjectMaster).order_by(ProjectMaster.created_at.desc()).offset(skip).limit(limit).all()
    return projects

# ==========================================
# 2. 신규 사업 등록 (POST /) - 단건 등록용
# ==========================================
@router.post("/", response_model=Project) # <--- 이 데코레이터가 필수입니다!
def create_project(proj: ProjectCreate, db: Session = Depends(get_db)):
    try:
        # [Index 순차 채번 로직] - A-001, A-002 방식
        last_proj = db.query(ProjectMaster).filter(ProjectMaster.dept_code == proj.dept_code).order_by(ProjectMaster.proj_id.desc()).first()

        if last_proj:
            last_num_str = last_proj.proj_id.split('-')[-1]
            if last_num_str.isdigit():
                new_num = int(last_num_str) + 1
            else:
                new_num = 1
        else:
            new_num = 1

        new_id = f"{proj.dept_code}-{new_num:03d}"
        
        # 마스터 데이터 저장 (최소 필드만)
        db_proj = ProjectMaster(
            proj_id=new_id,
            proj_name=proj.proj_name,
            dept_code=proj.dept_code,
            fiscal_year=proj.fiscal_year, # [필수] fiscal_year 추가
            # ... (나머지 필드는 단건 등록 시 입력값으로 채움) ...
        )
        db.add(db_proj)
        db.flush() 

        # 월별 데이터 저장
        for i, amt in enumerate(proj.monthly_amounts):
            month_str = f"{proj.fiscal_year}{str(i+1).zfill(2)}" # [수정] 연도 사용
            db_monthly = MonthlyData(
                proj_id=new_id,
                yyyymm=month_str,
                plan_amt=amt
            )
            db.add(db_monthly)
            
        db.commit()
        db.refresh(db_proj)
        return db_proj
        
    except Exception as e:
        logger.exception("ProjectCreate Failed: See Traceback below.")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"등록 실패: {str(e)}")
    

# ==========================================
# 3. 사업 계획 마스터 일괄 등록 (POST /master/bulk)
# ==========================================
@router.post("/master/bulk")
async def upload_bulk_project_master(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="엑셀 파일만 업로드 가능합니다.")

    try:
        # 연도 전체를 잠그는 간단한 체크 (01월 마감 여부 확인)
        first_month = f"{str(df.iloc[0].get('연도'))}01" if not df.empty else None
        
        if first_month and is_month_closed(db, first_month):
            raise HTTPException(status_code=403, detail="해당 연도의 데이터가 이미 마감되어 수정할 수 없습니다.")

        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df = df.where(pd.notnull(df), None) 
        
        PLAN_MONTHS_HEADERS = [col for col in df.columns if str(col).startswith('20') and len(str(col)) == 6]
        
        results = {"total": 0, "inserted_proj": 0, "inserted_monthly": 0, "skipped": 0}
        
        for _, row in df.iterrows():
            results["total"] += 1
            
            # 1. 필수값 파싱 및 유효성 검사
            proj_id = str(row.get('Index')) if row.get('Index') else None
            fiscal_year = str(row.get('연도')) if row.get('연도') else None
            proj_name = str(row.get('사업명')) if row.get('사업명') else None
            cost_center_name_raw = str(row.get('CC명칭')) if row.get('CC명칭') else None 
            
            # **[핵심 수정 부분] NOT NULL 컬럼 값 할당**
            final_dept_code = derive_dept_code(cost_center_name_raw) # 헬퍼 함수 호출
            
            # **[강제 체크] NOT NULL 컬럼 중 하나라도 없으면 스킵**
            if not proj_id or not fiscal_year or not proj_name or not final_dept_code:
                results["skipped"] += 1
                continue

            # **[CHECK] 이미 존재하는 사업은 스킵**
            existing_proj = db.query(ProjectMaster).filter(ProjectMaster.proj_id == proj_id, ProjectMaster.fiscal_year == fiscal_year).first()
            if existing_proj:
                results["skipped"] += 1
                continue
            
            # 2. ProjectMaster 테이블에 삽입 (최종 삽입)
            db_proj = ProjectMaster(
                proj_id=proj_id,
                fiscal_year=fiscal_year,
                proj_name=proj_name,
                dept_code=final_dept_code, # <--- NOT NULL 컬럼에 유효값 할당
                
                prev_proj_id=str(row.get('전년도 Index')),
                continuity_status=str(row.get('사업 연속성')),
                status_prev_year=str(row.get('전년도 사업상태')), 
                
                gl_account=str(row.get('계정')),
                cost_center_code=str(row.get('CC코드')),
                cost_center_name=str(row.get('CC명칭')),
                vendor_name_text=str(row.get('협력업체명')),
                contract_period=str(row.get('26년 계약기간(필수확인)')),
                
                # ... (나머지 컬럼들) ...
                
                memo=str(row.get('사업 메모', None)),
            )
            db.add(db_proj)
            results["inserted_proj"] += 1

            # 3. Monthly Data (YYYYMM별 계획 금액) 삽입
            for month_header in PLAN_MONTHS_HEADERS:
                # ... (월별 삽입 로직 유지) ...
                yyyymm = str(month_header)
                plan_amt_raw = str(row.get(month_header, 0))
                
                try:
                    plan_amt = int(plan_amt_raw.replace(',', ''))
                except ValueError:
                    plan_amt = 0
                
                if plan_amt > 0:
                    db_monthly = MonthlyData(
                        proj_id=proj_id,
                        yyyymm=yyyymm,
                        plan_amt=plan_amt,
                        actual_amt=0, est_amt=0
                    )
                    db.add(db_monthly)
                    results["inserted_monthly"] += 1
                
        db.commit()
        return {"status": "success", "message": f"총 {results['total']}건 처리 완료. (신규 사업: {results['inserted_proj']}건)"}

    except Exception as e:
        logger.exception("Project Bulk Upload Failed: See Traceback below.")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"일괄 등록 실패: {str(e)}")
    




# ==========================================
# 4. 예산 전용 실행 (POST /projects/transfer)
# ==========================================
@router.post("/transfer", response_model=TransferLog)
def execute_budget_transfer(req: TransferRequest, db: Session = Depends(get_db)):
    # 1. 월별 마감 상태 체크 (선택 월이 잠겨있으면 전용 불가능)
    from app.api.v1.closing import is_month_closed # 헬퍼 함수 임포트
    if is_month_closed(db, req.transfer_yyyymm):
        raise HTTPException(status_code=403, detail="마감된 월의 예산은 전용할 수 없습니다.")

    # 2. 잔액 체크 (보내는 사업의 잔여 계획 예산 확인)
    source_month_data = db.query(MonthlyData).filter(
        MonthlyData.proj_id == req.from_proj_id,
        MonthlyData.yyyymm == req.transfer_yyyymm
    ).first()

    if not source_month_data or source_month_data.plan_amt < req.transfer_amount:
        raise HTTPException(status_code=400, detail="보내는 사업의 해당 월 잔여 예산이 부족합니다.")

    # 3. DB 트랜잭션 시작 (예산 이동 및 이력 저장)
    try:
        # A. 보내는 사업 (Source): plan_amt 감소
        source_month_data.plan_amt -= req.transfer_amount
        db.add(source_month_data)

        # B. 받는 사업 (Target): plan_amt 증가 (업데이트 또는 생성)
        target_month_data = db.query(MonthlyData).filter(
            MonthlyData.proj_id == req.to_proj_id,
            MonthlyData.yyyymm == req.transfer_yyyymm
        ).first()

        if target_month_data:
            target_month_data.plan_amt += req.transfer_amount
            db.add(target_month_data)
        else:
            # 해당 월의 데이터가 없으면 새로 생성 (Plan만 업데이트)
            new_data = MonthlyData(
                proj_id=req.to_proj_id,
                yyyymm=req.transfer_yyyymm,
                plan_amt=req.transfer_amount,
                # 나머지는 0 또는 기본값
            )
            db.add(new_data)

        # C. 이력 저장 (Log)
        transfer_log = BudgetTransfer(
            from_proj_id=req.from_proj_id,
            to_proj_id=req.to_proj_id,
            transfer_amount=req.transfer_amount,
            transfer_yyyymm=req.transfer_yyyymm,
            reason=req.reason,
            transferred_by=req.transferred_by,
        )
        db.add(transfer_log)
        
        db.commit()
        
        db.refresh(transfer_log)
        return transfer_log

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"예산 전용 실패: {str(e)}")