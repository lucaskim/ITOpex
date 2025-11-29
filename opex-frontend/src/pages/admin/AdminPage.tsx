// src/pages/admin/AdminPage.tsx
import React from 'react';
import { Tabs } from 'antd';
import VendorTab from './VendorTab';
import ServiceTab from './ServiceTab';
import ClosingTab from './ClosingTab';

const AdminPage: React.FC = () => {
  // 탭 목록 정의
  const items = [
    {
      key: '1',
      label: '계약업체 관리',
      children: <VendorTab />, 
    },
    {
      key: '2',
      label: '서비스 관리',
      children: <ServiceTab />,
    },
    { key: '3', label: '월별 마감 통제', children: <ClosingTab /> },
    {
      key: '4',
      label: '계정/예산코드',
      children: <div>🚧 계정 관리 화면 준비중...</div>,
    },
  ];

  return (
    <div style={{ background: '#fff', padding: 20, minHeight: '100%' }}>
      <h2>⚙️ 기준정보 관리</h2>
      <p style={{ color: '#888' }}>시스템 운영에 필요한 기초 데이터를 관리합니다.</p>
      <Tabs defaultActiveKey="1" items={items} />
    </div>
  );
};

export default AdminPage;