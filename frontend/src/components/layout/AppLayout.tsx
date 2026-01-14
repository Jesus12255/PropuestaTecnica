/**
 * Layout principal de la aplicación con sidebar completa
 */
import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Typography, Space, Badge } from 'antd';
import {
  DashboardOutlined,
  LogoutOutlined,
  UserOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi } from '../../lib/api';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Query para obtener conteo de pendientes
  const { data: stats } = useQuery({
    queryKey: ['sidebar-stats'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 30000, // Refrescar cada 30s
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: user?.full_name || user?.email,
      disabled: true,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Cerrar Sesión',
      onClick: handleLogout,
    },
  ];

  // Determinar la key seleccionada basado en la ruta
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/') return '/';
    if (path === '/rfps') return '/rfps';
    if (path === '/rfps/pending') return '/rfps/pending';
    if (path === '/rfps/approved') return '/rfps/approved';
    if (path === '/rfps/rejected') return '/rfps/rejected';
    if (path === '/certifications') return '/certifications';
    if (path === '/settings') return '/settings';
    return '/';
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      onClick: () => navigate('/'),
    },
    {
      key: '/rfps',
      icon: <FileTextOutlined />,
      label: 'Todos los RFPs',
      onClick: () => navigate('/rfps'),
    },
    {
      key: '/rfps/pending',
      icon: <ClockCircleOutlined />,
      label: (
        <Space>
          Pendientes
          {stats && stats.pending_count + stats.analyzing_count > 0 && (
            <Badge
              count={stats.pending_count + stats.analyzing_count}
              size="small"
              style={{ backgroundColor: '#faad14' }}
            />
          )}
        </Space>
      ),
      onClick: () => navigate('/rfps/pending'),
    },
    {
      key: '/rfps/approved',
      icon: <CheckCircleOutlined />,
      label: (
        <Space>
          Aprobados
          {stats && stats.go_count > 0 && (
            <Badge
              count={stats.go_count}
              size="small"
              style={{ backgroundColor: '#52c41a' }}
            />
          )}
        </Space>
      ),
      onClick: () => navigate('/rfps/approved'),
    },
    {
      key: '/rfps/rejected',
      icon: <CloseCircleOutlined />,
      label: (
        <Space>
          Rechazados
          {stats && stats.no_go_count > 0 && (
            <Badge
              count={stats.no_go_count}
              size="small"
              style={{ backgroundColor: '#ff4d4f' }}
            />
          )}
        </Space>
      ),
      onClick: () => navigate('/rfps/rejected'),
    },
    {
      key: '/certifications',
      icon: <SafetyCertificateOutlined />,
      label: 'Certificaciones',
      onClick: () => navigate('/certifications'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Configuración',
      onClick: () => navigate('/settings'),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="dark"
        width={240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <Text strong style={{ color: '#fff', fontSize: 18 }}>
            ◆ TIVIT Proposals
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          style={{ marginTop: 16 }}
        />
      </Sider>

      <Layout style={{ marginLeft: 240 }}>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        }}>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <Text>{user?.full_name}</Text>
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ background: '#f5f5f5' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
