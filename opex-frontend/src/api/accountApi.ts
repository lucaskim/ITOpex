import client from './client';
//import { BudgetCodeCreate as BudgetCodeCreateSchema } from '../schemas/account';

// --- Type Definitions ---

export interface GLAccount {
    gl_account_code: string;
    gl_account_name: string;
    account_type?: string;
    is_active: string;
}

export interface BudgetCode {
    code_id: string;
    // 백엔드에서 code_name을 사용하고 있으므로, 컬럼명을 code_name으로 유지하고
    // AccountTab.tsx에서 테이블 dataIndex를 'code_name'으로 사용하는 것이 안전합니다.
    code_name: string; 
    parent_code_id?: string | null; // null 허용
    code_type: string;
    sort_order: number;
    // 백엔드에서 CHAR(1)을 'Y'/'N'으로 보내거나, FastAPI가 bool로 변환해줄 수 있으나, 
    // 현재 ORM 모델이 CHAR(1)이므로 string으로 유지하는 것이 안전합니다.
    is_active: string; 
}

// [신규] 코스트 센터 타입
export interface CostCenter {
    cc_code: string;
    cc_name: string;
    is_active: string;
}

// [추가] BudgetCode 생성 시 필요한 타입을 여기서 직접 정의합니다.
// 백엔드 schemas/account.py의 BudgetCodeCreate 스키마와 동일해야 합니다.
export interface BudgetCodeCreate {
    code_type: string;
    name: string;
    description?: string;
    is_active: boolean; // 백엔드 스키마와 일치
    parent_code_id?: string | null;
}

// --- API Functions ---

// 1. G/L Account API
export const getGLAccounts = async () => {
    const response = await client.get<GLAccount[]>('/accounts/gl');
    return response.data;
};

export const createGLAccount = async (data: GLAccount) => {
    const response = await client.post('/accounts/gl', data);
    return response.data;
};

// 2. Budget Code API
export const getBudgetCodes = async (codeType?: string) => {
    const url = codeType ? `/accounts/budget-code?code_type=${codeType}` : '/accounts/budget-code';
    const response = await client.get<BudgetCode[]>(url);
    return response.data;
};

export const createBudgetCode = async (data: BudgetCodeCreate) => {
    const response = await client.post('/accounts/budget-code', data);
    return response.data;
};

// 3. [신규] Cost Center API
export const getCostCenters = async () => {
    const response = await client.get<CostCenter[]>('/accounts/cost-center');
    return response.data;
};

export const createCostCenter = async (data: CostCenter) => {
    const response = await client.post('/accounts/cost-center', data);
    return response.data;
};


// [신규] BudgetCode 업데이트 시 사용하는 타입 (PATCH 요청용)
export interface BudgetCodeUpdate {
    name?: string; 
    is_active?: boolean; 
    parent_code_id?: string | null;
}

// 2. Budget Code API (추가)

// [신규] 예산 분류 코드 수정 API
export const updateBudgetCode = async (codeId: string, data: BudgetCodeUpdate) => {
    // PATCH 요청 사용
    const response = await client.patch<BudgetCode>(`/accounts/budget-code/${codeId}`, data); 
    return response.data;
};

// [신규] 예산 분류 코드 삭제 API
export const deleteBudgetCode = async (codeId: string) => {
    await client.delete(`/accounts/budget-code/${codeId}`); 
};