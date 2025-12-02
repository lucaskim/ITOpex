import React, { useEffect, useState, useMemo } from 'react';
import { Table, Card, Button, Modal, Form, Input, message, Alert, Upload, Spin, Tag} from 'antd';
import { PlusOutlined, ReloadOutlined, UploadOutlined, InboxOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

import { getVendors, createVendor, uploadBulkVendor } from '../../api/vendorApi';
import type { Vendor, VendorCreate, BulkUploadResult } from '../../types';

const { Dragger } = Upload;

// [UI] 벤더 업체 등록 및 관리 컴포넌트
const VendorMasterTab: React.FC = () => {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(false);
    
    // 단건 등록 State
    const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
    const [singleForm] = Form.useForm<VendorCreate>();

    // 벌크 등록 State
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [fileList, setFileList] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    // 중복 결과를 담는 핵심 State
    const [bulkResult, setBulkResult] = useState<BulkUploadResult<VendorCreate> | null>(null);

    // 1. 데이터 로드
    const loadVendors = async () => {
        setLoading(true);
        try {
            const data = await getVendors();
            setVendors(data);
        } catch (err) {
            message.error('업체 목록 로드 실패');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadVendors(); }, []);

    // 2. 단건 등록 처리
    const handleCreateSingle = async (values: VendorCreate) => {
        try {
            await createVendor(values);
            message.success(`업체 ${values.vendor_name}이(가) 성공적으로 등록되었습니다.`);
            setIsSingleModalOpen(false);
            singleForm.resetFields();
            loadVendors();
        } catch (error: any) {
            const detail = error.response?.data?.detail;
            message.error(`등록 실패: ${detail || '서버 오류'}`);
        }
    };

    // 3. 템플릿 다운로드
    const downloadTemplate = () => {
        const headers = ['업체 ID', '업체명'];
        const sample = [['120-81-01111', '(주)카카오'], ['110-10-00000', 'SK(주) C&C']];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "VendorTemplate");
        try {
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            saveAs(new Blob([wbout], { type: "application/octet-stream" }), `계약업체_일괄등록_템플릿.xlsx`);
        } catch (e) {
            message.error("다운로드 실패");
        }
    };

    // 4. 일괄 등록 실행 (첫 시도 - 중복 체크 로직 포함)
    const handleBulkUpload = async (overwrite: boolean = false) => {
        if (fileList.length === 0) {
            message.warning('업로드할 엑셀 파일을 선택해주세요.');
            return;
        }

       // ▼▼▼ [최종 수정] fileToUpload 변수를 정의합니다. ▼▼▼
        // originFileObj가 가장 정확한 File 객체입니다.
        const fileToUpload = fileList[0].originFileObj; 

        // 1. File 객체 유효성 검사 (str 전송 방지)
        if (!(fileToUpload instanceof File)) {
             message.error("파일 객체 추출 실패: 파일을 다시 드래그해 주세요.");
             console.error("Critical File Error: Expected 'File', received:", fileToUpload);
             return;
        }
        // ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲

        setUploading(true);
        
        try {
            // 파일을 File 객체로 전달
            //const result = await uploadBulkVendor(fileList[0].originFileObj, overwrite);
            const result = await uploadBulkVendor(fileToUpload, overwrite);
            
            if (result.duplicate_count > 0 && !overwrite) {
                // 중복 발견, 덮어쓰기 옵션이 없으므로, 사용자에게 선택 요청
                setBulkResult(result);
            } else {
                // 등록 성공 또는 중복 덮어쓰기 성공
                message.success(result.message);
                setIsBulkModalOpen(false);
                setFileList([]);
                setBulkResult(null);
                loadVendors();
            }

        } catch (error: any) {
            message.error('일괄 등록 실패: ' + (error.response?.data?.detail || '서버 오류'));
            setBulkResult(null); 
        } finally {
            setUploading(false);
        }
    };
    
    // Upload 컴포넌트 속성
    const uploadProps = useMemo(() => ({
        name: 'file', multiple: false, fileList,
        accept: '.xlsx,.xls',
        onRemove: () => setFileList([]),
        beforeUpload: (file: any) => {
            const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
            if (!isExcel) {
                message.error('엑셀 파일만 업로드할 수 있습니다!');
                return Upload.LIST_IGNORE;
            }
            
            // AntD가 file 객체를 변경하기 전에, 원본 파일을 originFileObj에 담아 저장합니다.
            setFileList([{ 
                ...file, 
                uid: file.uid || new Date().getTime(),
                originFileObj: file, // 🚨 file 객체 자체가 File 타입이므로, 이를 원본으로 저장
            }]);

            setBulkResult(null);
            return false; // 파일 업로드 대신 수동으로 처리
        },
    }), [fileList]);


    const columns = [
        { title: '업체 ID (사업자번호)', dataIndex: 'vendor_id', width: 150, fixed: 'left' as const },
        { title: '업체명', dataIndex: 'vendor_name', width: 250 },
        { title: '상태', dataIndex: 'is_active', width: 100, render: (isActive: boolean) => (
            <Tag color={isActive ? 'green' : 'red'}>{isActive ? '활성' : '비활성'}</Tag>
        )},
        { title: '등록일', dataIndex: 'created_at', width: 180, render: (date: string) => new Date(date).toLocaleDateString() },
    ];

    return (
        <Spin spinning={loading}>
            <div className="p-4 bg-white rounded-lg shadow-md">
                <Card title="계약 업체 마스터 관리" extra={
                    <div className="flex space-x-2">
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsSingleModalOpen(true)}>
                            단건 등록
                        </Button>
                        <Button icon={<UploadOutlined />} onClick={() => setIsBulkModalOpen(true)}>
                            일괄 등록
                        </Button>
                        <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
                            템플릿 다운로드
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={loadVendors}>
                            새로고침
                        </Button>
                    </div>
                } className="mb-4">
                    <Table 
                        dataSource={vendors} 
                        columns={columns} 
                        rowKey="vendor_id" 
                        size="small" 
                        scroll={{ x: 800 }} 
                        pagination={{ pageSize: 15 }} 
                    />
                </Card>
            </div>

            {/* 1. 단건 등록 Modal */}
            <Modal
                title="신규 계약 업체 단건 등록"
                open={isSingleModalOpen}
                onCancel={() => { setIsSingleModalOpen(false); singleForm.resetFields(); }}
                footer={null} // <--- 닫는 버튼을 Form 내부에 위치시키기 위해 footer 숨김
            >
                <Form form={singleForm} layout="vertical" onFinish={handleCreateSingle}>
                    <Form.Item
                        label="업체 ID (사업자/법인번호)"
                        name="vendor_id"
                        rules={[{ required: true, message: '업체 ID는 필수입니다.' }]}
                    >
                        <Input placeholder="예: 120-81-01111 (고유값)" />
                    </Form.Item>
                    <Form.Item
                        label="업체명"
                        name="vendor_name"
                        rules={[{ required: true, message: '업체명은 필수입니다.' }]}
                    >
                        <Input placeholder="예: (주)카카오" />
                    </Form.Item>
                    {/* [핵심] Form 내부의 Submit 버튼 */}
                    <Form.Item className="text-right mt-4">
                        <Button onClick={() => setIsSingleModalOpen(false)} className="mr-2">취소</Button>
                        <Button type="primary" htmlType="submit">등록</Button>
                    </Form.Item>
                </Form>
            </Modal>

            {/* 2. 일괄 등록 Modal (중복 처리 UI 포함) */}
            <Modal
                title="계약 업체 정보 엑셀 일괄 등록"
                open={isBulkModalOpen}
                width={700}
                onCancel={() => { 
                    setIsBulkModalOpen(false); 
                    setFileList([]); 
                    setBulkResult(null); // 모달 닫을 때 모두 초기화
                }}
                footer={bulkResult && bulkResult.duplicate_count > 0 ? (
                    // 중복이 발견된 경우 (재확인) - 사용자 요청 반영 UI
                    [
                        <Button key="cancel" onClick={() => setIsBulkModalOpen(false)}>닫기</Button>,
                        <Button key="skip" onClick={() => { message.info('중복 항목을 제외하고 등록 요청을 진행합니다.'); handleBulkUpload(false); }} disabled={uploading} className="mr-2">
                            중복 제외 등록
                        </Button>,
                        <Button key="overwrite" type="primary" danger onClick={() => handleBulkUpload(true)} loading={uploading}>
                            전체 덮어쓰기 실행
                        </Button>
                    ]
                ) : (
                    // 일반 등록 시 (덮어쓰기 옵션 없이 첫 시도)
                    [
                        <Button key="cancel" onClick={() => setIsBulkModalOpen(false)}>취소</Button>,
                        <Button key="submit" type="primary" onClick={() => handleBulkUpload(false)} disabled={fileList.length === 0 || uploading}>
                            {uploading ? '처리 중' : '등록 실행 (중복 검사 시작)'}
                        </Button>
                    ]
                )}
            >
                {bulkResult && bulkResult.duplicate_count > 0 ? (
                    // --- 중복 발견 UI: 덮어쓰기 선택 필요 ---
                    <Card size="small" className="bg-red-50 border-red-200" title={<span className="text-red-600">🚨 중복 업체 ID 발견!</span>} style={{ marginBottom: 16 }}>
                        <p className="mb-2"><strong>총 {bulkResult.total_count}건</strong> 중 **{bulkResult.duplicate_count}건**이 기존 DB에 존재하는 업체 ID와 일치합니다.</p>
                        <Alert 
                            type="warning"
                            message="처리 선택 필요"
                            description="중복된 항목을 DB에서 갱신(덮어쓰기)할지, 아니면 해당 항목을 제외하고 등록할지 선택해 주세요."
                            showIcon 
                            className="mb-3"
                        />
                        <div className="max-h-40 overflow-auto border rounded p-2 bg-white">
                            <p className="font-semibold text-sm mb-1">중복 목록 (최대 5개 표시)</p>
                            {bulkResult.duplicates?.slice(0, 5).map(v => (
                                <Tag key={v.vendor_id} color="red">{v.vendor_name} ({v.vendor_id})</Tag>
                            ))}
                            {bulkResult.duplicate_count > 5 && <p className="text-xs mt-1">... 외 {bulkResult.duplicate_count - 5}건</p>}
                        </div>
                    </Card>
                ) : (
                    // --- 일반 업로드 UI ---
                    <div className="space-y-4">
                        <Alert message="템플릿 형식 준수" description="헤더명('업체 ID', '업체명')을 정확히 지켜주세요." type="info" showIcon />
                        <Dragger {...uploadProps} height={150}>
                            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                            <p className="ant-upload-text">파일을 드래그하거나 클릭하여 업로드</p>
                            <p className="ant-upload-hint">단일 엑셀 파일만 지원합니다.</p>
                        </Dragger>
                        {fileList.length > 0 && <Alert type="success" message={`선택된 파일: ${fileList[0].name}`} showIcon />}
                    </div>
                )}
                
            </Modal>
        </Spin>
    );
};

export default VendorMasterTab;