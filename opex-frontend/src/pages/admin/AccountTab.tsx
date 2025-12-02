import React, { useState, useEffect } from 'react';
import { Tabs, Table, Button, Modal, Form, Input, Select, message, Card, Tag, InputNumber } from 'antd';
import { 
    getGLAccounts, createGLAccount, 
    getBudgetCodes, createBudgetCode,
    getCostCenters, createCostCenter , updateBudgetCode, deleteBudgetCode
} from '../../api/accountApi';
import type { GLAccount, BudgetCode, CostCenter, BudgetCodeCreate, BudgetCodeUpdate } from '../../api/accountApi';
import { EditOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'; // <-- EditOutlined, DeleteOutlined 추가



const { TabPane } = Tabs;
const { Option } = Select;

// // BudgetCode 생성 시 백엔드로 보내는 페이로드 타입 (code_id는 제외됨)
// interface BudgetCodeCreatePayload {
//     code_type: string;
//     name: string;
//     description?: string;
//     is_active: boolean;
//     parent_code_id?: string | null;
// }

const AccountTab: React.FC = () => {
    // --- State Management ---
    const [glList, setGlList] = useState<GLAccount[]>([]);
    const [budgetList, setBudgetList] = useState<BudgetCode[]>([]);
    const [ccList, setCcList] = useState<CostCenter[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Modal Visibility States
    const [isGlModalOpen, setIsGlModalOpen] = useState(false);
    const [isCcModalOpen, setIsCcModalOpen] = useState(false);
    
    // [수정] 예산 분류 코드 관련 상태
    const [isBudgetL1L2ModalOpen, setIsBudgetL1L2ModalOpen] = useState(false);
    const [isBudgetITModalOpen, setIsBudgetITModalOpen] = useState(false);

    // [수정] L1/L2 등록 관련 데이터 상태
    const [budgetL1L2Data, setBudgetL1L2Data] = useState({
        name: '',
        description: '',
        isL2: false, // L2 등록 여부 플래그
        selectedL1: '', // L2 등록 시 선택된 L1의 code_id
    });
    
    // [추가] IT 분류 등록 관련 데이터 상태
    const [budgetITData, setBudgetITData] = useState({
        name: '',
        description: '',
    });

    // [신규] 수정 모달 상태
    const [isBudgetEditModalOpen, setIsBudgetEditModalOpen] = useState(false);
    const [selectedBudgetCode, setSelectedBudgetCode] = useState<BudgetCode | null>(null);


    const [formBudgetEdit] = Form.useForm(); // [신규] 수정 폼 인스턴스

    // Form Instances
    const [formGL] = Form.useForm();
    const [formCC] = Form.useForm();

    // --- Data Fetching ---
    const fetchGL = async () => {
        setLoading(true);
        try {
            const data = await getGLAccounts();
            setGlList(data);
        } catch (e) { message.error('G/L 목록 로드 실패'); }
        finally { setLoading(false); }
    };

    const fetchBudget = async () => {
        setLoading(true);
        try {
            const data = await getBudgetCodes();
            setBudgetList(data);
        } catch (e) { message.error('예산 코드 로드 실패'); }
        finally { setLoading(false); }
    };

    const fetchCC = async () => {
        setLoading(true);
        try {
            const data = await getCostCenters();
            setCcList(data);
        } catch (e) { message.error('코스트 센터 로드 실패'); }
        finally { setLoading(false); }
    };

    // Initial Load
    useEffect(() => {
        fetchGL();
        fetchBudget();
        fetchCC();
    }, []);


   





    // --- Create Handlers ---
    const handleCreateGL = async (values: any) => {
        try {
            await createGLAccount(values);
            message.success('G/L 계정이 등록되었습니다.');
            setIsGlModalOpen(false);
            formGL.resetFields();
            fetchGL();
        } catch (e: any) { 
            message.error(e.response?.data?.detail || '등록 실패'); 
        }
    };

    const handleCreateCC = async (values: any) => {
        try {
            await createCostCenter(values);
            message.success('코스트 센터가 등록되었습니다.');
            setIsCcModalOpen(false);
            formCC.resetFields();
            fetchCC();
        } catch (e: any) { 
            message.error(e.response?.data?.detail || '등록 실패'); 
        }
    };
    
    // [수정] L1/L2 등록 처리 함수 (사용자 코드 기반으로 수정)
    const handleCreateBudgetL1L2 = async () => {
        if (!budgetL1L2Data.name) {
            message.error('분류 이름을 입력해주세요.');
            return;
        }

        const codeType = budgetL1L2Data.isL2 ? 'BUDGET_L2' : 'BUDGET_L1';

        // L2 등록 시, L1 선택 필수 검증
        if (budgetL1L2Data.isL2 && !budgetL1L2Data.selectedL1) {
            message.error('L2 (소분류) 등록 시, L1 (대분류)를 반드시 선택해야 합니다.');
            return;
        }

        // 백엔드 스키마에 맞춘 페이로드 생성 (code_id 제거)
        const payload: BudgetCodeCreate = { 
            code_type: codeType,
            name: budgetL1L2Data.name,
            description: budgetL1L2Data.description,
            is_active: true,
            parent_code_id: budgetL1L2Data.isL2 ? budgetL1L2Data.selectedL1 : null, 
        };

        try {
            await createBudgetCode(payload); 
            message.success(`${codeType} 코드가 성공적으로 등록되었습니다. (시스템에서 ID 자동 채번)`);

            // 등록 후 모달 닫기, 상태 초기화 및 목록 새로고침
            setIsBudgetL1L2ModalOpen(false);
            setBudgetL1L2Data({ name: '', description: '', isL2: false, selectedL1: '' });
            
            fetchBudget(); // [수정] 예산 코드 목록을 새로 불러오는 함수 호출

        } catch (e: any) {
            console.error('L1/L2 코드 등록 실패:', e);
            message.error(e.response?.data?.detail || 'L1/L2 코드 등록에 실패했습니다. (콘솔 확인)');
        }
    };

    // [추가] IT 분류 등록 처리 함수
    const handleCreateBudgetIT = async () => {
        if (!budgetITData.name) {
            message.error('분류 이름을 입력해주세요.');
            return;
        }

        const payload: BudgetCodeCreate = {
            code_type: 'IT_TYPE',
            name: budgetITData.name,
            description: budgetITData.description,
            is_active: true,
            parent_code_id: null,
        };

        try {
            await createBudgetCode(payload);
            message.success('IT 분류 코드가 성공적으로 등록되었습니다. (시스템에서 ID 자동 채번)');
            
            setIsBudgetITModalOpen(false);
            setBudgetITData({ name: '', description: '' });
            fetchBudget();

        } catch (e: any) {
            console.error('IT 코드 등록 실패:', e);
            message.error(e.response?.data?.detail || 'IT 분류 코드 등록에 실패했습니다. (콘솔 확인)');
        }
    };

    // --- Update Handler ---
    const handleUpdateBudget = async (values: any) => {
        if (!selectedBudgetCode) return;

        // 백엔드 API가 name 필드를 받고 is_active를 boolean으로 기대하므로 변환
        const payload: BudgetCodeUpdate = {
            name: values.name,
            is_active: values.is_active === 'Y', // 'Y'/'N'을 boolean으로 변환
            // L2 타입일 경우에만 parent_code_id를 전달
            parent_code_id: selectedBudgetCode.code_type === 'BUDGET_L2' ? values.parent_code_id : null, 
        };

        try {
            await updateBudgetCode(selectedBudgetCode.code_id, payload);
            message.success(`코드 ${selectedBudgetCode.code_id}가 수정되었습니다.`);
            setIsBudgetEditModalOpen(false);
            setSelectedBudgetCode(null);
            fetchBudget();
        } catch (e: any) {
            message.error(e.response?.data?.detail || '코드 수정 실패');
        }
    };

    // --- Delete Handler ---
    const handleDeleteBudget = (code: BudgetCode) => {
        Modal.confirm({
            title: `[${code.code_id}] ${code.code_name} 삭제`,
            content: '정말로 이 예산 분류 코드를 삭제하시겠습니까? 관련 데이터가 있을 경우 삭제되지 않을 수 있습니다.',
            okText: '삭제',
            okType: 'danger',
            cancelText: '취소',
            onOk: async () => {
                try {
                    await deleteBudgetCode(code.code_id);
                    message.success(`코드 ${code.code_id}가 성공적으로 삭제되었습니다.`);
                    fetchBudget();
                } catch (e: any) {
                    message.error(e.response?.data?.detail || '삭제 실패');
                }
            },
        });
    };





    // --- Table Columns ---
    const columnsGL = [
        { title: 'G/L 코드', dataIndex: 'gl_account_code', width: 120 },
        { title: '계정 명칭', dataIndex: 'gl_account_name' },
        { title: '유형', dataIndex: 'account_type', width: 100 },
        { title: '상태', dataIndex: 'is_active', width: 80, render: (v:string) => <Tag color={v==='Y'?'green':'red'}>{v}</Tag> },
    ];

    const columnsBudget = [
        { title: '분류 ID', dataIndex: 'code_id', width: 120 },
        { title: '분류명', dataIndex: 'code_name' }, // [최종 수정] 'name' -> 'code_name'으로 변경 (백엔드 스키마와 통일)
        { title: '구분', dataIndex: 'code_type', width: 150, render: (v:string) => <Tag color={v.includes('L1') ? 'blue' : v.includes('L2') ? 'geekblue' : 'purple'}>{v}</Tag> },
        { title: '상위코드', dataIndex: 'parent_code_id', width: 120 },
        { title: '상태', dataIndex: 'is_active', width: 80, render: (v:any) => <Tag color={v==='Y' || v===true ?'green':'red'}>{v==='Y' || v===true ? 'Y' : 'N'}</Tag> }, // 타입 통일 (string/boolean)
        { // [신규] 액션 컬럼 추가
        title: '액션',
        key: 'action',
        width: 100,
        render: (text: any, record: BudgetCode) => (
            <span>
                <Button 
                    icon={<EditOutlined />} 
                    size="small" 
                    style={{ marginRight: 8 }}
                    onClick={() => {
                        setSelectedBudgetCode(record);
                        // 폼 필드 초기값 설정
                        formBudgetEdit.setFieldsValue({
                            name: record.code_name,
                            is_active: record.is_active, // 'Y'/'N'
                            parent_code_id: record.parent_code_id,
                        });
                        setIsBudgetEditModalOpen(true);
                    }}
                />
                <Button 
                    icon={<DeleteOutlined />} 
                    size="small" 
                    danger
                    onClick={() => handleDeleteBudget(record)}
                />
            </span>
        ),
    },
    ];

    const columnsCC = [
        { title: 'CC 코드', dataIndex: 'cc_code', width: 120 },
        { title: 'CC 명칭', dataIndex: 'cc_name' },
        { title: '상태', dataIndex: 'is_active', width: 80, render: (v:string) => <Tag color={v==='Y'?'green':'red'}>{v}</Tag> },
    ];

    return (
        <Card title="계정 및 기준정보 관리" size="small" style={{ minHeight: 500 }}>
            <Tabs defaultActiveKey="1" type="card">
                
                {/* Tab 1: G/L 계정 */}
                <TabPane tab="G/L 계정" key="1">
                    <div style={{ marginBottom: 16, textAlign: 'right' }}>
                        <Button icon={<ReloadOutlined />} onClick={fetchGL} style={{ marginRight: 8 }}>새로고침</Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsGlModalOpen(true)}>신규 G/L 등록</Button>
                    </div>
                    <Table dataSource={glList} columns={columnsGL} rowKey="gl_account_code" size="small" loading={loading} bordered pagination={{ pageSize: 10 }} />
                </TabPane>

                {/* Tab 2: 코스트 센터 */}
                <TabPane tab="코스트 센터 (CC)" key="2">
                    <div style={{ marginBottom: 16, textAlign: 'right' }}>
                        <Button icon={<ReloadOutlined />} onClick={fetchCC} style={{ marginRight: 8 }}>새로고침</Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsCcModalOpen(true)}>신규 CC 등록</Button>
                    </div>
                    <Table dataSource={ccList} columns={columnsCC} rowKey="cc_code" size="small" loading={loading} bordered pagination={{ pageSize: 10 }} />
                </TabPane>

                {/* Tab 3: 예산 분류 코드 (L1/L2, IT 분류 분리) */}
                <TabPane tab="예산 분류 코드" key="3">
                    <div style={{ marginBottom: 16, textAlign: 'right' }}>
                        <Button icon={<ReloadOutlined />} onClick={fetchBudget} style={{ marginRight: 8 }}>새로고침</Button>
                        <Button type="default" icon={<PlusOutlined />} onClick={() => setIsBudgetITModalOpen(true)} style={{ marginRight: 8 }}>IT 분류 등록</Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                            setBudgetL1L2Data({ name: '', description: '', isL2: false, selectedL1: '' }); // 모달 열기 전 초기화
                            setIsBudgetL1L2ModalOpen(true);
                        }}>L1/L2 분류 등록</Button>
                    </div>
                    <Table dataSource={budgetList} columns={columnsBudget} rowKey="code_id" size="small" loading={loading} bordered pagination={{ pageSize: 10 }} />
                </TabPane>
            </Tabs>

            {/* --- Modals --- */}

            {/* 1. G/L 등록 모달 */}
            <Modal title="G/L 계정 등록" open={isGlModalOpen} onCancel={() => setIsGlModalOpen(false)} onOk={formGL.submit}>
                <Form form={formGL} layout="vertical" onFinish={handleCreateGL} initialValues={{ is_active: 'Y', account_type: '비용' }}>
                    <Form.Item name="gl_account_code" label="G/L 코드" rules={[{ required: true, message: '필수 입력' }]}><Input placeholder="예: 6663600" /></Form.Item>
                    <Form.Item name="gl_account_name" label="계정 명칭" rules={[{ required: true, message: '필수 입력' }]}><Input placeholder="예: 관리비-지급수수료" /></Form.Item>
                    <Form.Item name="account_type" label="계정 유형"><Select><Option value="비용">비용</Option><Option value="자산">자산</Option></Select></Form.Item>
                </Form>
            </Modal>

            {/* 2. CC 등록 모달 */}
            <Modal title="코스트 센터 등록" open={isCcModalOpen} onCancel={() => setIsCcModalOpen(false)} onOk={formCC.submit}>
                <Form form={formCC} layout="vertical" onFinish={handleCreateCC} initialValues={{ is_active: 'Y' }}>
                    <Form.Item name="cc_code" label="CC 코드" rules={[{ required: true, message: '필수 입력' }]}><Input placeholder="예: 11001121" /></Form.Item>
                    <Form.Item name="cc_name" label="CC 명칭" rules={[{ required: true, message: '필수 입력' }]}><Input placeholder="예: DX개발운영팀" /></Form.Item>
                </Form>
            </Modal>

            {/* 3.1. L1/L2 예산 분류 코드 등록 모달 (계층 구조 반영) */}
            <Modal 
                title={budgetL1L2Data.isL2 ? 'L2 (소분류) 등록' : 'L1 (대분류) 등록'} 
                open={isBudgetL1L2ModalOpen} 
                onCancel={() => setIsBudgetL1L2ModalOpen(false)} 
                onOk={handleCreateBudgetL1L2}
            >
                <Form layout="vertical">
                    <Form.Item label="분류 레벨 선택">
                        <Select
                            value={budgetL1L2Data.isL2 ? 'L2' : 'L1'}
                            onChange={(value) => setBudgetL1L2Data({ 
                                ...budgetL1L2Data, 
                                isL2: value === 'L2', 
                                selectedL1: '' 
                            })}
                        >
                            <Option value="L1">L1 (대분류)</Option>
                            <Option value="L2">L2 (소분류)</Option>
                        </Select>
                    </Form.Item>
                    
                    {/* L2 등록 선택 시 L1 드롭다운 표시 */}
                    {budgetL1L2Data.isL2 && (
                        <Form.Item 
                            label="예산 대분류 1 (L1) 선택" 
                            required={budgetL1L2Data.isL2}
                            validateStatus={!budgetL1L2Data.selectedL1 && budgetL1L2Data.isL2 ? 'error' : ''}
                            help={!budgetL1L2Data.selectedL1 && budgetL1L2Data.isL2 ? 'L2 등록 시 L1은 필수입니다.' : ''}
                        >
                            <Select
                                value={budgetL1L2Data.selectedL1}
                                onChange={(value) => setBudgetL1L2Data({ ...budgetL1L2Data, selectedL1: value })}
                                placeholder="-- L1을 선택하세요 --"
                            >
                                {/* budgetList 목록에서 type이 'BUDGET_L1'인 항목만 필터링하여 옵션으로 맵핑 */}
                                {budgetList
                                    .filter(code => code.code_type === 'BUDGET_L1')
                                    .map((code) => (
                                        <Option key={code.code_id} value={code.code_id}>
                                            [{code.code_id}] {code.code_name}
                                        </Option>
                                    ))}
                            </Select>
                        </Form.Item>
                    )}
                    
                    {/* 이름 입력 필드 */}
                    <Form.Item label="분류 이름" required>
                        <Input
                            value={budgetL1L2Data.name}
                            onChange={(e) => setBudgetL1L2Data({ ...budgetL1L2Data, name: e.target.value })}
                        />
                    </Form.Item>

                    {/* 설명 입력 필드 */}
                    <Form.Item label="설명 (선택)">
                        <Input.TextArea
                            value={budgetL1L2Data.description}
                            onChange={(e) => setBudgetL1L2Data({ ...budgetL1L2Data, description: e.target.value })}
                        />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 3.2. IT 예산 분류 코드 등록 모달 (단일 레벨) */}
            <Modal 
                title="IT 예산 분류 코드 등록 (Capex/Opex)" 
                open={isBudgetITModalOpen} 
                onCancel={() => setIsBudgetITModalOpen(false)} 
                onOk={handleCreateBudgetIT}
            >
                <Form layout="vertical">
                    {/* 코드 ID는 백엔드에서 자동 채번되므로 입력 필드 제거 */}
                    <Form.Item label="분류 이름" required>
                        <Input
                            value={budgetITData.name}
                            onChange={(e) => setBudgetITData({ ...budgetITData, name: e.target.value })}
                            placeholder="예: Capex, Opex"
                        />
                    </Form.Item>

                    {/* 설명 입력 필드 */}
                    <Form.Item label="설명 (선택)">
                        <Input.TextArea
                            value={budgetITData.description}
                            onChange={(e) => setBudgetITData({ ...budgetITData, description: e.target.value })}
                        />
                    </Form.Item>
                </Form>
            </Modal>

