# opex-backend/app/schemas/project.py
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# 1. 기본 속성 (ProjectBase) - NOT NULL 필드를 포함합니다.
class ProjectBase(BaseModel):
    # ▼▼▼ [필수 확인] dept_code와 fiscal_year가 여기에 있어야 합니다. ▼▼▼
    proj_name: str = Field(..., description="사업명")
    dept_code: str = Field(..., description="담당 부서 코드 (A, B, C)") 
    fiscal_year: str = Field(..., description="회계 연도")
    
    # 2. CONTRACT & ATTRIBUTES
    prev_proj_id: Optional[str] = None
    vendor_id: Optional[str] = None
    svc_id: Optional[str] = None
    budget_nature: Optional[str] = None 
    report_class: Optional[str] = None
    exec_appr_no: Optional[str] = None
    is_shared: Optional[str] = 'N'
    shared_ratio: Optional[float] = 0.0
    is_prepay: Optional[str] = 'N'
    
    # ... (나머지 Optional 필드 생략) ...


# 2. 등록용 스키마 (ProjectCreate)
class ProjectCreate(ProjectBase):
    """월별 금액 리스트 포함"""
    monthly_amounts: List[int]

# 3. 조회용 스키마 (Project) - Response Validation 용도
class Project(ProjectBase):
    """ProjectMaster의 모든 필드를 담아 Response합니다."""
    proj_id: str
    proj_status: str
    created_at: datetime
    
    # ▼▼▼ DB Model에 있는 모든 추가 필드들을 Optional로 정의하여 누락을 방지합니다. ▼▼▼
    
    # AUDIT/CONTROL
    updated_at: Optional[datetime] = None
    memo: Optional[str] = None
    
    # GL & COST CENTER
    gl_account: Optional[str] = None
    cost_center_code: Optional[str] = None
    
    # BULK UPLOAD 속성 (DB 모델의 모든 필드와 일치해야 함)
    vendor_name_text: Optional[str] = None
    contract_period: Optional[str] = None
    responsible_dept: Optional[str] = None
    # ... (생략된 기타 모든 필드도 여기에 포함되어 있어야 합니다!) ...
    
    class Config:
        # 이 옵션이 DB 객체를 Pydantic으로 자동 변환하는 핵심입니다.
        from_attributes = True