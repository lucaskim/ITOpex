// src/pages/planning/BudgetPlanPage.tsx
import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, InputNumber, message, Row, Col, Card } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { getProjects, createProject } from '../../api/projectApi';
import { getVendors } from '../../api/vendorApi';   // 업체 목록용
import { getServices } from '../../api/serviceApi'; // 서비스 목록용
import type { Project, ProjectCreate } from '../../types';

const BudgetPlanPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 1. 초기 데이터 로드 (사업목록 + 업체/서비스 콤보박스용 데이터)
  const initData = async () => {
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
      message.error('데이터 로드 실패');
    }
  };

  useEffect(() => { initData(); }, []);

  // 2. 저장 처리
  const handleCreate = async (values: any) => {
    try {
      // 폼 데이터(monthly_1, monthly_2...)를 배열([100, 200...])로 변환
      const amounts = [];
      for(let i=1; i<=12; i++) {
        amounts.push(values[`month_${i}`] || 0);
      }

      const payload: ProjectCreate = {
        ...values,
        monthly_amounts: amounts
      };

      await createProject(payload);
      message.success('사업 계획이 등록되었습니다.');
      setIsModalOpen(false);
      form.resetFields();
      initData();
    } catch (err) {
      message.error('저장 실패');
    }
  };

  // 테이블 컬럼
  const columns = [
    { title: 'Index', dataIndex: 'proj_id', width: 100 },
    { title: '사업명', dataIndex: 'proj_name', width: 200 },
    { title: '부서', dataIndex: 'dept_code', width: 80 },
    { title: '상태', dataIndex: 'proj_status', width: 100 },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3>📝 2025년 사업 계획 관리</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>신규 사업 등록</Button>
      </div>

      <Table dataSource={projects} columns={columns} rowKey="proj_id" size="small" bordered />

      {/* 등록 모달 */}
      <Modal title="신규 사업 및 예산 등록" open={isModalOpen} width={800} onCancel={() => setIsModalOpen(false)} onOk={form.submit}>
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ dept_code: 'A' }}>
          
          {/* 기본 정보 영역 */}
          <Card size="small" title="1. 기본 정보" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="사업명" name="proj_name" rules={[{ required: true }]}>
                  <Input placeholder="예: 방화벽 교체 사업" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="부서" name="dept_code">
                  <Select>
                    <Select.Option value="A">DX운영(A)</Select.Option>
                    <Select.Option value="B">DX기획(B)</Select.Option>
                    <Select.Option value="C">보안(C)</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="예산성격" name="budget_nature">
                  <Select placeholder="선택">
                    <Select.Option value="용역비">용역비</Select.Option>
                    <Select.Option value="소모품비">소모품비</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="계약 업체" name="vendor_id">
                  <Select placeholder="업체 선택" showSearch optionFilterProp="label">
                    {vendors.map(v => (
                      <Select.Option key={v.vendor_id} value={v.vendor_id} label={v.vendor_name}>
                        {v.vendor_name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="대상 서비스" name="svc_id">
                  <Select placeholder="서비스 선택">
                    {services.map(s => (
                      <Select.Option key={s.svc_id} value={s.svc_id}>
                        {s.svc_name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* 월별 예산 영역 */}
          <Card size="small" title="2. 월별 예산 계획 (VAT 별도, 원 단위)">
            <Row gutter={8}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <Col span={6} key={m}>
                  <Form.Item label={`${m}월`} name={`month_${m}`}>
                    <InputNumber 
                      style={{ width: '100%' }} 
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
                    />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Card>

        </Form>
      </Modal>
    </div>
  );
};

export default BudgetPlanPage;