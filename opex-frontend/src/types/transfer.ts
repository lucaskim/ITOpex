// src/types/transfer.ts (수정 후 최종 형태)

export interface TransferRequest {
    from_proj_id: string;
    to_proj_id: string;
    transfer_amount: number;
    transfer_yyyymm: string;
    reason?: string;
    transferred_by?: string; 
}

export interface TransferLog {
    transfer_id: number;
    from_proj_id: string;
    to_proj_id: string;
    transfer_amount: number;
    transfer_yyyymm: string;
    transferred_at: string; // string으로 유지
    reason?: string;
}