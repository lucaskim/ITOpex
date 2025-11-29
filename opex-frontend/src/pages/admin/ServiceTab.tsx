// src/pages/admin/ServiceTab.tsx
import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Radio, message, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { getServices, createService } from '../../api/serviceApi';
import type { Service, ServiceCreate } from '../../types';

const ServiceTab: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getServices();
      setServices(data);
    } catch (error) {
      message.error('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (values: ServiceCreate) => {
    try {
      await createService(values);
      message.success('서비스가 등록되었습니다.');
      setIsModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error('등록 실패');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'svc_id', width: 100 },
    { title: '서비스명', dataIndex: 'svc_name', width: 200, fontWeight: 'bold' },
    { title: '운영자', dataIndex: 'operator_names' },
    { title: '계약방식', dataIndex: 'contract_type', width: 100 },
    { 
      title: '상주여부', dataIndex: 'is_resident', width: 100,
      render: (val: string) => val === 'Y' ? <Tag color="blue">상주</Tag> : <Tag>비상주</Tag>
    },
    { title: '상태', dataIndex: 'is_active', width: 80, render: (val: string) => <Tag color={val==='Y'?'green':'red'}>{val}</Tag> },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3>📱 서비스(App) 목록</h3>
        <div>
          <Button icon={<ReloadOutlined />} onClick={fetchData} style={{ marginRight: 8 }}>새로고침</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>신규 등록</Button>
        </div>
      </div>

      <Table dataSource={services} columns={columns} rowKey="svc_id" loading={loading} size="small" bordered />

      <Modal title="신규 서비스 등록" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleCreate} initialValues={{ is_resident: 'N', is_active: 'Y' }}>
          <Form.Item label="서비스명" name="svc_name" rules={[{ required: true }]}>
            <Input placeholder="예: 모바일Toktok" />
          </Form.Item>
          <Form.Item label="주 운영자명" name="operator_names">
            <Input placeholder="예: 홍길동, 김철수" />
          </Form.Item>
          <Form.Item label="계약 방식" name="contract_type">
            <Select placeholder="선택하세요">
              <Select.Option value="직계약">직계약</Select.Option>
              <Select.Option value="재계약">재계약</Select.Option>
              <Select.Option value="기타">기타</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="상주 여부" name="is_resident">
            <Radio.Group>
              <Radio value="N">비상주</Radio>
              <Radio value="Y">상주</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ServiceTab;