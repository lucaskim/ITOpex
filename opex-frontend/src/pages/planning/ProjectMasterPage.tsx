import React, { useEffect, useState } from 'react';
import { Table, Card, Button, Modal, Form, Input, Select, InputNumber, message, Row, Col, Alert, Upload } from 'antd';
import { PlusOutlined, ReloadOutlined, DownloadOutlined, UploadOutlined, InboxOutlined } from '@ant-design/icons';
import dayjs from 'dayjs'; // 날짜 라이브러리 (필수)

import { getProjects, createProject, uploadBulkProject } from '../../api/projectApi';
import { getVendors } from '../../api/vendorApi';
import { getServices } from '../../api/serviceApi';
import type { Project, ProjectCreate } from '../../types';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';


const { Dragger } = Upload;
const { Option } = Select;

// [필수 헬퍼 함수] 폼에서 넘어온 빈 값('', undefined)을 null로 변환합니다.
const cleanPayload = (values: any) => {
    const cleaned: any = {};
    for (const key in values) {
        if (values[key] === '' || values[key] === undefined || values[key] === null) {
            cleaned[key] = null;
        } else {
             cleaned[key] = values[key];
        }
    }
    return cleaned;
};

const ProjectMasterPage: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    
    // 모달 및 로딩 상태
    const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [fileList, setFileList] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    // 1. 데이터 초기화 (프로젝트 목록, 드롭다운 옵션)
    const initData = async () => {
        setLoading(true);
        try {
            const [pData, vData, sData] = await Promise.all([
                getProjects(),
                getVendors(),
                getServices()
            ]);
            setProjects(pData);
            setVendors(vData);
            setServices(sData);
        } catch (err) {
            message.error('초기 데이터 로드 실패');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { initData(); }, []);

    const testSubmissionLinkage = () => {
        alert("링크 테스트 성공! 이 창이 뜨면 함수 연결은 맞습니다.");
    };

    // 2. 단일 등록 처리 (Single Registration) - [최종 수정 로직]
    const handleCreate = async (values: any) => {
        alert("함수 시작!"); // 디버깅용 alert은 제거했습니다.
        try {
            // 1. 월별 금액 배열 생성
            const amounts = [];
            for(let i=1; i<=12; i++) {
                amounts.push(values[`month_${i}`] ? Number(values[`month_${i}`]) : 0);
            }

            // 2. [핵심 수정] fiscal_year를 먼저 values 객체에 주입
            const currentYear = dayjs().format('YYYY');
            values.fiscal_year = currentYear; // <--- 이 부분이 누락되지 않도록 주입!

            // 3. 폼 데이터를 정리 (null 안전성 확보)
            const cleanedValues = cleanPayload(values); 

            // 4. Payload 객체 최종 생성
            const payload: ProjectCreate = { 
                // 필수 필드와 선택 필드를 명시적으로 지정
                proj_name: cleanedValues.proj_name,
                dept_code: cleanedValues.dept_code,
                fiscal_year: cleanedValues.fiscal_year, // cleanedValues에서 가져오기
                monthly_amounts: amounts,
                
                // 나머지 선택 필드
                vendor_id: cleanedValues.vendor_id || null,
                svc_id: cleanedValues.svc_id || null,
                budget_nature: cleanedValues.budget_nature || null,
                report_class: cleanedValues.report_class || null,
            };

            // 5. API 호출
            await createProject(payload);
            
            message.success('사업 계획이 등록되었습니다.');
            setIsSingleModalOpen(false);
            form.resetFields();
            initData();

        } catch (error: any) {
            console.error("API Error:", error);
            if (error.response && error.response.status === 422) {
                // Pydantic 상세 에러를 프론트엔드에 토스트로 출력
                const detail = error.response.data.detail;
                const msg = Array.isArray(detail) 
                    ? detail.map((e: any) => `${e.loc.join('->')}: ${e.msg}`).join(', ')
                    : '데이터 형식이 올바르지 않습니다.';
                message.error(`유효성 검사 실패: ${msg}`);
            } else {
                 message.error('저장 실패: ' + (error.response?.data?.detail || '서버 오류'));
            }
        }
    };

    // 3. 일괄 등록 실행 (Bulk Upload)
    const handleBulkUpload = async () => {
        if (fileList.length === 0) {
            message.warning('템플릿 파일을 선택해주세요.');
            return;
        }
        setUploading(true);
        try {
            const res = await uploadBulkProject(fileList[0]);
            message.success(res.message);
            setIsBulkModalOpen(false);
            setFileList([]);
            initData();
        } catch (error: any) {
            message.error('일괄 등록 실패: ' + (error.response?.data?.detail || '서버 오류'));
        } finally {
            setUploading(false);
        }
    };

    // 4. 템플릿 다운로드 및 Dragger 설정
    const downloadTemplate = () => {
        // ... (템플릿 다운로드 로직 유지) ...
        const headers = ['부서 코드', '사업명', '연도', '1월 계획', '2월 계획', '3월 계획', '4월 계획', '5월 계획', '6월 계획', '7월 계획', '8월 계획', '9월 계획', '10월 계획', '11월 계획', '12월 계획'];
        const sample = [['A', '샘플 사업', dayjs().format('YYYY'), 100000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        try {
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            saveAs(new Blob([wbout], { type: "application/octet-stream" }), `사업계획_일괄등록_템플릿.xlsx`);
        } catch (e) {
            message.error("다운로드 실패");
        }
    };

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

    const columns = [
        { title: 'Index', dataIndex: 'proj_id', width: 100, fixed: 'left' as const },
        { title: '사업명', dataIndex: 'proj_name', width: 200 },
        { title: '부서', dataIndex: 'dept_code', width: 80 },
        { title: '연도', dataIndex: 'fiscal_year', width: 80 },
        { title: '상태', dataIndex: 'proj_status', width: 100 },
        { title: '업체ID', dataIndex: 'vendor_id', width: 100 },
    ];

    // Form.submit()을 Modal 확인 버튼에 연결하기 위한 AntD 표준 구조
    const submitInternalForm = () => {
        // Modal의 OK 버튼 클릭 시 Form 내부의 onFinish를 호출
        alert("submitInternalForm 내부");
        form.submit();
    };

    return (
        <div style={{ padding: 20 }}>
            <h3>📝 사업 계획 관리22222</h3>
            <Card style={{ marginBottom: 20 }} size="small">
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsSingleModalOpen(true)}>
                        신규 사업 등록 (단건)
                    </Button>
                    <Button icon={<UploadOutlined />} onClick={() => setIsBulkModalOpen(true)}>
                        일괄 등록 (간편)
                    </Button>
                    <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>
                        템플릿 다운로드
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={initData}>
                        새로고침
                    </Button>
                </div>
            </Card>

            <Table dataSource={projects} columns={columns} rowKey="proj_id" loading={loading} scroll={{ x: 900 }} size="small" bordered />

            {/* 단일 등록 Modal */}
            <Modal 
                title="신규 사업 및 예산 등록" 
                open={isSingleModalOpen} 
                width={800} 
                onCancel={() => setIsSingleModalOpen(false)} 
                //footer={null} // <--- [수정 1] Modal의 기본 OK/Cancel 버튼을 숨깁니다.
                onOk={submitInternalForm} //<--- 이 부분은 삭제되거나 주석 처리됩니다.
            >
                <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ dept_code: 'A' }}>
                    <Card size="small" title="1. 기본 정보" style={{ marginBottom: 16 }}>
                        <Row gutter={16}>
                            <Col span={12}><Form.Item label="사업명" name="proj_name" rules={[{ required: true, message: '필수' }]}><Input /></Form.Item></Col>
                            <Col span={6}>
                                <Form.Item label="부서" name="dept_code" rules={[{ required: true, message: '필수' }]}>
                                    <Select>
                                        <Option value="A">DX운영(A)</Option><Option value="B">DX기획(B)</Option><Option value="C">보안(C)</Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={6}><Form.Item label="예산성격" name="budget_nature"><Input /></Form.Item></Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item label="계약 업체" name="vendor_id">
                                    <Select showSearch optionFilterProp="label" allowClear>
                                        {vendors.map(v => (<Option key={v.vendor_id} value={v.vendor_id} label={v.vendor_name}>{v.vendor_name}</Option>))}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item label="대상 서비스" name="svc_id">
                                    <Select allowClear>
                                        {services.map(s => (<Option key={s.svc_id} value={s.svc_id}>{s.svc_name}</Option>))}
                                    </Select>
                                </Form.Item>
                            </Col>
                        </Row>
                    </Card>
                    <Card size="small" title="2. 월별 예산 계획 (VAT 별도)">
                        <Row gutter={8}>
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                                <Col span={6} key={m}>
                                    <Form.Item label={`${m}월`} name={`month_${m}`} rules={[{ required: m === 1, message: m === 1 ? '최소 1월 예산은 필수' : undefined }]}>
                                        <InputNumber style={{ width: '100%' }} formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number} />
                                    </Form.Item>
                                </Col>
                            ))}
                        </Row>
                    </Card>
                </Form>
            </Modal>

            {/* 일괄 등록 Modal */}
            <Modal
                title="사업 계획 엑셀 일괄 등록"
                open={isBulkModalOpen}
                onCancel={() => { setIsBulkModalOpen(false); setFileList([]); }}
                footer={[<Button key="submit" type="primary" loading={uploading} onClick={handleBulkUpload} disabled={fileList.length === 0}>등록 실행</Button>]}
            >
                <Alert message="주의사항" description="템플릿 형식(헤더명)을 정확히 지켜주세요." type="info" showIcon style={{ marginBottom: 16 }}/>
                <Dragger {...uploadProps} style={{ height: 150 }}>
                    <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                    <p className="ant-upload-text">파일을 드래그하거나 클릭하여 업로드</p>
                </Dragger>
            </Modal>
        </div>
    );
};

export default ProjectMasterPage;