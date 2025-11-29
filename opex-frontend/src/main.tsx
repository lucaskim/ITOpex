// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ConfigProvider } from 'antd'; // 디자인 설정 컴포넌트
import koKR from 'antd/lib/locale/ko_KR'; // 한국어 팩
import 'antd/dist/reset.css'; // Ant Design 기본 스타일 초기화

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 한국어 설정 적용 */}
    <ConfigProvider locale={koKR}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)