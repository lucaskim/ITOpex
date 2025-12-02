import axios from 'axios';
import type { Vendor, VendorCreate, BulkUploadResult } from '../types';

/*
type UploadItem = {
    // Antd Upload item typically exposes originFileObj which is the original File object.
    originFileObj?: File | null;
    // some wrappers might use `file` property instead
    file?: File | null;
    // allow any extra fields to keep compatibility with different upload item shapes
    [key: string]: any;
};*/

const API_BASE_URL = 'http://127.0.0.1:8000/api/v1/vendors';

// 1. 업체 목록 조회
export const getVendors = async (): Promise<Vendor[]> => {
    const response = await axios.get(API_BASE_URL);
    return response.data;
};

// 2. 신규 업체 단건 등록
export const createVendor = async (data: VendorCreate): Promise<Vendor> => {
    const response = await axios.post(API_BASE_URL, data);
    return response.data;
};

// 3. 업체 일괄 등록 (덮어쓰기 옵션 포함)
export const uploadBulkVendor = async (file: File, overwrite: boolean = false): Promise<BulkUploadResult<VendorCreate>> => {
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('overwrite_duplicates', overwrite.toString());

    // NOTE: Content-Type 헤더를 명시적으로 제거해야 Axios가 boundary를 포함한 
    //       올바른 'multipart/form-data' 헤더를 자동 생성합니다.
    const response = await axios.post(`${API_BASE_URL}/bulk-upload`, formData, {
        headers: {
            Accept: 'application/json',
        },
    });
    return response.data;
};