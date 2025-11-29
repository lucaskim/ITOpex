// src/types/index.ts

// 반드시 앞에 'export'가 붙어 있어야 합니다!
export interface Vendor {
  vendor_id: string;      // 업체코드 (V0001)
  biz_reg_no: string;     // 사업자번호
  vendor_name: string;    // 업체명
  sap_vendor_cd?: string; // SAP 코드 (선택)
  vendor_alias?: string;  // 검색 별칭 (선택)
  is_active: string;      // Y/N
  created_at: string;     // 생성일시
}

export interface VendorCreate {
  vendor_name: string;
  biz_reg_no: string;
  sap_vendor_cd?: string;
  vendor_alias?: string;
  is_active?: string;
}

export interface Service {
  svc_id: string;
  svc_name: string;
  contract_type?: string;
  is_resident: string;
  operator_names?: string;
  is_active: string;
}

export interface ServiceCreate {
  svc_name: string;
  contract_type?: string;
  is_resident: string;
  operator_names?: string;
  is_active?: string;
}

export interface Project {
  proj_id: string;
  proj_name: string;
  dept_code: string;
  fiscal_year: string;    // [필수] 연도 추가됨
  proj_status: string;
  
  vendor_id?: string;
  svc_id?: string;
  budget_nature?: string;
  // 필요한 경우 여기에 report_class 등 조회 시 필요한 필드 추가 가능
}

export interface ProjectCreate {
  proj_name: string;
  dept_code: string;
  fiscal_year: string;       // [핵심] 이 필드가 있어서 에러가 해결됩니다.
  
  vendor_id?: string | null; // null 허용 (폼에서 선택 안함)
  svc_id?: string | null;
  budget_nature?: string | null;
  report_class?: string | null; // [수정] 여기도 null 허용 추가
  
  monthly_amounts: number[]; // [1000, 2000, ...]
}

export interface MonthlyStatus {
  proj_id: string;
  proj_name: string;
  dept_code: string;
  vendor_name?: string;
  plan_amt: number;   // 계획
  actual_amt: number; // SAP 실적
  est_amt: number;    // 추정 (입력값)
  is_actual_finalized?: string; // 실적 확정 여부
}

export interface ClosingStatus {
    yyyymm: string;
    status: 'OPEN' | 'CLOSED';
    closed_at?: string;
}