# app/models/sap.py
from sqlalchemy import Column, String, Integer, Numeric, TIMESTAMP, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class SapUploadRaw(Base):
    __tablename__ = "tb_sap_upload_raw"

    raw_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    
    # 1. 키 정보
    yyyymm = Column(String(6), index=True)      # 기준년월 (202307) - 전기일 가공
    fiscal_year = Column(String(4))             # 회계연도 (2023)
    slip_no = Column(String(50))                # 전표 번호
    line_item = Column(Integer)                 # 개별 항목 (Line Item) -> 중복 방지 핵심

    # 2. 계정 및 텍스트
    gl_account = Column(String(20))             # G/L 계정
    gl_desc = Column(String(100), nullable=True)# G/L 계정과목명
    header_text = Column(String(200))           # 텍스트 (핵심 파싱 대상)
    
    # 3. 금액
    amt_val = Column(Numeric(15, 0))            # 금액(현지 통화)
    currency = Column(String(10))               # 현지 통화 (KRW)
    
    # 4. 기타 정보
    vendor_text = Column(String(100), nullable=True) # 상계계정 명칭 (업체명)
    ref_key = Column(String(100), nullable=True)     # 참조 키(헤더) 1 (담당자 정보 등)
    cost_center = Column(String(20), nullable=True)  # 코스트 센터
    
    

    # 어떤 사업으로 매핑되었는지 ▼▼▼
    mapped_proj_id = Column(String(20), ForeignKey("tb_project_master.proj_id"), nullable=True) # 매핑된 사업 ID
    mapping_status = Column(String(20), default="UNMAPPED") # UNMAPPED, MAPPED, IGNORED


    upload_dt = Column(TIMESTAMP, server_default=func.now())