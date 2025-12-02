// src/App.tsx (최종 정리)

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import DashboardPage from './pages/dashboard/DashboardPage';
// import BudgetPlanPage from './pages/planning/BudgetPlanPage'; <--- 이 Import는 삭제합니다!
import AdminPage from './pages/admin/AdminPage';
import MonthlyInputPage from './pages/execution/MonthlyInputPage';
import SapReconcilePage from './pages/execution/SapReconcilePage';
import ReportPage from './pages/report/ReportPage';
// import ProjectMasterPage from './pages/planning/ProjectMasterPage'; <--- 이 Import는 삭제합니다!
import ProjectBulkMasterPage from './pages/planning/ProjectBulkMasterPage';
import BudgetTransferPage from './pages/planning/BudgetTransferPage';
import ProjectSingleMasterPage from './pages/planning/ProjectSingleMasterPage'; // <--- 최종 사용 컴포넌트

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* 메인 레이아웃으로 감싸기 */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          
          {/* 기획 메뉴 */}
          {/* [수정] 최종 단일 등록 페이지를 planning/list 경로에 연결합니다. */}
          <Route path="planning/list" element={<ProjectSingleMasterPage />} />
          
          {/* 관리 메뉴 */}
          <Route path="admin" element={<AdminPage />} />
          
          {/* 실행 메뉴 (중복 라우트 정리) */}
          <Route path="execution/input" element={<MonthlyInputPage />} />
          <Route path="execution/sap" element={<SapReconcilePage />} />
          <Route path="report" element={<ReportPage />} />

          {/* Bulk 및 Transfer 메뉴 */}
          <Route path="planning/bulk" element={<ProjectBulkMasterPage />} />      
          <Route path="planning/transfer" element={<BudgetTransferPage />} />    

          {/* 아직 정의되지 않은 경로 처리는 맨 마지막에 위치 */}
          <Route path="*" element={<DashboardPage />} /> 

        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;