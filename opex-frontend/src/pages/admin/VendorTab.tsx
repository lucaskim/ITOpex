// src/pages/admin/VendorTab.tsx
import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { getVendors, createVendor } from '../../api/vendorApi';
// 'import type'을 쓰거나 중괄호 안에 'type'을 붙여야 합니다.
import type { Vendor, VendorCreate } from '../../types';

const VendorTab: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 1. 데이터 불러오기
  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getVendors();
      setVendors(data);
    } catch (error) {
      message.error('데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 화면 켜지면 바로 조회
  useEffect(() => {
    fetchData();
  }, []);

  // 2. 등록 처리
  const handleCreate = async (values: VendorCreate) => {
    try {
      await createVendor(values);
      message.success('업체가 등록되었습니다.');
      setIsModalOpen(false);
      form.resetFields();
      fetchData(); // 목록 갱신
    } catch (error: any) {
      // 백엔드에서 보낸 에러 메시지 표시 (예: 중복 사업자번호)
      message.error(error.response?.data?.detail || '등록 실패');
    }
  };

  // 3. 테이블 컬럼 정의
  const columns = [
    { title: '업체코드', dataIndex: 'vendor_id', key: 'vendor_id', width: 100 },
    { title: '업체명', dataIndex: 'vendor_name', key: 'vendor_name', width: 200 },
    { title: '사업자번호', dataIndex: 'biz_reg_no', key: 'biz_reg_no', width: 150 },
    { title: 'SAP코드', dataIndex: 'sap_vendor_cd', key: 'sap_vendor_cd', width: 100 },
    { title: '별칭(Alias)', dataIndex: 'vendor_alias', key: 'vendor_alias' },
    { 
      title: '상태', dataIndex: 'is_active', key: 'is_active', width: 80,
      render: (val: string) => <Tag color={val === 'Y' ? 'green' : 'red'}>{val}</Tag> 
    },
  ];

  return (
    <div>
      {/* 상단 버튼 영역 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3>🏢 계약업체 목록</h3>
        <div>
          <Button icon={<ReloadOutlined />} onClick={fetchData} style={{ marginRight: 8 }}>새로고침</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>신규 등록</Button>
        </div>
      </div>

      {/* 데이터 그리드 */}
      <Table 
        dataSource={vendors} 
        columns={columns} 
        rowKey="vendor_id" 
        loading={loading} 
        pagination={{ pageSize: 10 }}
        size="small"
        bordered
      />

      {/* 등록 팝업 (모달) */}
      <Modal
        title="신규 업체 등록"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()} // 확인 버튼 누르면 폼 제출
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="업체명" name="vendor_name" rules={[{ required: true }]}>
            <Input placeholder="(주)에스케이텔레콤" />
          </Form.Item>
          <Form.Item label="사업자등록번호" name="biz_reg_no" rules={[{ required: true }]}>
            <Input placeholder="123-45-67890 (하이픈 포함)" />
          </Form.Item>
          <Form.Item label="SAP 공급업체 코드" name="sap_vendor_cd">
            <Input placeholder="예: 512272" />
          </Form.Item>
          <Form.Item label="검색 별칭 (Alias)" name="vendor_alias">
            <Input placeholder="예: SKT, SK텔레콤" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VendorTab;