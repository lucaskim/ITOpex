// src/api/vendorApi.ts
import client from './client';
// 'type' 키워드를 꼭 붙여야 합니다!
import type { Vendor, VendorCreate } from '../types';

// 1. 목록 조회
export const getVendors = async () => {
  const response = await client.get<Vendor[]>('/vendors/');
  return response.data;
};

// 2. 신규 등록
export const createVendor = async (data: VendorCreate) => {
  const response = await client.post<Vendor>('/vendors/', data);
  return response.data;
};