import React, { useEffect, useState } from 'react';
import { Card, Form, Input, InputNumber, Select, Button, DatePicker, message, Row, Col, Alert, Statistic, Table, Spin } from 'antd'; // Spin 추가
import { ArrowRightOutlined, SwapOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

// API 및 타입 import
import { getProjects, executeBudgetTransfer } from '../../api/projectApi';
import type { Project } from '../../types';
import type { TransferRequest, TransferLog } from '../../types/transfer';

const { Option } = Select;
const { TextArea } = Input;

const BudgetTransferPage: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [transferLogs, setTransferLogs] = useState<TransferLog[]>([]); 
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const [selectedFromProj, setSelectedFromProj] = useState<Project | null>(null); 
    
    // NOTE: [수정 1] currentMonthPlan 상태는 사용되지 않으므로 제거하거나, 
    //       아니면 명시적으로 사용하지 않는 것으로 표시합니다. (일단 유지)
    const [currentMonthPlan] = useState<number>(0); 

    // 1. 초기 데이터 로드 (프로젝트 목록) - [수정됨]
    const fetchProjects = async () => {
        setLoading(true);
        // [수정 2] 현재 연도를 계산하여 getProjects에 전달합니다.
        const currentYear = dayjs().format('YYYY'); 
        try {
            const data = await getProjects(currentYear); // <--- [오류 수정] 인수 전달
            setProjects(data);
            // NOTE: 전용 이력 API는 아직 미구현이므로 로그는 빈 배열로 시작합니다.
            setTransferLogs([]); 
        } catch (err) {
            message.error('프로젝트 목록 로드 실패');
        } finally {
            setLoading(false);
        }
    };
    
    // 2. 전용 이력 로드 (API 구현 후 여기에 로직 추가)
    const fetchLogs = async () => {
        // NOTE: 추후 API 구현 후 여기에 이력 조회 로직 추가 예정
        // 임시 로그:
        setTransferLogs([]); 
    };

    useEffect(() => {
        fetchProjects();
        fetchLogs();
    }, []); // 최초 마운트 시 실행

    // 3. 전용 실행 핸들러
    const handleTransfer = async (values: any) => {
        // YYYYMM 형식으로 변환 (DatePicker 값은 Dayjs 객체)
        const transfer_yyyymm = dayjs(values.transfer_yyyymm).format('YYYYMM');
        
        // 잔액 부족 및 Self Transfer 방지 로직 (BE에서도 하지만 FE에서 미리 체크)
        if (values.from_proj_id === values.to_proj_id) {
            message.error('보내는 사업과 받는 사업이 동일할 수 없습니다.');
            return;
        }

        const requestData: TransferRequest = {
            ...values,
            transfer_yyyymm: transfer_yyyymm,
            transfer_amount: values.transfer_amount || 0,
            transferred_by: 'admin' // BE에서 사용할 임시 ID
        };

        setLoading(true);
        try {
            const result = await executeBudgetTransfer(requestData);
            message.success(`전용 성공: ${result.transfer_amount.toLocaleString()}원 이동 완료`);
            form.resetFields();
            fetchProjects(); // 프로젝트 목록 (잔액 갱신)
            fetchLogs(); // 이력 갱신
        } catch (err: any) {
            // BE에서 마감/잔액 부족 오류가 올 경우 처리
            message.error(err.response?.data?.detail || '전용 실패. 월 마감 또는 잔액 부족 확인.');
        } finally {
            setLoading(false);
        }
    };

    // 전용 이력 테이블 컬럼
    const logColumns = [
        { title: 'ID', dataIndex: 'transfer_id', width: 80 },
        { title: '보내는 사업', dataIndex: 'from_proj_id', width: 120 },
        { title: '받는 사업', dataIndex: 'to_proj_id', width: 120 },
        { title: '금액', dataIndex: 'transfer_amount', width: 120, render: (v: number) => v.toLocaleString() },
        { title: '월', dataIndex: 'transfer_yyyymm', width: 80 },
        { title: '사유', dataIndex: 'reason' },
        // [수정 3] transferred_at 필드가 없을 때의 에러 방지
        { title: '처리일', dataIndex: 'transferred_at', width: 150, render: (d: string) => d ? dayjs(d).format('YY-MM-DD HH:mm') : '-' },
    ];

    return (
        <Spin spinning={loading}>
        <div className="p-4 md:p-8 bg-white rounded-lg shadow-xl">
            <h3 className="text-3xl font-extrabold text-blue-600 mb-6">🔄 예산 전용 관리 (Budget Transfer)</h3>
            <Alert 
                message="전용 규칙" 
                description="전용은 마감되지 않은 월에 대해서만 가능하며, 보내는 사업의 잔여 계획 예산 내에서만 허용됩니다." 
                type="info" 
                showIcon 
                className="mb-6"
            />

            <Card title="예산 전용 신청" className="mb-8" >
                <Form form={form} layout="vertical" onFinish={handleTransfer} className="space-y-4">
                    <Row gutter={24}>
                        {/* 1. FROM 사업 선택 */}
                        <Col span={10}>
                            <Form.Item label="보내는 사업 (FROM)" name="from_proj_id" rules={[{ required: true, message: '보내는 사업을 선택하세요' }]}>
                                <Select 
                                    showSearch 
                                    placeholder="사업 검색" 
                                    optionFilterProp="label"
                                    onChange={(value) => setSelectedFromProj(projects.find(p => p.proj_id === value) || null)}
                                >
                                    {projects.map(p => <Option key={p.proj_id} value={p.proj_id} label={`[${p.proj_id}] ${p.proj_name}`}>{`[${p.proj_id}] ${p.proj_name}`}</Option>)}
                                </Select>
                            </Form.Item>
                            
                            {selectedFromProj && <Statistic title="잔액 (해당 월)" value={currentMonthPlan} suffix="KRW" valueStyle={{ fontSize: 14 }} />}

                        </Col>
                        
                        {/* 2. 전용 아이콘 */}
                        <Col span={4} className="flex items-center justify-center pt-8">
                            <ArrowRightOutlined className="text-4xl text-gray-400" />
                        </Col>

                        {/* 3. TO 사업 선택 */}
                        <Col span={10}>
                            <Form.Item label="받는 사업 (TO)" name="to_proj_id" rules={[{ required: true, message: '받는 사업을 선택하세요' }]}>
                                <Select showSearch placeholder="사업 검색" optionFilterProp="label">
                                    {projects.map(p => <Option key={p.proj_id} value={p.proj_id} label={`[${p.proj_id}] ${p.proj_name}`}>{`[${p.proj_id}] ${p.proj_name}`}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={24}>
                        {/* 4. 금액 입력 */}
                        <Col span={6}>
                            <Form.Item label="전용 금액" name="transfer_amount" rules={[{ required: true, message: '금액을 입력하세요' }]}>
                                <InputNumber
                                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
                                    className="w-full"
                                />
                            </Form.Item>
                        </Col>

                        {/* 5. 월/사유 입력 */}
                        <Col span={6}>
                            <Form.Item label="전용 발생 월" name="transfer_yyyymm" rules={[{ required: true, message: '월을 선택하세요' }]} initialValue={dayjs()}>
                                <DatePicker picker="month" format="YYYY-MM" className="w-full" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="전용 사유" name="reason" rules={[{ required: true, message: '사유를 입력하세요' }]}>
                                <TextArea rows={1} placeholder="예: 단가 상승으로 인한 부족분 충당" />
                            </Form.Item>
                        </Col>
                    </Row>
                    
                    <Form.Item className="text-right mt-6">
                        <Button type="primary" htmlType="submit" icon={<SwapOutlined />} loading={loading} className="px-6 py-2">
                            예산 전용 실행
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            <Card title="전용 실행 이력" className="mt-8" size="small">
                 <Table 
                    dataSource={transferLogs} 
                    columns={logColumns} 
                    rowKey="transfer_id" 
                    loading={loading} 
                    size="small" 
                    pagination={{ pageSize: 5 }}
                 />
                 <Button type="link" icon={<HistoryOutlined />} onClick={fetchLogs} className="float-right mt-2">전용 이력 새로고침</Button>
            </Card>
        </div>
        </Spin>
    );
};

export default BudgetTransferPage;