import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { useEffect } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { VirtualOffice } from './pages/VirtualOffice';
import { ProjectDetail } from './pages/ProjectDetail';
import { AgentDetail } from './pages/AgentDetail';
import { AdminDashboard } from './pages/AdminDashboard';
import socketClient from './lib/websocket/socket-client';
import { useAuthStore } from './stores/authStore';

export function App() {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      socketClient.connect();
      return () => {
        socketClient.disconnect();
      };
    }
  }, [isAuthenticated]);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          colorBgContainer: '#161b22',
          colorBgElevated: '#1c2128',
          colorBorder: '#30363d',
          colorText: '#e6edf3',
          colorTextSecondary: '#8b949e',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        components: {
          Layout: {
            bodyBg: '#0d1117',
            siderBg: '#001529',
            headerBg: '#001529',
          },
          Menu: {
            darkItemBg: '#001529',
            darkItemSelectedBg: '#1677ff22',
          },
          Card: {
            colorBgContainer: '#161b22',
          },
        },
      }}
    >
      <Router>
        <Routes>
          <Route path="/auth" element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />} />
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/virtual-office" element={<VirtualOffice />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/agents/:id" element={<AgentDetail />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Routes>
      </Router>
    </ConfigProvider>
  );
}
