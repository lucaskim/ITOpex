// src/api/utilsApi.ts
import client from './client';

export const getAvailableYears = async () => {
    const response = await client.get<number[]>('/utils/years');
    return response.data;
};