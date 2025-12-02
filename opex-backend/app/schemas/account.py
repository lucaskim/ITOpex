from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

# --- G/L Account Schemas ---
class GLAccountBase(BaseModel):
    gl_account_code: str = Field(..., description="G/L 계정 코드")
    gl_account_name: str = Field(..., description="계정 명칭")
    account_type: Optional[str] = None
    is_active: Optional[str] = 'Y'

class GLAccountCreate(GLAccountBase):
    pass

class GLAccount(GLAccountBase):
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# --- Budget Code Schemas ---
class BudgetCodeBase(BaseModel):
    code_id: str
    # ORM 모델의 code_name을 따릅니다.
    code_name: str 
    parent_code_id: Optional[str] = None
    code_type: str
    sort_order: Optional[int] = 0
    is_active: Optional[str] = 'Y'

# BudgetCode 생성을 위한 스키마 (code_id는 제거됨)
class BudgetCodeCreate(BaseModel):
    # code_id 필드가 제거되었으므로, 백엔드에서 자동 생성됨
    code_type: str  # 'BUDGET_L1', 'BUDGET_L2', 'IT_TYPE' 중 하나
    name: str # 프론트엔드에서 보내는 데이터 (views/api에서 code_name으로 매핑되어야 함)
    description: Optional[str] = None
    is_active: bool = True
    # L2 등록 시에만 사용 (L1의 code_id가 들어옴)
    parent_code_id: Optional[str] = None 
    
    class Config:
        from_attributes = True

class BudgetCode(BaseModel):
    code_id: str
    name: str # [추가] BudgetCodeBase 대신 여기에 name 필드를 추가하여 프론트엔드와 일치
    code_name: str # [유지] ORM 모델에서 넘어오는 필드를 유지하여 데이터 손실 방지
    parent_code_id: Optional[str] = None
    code_type: str
    sort_order: Optional[int] = 0
    is_active: str # DB의 CHAR(1)에 맞춤
    created_at: datetime
    
    # name 필드를 code_name 필드에서 읽어오도록 설정 (Alias 또는 Computed field 사용)
    # 현재 Pydantic v1 또는 v2 설정에 따라 name 필드를 처리해야 합니다.
    # 가장 간단한 해결책은 BudgetCodeBase를 code_name으로 유지하고, 프론트엔드에서 code_name을 name으로 사용하도록 수정하는 것입니다.
    # 하지만 이미 AccountTab.tsx에서 name을 사용하도록 변경했으므로, Pydantic 모델에 name을 추가합니다.
    
    class Config:
        from_attributes = True
        
class BudgetCode(BudgetCodeBase):
    created_at: datetime
    class Config:
        from_attributes = True        


# --- [신규] Cost Center Schemas ---
class CostCenterBase(BaseModel):
    cc_code: str = Field(..., description="코스트 센터 코드")
    cc_name: str = Field(..., description="코스트 센터 명칭")
    is_active: Optional[str] = 'Y'

class CostCenterCreate(CostCenterBase):
    pass

class CostCenter(CostCenterBase):
    created_at: datetime
    updated_at: Optional[datetime] = None
    class Config:
        from_attributes = True
        
        
        
        
class BudgetCodeUpdatePayload(BaseModel):
    # 프론트엔드 name -> 백엔드 code_name에 매핑
    name: Optional[str] = None
    is_active: Optional[bool] = None 
    parent_code_id: Optional[str | None] = None
    # description 필드는 ORM에 없다고 가정하고 제외함.