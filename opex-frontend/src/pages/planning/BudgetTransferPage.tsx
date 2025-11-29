// src/pages/planning/BudgetTransferPage.tsx
import React, { useEffect, useState } from 'react';
import { Card, Form, Input, InputNumber, Select, Button, DatePicker, message, Row, Col, Alert, Statistic, Table } from 'antd';
import { ArrowRightOutlined, SwapOutlined, HistoryOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getProjects, executeBudgetTransfer } from '../../api/projectApi';
import type { Project } from '../../types';
import type { TransferRequest, TransferLog } from '../../types/transfer';

const { Option } = Select;
const { TextArea } = Input;

const BudgetTransferPage: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]); // 프로젝트 목록 (드롭다운 옵션)
    const [transferLogs, setTransferLogs] = useState<TransferLog[]>([]); // 전용 이력
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const [selectedFromProj, setSelectedFromProj] = useState<Project | null>(null);

    // 1. 초기 데이터 로드 (프로젝트 목록)
    const fetchProjects = async () => {
        try {
            const data = await getProjects();
            setProjects(data);
        } catch (err) {
            message.error('프로젝트 목록 로드 실패');
        }
    };
    
    // 2. 전용 이력 로드 (추후 구현 예정)
    const fetchLogs = async () => {
        // 추후 API 구현 후 여기에 이력 조회 로직 추가 예정
        setTransferLogs([]); 
    };

    useEffect(() => {
        fetchProjects();
        fetchLogs();
    }, []);

    // 3. 전용 실행 핸들러
    const handleTransfer = async (values: any) => {
        // yyyymm 형식으로 변환
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
            // transferred_by는 BE에서 'admin'으로 처리되도록 함 (실제 구현 시 로그인 ID 사용)
        };

        setLoading(true);
        try {
            const result = await executeBudgetTransfer(requestData);
            message.success(`전용 성공: ${result.transfer_amount.toLocaleString()}원 이동 완료`);
            form.resetFields();
            fetchLogs(); // 이력 갱신
            // Project 목록은 변경되지 않으므로, 잔액 확인은 별도 로직 필요
        } catch (err: any) {
            message.error(err.response?.data?.detail || '전용 실패. 잔액 부족 또는 월 마감 확인.');
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
    ];

    return (
        <div style={{ padding: 20 }}>
            <h3>🔄 예산 전용 관리 (Budget Transfer)</h3>
            <Alert 
                message="전용 규칙" 
                description="전용은 마감되지 않은 월에 대해서만 가능하며, 보내는 사업의 잔여 계획 예산 내에서만 허용됩니다." 
                type="info" 
                showIcon 
                style={{ marginBottom: 20 }}
            />

            <Card title="예산 전용 신청" style={{ marginBottom: 20 }} loading={loading}>
                <Form form={form} layout="vertical" onFinish={handleTransfer}>
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
                        </Col>
                        
                        {/* 2. 전용 아이콘 */}
                        <Col span={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ArrowRightOutlined style={{ fontSize: '24px', color: '#1677ff' }} />
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
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                            {/* 잔액 표시 (심화: 현재 월의 잔액 계산 로직 추가 필요) */}
                            {selectedFromProj && <Statistic title="잔액 (해당 월)" value={0} suffix="KRW" valueStyle={{ fontSize: 14 }} />}
                        </Col>

                        {/* 5. 월/사유 입력 */}
                        <Col span={6}>
                            <Form.Item label="전용 발생 월" name="transfer_yyyymm" rules={[{ required: true, message: '월을 선택하세요' }]}>
                                <DatePicker picker="month" format="YYYY-MM" style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="전용 사유" name="reason" rules={[{ required: true, message: '사유를 입력하세요' }]}>
                                <TextArea rows={1} placeholder="예: 단가 상승으로 인한 부족분 충당" />
                            </Form.Item>
                        </Col>
                    </Row>
                    
                    <Form.Item style={{ textAlign: 'right', marginTop: 20 }}>
                        <Button type="primary" htmlType="submit" icon={<SwapOutlined />} loading={loading}>
                            예산 전용 실행
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            <Card title="전용 실행 이력" size="small">
                 <Table 
                    dataSource={transferLogs} 
                    columns={logColumns} 
                    rowKey="transfer_id" 
                    loading={loading} 
                    size="small" 
                    pagination={{ pageSize: 5 }}
                 />
                 <Button type="link" icon={<HistoryOutlined />} onClick={fetchLogs} style={{ float: 'right', marginTop: 10 }}>전용 이력 새로고침</Button>
            </Card>
        </div>
    );
};

export default BudgetTransferPage;