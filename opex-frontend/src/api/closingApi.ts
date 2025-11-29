// src/api/closingApi.ts
import client from './client';
import { message } from 'antd';

export interface ClosingStatus {
    yyyymm: string;
    status: 'OPEN' | 'CLOSED';
    closed_at?: string;
}

// 1. 특정 월 마감 상태 조회
export const getClosingStatus = async (yyyymm: string): Promise<ClosingStatus> => {
    try {
        const response = await client.get(`/closing/status/${yyyymm}`);
        return response.data;
    } catch (error) {
        // 데이터가 없으면 OPEN으로 간주 (백엔드 로직에 따름)
        return { yyyymm, status: 'OPEN' }; 
    }
};

// 2. 마감/해제 처리
export const updateClosingStatus = async (yyyymm: string, status: 'OPEN' | 'CLOSED') => {
    // 실제 서비스에서는 로그인된 사용자 ID를 넘겨야 하지만, 여기서는 임시로 'admin' 사용
    const user_id = 'admin'; 
    const response = await client.post('/closing/update', { yyyymm, status, user_id });
    message.success(response.data.message);
    return response.data;
};