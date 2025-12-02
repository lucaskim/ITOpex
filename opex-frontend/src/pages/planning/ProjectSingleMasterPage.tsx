import React, { useEffect, useState } from 'react';
import { Table, Card, Button, Modal, Form, Input, Select, InputNumber, message, Row, Col, Alert, DatePicker } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs'; // 날짜 라이브러리
// [수정] 벌크 관련 import 제거, CRUD 관련 import 추가
import { getProjects, createProject, updateProject, deleteProject } from '../../api/projectApi';
import { getVendors } from '../../api/vendorApi';
import { getServices } from '../../api/serviceApi';
import type { Project, ProjectCreate, ProjectUpdate } from '../../types'; // ProjectUpdate 타입 임포트 필요
import { getBudgetCodes } from '../../api/accountApi';

const { Option } = Select;

// [필수 헬퍼 함수] 폼에서 넘어온 빈 값('', undefined)을 null로 변환합니다.
const cleanPayload = (values: any) => {
    const cleaned: any = {};
    for (const key in values) {
        if (values[key] === '' || values[key] === undefined) {
            cleaned[key] = null;
        } else {
             cleaned[key] = values[key];
        }
    }
    return cleaned;
};

const ProjectSingleMasterPage: React.FC = () => {
    // === 1. 상태 관리 ===
    // 선택된 연도는 Dayjs 객체로 관리하여 안정성 확보
    const [selectedYear, setSelectedYear] = useState<Dayjs>(dayjs()); 
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [services, setServices] = useState<any[]>([]);
    
    // 모달 및 CRUD 상태
    const [isModalOpen, setIsModalOpen] = useState(false); // 단일 등록/수정 모달 통일
    const [editingProject, setEditingProject] = useState<Project | null>(null); // 수정 중인 사업 객체
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const [itCodes, setItCodes] = useState<any[]>([]); // IT 분류 코드 목록

    // 1. 데이터 초기화 (API 병렬 호출)
    const initData = React.useCallback(async (year: string) => {
        setLoading(true);
        try {
            const [pData, vData, sData] = await Promise.all([
                getProjects(year), 
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
    }, []);

    const fetchItCodes = async () => {
    try {
        // 'IT_TYPE' 타입의 예산 코드만 조회
        const data = await getBudgetCodes('IT_TYPE'); 
        setItCodes(data);
    } catch (e) {
        console.error('IT 코드 로드 실패', e);
    }
    };


    // selectedYear가 바뀔 때마다 데이터 로드
    useEffect(() => { 
        initData(selectedYear.format('YYYY')); 
        // [수정] 컴포넌트 마운트 시 (또는 Year 변경 시) IT 코드를 로드하도록 추가
        fetchItCodes();
    }, [selectedYear, initData]);


    // 2. 단일 등록/수정 처리 (Single Registration/Update)
    const handleSave = async (values: any) => {
        const yearString = selectedYear.format('YYYY');
        const amounts = [];
        for(let i=1; i<=12; i++) {
            amounts.push(values[`month_${i}`] ? Number(values[`month_${i}`]) : 0);
        }

        const cleanedValues = cleanPayload(values);
        
        try {
            if (editingProject) {
                // --- 수정 (Update) 로직 ---
                const payload: ProjectUpdate = {
                    ...cleanedValues,
                    // monthly_amounts는 updateProject 함수에서 별도 처리
                    monthly_amounts: amounts, 
                };
                
                await updateProject(editingProject.proj_id, payload as any);
                message.success(`사업 ${editingProject.proj_id}가 수정되었습니다.`);

            } else {
                // --- 등록 (Create) 로직 ---
                const payload: ProjectCreate = { 
                    ...cleanedValues,
                    fiscal_year: yearString, 
                    monthly_amounts: amounts,
                };
                
                await createProject(payload);
                message.success('신규 사업 계획이 등록되었습니다.');
            }
            
            setIsModalOpen(false);
            setEditingProject(null);
            form.resetFields();
            initData(yearString); // 목록 갱신

        } catch (error: any) {
            console.error("API Error:", error);
            const detail = error.response?.data?.detail;
            const msg = Array.isArray(detail) 
                ? detail.map((e: any) => `${e.loc.join('->')}: ${e.msg}`).join(', ')
                : '데이터 형식을 확인하세요.';
            message.error(`처리 실패: ${msg}`);
        }
    };

    // 3. 삭제 처리 (Delete)
    const handleDelete = (projId: string, projName: string) => {
        Modal.confirm({
            title: `사업 [${projId}] 삭제`,
            content: `사업명: ${projName}\n정말로 이 사업 계획을 삭제하시겠습니까?`,
            okText: '삭제',
            okType: 'danger',
            cancelText: '취소',
            onOk: async () => {
                try {
                    await deleteProject(projId);
                    message.success('사업 계획이 삭제되었습니다.');
                    initData(selectedYear.format('YYYY'));
                } catch (error: any) {
                    message.error('삭제 실패: ' + (error.response?.data?.detail || '서버 오류'));
                }
            }
        });
    };
    
    // 4. 수정 모드 설정 (Edit Mode Setup)
    const handleEdit = (record: Project) => {
        setEditingProject(record);
        
        // 폼 초기값 설정 (마스터 필드)
        form.setFieldsValue({
            ...record,
            // 월별 금액 필드 설정 (NOTE: 월별 데이터를 따로 조회하는 로직이 필요할 수 있으나, 
            // 현재는 간소화를 위해 월별 데이터를 Project 객체가 포함한다고 가정하고 구현합니다.)
            // 실제 구현 시는 getProjectDetail API를 통해 월별 데이터를 불러와야 합니다.
        });

        // 월별 데이터 (임시: 실제로는 DB에서 월별 데이터를 조회해야 함)
        // 여기서는 임시로 0으로 설정하거나, 실제 월별 데이터가 있다면 해당 데이터로 채웁니다.
        for(let i=1; i<=12; i++) {
            form.setFieldValue(`month_${i}`, 0); 
        }

        setIsModalOpen(true);
    };


    const columns = [
        // 1. Index (고정)
        { title: 'Index', dataIndex: 'proj_id', width: 100, fixed: 'left' as const },
        // 2. 사업명 (고정)
        { title: '사업명', dataIndex: 'proj_name', width: 250, fixed: 'left' as const }, // 너비 조정 및 고정
        
        // 3. 주요 마스터 정보
        { title: '부서', dataIndex: 'dept_code', width: 80 },
        { title: '예산성격', dataIndex: 'budget_nature_type', width: 120 },
        { title: '업체ID', dataIndex: 'vendor_name_text', width: 100 },
        
        // 4. 월별 계획 금액 (12개월)
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
            const monthKey = m.toString().padStart(2, '0');
            const dataKey = `${selectedYear.format('YYYY')}${monthKey}`; // YYYYMM 형식
            
            return {
                title: `${m}월 계획`,
                dataIndex: 'monthly_plans',
                width: 100,
                // [핵심] monthly_plans 딕셔너리에서 해당 월의 금액을 가져와 표시
                render: (value: Record<string, number | undefined>, record: any) => { // undefined 허용 추가

                    // 🚨 디버깅을 위해 콘솔에 값 출력
                    console.log("Checking Project:", record.proj_id, "Key:", dataKey, "Plans:", value);

                    // 월별 계획 금액이 없을 수 있으므로 0으로 폴백 처리합니다.
                    const amount = value ? (value[dataKey] || 0) : 0; 
                    // 0원 이상일 때만 표시
                    return amount > 0 ? amount.toLocaleString() : '-';
                },
            };
        }),
        // 5. 액션 컬럼 (고정)
        {
            title: '액션',
            key: 'action',
            width: 120,
            fixed: 'right' as const,
            render: (_: any, record: Project) => (
                <span>
                    <Button icon={<EditOutlined />} size="small" style={{ marginRight: 8 }} onClick={() => handleEdit(record)}>
                        수정
                    </Button>
                    <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.proj_id, record.proj_name)}>
                        삭제
                    </Button>
                </span>
            ),
        },
    ];

    return (
        <div style={{ padding: 20 }}>
            <h3 className="text-xl font-bold mb-4">📝 {selectedYear.format('YYYY')}년 사업 계획 단건 관리</h3>
            
            <Card style={{ marginBottom: 20 }} size="small">
                <div className="flex justify-between items-center">
                    <div className="flex space-x-4 items-center">
                        <DatePicker 
                            picker="year" 
                            value={selectedYear}
                            format="YYYY년"
                            onChange={(date) => {
                                if (date) setSelectedYear(date);
                            }}
                            style={{ width: 100 }}
                        />
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                            setEditingProject(null); // 신규 등록 모드로 설정
                            form.resetFields();
                            setIsModalOpen(true);
                        }}>
                            신규 사업 등록
                        </Button>
                        <Button icon={<ReloadOutlined />} onClick={() => initData(selectedYear.format('YYYY'))}>
                            새로고침
                        </Button>
                        {/* 벌크 관련 버튼 제거됨 */}
                    </div>
                </div>
            </Card>
            

            <Table 
                dataSource={projects} 
                columns={columns} 
                rowKey="proj_id" 
                loading={loading} 
                scroll={{ x: 900 }} 
                size="small" 
                bordered 
            />

            {/* 단일 등록/수정 Modal */}
            <Modal 
                title={editingProject ? `사업 수정: ${editingProject.proj_id}` : "신규 사업 및 예산 등록"} 
                open={isModalOpen} 
                width={800} 
                onCancel={() => { setIsModalOpen(false); setEditingProject(null); form.resetFields(); }} 
                footer={null} 
            >
                <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ dept_code: 'A' }}>
                    <Alert 
                        message={editingProject ? "수정 모드: 사업명, 부서 등 주요 필드 수정 시 주의" : "신규 등록 모드"} 
                        type={editingProject ? "warning" : "info"}
                        showIcon style={{ marginBottom: 16 }}
                    />
                    <Card size="small" title="1. 기본 정보" style={{ marginBottom: 16 }}>
                        <Row gutter={16}>
                            <Col span={12}><Form.Item label="사업명" name="proj_name" rules={[{ required: true, message: '필수' }]}><Input /></Form.Item></Col>
                            <Col span={6}>
                                <Form.Item label="부서" name="dept_code" rules={[{ required: true, message: '필수' }]}><Select><Option value="A">DX운영(A)</Option><Option value="B">DX기획(B)</Option><Option value="C">보안(C)</Option></Select></Form.Item>
                            </Col>
                            <Col span={6}>
                                <Form.Item label="예산성격" name="budget_nature">
                                {/* [수정] Input -> Select로 변경하고 itCodes를 옵션으로 사용 */}
                                    <Select allowClear>
                                        {itCodes.map(code => (
                                            <Option key={code.code_id} value={code.code_id}>
                                                {code.code_name} ({code.code_id})
                                            </Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Form.Item label="계약 업체" name="vendor_id">
                                    <Select showSearch optionFilterProp="label" allowClear>{vendors.map(v => (<Option key={v.vendor_id} value={v.vendor_id} label={v.vendor_name}>{v.vendor_name}</Option>))}</Select>
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item label="대상 서비스" name="svc_id">
                                    <Select allowClear>{services.map(s => (<Option key={s.svc_id} value={s.svc_id}>{s.svc_name}</Option>))}</Select>
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
                    
                    {/* Modal 내부의 Form 제출 버튼 */}
                    <Form.Item style={{ textAlign: 'right', marginTop: 20 }}>
                        <Button onClick={() => setIsModalOpen(false)} style={{ marginRight: 8 }}>
                            취소
                        </Button>
                        <Button type="primary" htmlType="submit">
                            {editingProject ? '수정 내용 저장' : '사업 계획 등록 실행'}
                        </Button>
                    </Form.Item>

                </Form>
            </Modal>
        </div>
    );
};

export default ProjectSingleMasterPage;