/**
 * Página principal - Dashboard
 */
import React, { useState } from 'react';
import { Layout, Typography, Button, Space, Input, Select, Spin, Empty } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, rfpApi } from '../lib/api';
import StatsCards from '../components/dashboard/StatsCards';
import RFPTable from '../components/dashboard/RFPTable';
import UploadModal from '../components/dashboard/UploadModal';
import AppLayout from '../components/layout/AppLayout';

const { Title } = Typography;
const { Content } = Layout;

const DashboardPage: React.FC = () => {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Queries
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
  });

  const { data: rfpList, isLoading: rfpLoading, refetch: refetchRfps } = useQuery({
    queryKey: ['rfp-list', page, pageSize, statusFilter, searchText],
    queryFn: () => rfpApi.list({
      page,
      page_size: pageSize,
      status: statusFilter,
      search: searchText || undefined,
    }),
  });

  const handleRefresh = () => {
    refetchStats();
    refetchRfps();
  };

  const handleUploadSuccess = () => {
    setUploadModalOpen(false);
    handleRefresh();
  };

  return (
    <AppLayout>
      <Content style={{ padding: '24px', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 24,
        }}>
          <Title level={2} style={{ margin: 0 }}>
            Dashboard
          </Title>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleRefresh}
            >
              Actualizar
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setUploadModalOpen(true)}
            >
              Subir RFP
            </Button>
          </Space>
        </div>

        {/* Stats Cards */}
        {statsLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : stats ? (
          <StatsCards stats={stats} />
        ) : null}

        {/* Filters */}
        <div style={{ 
          display: 'flex', 
          gap: 16, 
          marginBottom: 16,
          marginTop: 24,
          flexWrap: 'wrap',
        }}>
          <Input.Search
            placeholder="Buscar por cliente o resumen..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(value) => setSearchText(value)}
            style={{ width: 300 }}
            allowClear
            enterButton
          />
          <Select
            placeholder="Filtrar por estado"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 180 }}
            allowClear
            options={[
              { value: 'pending', label: 'Pendiente' },
              { value: 'analyzing', label: 'Analizando' },
              { value: 'analyzed', label: 'Analizado' },
              { value: 'go', label: 'GO' },
              { value: 'no_go', label: 'NO GO' },
            ]}
          />
          {(searchText || statusFilter) && (
            <Button onClick={() => { setSearchText(''); setStatusFilter(undefined); }}>
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* RFP Table */}
        {rfpLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : rfpList && rfpList.items.length > 0 ? (
          <RFPTable
            data={rfpList.items}
            pagination={{
              current: page,
              pageSize,
              total: rfpList.total,
              onChange: setPage,
            }}
          />
        ) : (
          <Empty description="No hay RFPs" />
        )}

        {/* Upload Modal */}
        <UploadModal
          open={uploadModalOpen}
          onCancel={() => setUploadModalOpen(false)}
          onSuccess={handleUploadSuccess}
        />
      </Content>
    </AppLayout>
  );
};

export default DashboardPage;
