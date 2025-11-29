// src/api/client.ts
import axios from 'axios';

// 백엔드(FastAPI) 주소
const API_BASE_URL = 'http://localhost:8000/api/v1';

// 1. 일반 데이터 전송용 (JSON)
const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. 파일 업로드용 (엑셀 등)
export const fileClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

export default client;