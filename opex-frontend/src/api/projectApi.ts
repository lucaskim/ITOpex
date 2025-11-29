import client, {fileClient} from './client';
import type { Project, ProjectCreate } from '../types';
import type { TransferRequest, TransferLog } from '../types/transfer';

export const getProjects = async () => {
  const response = await client.get<Project[]>('/projects/');
  return response.data;
};

export const createProject = async (data: ProjectCreate) => {
  const response = await client.post<Project>('/projects/', data);
  return response.data;
};


// 일괄 등록 실행
export const uploadBulkProject = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    // '/projects/upload-bulk' 엔드포인트 호출
    const response = await client.post('/projects/upload-bulk', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};


/**
 * [NEW] 연도별 사업계획 마스터 데이터를 일괄 등록합니다. (별도 메뉴)
 * @param formData - 파일과 연도 정보가 담긴 FormData
 */
export const uploadBulkProjectMaster = async (formData: FormData): Promise<any> => {
    try {
        // 엔드포인트는 연도별 마스터 데이터에 맞게 분리합니다.
        const response = await fileClient.post('/projects/master/bulk', formData);
        
        return response.data;
    } catch (error) {
        throw error;
    }
};



// ▼▼▼ [NEW] 예산 전용 실행 API ▼▼▼
export const executeBudgetTransfer = async (data: TransferRequest): Promise<TransferLog> => {
    const response = await client.post('/projects/transfer', data);
    return response.data;
};