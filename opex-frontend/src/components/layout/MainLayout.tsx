// src/components/layout/MainLayout.tsx
import React, { useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  DesktopOutlined,
  PieChartOutlined,
  FileProtectOutlined,
  DollarOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Header, Content, Footer, Sider } = Layout;

// 메뉴 구조 정의 (IA 기반)
const items = [
  { key: '/', icon: <DesktopOutlined />, label: '대시보드' },
  {
    key: 'planning',
    icon: <FileProtectOutlined />,
    label: '예산 계획',
    children: [
      { key: '/planning/list', label: '사업 계획 관리' },
      { key: '/planning/bulk', label: '사업계획 마스터 등록' },
      { key: '/planning/transfer', label: '예산 전용 신청' },
    ],
  },
  {
    key: 'execution',
    icon: <DollarOutlined />,
    label: '실적 관리',
    children: [
      { key: '/execution/input', label: '월별 실적 입력' },
      { key: '/execution/sap', label: 'SAP 대사 관리' },
    ],
  },
  { key: '/report', icon: <PieChartOutlined />, label: '분석 리포트' },
  { key: '/admin', icon: <SettingOutlined />, label: '기준정보 관리' },
  
];

const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { token: { colorBgContainer } } = theme.useToken();
  const navigate = useNavigate();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 좌측 사이드바 */}
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255, 255, 255, 0.2)', color: 'white', textAlign: 'center', lineHeight: '32px', fontWeight: 'bold' }}>
          IT Opex
        </div>
        <Menu 
          theme="dark" 
          defaultSelectedKeys={['/']} 
          mode="inline" 
          items={items} 
          onClick={({ key }) => navigate(key)} // 클릭 시 페이지 이동
        />
      </Sider>
      
      {/* 우측 본문 영역 */}
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer, textAlign: 'right', paddingRight: '20px' }}>
          <span style={{ marginRight: 10 }}>홍길동 님</span>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div style={{ padding: 24, minHeight: 360, background: colorBgContainer }}>
            {/* 여기가 실제 페이지가 바뀌는 부분입니다 */}
            <Outlet /> 
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>IT Opex Management System ©2025 Created by IT Team</Footer>
      </Layout>
    </Layout>
  );
};

export default MainLayout;