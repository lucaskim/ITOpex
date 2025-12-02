from sqlalchemy import Column, String, CHAR, TIMESTAMP, Integer, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

# 1. G/L 계정 마스터
class GLAccountMaster(Base):
    __tablename__ = "tb_gl_account_master"

    gl_account_code = Column(String(20), primary_key=True, index=True) # 예: 6663600
    gl_account_name = Column(String(100), nullable=False)              # 예: 관리비-지급수수료
    account_type = Column(String(50), nullable=True)                   # 예: 비용, 자산, 부채
    is_active = Column(CHAR(1), default='Y')
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

# 2. 예산 분류 코드 마스터
class BudgetCodeMaster(Base):
    __tablename__ = "tb_budget_code_master"

    code_id = Column(String(20), primary_key=True, index=True) # 예: B-001
    code_name = Column(String(100), nullable=False)            # 예: IT서비스 운영
    parent_code_id = Column(String(20), nullable=True)         # 상위 코드
    code_type = Column(String(50), nullable=False)             # 예: BUDGET_L1, BUDGET_L2
    sort_order = Column(Integer, default=0)
    is_active = Column(CHAR(1), default='Y')
    created_at = Column(TIMESTAMP, server_default=func.now())

# 3. [신규] 코스트 센터 마스터
class CostCenterMaster(Base):
    __tablename__ = "tb_cost_center_master"

    cc_code = Column(String(20), primary_key=True, index=True) # 예: 11001121
    cc_name = Column(String(100), nullable=False)              # 예: DX개발운영팀
    is_active = Column(CHAR(1), default='Y')
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())