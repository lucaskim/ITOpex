from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form, status
from sqlalchemy.orm import Session
from typing import List
import pandas as pd

import io
import re
from sqlalchemy import func
import logging

from app.core.database import get_db
from app.models.project import ProjectMaster, MonthlyData 
from app.schemas.project import Project, ProjectCreate, ProjectUpdate

from app.api.v1.closing import is_month_closed# 마감 체크용

from app.models.transfer import BudgetTransfer
from app.schemas.transfer import TransferRequest, TransferLog
from app.models.project import MonthlyData # MonthlyData 테이블 필요
from app.models.account import BudgetCodeMaster # 기준정보 모델 임포트 필요
from collections import defaultdict



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
def read_projects(fiscal_year: str, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # 1. **[수정]** 요청받은 연도에 해당하는 사업만 조회하도록 필터링
    db_projects = db.query(ProjectMaster)\
                 .filter(ProjectMaster.fiscal_year == fiscal_year)\
                 .order_by(ProjectMaster.created_at.desc())\
                 .offset(skip).limit(limit).all()
    # 2. 월별 데이터 한 번에 조회 (N+1 문제 방지)
    proj_ids = [p.proj_id for p in db_projects]
    
    
    # 해당 프로젝트들의 월별 데이터만 필터링하여 조회
    monthly_data_list = db.query(MonthlyData).filter(
        MonthlyData.proj_id.in_(proj_ids),
        MonthlyData.yyyymm.startswith(fiscal_year)
    ).all()
    
    # 3. 데이터 구조화 (딕셔너리 형태로 변환)
    project_monthly_map = defaultdict(dict)
    for md in monthly_data_list:
        #project_monthly_map[md.proj_id][md.yyyymm] = md.plan_amt
        #project_monthly_map[md.proj_id][md.yyyymm] = float(md.plan_amt) if md.plan_amt is not None else 0.0
        # float() 변환 시도 및 None/누락 값에 대한 안전한 폴백
        plan_amt_value = float(md.plan_amt) if md.plan_amt is not None else 0.0
        project_monthly_map[md.proj_id][md.yyyymm] = plan_amt_value
        
    # 4. Pydantic 응답 생성
    response_list = []
    for db_proj in db_projects:
        # [수정] 1. ORM 객체의 속성을 딕셔너리로 수동 변환
        proj_response_data = {}
        
        # db_proj의 __dict__를 사용하여 모든 속성을 딕셔너리로 복사합니다.
        # ORM 객체의 속성만 복사하고 SQLAlchemy 관련 메타데이터는 제외합니다.
        for column in db_proj.__table__.columns:
            proj_response_data[column.name] = getattr(db_proj, column.name)
            
        # 2. 월별 계획 데이터를 딕셔너리에 추가
        proj_response_data['monthly_plans'] = project_monthly_map.get(db_proj.proj_id, {})
        
        # 3. Pydantic 스키마에 정의된 이름으로 최종 데이터 정리 (수동 매핑)
        # NOTE: ORM의 budget_nature_type을 Pydantic의 budget_nature_type 필드에 할당합니다.
        proj_response_data['budget_nature_type'] = db_proj.budget_nature_type
        proj_response_data['vendor_name_text'] = db_proj.vendor_name_text

        # 4. 완성된 딕셔너리로 최종 Pydantic 객체 생성 (이제 from_attributes=False이므로 안전합니다.)
        # proj_response_data는 이제 Project 스키마의 모든 필드를 포함해야 합니다.
        response_list.append(Project(**proj_response_data))
    return response_list

# ==========================================
# 2. 신규 사업 등록 (POST /) - 단건 등록용
# ==========================================
@router.post("/", response_model=Project)
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
        
        
        # [수정] 1. 예산 성격(budget_nature) 유효성 검사
        if proj.budget_nature:
            # IT_TYPE 코드 기준정보에서 해당 ID가 존재하는지 확인
            it_code = db.query(BudgetCodeMaster).filter(
                BudgetCodeMaster.code_id == proj.budget_nature,
                BudgetCodeMaster.code_type == 'IT_TYPE' # IT 분류 타입에 해당하는지 확인
            ).first()
            
            if not it_code:
                raise HTTPException(
                    status_code=400, 
                    detail=f"예산 성격 코드 '{proj.budget_nature}'는 유효한 IT 분류 코드에 해당하지 않습니다."
                )
        
       
        
        # 1. 마스터 데이터 저장 (Pydantic to ORM Mapping)
        db_proj = ProjectMaster(
            # 1. CORE KEYS & IDENTIFIERS (필수 필드)
            proj_id=new_id,
            proj_name=proj.proj_name,
            fiscal_year=proj.fiscal_year,
            dept_code=proj.dept_code,

            # 2. AUDIT & CONTINUITY
            prev_proj_id=proj.prev_proj_id, 
            # ORM: continuity_status <--- Pydantic: proj_continuity (스키마가 ProjectCreate라면 이 필드를 받는지 확인 필요)
            # continuity_status=proj.proj_continuity, 
            # status_prev_year=proj.prev_status, # 스키마에 있다면 매핑

            # 3. GL & COST CENTER (Pydantic 스키마에 있다면 매핑)
            # gl_account=proj.gl_account,
            # cost_center_code=proj.cost_center_code,
            
            # 4. CONTRACT & MANAGEMENT ATTRIBUTES
            vendor_id=proj.vendor_id, 
            # vendor_name_text=proj.vendor_name_text,
            # contract_period=proj.contract_period,
            # vendor_location=proj.collaboration_type, # ORM 필드명과 Pydantic 필드명 확인
            # responsible_user=proj.responsible_person,
            # responsible_dept=proj.responsible_dept,
            contract_nature=proj.contract_nature, # ORM에 동일 이름으로 존재
            # business_allocation=proj.location_alloc, # ORM 필드명과 Pydantic 필드명 확인
            
            # 5. BUDGET CLASSIFICATION (필드명 충돌 해결)
            svc_id=proj.svc_id, # ORM 필드명과 Pydantic 필드명이 동일해야 함
            
            # ORM: budget_nature_type <--- Pydantic: budget_nature
            budget_nature_type=proj.budget_nature, 
            
            # ORM: report_class_type <--- Pydantic: report_class
            report_class_type=proj.report_class,
            
            # ORM: budget_it_type <--- Pydantic: budget_it_text
            # budget_it_type=proj.budget_it_text, 
            
            # 6. SYSTEM CONTROLS
            # is_ito=proj.it_integration_target,
            is_prepay=proj.is_prepay,
            prepay_id=proj.prepay_id,
            shared_ratio=proj.shared_ratio,
            # memo=proj.memo,
        )
        db.add(db_proj)
        db.flush() 

        # 2. 월별 데이터 저장
        for i, amt in enumerate(proj.monthly_amounts):
            month_str = f"{proj.fiscal_year}{str(i+1).zfill(2)}"
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
    
    
    
# 3. 사업 수정 (PATCH /{proj_id})
@router.patch("/{proj_id}", response_model=Project)
def update_project(proj_id: str, proj: ProjectUpdate, db: Session = Depends(get_db)):
    db_proj = db.query(ProjectMaster).filter(ProjectMaster.proj_id == proj_id).first()
    
    if db_proj is None:
        raise HTTPException(status_code=404, detail="Project not found")

    # 1. 월별 마감 상태 체크 (수정 전년도 1월 마감 여부 확인)
    if is_month_closed(db, f"{db_proj.fiscal_year}01"):
        raise HTTPException(status_code=403, detail=f"{db_proj.fiscal_year}년 데이터는 이미 마감되어 수정할 수 없습니다.")


    # 2. 마스터 데이터 업데이트
    update_data = proj.model_dump(exclude_unset=True, exclude_none=True)
    
    # monthly_amounts는 분리하여 처리
    monthly_amounts = update_data.pop("monthly_amounts", None) 
    
    for key, value in update_data.items():
        # ORM 객체의 속성을 Pydantic에서 받은 값으로 업데이트
        setattr(db_proj, key, value) 

    # 3. 월별 데이터 업데이트 (월별 금액이 전달된 경우)
    if monthly_amounts is not None:
        fiscal_year = db_proj.fiscal_year
        for i, amt in enumerate(monthly_amounts):
            month_str = f"{fiscal_year}{str(i+1).zfill(2)}"
            
            # 기존 월별 데이터를 찾거나 생성
            db_monthly = db.query(MonthlyData).filter(
                MonthlyData.proj_id == proj_id,
                MonthlyData.yyyymm == month_str
            ).first()

            amount = amt if amt is not None else 0
            
            if db_monthly:
                # 데이터가 존재하면 업데이트 (계획 금액만)
                db_monthly.plan_amt = amount
            else:
                # 데이터가 없으면 새로 생성
                db_monthly = MonthlyData(
                    proj_id=proj_id,
                    yyyymm=month_str,
                    plan_amt=amount
                )
            
            db.add(db_monthly)

    db.commit()
    db.refresh(db_proj)
    return db_proj




# 4. 사업 삭제 (DELETE /{proj_id})
@router.delete("/{proj_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(proj_id: str, db: Session = Depends(get_db)):
    db_proj = db.query(ProjectMaster).filter(ProjectMaster.proj_id == proj_id).first()
    
    if db_proj is None:
        raise HTTPException(status_code=404, detail="Project not found")

    # 1. 월별 마감 상태 체크
    if is_month_closed(db, f"{db_proj.fiscal_year}01"):
        raise HTTPException(status_code=403, detail=f"{db_proj.fiscal_year}년 데이터는 이미 마감되어 삭제할 수 없습니다.")

    try:
        # 2. 연결된 월별 데이터(MonthlyData) 모두 삭제
        db.query(MonthlyData).filter(MonthlyData.proj_id == proj_id).delete(synchronize_session='fetch')
        
        # 3. 마스터 데이터 삭제
        db.delete(db_proj)
        db.commit()
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"삭제 실패: {str(e)}")
    
    return    
    
    
    

# ==========================================
# 3. 사업 계획 마스터 일괄 등록 (POST /master/bulk)
# ==========================================
@router.post("/master/bulk")
async def upload_bulk_project_master(
    file: UploadFile = File(...), 
    year: str = Form(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="엑셀 파일만 업로드 가능합니다.")

    try:
        # 1. 파일 로드 및 데이터 정리
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        # Pandas DataFrame의 NaN(빈 값)은 None으로 처리
        df = df.where(pd.notnull(df), None) 
        
        # 2. **[핵심] 템플릿 헤더 목록 정의** (ProjectMasterTab.tsx에서 사용된 헤더 기준)
        # 이 목록은 엑셀 컬럼 이름과 정확히 일치해야 합니다.
        YEAR_HEADER = str(df.columns[0]) # '연도'
        INDEX_HEADER = str(df.columns[1]) # 'Index'
        
        # 월별 금액 헤더를 동적으로 추출 (예: '202501', '202502'...)
        PLAN_MONTHS_HEADERS = [col for col in df.columns if re.match(r'^\d{6}$', str(col))]

        if df.empty:
            raise HTTPException(status_code=400, detail="업로드된 파일에 데이터 행이 없습니다.")

        # 마감 체크: 연도 컬럼을 읽어 해당 연도의 1월이 마감되었는지 확인
        fiscal_year = str(df.iloc[0].get(YEAR_HEADER))
        if not fiscal_year:
            raise HTTPException(status_code=400, detail="엑셀 파일에 '연도' 컬럼 값이 없습니다.")
            
        first_month = f"{fiscal_year}01"
        if is_month_closed(db, first_month):
            raise HTTPException(status_code=403, detail=f"{fiscal_year}년 데이터는 이미 마감되어 수정할 수 없습니다.")


        results = {"total": 0, "inserted_proj": 0, "inserted_monthly": 0, "skipped": 0}
        
        # 3. 데이터 처리 및 삽입/업데이트
        for _, row in df.iterrows():
            results["total"] += 1
            
            # 1. 필수값 파싱 및 유효성 검사
            proj_id = str(row.get(INDEX_HEADER)) if row.get(INDEX_HEADER) else None
            proj_name = str(row.get('사업명')) if row.get('사업명') else None
            cost_center_name_raw = str(row.get('CC명칭')) if row.get('CC명칭') else None 
            
            final_dept_code = derive_dept_code(cost_center_name_raw) # 헬퍼 함수 호출
            
            # **[필수 체크] NOT NULL 컬럼 중 하나라도 없으면 스킵**
            if not proj_id or not fiscal_year or not proj_name or not final_dept_code:
                results["skipped"] += 1
                logger.warning(f"Skipped row {results['total']} due to missing required fields (Index, 사업명, CC명칭).")
                continue

            # **[핵심: 등록/업데이트 분기] 이미 존재하는 사업은 업데이트 (마스터 데이터 갱신 기능)**
            existing_proj = db.query(ProjectMaster).filter(
                ProjectMaster.proj_id == proj_id, 
                ProjectMaster.fiscal_year == fiscal_year
            ).first()
            
            if existing_proj:
                # 갱신 로직: 마스터 데이터 필드 업데이트
                db_proj = existing_proj 
                action = "Updated"
            else:
                # 신규 등록 로직
                db_proj = ProjectMaster(proj_id=proj_id)
                db_proj.fiscal_year = fiscal_year
                results["inserted_proj"] += 1
                action = "Inserted"


            # 2. ProjectMaster 테이블 필드 매핑 및 업데이트
            # 엑셀 헤더와 ProjectMaster ORM 필드를 1:1 매핑하여 업데이트합니다.
            db_proj.proj_name = proj_name
            db_proj.dept_code = final_dept_code # (NOT NULL)
            
            # **[핵심 매핑] 나머지 엑셀 컬럼들을 ORM 필드에 정확히 할당**
            db_proj.prev_proj_id = str(row.get('전년도 Index'))
            db_proj.continuity_status = str(row.get('사업 연속성'))
            db_proj.vendor_name_text = str(row.get('협력업체명'))
            db_proj.contract_period = str(row.get(f'{fiscal_year}년 계약기간(필수확인)')) # 동적 헤더
            db_proj.collaboration_type = str(row.get('협력'))
            db_proj.gl_account = str(row.get('계정'))
            db_proj.gl_account_name = str(row.get('계정명칭'))
            db_proj.cost_center_code = str(row.get('CC코드'))
            db_proj.cost_center_name = cost_center_name_raw
            db_proj.responsible_dept = str(row.get('담당부서'))
            db_proj.responsible_person = str(row.get('담당자'))
            db_proj.status_prev_year = str(row.get('전년도 사업상태'))
            db_proj.svc_id = str(row.get('서비스명'))
            db_proj.contract_nature = str(row.get('계약 성격'))
            db_proj.location_alloc = str(row.get('사업장 배분'))
            
            # 예산 분류 코드 (텍스트)
            db_proj.budget_l1_text = str(row.get('예산 분류(대2)'))
            db_proj.budget_l2_text = str(row.get('예산 분류(소2)'))
            db_proj.budget_nature = str(row.get('예산 성격'))
            db_proj.report_class = str(row.get('예산보고 분류'))
            db_proj.budget_it_text = str(row.get('예산 분류(IT)'))

            # Y/N 값 처리
            db_proj.it_integration_target = str(row.get('통합ITO 대상'))
            db_proj.prepay_target = str(row.get('선급 대상'))
            db_proj.prepay_id = str(row.get('선급ID'))
            
            # 숫자 값 처리
            try:
                db_proj.shared_ratio = float(row.get('Shared비율') or 0.0)
            except ValueError:
                db_proj.shared_ratio = 0.0

            db_proj.memo = str(row.get('사업 메모'))
            
            db.add(db_proj) # ORM 객체 추가/업데이트

            # 3. Monthly Data (YYYYMM별 계획 금액) 삽입/업데이트
            for month_header in PLAN_MONTHS_HEADERS:
                yyyymm = str(month_header)
                plan_amt_raw = row.get(month_header, 0) # 숫자 0으로 기본값 설정
                
                try:
                    # 쉼표 제거는 Pandas가 숫자 컬럼으로 로드 시 자동 처리되지만 안전을 위해 float로 변환 시도
                    plan_amt = float(plan_amt_raw) if plan_amt_raw is not None else 0
                except ValueError:
                    plan_amt = 0
                
                if plan_amt > 0:
                    # 해당 월의 MonthlyData 객체를 찾거나 새로 생성
                    db_monthly = db.query(MonthlyData).filter(
                        MonthlyData.proj_id == proj_id,
                        MonthlyData.yyyymm == yyyymm
                    ).first()

                    if db_monthly:
                        # 이미 있으면 계획 금액만 업데이트
                        db_monthly.plan_amt = plan_amt
                    else:
                        # 없으면 새로 생성
                        db_monthly = MonthlyData(
                            proj_id=proj_id,
                            yyyymm=yyyymm,
                            plan_amt=plan_amt,
                            actual_amt=0, est_amt=0
                        )
                    
                    db.add(db_monthly)
                    results["inserted_monthly"] += 1
                # 금액이 0이거나 None이면 업데이트/삽입을 건너뜁니다.
                
        db.commit()
        return {"status": "success", "message": f"총 {results['total']}건 처리 완료. (신규 등록: {results['inserted_proj']}건, 월별 계획 갱신: {results['inserted_monthly']}건)"}

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