import React from 'react';
import { Layout, Menu, Badge, Typography, Space, Button, Avatar } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  ApiOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useWebsocketStore } from '../../stores/websocketStore';
import { useAuthStore } from '../../stores/authStore';
import { ApprovalNotification } from '../approvals/ApprovalNotification';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const CONNECTION_STATUS_COLOR: Record<string, string> = {
  connected: '#52c41a',
  connecting: '#faad14',
  reconnecting: '#faad14',
  disconnected: '#ff4d4f',
};

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { status } = useWebsocketStore();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const selectedKey = location.pathname.startsWith('/virtual-office')
    ? '/virtual-office'
    : location.pathname.startsWith('/projects')
    ? '/projects'
    : location.pathname.startsWith('/admin')
    ? '/admin'
    : '/';

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      onClick: () => navigate('/'),
    },
    {
      key: '/virtual-office',
      icon: <TeamOutlined />,
      label: 'Virtual Office',
      onClick: () => navigate('/virtual-office'),
    },
    {
      key: '/admin',
      icon: <SettingOutlined />,
      label: 'Admin',
      onClick: () => navigate('/admin'),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#001529',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {/* Logo */}
        <Space align="center" size={12}>
          <ApiOutlined style={{ fontSize: 24, color: '#1677ff' }} />
          <Text
            strong
            style={{ fontSize: 18, color: '#fff', letterSpacing: 1 }}
          >
            AI Corp
          </Text>
        </Space>

        {/* Right side controls */}
        <Space size={16}>
          {/* Connection status indicator */}
          <Space size={6}>
            <Badge
              color={CONNECTION_STATUS_COLOR[status] ?? '#d9d9d9'}
              text={
                <Text style={{ color: '#ccc', fontSize: 12, textTransform: 'capitalize' }}>
                  {status}
                </Text>
              }
            />
          </Space>

          <ApprovalNotification />

          <Avatar
            icon={<UserOutlined />}
            style={{ background: '#1677ff', cursor: 'pointer' }}
          />
          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{ color: '#ccc' }}
          />
        </Space>
      </Header>

      <Layout>
        <Sider
          width={220}
          style={{
            background: '#001529',
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            style={{ borderRight: 0, paddingTop: 12 }}
          />
        </Sider>

        <Content
          style={{
            padding: 24,
            background: '#0d1117',
            minHeight: 'calc(100vh - 64px)',
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
