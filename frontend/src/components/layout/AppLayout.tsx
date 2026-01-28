/**
 * Layout principal de la aplicación con sidebar completa
 * Incluye Chat flotante con botón arrastrable
 */
import React, { useState, useMemo } from 'react';
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
  ProjectOutlined,
  ReadOutlined,
  FolderOpenOutlined,
  RightOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi } from '../../lib/api';
import FloatingChat from '../chat/FloatingChat';
import type { ChatMessage } from '../../types';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Estado del chat (persistente)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Detectar RFP desde URL
  const rfpIdFromUrl = useMemo(() => {
    const match = location.pathname.match(/^\/rfp\/([a-f0-9-]+)$/i);
    return match ? match[1] : null;
  }, [location.pathname]);

  const { data: stats } = useQuery({
    queryKey: ['sidebar-stats'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 30000,
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAddMessage = (message: ChatMessage) => {
    setChatMessages((prev) => [...prev, message]);
  };

  const handleClearMessages = () => {
    setChatMessages([]);
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: <Text strong>{user?.full_name || user?.email}</Text>,
      disabled: true,
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined style={{ color: 'var(--color-primary)' }} />,
      label: <Text type="danger">Cerrar Sesión</Text>,
      onClick: handleLogout,
    },
  ];

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/') return '/';
    if (path === '/rfps') return '/rfps';
    if (path === '/rfps/pending') return '/rfps/pending';
    if (path === '/rfps/approved') return '/rfps/approved';
    if (path === '/rfps/rejected') return '/rfps/rejected';
    if (path === '/certifications') return '/certifications';
    if (path === '/experiences') return '/experiences';
    if (path === '/chapters') return '/chapters';
    if (path === '/storage') return '/storage';
    if (path === '/settings') return '/settings';
    return '/';
  };

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard', onClick: () => navigate('/') },
    { type: 'divider' as const },
    {
      key: 'rfps-grp',
      label: collapsed ? undefined : <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', paddingLeft: 16 }}>Propuestas</Text>,
      type: 'group' as const,
      children: [
        { key: '/rfps', icon: <FileTextOutlined />, label: 'Todos los RFPs', onClick: () => navigate('/rfps') },
        {
          key: '/rfps/pending',
          icon: <ClockCircleOutlined style={{ color: '#faad14' }} />,
          label: (
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              Pendientes
              {stats && stats.pending_count + stats.analyzing_count > 0 && (
                <Badge count={stats.pending_count + stats.analyzing_count} size="small" style={{ backgroundColor: '#faad14', boxShadow: 'none' }} />
              )}
            </Space>
          ),
          onClick: () => navigate('/rfps/pending'),
        },
        {
          key: '/rfps/approved',
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          label: (
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              Aprobados
              {stats && stats.go_count > 0 && <Badge count={stats.go_count} size="small" style={{ backgroundColor: '#52c41a', boxShadow: 'none' }} />}
            </Space>
          ),
          onClick: () => navigate('/rfps/approved'),
        },
        {
          key: '/rfps/rejected',
          icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
          label: (
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              Rechazados
              {stats && stats.no_go_count > 0 && <Badge count={stats.no_go_count} size="small" style={{ backgroundColor: '#ff4d4f', boxShadow: 'none' }} />}
            </Space>
          ),
          onClick: () => navigate('/rfps/rejected'),
        }
      ]
    },
    { type: 'divider' as const },
    {
      key: 'kb-grp',
      label: collapsed ? undefined : <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', paddingLeft: 16 }}>Knowledge Base</Text>,
      type: 'group' as const,
      children: [
        { key: '/certifications', icon: <SafetyCertificateOutlined />, label: 'Certificaciones', onClick: () => navigate('/certifications') },
        { key: '/experiences', icon: <ProjectOutlined />, label: 'Experiencias', onClick: () => navigate('/experiences') },
        { key: '/chapters', icon: <ReadOutlined />, label: 'Capítulos', onClick: () => navigate('/chapters') },
        { key: '/storage', icon: <FolderOpenOutlined />, label: 'Archivos', onClick: () => navigate('/storage') },
      ]
    },
    { type: 'divider' as const },
    { key: '/settings', icon: <SettingOutlined />, label: 'Configuración', onClick: () => navigate('/settings') },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        theme="dark"
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        width={260}
        style={{
          overflow: 'hidden',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
          borderRight: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)', // Pure dark sidebar
          boxShadow: '4px 0 24px rgba(0,0,0,0.4)'
        }}
        trigger={
          <div style={{
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-color)',
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)'
          }}>
            {collapsed ? <RightOutlined /> : <div style={{ fontSize: 12, letterSpacing: 1 }}>CERRAR MENÚ</div>}
          </div>
        }
      >
        {/* LOGO AREA */}
        <div style={{
          height: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          paddingLeft: collapsed ? 0 : 24,
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(227, 24, 55, 0.03)' // Subtle red tint
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, #E31837 0%, #B00020 100%)', // Red gradient
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(227, 24, 55, 0.4)'
            }}>
              <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>T</span>
            </div>
            {!collapsed && (
              <Text style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
                TIVIT<span style={{ color: 'var(--color-primary)' }}>.AI</span>
              </Text>
            )}
          </div>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          items={menuItems}
          style={{
            marginTop: 16,
            background: 'transparent',
            borderRight: 'none',
            padding: '0 8px'
          }}
        />
      </Sider>

      <Layout style={{
        marginLeft: collapsed ? 80 : 260,
        background: 'var(--bg-primary)',
        transition: 'all 0.2s ease'
      }}>
        <Header style={{
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          height: 72,
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          zIndex: 900
        }}>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
            <div
              className="hover-lift"
              style={{
                cursor: 'pointer',
                padding: '4px 12px 4px 4px', // Tighter padding
                borderRadius: 40,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(0, 0, 0, 0.4)', // Darker, glass-like
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                height: 40 // Fixed, smaller height
              }}
            >
              <Avatar
                size={32}
                icon={<UserOutlined />}
                style={{
                  background: 'linear-gradient(135deg, #E31837 0%, #ff4d4f 100%)', // Premium gradient
                  color: '#fff',
                  border: '2px solid rgba(255,255,255,0.1)'
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, marginRight: 4 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: 500, letterSpacing: '0.3px' }}>
                  {user?.full_name?.split(' ')[0]}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 400 }}>
                  Admin
                </Text>
              </div>
              <RightOutlined style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }} />
            </div>
          </Dropdown>
        </Header>
        <Content style={{ background: 'var(--bg-primary)', padding: '32px' }}>
          {children}
        </Content>
      </Layout>

      {/* Floating Chat */}
      <FloatingChat
        rfpId={rfpIdFromUrl}
        messages={chatMessages}
        onAddMessage={handleAddMessage}
        onClearMessages={handleClearMessages}
      />
    </Layout>
  );
};

export default AppLayout;


