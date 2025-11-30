# app/schemas/vendor.py
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# 1. 공통 속성 (Base)
class VendorBase(BaseModel):
    vendor_name: str
    biz_reg_no: str
    sap_vendor_cd: Optional[str] = None
    vendor_alias: Optional[str] = None
    is_active: Optional[str] = 'Y'

# 2. 생성 시 필요한 속성 (Create)
class VendorCreate(VendorBase):
    pass # Base와 동일

# 3. 읽을 때 반환할 속성 (Response)
class Vendor(VendorBase):
    vendor_id: str
    created_at: datetime

    class Config:
        from_attributes = True # ORM 객체를 Pydantic 모델로 변환 허용