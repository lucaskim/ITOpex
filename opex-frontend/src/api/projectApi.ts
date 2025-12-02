import client, {fileClient} from './client';
import type { Project, ProjectCreate } from '../types';
import type { TransferRequest, TransferLog } from '../types/transfer';
import dayjs from 'dayjs';

export const getProjects = async (year: string) => {
    // year 값이 없으면 기본값으로 현재 연도를 사용합니다 (Frontend의 방어적 로직)
    const finalYear = year || dayjs().format('YYYY');
    // 백엔드 API 호출 시 쿼리 파라미터로 year를 전달합니다.
    const response = await client.get<Project[]>(`/projects/?fiscal_year=${finalYear}`); 
  return response.data;
};

export const createProject = async (data: ProjectCreate) => {
  const response = await client.post<Project>('/projects/', data);
  return response.data;
};


// [신규] 사업계획 수정 요청 시 사용되는 타입 (PATCH 요청 페이로드)
// 백엔드 ProjectUpdate 스키마와 일치해야 하며, 모두 Optional입니다.
export interface ProjectUpdate {
    proj_name?: string;
    dept_code?: string;
    fiscal_year?: string;
    prev_proj_id?: string;
    vendor_id?: string;
    svc_id?: string;
    budget_nature?: string;
    report_class?: string;
    exec_appr_no?: string;
    is_shared?: string;
    shared_ratio?: number;
    is_prepay?: string;
    
    // 월별 금액 리스트 (12개월 전체를 배열로 보낼 때 사용)
    monthly_amounts?: (number | null)[]; 
}


// 5. 사업계획 수정 (PATCH)
export const updateProject = async (projId: string, data: ProjectUpdate) => {
    // PATCH 요청은 수정할 필드만 포함합니다.
    // [수정] cleanedData를 ProjectUpdate 타입으로 정의합니다.
    const cleanedData: ProjectUpdate = {};

    const dataWithIndex = data as Record<string, any>;

// key는 이제 안전하게 string으로 처리됩니다.
    // [수정] data 대신 dataWithIndex를 사용하여 타입 오류를 우회합니다.
    for (const key in dataWithIndex) { 
        // null 또는 undefined 값은 페이로드에서 제외
        if (dataWithIndex[key] !== null && dataWithIndex[key] !== undefined) { 
            // [수정] cleanedData[key]에 값을 할당할 때도 캐스팅을 적용합니다.
            (cleanedData as Record<string, any>)[key] = dataWithIndex[key]; 
        }
    }

    const response = await client.patch(`/projects/${projId}`, cleanedData); 
    return response.data;
};

// 6. 사업계획 삭제 (DELETE)
export const deleteProject = async (projId: string) => {
    // 204 No Content가 예상되므로, 응답 데이터는 없습니다.
    await client.delete(`/projects/${projId}`); 
};

// 일괄 등록 실행
// export const uploadBulkProjectMaster = async (file: File, year: string, overwrite: boolean = false): Promise<any> => {
    
//     // FormData 객체를 직접 받습니다.
//     // NOTE: overwrite 매개변수는 formData 내부에 string으로 포함되어 전송됩니다.
    
//     // Content-Type을 명시적으로 추가하여 안정화합니다.
//     try{
//         const formData = new FormData();
//         formData.append('file', file);
//         formData.append('year', year); // 년도 정보를 Form 데이터에 추가
//         formData.append('overwrite_duplicates', overwrite.toString()); // 덮어쓰기 옵션 추가
        
        
        
//         const response = await client.post('/projects/master/bulk', formData, {
//             headers: {
//                 'Content-Type': 'multipart/form-data', 
//             },
//         });
//         return response.data;

//     }catch (error) {
//          throw error;
//     }
// };


export const uploadBulkProjectMaster = async (formData: FormData) => {
    // Axios가 FormData를 감지하고 자동으로 Content-Type을 multipart/form-data로 설정합니다.
    const response = await client.post('/projects/master/bulk', formData, {
        // Content-Type을 명시적으로 undefined로 설정하여 Axios가 multipart/form-data로 인식하게 함
        headers: {
            'Content-Type': undefined 
        }
    }); 
    return response.data;
};


// ▼▼▼ [NEW] 예산 전용 실행 API ▼▼▼
export const executeBudgetTransfer = async (data: TransferRequest): Promise<TransferLog> => {
    const response = await client.post('/projects/transfer', data);
    return response.data;
};