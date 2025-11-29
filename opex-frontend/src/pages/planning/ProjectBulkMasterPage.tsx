import React, { useState, useEffect } from 'react';
import { 
    Card, Button, Modal, message, Upload, Alert, Select, Spin, 
    Row, Col 
} from 'antd';
import { 
    DownloadOutlined, UploadOutlined, InboxOutlined, CheckCircleOutlined, ReloadOutlined 
} from '@ant-design/icons';

// 엑셀 라이브러리 및 파일 저장 import (설치 필요)
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

import { uploadBulkProjectMaster } from '../../api/projectApi';
import { getAvailableYears } from '../../api/utilsApi';

const { Dragger } = Upload; 
const { Option } = Select;   

const ProjectBulkMasterPage: React.FC = () => {
    // === 1. 상태 관리 ===
    const [fileList, setFileList] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [availableYears, setAvailableYears] = useState<number[]>([]); 

    // 2. 관리 연도 목록 로드 (2022년부터 현재+2년까지)
    const fetchYears = async () => {
        try {
            const yearsData = await getAvailableYears();
            setAvailableYears(yearsData);
            
            const currentYear = new Date().getFullYear();
            if (yearsData.includes(currentYear)) {
                setSelectedYear(currentYear); 
            } else if (yearsData.length > 0) {
                setSelectedYear(yearsData[yearsData.length - 1]);
            }
        } catch (error) {
            message.error('연도 정보 로드 실패');
        }
    }

    // 템플릿 다운로드 기능 구현
    const downloadTemplate = (year: number) => {
        // ▼▼▼ 새 컬럼 구조 반영 (마스터 데이터 및 계획 월별 컬럼만 포함) ▼▼▼
        const headers = [
            '연도', 'Index', '전년도 Index', '사업 연속성', '사업명', '협력업체명', 
            `${year}년 계약기간(필수확인)`, '협력', '계정', '계정명칭', 'CC코드', 'CC명칭', 
            '담당부서', '담당자', '전년도 사업상태', '서비스명', '계약 성격', '사업장 배분', 
            '예산 분류(대2)', '예산 분류(소2)', '예산 성격', '예산보고 분류', '예산 분류(IT)', 
            '통합ITO 대상', '선급 대상', '선급ID', 'Shared비율', 
            // 월별 계획 금액 컬럼 (DB에서 파싱할 이름)
            `${year}01`, `${year}02`, `${year}03`, `${year}04`, `${year}05`, `${year}06`,
            `${year}07`, `${year}08`, `${year}09`, `${year}10`, `${year}11`, `${year}12`,
            '사업 메모'
        ];

        // 샘플 데이터 (예시 값)
        const sampleData = [
            [
                year, 'A-001', 'A-01', '계속', 'SLA 용역료 - 본사', 'SK(주)', 
                `${year}.01.01~${year}.12.31`, '본사', '6663600', '관리비-지급수수료', 
                '11001121', 'DX개발운영팀', 'IT운영팀', '김병윤', '비용집행중', '전사 공통', '통합ITO', 'Y', 
                '1. IT서비스 운영', '공통 시스템', '용역 인건비', '1. 용역 인건비', 'DT',
                'N', 'N', '', 0.358, 
                385109063, 385109063, 385109063, 385109063, 385109063, 385109063, 
                385109063, 385109063, 385109063, 385109063, 385109063, 385109063, '자동 이관된 SLA 비용'
            ],
        ];
        // ▲▲▲ ▲▲▲ ▲▲▲

        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "사업계획_마스터");
        
        const fileName = `사업계획_마스터_템플릿_${year}.xlsx`;
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        
        try {
            saveAs(new Blob([wbout], { type: "application/octet-stream" }), fileName);
            message.success("템플릿 다운로드가 완료되었습니다.");
        } catch (e) {
            message.error("파일 다운로드 중 오류가 발생했습니다.");
        }
    };


    useEffect(() => { 
        fetchYears(); 
    }, []); 


    // 3. 일괄 등록 실행 핸들러 (Bulk Master Upload)
    const handleBulkUpload = async () => {
        if (fileList.length === 0 || !selectedYear) {
            message.warning('대상 연도와 템플릿 파일을 모두 선택해주세요.');
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', fileList[0]);
            formData.append('year', selectedYear.toString());
            
            const res = await uploadBulkProjectMaster(formData); 
            
            setSuccessMessage(res.message);
            setIsSuccessModalOpen(true);
            setFileList([]);
            
        } catch (error: any) {
            message.error('마스터 등록 실패: ' + (error.response?.data?.detail || '서버 오류'));
        } finally {
            setUploading(false);
        }
    };

    // 4. AntD Dragger 설정 (드래그 시 동작 정의)
    const uploadProps = {
        name: 'file', multiple: false, fileList,
        onRemove: () => setFileList([]),
        beforeUpload: (file: any) => {
            const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
            if (!isExcel) {
                message.error('엑셀 파일만 업로드할 수 있습니다!');
                return Upload.LIST_IGNORE;
            }
            setFileList([file]);
            return false;
        },
    };

    return (
        <div style={{ padding: 20 }}>
            <h3>⭐ 연도별 사업계획 마스터 등록</h3>
            <Card style={{ marginBottom: 20 }} title="등록 옵션 선택" size="small">
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>대상 연도:</p>
                    <Select
                        style={{ width: 120 }}
                        value={selectedYear}
                        onChange={setSelectedYear}
                        loading={availableYears.length === 0}
                    >
                        {availableYears.map(y => <Option key={y} value={y}>{y}년</Option>)}
                    </Select>
                    
                    {/* 구현된 다운로드 함수 연결 */}
                    <Button 
                        icon={<DownloadOutlined />} 
                        onClick={() => downloadTemplate(selectedYear)} 
                    >
                        템플릿 다운로드
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={fetchYears}>
                        연도 목록 갱신
                    </Button>
                </div>
            </Card>

            <Card title="엑셀 파일 업로드" size="small">
                <Alert 
                    message="마스터 등록 주의사항" 
                    description="선택된 연도의 사업계획 마스터 데이터를 일괄로 등록/갱신합니다. (연초 확정 데이터)" 
                    type="info" 
                    showIcon 
                    style={{ marginBottom: 16 }}
                />
                <Dragger {...uploadProps} style={{ height: 200 }}>
                    {/* ▼▼▼ P 태그를 SPAN 태그로 변경합니다! ▼▼▼ */}
                    <span className="ant-upload-drag-icon">{uploading ? <Spin /> : <InboxOutlined />}</span>
                    <span className="ant-upload-text">
                        파일을 드래그하거나 클릭하여 업로드
                    </span>
                    {fileList.length > 0 && <p className="ant-upload-hint">{fileList[0].name} ({selectedYear}년도)</p>}
                </Dragger>
                
                <Button 
                    type="primary" 
                    icon={<UploadOutlined />} 
                    loading={uploading} 
                    onClick={handleBulkUpload} 
                    disabled={fileList.length === 0 || uploading}
                    style={{ marginTop: 20 }}
                >
                    {selectedYear}년도 마스터 등록 실행
                </Button>
            </Card>

            {/* 성공 피드백 모달 */}
            <Modal
                open={isSuccessModalOpen}
                onCancel={() => setIsSuccessModalOpen(false)}
                footer={[<Button key="ok" type="primary" onClick={() => setIsSuccessModalOpen(false)}>확인</Button>]}
            >
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 48, marginBottom: 20 }} />
                    <h4>마스터 등록 성공</h4>
                    <p>{successMessage}</p>
                </div>
            </Modal>
        </div>
    );
};

export default ProjectBulkMasterPage;