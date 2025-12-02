from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# 1. VendorBase: Core attributes for creation/update
class VendorBase(BaseModel):
    vendor_id: str = Field(..., max_length=20, description="계약 업체 고유 ID (사업자번호/법인번호)")
    vendor_name: str = Field(..., max_length=100, description="계약 업체명")
    biz_reg_no: Optional[str] = None # ORM에 전달하기 위한 필드
    
# 2. VendorCreate: Schema for creating a new vendor
class VendorCreate(VendorBase):
    pass

# 3. Vendor: Schema for reading/response
class Vendor(VendorBase):
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# 4. Bulk Upload Response Schema (for duplicate handling)
class BulkUploadResult(BaseModel):
    total_count: int
    success_count: int
    duplicate_count: int
    message: str
    duplicates: Optional[List[VendorCreate]] = None