// src/api/serviceApi.ts
import client from './client';
import type { Service, ServiceCreate } from '../types';

export const getServices = async () => {
  const response = await client.get<Service[]>('/services/');
  return response.data;
};

export const createService = async (data: ServiceCreate) => {
  const response = await client.post<Service>('/services/', data);
  return response.data;
};