{/* 3.3. [신규] 예산 분류 코드 수정 모달 */}
        <Modal
            title={`예산 분류 코드 수정: ${selectedBudgetCode?.code_id}`}
            open={isBudgetEditModalOpen}
            onCancel={() => {
                setIsBudgetEditModalOpen(false);
                setSelectedBudgetCode(null);
            }}
            onOk={formBudgetEdit.submit}
            destroyOnClose={true} // 모달 닫을 때 폼 초기화
        >
            <Form 
                form={formBudgetEdit} 
                layout="vertical" 
                onFinish={handleUpdateBudget}
            >
                <Form.Item label="분류 구분">
                    <Input readOnly value={selectedBudgetCode?.code_type} />
                </Form.Item>

                {/* 이름 입력 필드 */}
                <Form.Item name="name" label="분류 이름" rules={[{ required: true, message: '분류 이름을 입력해주세요.' }]}>
                    <Input />
                </Form.Item>

                {/* 상태 (활성/비활성) */}
                <Form.Item name="is_active" label="상태">
                    <Select>
                        <Option value="Y">활성</Option>
                        <Option value="N">비활성</Option>
                    </Select>
                </Form.Item>

                {/* L2인 경우에만 상위 코드 수정 가능 */}
                {selectedBudgetCode?.code_type === 'BUDGET_L2' && (
                    <Form.Item 
                        name="parent_code_id" 
                        label="예산 대분류 1 (L1) 선택" 
                        rules={[{ required: true, message: 'L2 코드는 L1을 반드시 선택해야 합니다.' }]}
                    >
                        <Select placeholder="-- L1을 선택하세요 --">
                            {/* L1 코드 목록 필터링 */}
                            {budgetList
                                .filter(code => code.code_type === 'BUDGET_L1')
                                .map((code) => (
                                    <Option key={code.code_id} value={code.code_id}>
                                        [{code.code_id}] {code.code_name}
                                    </Option>
                                ))}
                        </Select>
                    </Form.Item>
                )}
            </Form>
        </Modal>


        </Card>
    );
};

export default AccountTab;