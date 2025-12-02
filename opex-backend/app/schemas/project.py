# opex-backend/app/schemas/project.py
from pydantic import BaseModel, Field
# [수정] Dict 타입을 임포트 목록에 추가합니다.
from typing import Optional, List, Dict 
from datetime import datetime

# 1. ProjectBase는 현재 사용되지 않으므로 제거하거나, 
# ProjectMasterCreate가 이를 상속받도록 유지할 경우, 아래 코드를 유지해야 합니다.
# 여기서는 코드를 간결하게 유지하기 위해 ProjectBase를 ProjectMasterCreate에 통합하는 것을 권장합니다.
# (사용자가 제공한 ProjectBase 코드는 그대로 유지합니다.)
class ProjectBase(BaseModel):
    """
    사업계획 마스터의 공통 기준 필드를 정의합니다.
    이 필드는 ProjectCreate, ProjectUpdate가 상속받습니다.
    """
    # 1. CORE KEYS (NOT NULL)
    proj_name: str = Field(..., description="사업명")
    dept_code: str = Field(..., description="담당 부서 코드 (A, B, C)") 
    fiscal_year: str = Field(..., description="회계 연도")
    
    # 2. ACCOUNTING & SERVICE (오류 해결 필드 포함)
    vendor_id: Optional[str] = None
    vendor_name_text: Optional[str] = None # ORM의 Vendor Name Text
    svc_id: Optional[str] = None           # <-- 이전 오류 필드 (ORM에 존재)
    gl_account: Optional[str] = None       # <-- G/L 계정 코드 추가
    cost_center_code: Optional[str] = None # <-- CC 코드 추가
    
    # 3. BUDGET CLASSIFICATION & NATURE (오류 해결 필드 포함)
    budget_nature: Optional[str] = None    # <-- ORM budget_nature_type에 매핑될 값
    budget_nature_type: Optional[str] = None
    # [필수 추가] 현재 오류를 일으킨 필드
    contract_nature: Optional[str] = None  # <-- 현재 오류 필드
    
    report_class: Optional[str] = None     # 예산 보고 분류
    
    # 4. CONTINUITY & CONTROL
    prev_proj_id: Optional[str] = None
    exec_appr_no: Optional[str] = None
    is_shared: Optional[str] = 'N'
    shared_ratio: Optional[float] = 0.0
    is_prepay: Optional[str] = 'N'
    prepay_id: Optional[str] = None        # 선급 ID
    
    
    monthly_plans: Dict[str, float] = {}
    
    # NOTE: 단일 등록 시 'proj_status'나 'created_at' 같은 시스템 필드는 제외합니다.
    class Config:
        from_attributes = False


# --- 1. 월별 계획 상세 등록 스키마 (Plan Detail) ---
class ProjectPlanCreate(BaseModel):
    month: str = Field(..., description="연월 (YYYYMM)")
    amount: float = Field(..., description="계획 금액")
    
# =================================================================
# [추가] 2. 단일 등록용 스키마 (ProjectCreate) 복원
# 기존 projects.py 파일의 POST / API에서 사용하는 스키마입니다.
# =================================================================
class ProjectCreate(ProjectBase):
    """단일 건 등록 시 월별 금액 리스트를 받는 스키마"""
    monthly_amounts: List[int] # 단일 건 등록 시 12개월 금액을 리스트로 받습니다.
    
    # ProjectBase 외에 다른 필드를 추가하지 않고 월별 금액만 받습니다.    
 
# =================================================================
# 2. 사업 마스터 및 월별 계획 수정용 스키마
# =================================================================    
class ProjectUpdate(BaseModel):
    """사업 마스터 및 월별 계획 수정용 스키마"""
    
    # 마스터 데이터 필드 (ProjectBase 필드들을 Optional로 만듭니다.)
    proj_name: Optional[str] = None
    dept_code: Optional[str] = None
    fiscal_year: Optional[str] = None
    
    # ... (ProjectBase의 나머지 필드들도 모두 Optional로 추가) ...
    prev_proj_id: Optional[str] = None
    vendor_id: Optional[str] = None
    svc_id: Optional[str] = None
    budget_nature: Optional[str] = None
    # ... (나머지 수정 가능한 마스터 필드) ...

    # 월별 금액 리스트 (전체 12개월을 모두 보내는 경우에 사용)
    monthly_amounts: Optional[List[Optional[float]]] = None    
    
