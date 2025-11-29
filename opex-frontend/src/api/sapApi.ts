// src/api/sapApi.ts
import client from './client';

// 자동 매핑 실행
export const runAutoMapping = async () => {
  const response = await client.post('/sap/run-mapping');
  return response.data;
};

// (나중에 쓸 것) Raw 데이터 조회
export const getSapRawData = async () => {
  // ...
};


// 미매핑 데이터 조회
export const getUnmappedSapData = async () => {
  const response = await client.get<any[]>('/sap/unmapped');
  return response.data;
};

// 수동 매핑 실행
export const manualMapSapData = async (raw_ids: number[], target_proj_id: string) => {
  const response = await client.post('/sap/manual-map', { raw_ids, target_proj_id });
  return response.data;
};