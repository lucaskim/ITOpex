// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import DashboardPage from './pages/dashboard/DashboardPage';
import BudgetPlanPage from './pages/planning/BudgetPlanPage';
import AdminPage from './pages/admin/AdminPage';
import MonthlyInputPage from './pages/execution/MonthlyInputPage';
import SapReconcilePage from './pages/execution/SapReconcilePage';
import ReportPage from './pages/report/ReportPage';
import ProjectMasterPage from './pages/planning/ProjectMasterPage';
import ProjectBulkMasterPage from './pages/planning/ProjectBulkMasterPage';
import BudgetTransferPage from './pages/planning/BudgetTransferPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* 메인 레이아웃으로 감싸기 */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          
          {/* 기획 메뉴 */}
          <Route path="planning/list" element={<BudgetPlanPage />} />
          
          {/* 관리 메뉴 */}
          <Route path="admin" element={<AdminPage />} />
          
          {/* 아직 안 만든 페이지는 임시로 대시보드 보여주기 */}
          <Route path="*" element={<DashboardPage />} />

          <Route path="execution/input" element={<MonthlyInputPage />} />

          <Route path="execution/sap" element={<SapReconcilePage />} />

          <Route path="report" element={<ReportPage />} />

          <Route path="planning/list" element={<ProjectMasterPage />} />

          <Route path="planning/bulk" element={<ProjectBulkMasterPage />} />      

          <Route path="planning/transfer" element={<BudgetTransferPage />} />    

        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;