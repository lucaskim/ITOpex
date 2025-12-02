# app/models/project.py
from sqlalchemy import Column, String, Date, Text, Numeric, ForeignKey, CHAR, TIMESTAMP, Integer, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base

# 1. 사업 마스터 테이블
class ProjectMaster(Base):
    __tablename__ = "tb_project_master"

    # 1. CORE KEYS & IDENTIFIERS
    proj_id = Column(String(20), primary_key=True, index=True) # Index (A-001)
    proj_name = Column(String(200), nullable=False)           # 사업명
    fiscal_year = Column(String(4), nullable=False)           # 연도 (2025)

    dept_code = Column(String(10), nullable=False)

    # 2. AUDIT & CONTINUITY
    prev_proj_id = Column(String(20), nullable=True)          # 전년도 Index
    continuity_status = Column(String(20), nullable=True)     # 사업 연속성 (계속, 신규)
    status_prev_year = Column(String(50), nullable=True)      # 전년도 사업상태 (비용집행중)
    
    # 3. GL & COST CENTER (재무 연결고리)
    gl_account = Column(String(10), nullable=True)            # 계정
    gl_account_name = Column(String(100), nullable=True)      # 계정명칭
    cost_center_code = Column(String(20), nullable=True)      # CC코드
    cost_center_name = Column(String(100), nullable=True)     # CC명칭
    
    # 4. CONTRACT & MANAGEMENT ATTRIBUTES
    vendor_id = Column(String(20), ForeignKey("tb_vendor_master.vendor_id"), nullable=True) # (FK)
    vendor_name_text = Column(String(100), nullable=True)     # 협력업체명 (매핑 전 텍스트)
    contract_period = Column(String(50), nullable=True)       # 26년 계약기간(필수확인)
    vendor_location = Column(String(20), nullable=True)       # 협력 (본사, 안동)
    responsible_user = Column(String(50), nullable=True)      # 담당자
    responsible_dept = Column(String(50), nullable=True)      # 담당부서
    contract_nature = Column(String(50), nullable=True)       # 계약 성격
    business_allocation = Column(String(50), nullable=True)   # 사업장 배분
    
    # 5. BUDGET CLASSIFICATION (분석 속성)
    budget_l2 = Column(String(100), nullable=True)            # 예산 분류(대2)
    budget_s2 = Column(String(100), nullable=True)            # 예산 분류(소2)
    budget_nature_type = Column(String(50), nullable=True)    # 예산 성격
    budget_nature = Column(String(50), nullable=True) # <-- 이 필드가 있는지 확인
    svc_id = Column(String(50), nullable=True)        # <-- 이 필드가 있는지 확인
    report_class_type = Column(String(50), nullable=True)     # 예산보고 분류
    budget_it_type = Column(String(50), nullable=True)        # 예산 분류(IT) <--- NEW
    
    # 6. SYSTEM CONTROLS
    proj_status = Column(String(20), default="PENDING")
    is_ito = Column(CHAR(1), default='N')                     # 통합ITO 대상
    is_prepay = Column(CHAR(1), default='N')                  # 선급 대상
    prepay_id = Column(String(50), nullable=True)             # 선급ID <--- NEW
    shared_ratio = Column(Float, default=0.0)                 # Shared비율 <--- NEW
    
    # 추가 필드 (원래 있던 컬럼)
    memo = Column(Text, nullable=True)

    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    # (선택) 관계 설정: 나중에 project.vendor.vendor_name 처럼 쓰려면 필요
    # vendor = relationship("VendorMaster")
    # service = relationship("ServiceMaster")


# 2. 월별 데이터 테이블 (Detail)
class MonthlyData(Base):
    __tablename__ = "tb_monthly_data"

    data_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    proj_id = Column(String(20), ForeignKey("tb_project_master.proj_id"), nullable=False)
    yyyymm = Column(String(6), nullable=False) # 202501
    
    plan_amt = Column(Numeric(15,0), default=0)   # 계획 (VAT 별도)
    actual_amt = Column(Numeric(15,0), default=0) # 실적 (SAP)
    est_amt = Column(Numeric(15,0), default=0)    # 추정
    confirmed_amt = Column(Numeric(15,0), default=0) 
    
    is_confirmed = Column(CHAR(1), default='N')
    remark = Column(String(500), nullable=True)

    project = relationship("ProjectMaster", backref="monthly_data")

    is_actual_finalized = Column(CHAR(1), default='N') # 실적 확정 여부 (Y: 최종 승인)
