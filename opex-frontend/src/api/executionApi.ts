// src/api/executionApi.ts
import client from './client';
import type { MonthlyStatus } from '../types';

// 1. 월별 현황 조회 API 호출
export const getMonthlyStatus = async (yyyymm: string) => {
  // 백엔드: GET /api/v1/execution/{yyyymm}
  const response = await client.get<MonthlyStatus[]>(`/execution/${yyyymm}`);
  return response.data;
};

// 2. 추정 금액 수정 API 호출
export const updateForecast = async (proj_id: string, yyyymm: string, est_amt: number) => {
  // 백엔드: POST /api/v1/execution/update-forecast
  const response = await client.post('/execution/update-forecast', { 
    proj_id, 
    yyyymm, 
    est_amt 
  });
  return response.data;
};


// ▼▼▼ [NEW] 월별 실적 최종 확정 API ▼▼▼
export const finalizeMonthlyActuals = async (yyyymm: string) => {
    const user_id = 'admin'; // 임시 사용자 ID
    const response = await client.post('/execution/finalize-month', { yyyymm, user_id });
    return response.data;
};