# --- 2. Project Master 생성 스키마 (Create) ---
# ProjectBase를 상속받지 않고 모든 필드를 명시적으로 정의하는 것이 명확합니다.
# ProjectBase의 필드를 포함하고 엑셀 컬럼에 대응되는 모든 필드를 명시합니다.
class ProjectMasterCreate(ProjectBase): # ProjectBase 상속을 유지할 경우
    """사업계획 마스터 테이블 등록에 필요한 모든 필드"""
    
    # ProjectBase에 없는 나머지 엑셀 컬럼 필드를 명시적으로 추가합니다.
    # 참고: ProjectBase에 있는 fiscal_year, proj_name, dept_code는 상속됨
    
    # 2. Key/Identifier Fields
    prev_index: Optional[str] = Field(None, description="전년도 Index (proj_id)")
    proj_continuity: Optional[str] = Field(None, description="사업 연속성")
    
    # 3. Vendor & Service
    vendor_name_text: Optional[str] = Field(None, description="협력업체명")
    contract_period: Optional[str] = Field(None, description="계약기간")
    collaboration_type: Optional[str] = Field(None, description="협력 구분")
    # svc_id: ProjectBase에 있으므로 생략
    contract_nature: Optional[str] = Field(None, description="계약 성격")
    location_alloc: Optional[str] = Field(None, description="사업장 배분")
    
    # 4. Accounting & Budget Codes
    gl_account: Optional[str] = Field(None, description="계정 (G/L 코드)")
    cost_center_code: Optional[str] = Field(None, description="CC 코드")
    budget_l1_text: Optional[str] = Field(None, description="예산 분류(대2)") 
    budget_l2_text: Optional[str] = Field(None, description="예산 분류(소2)")
    # budget_nature: ProjectBase에 있으므로 생략
    # report_class: ProjectBase에 있으므로 생략
    budget_it_text: Optional[str] = Field(None, description="예산 분류(IT)")
    
    # 5. Control & Status
    responsible_dept: Optional[str] = Field(None, description="담당부서 (텍스트)")
    responsible_person: Optional[str] = Field(None, description="담당자")
    prev_status: Optional[str] = Field(None, description="전년도 사업상태")
    it_integration_target: Optional[str] = Field(None, description="통합ITO 대상 (Y/N)")
    prepay_target: Optional[str] = Field(None, description="선급 대상 (Y/N)")
    prepay_id: Optional[str] = Field(None, description="선급ID")
    # shared_ratio: ProjectBase에 있으므로 생략
    memo: Optional[str] = Field(None, description="사업 메모")
    
    # ORM에 없는 필드(예: vendor_name_text)는 매핑 시 주의 필요
    
# 3. 월별 금액을 포함하는 최종 벌크 등록 요청 스키마
class ProjectBulkCreate(BaseModel):
    """벌크 등록 시 엑셀 한 행의 모든 데이터를 담는 컨테이너"""
    
    # 마스터 데이터 (ProjectMaster 테이블에 저장)
    master: ProjectMasterCreate
    
    # 월별 계획 데이터 (ProjectPlanDetail 테이블에 저장)
    # key: YYYYMM, value: amount
    monthly_plan: Dict[str, float]


# 4. 조회용 스키마 (Response)
class Project(BaseModel):
    # ProjectMasterCreate의 필드를 모두 포함하거나 ProjectMasterCreate를 상속받아야 함.
    # 여기서는 필수 필드 외에 조회에 필요한 필드를 추가 정의합니다.
    proj_id: str
    proj_name: str
    fiscal_year: str
    proj_status: str = Field(..., description="사업 상태")
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # [수정] Config 클래스를 Project 클래스 내부에 위치시켜야 합니다.
    class Config:
        from_attributes = False