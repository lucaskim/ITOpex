// src/api/serviceApi.ts
import client, { fileClient } from './client';
import type { Service, ServiceCreate } from '../types';

export const getServices = async () => {
  const response = await client.get<Service[]>('/services/');
  return response.data;
};

export const createService = async (data: ServiceCreate) => {
  const response = await client.post<Service>('/services/', data);
  return response.data;
};

export const uploadServicesBulk = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fileClient.post('/services/bulk-upload', formData);
  return response.data;
};