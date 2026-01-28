/**
 * Página de lista de RFPs con filtros
 */
import React, { useState } from 'react';
import { Layout, Typography, Button, Space, Input, Select, Table, Tag, Tooltip } from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined,
  DownloadOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { rfpApi } from '../lib/api';
import UploadModal from '../components/dashboard/UploadModal';
import ProposalGenerationModal from '../components/rfp/ProposalGenerationModal';
import AppLayout from '../components/layout/AppLayout';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { Content } = Layout;

interface RFPListPageProps {
  filterStatus?: 'pending' | 'approved' | 'rejected' | 'all';
}

const RFPListPage: React.FC<RFPListPageProps> = ({ filterStatus = 'all' }) => {
  const navigate = useNavigate();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [generationModalOpen, setGenerationModalOpen] = useState(false);
  const [selectedRfpId, setSelectedRfpId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Mapear filtro de status a valores del backend
  const getStatusFilter = (): string | undefined => {
    switch (filterStatus) {
      case 'pending':
        return 'analyzed'; // Pendientes de decisión
      case 'approved':
        return 'go';
      case 'rejected':
        return 'no_go';
      default:
        return undefined;
    }
  };

  // Query para obtener RFPs
  const { data: rfpList, isLoading, refetch } = useQuery({
    queryKey: ['rfp-list', page, pageSize, filterStatus, categoryFilter, searchText],
    queryFn: () => rfpApi.list({
      page,
      page_size: pageSize,
      status: getStatusFilter(),
      category: categoryFilter,
      search: searchText || undefined,
    }),
  });

  const handleUploadSuccess = () => {
    setUploadModalOpen(false);
    refetch();
  };

  // Títulos según el filtro
  const getTitle = () => {
    switch (filterStatus) {
      case 'pending':
        return 'RFPs Pendientes';
      case 'approved':
        return 'RFPs Aprobados';
      case 'rejected':
        return 'RFPs Rechazados';
      default:
        return 'Todos los RFPs';
    }
  };

  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: 'Pendiente' },
      analyzing: { color: 'processing', text: 'Analizando' },
      analyzed: { color: 'warning', text: 'Por Decidir' },
      go: { color: 'success', text: 'GO' },
      no_go: { color: 'error', text: 'NO GO' },
      error: { color: 'error', text: 'Error' },
    };
    const config = statusConfig[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getCategoryTag = (category: string | null) => {
    if (!category) return <Text type="secondary">-</Text>;
    const categoryLabels: Record<string, string> = {
      mantencion_aplicaciones: 'Mantención',
      desarrollo_software: 'Desarrollo',
      analitica: 'Analítica',
      ia_chatbot: 'IA Chatbot',
      ia_documentos: 'IA Docs',
      ia_video: 'IA Video',
      otro: 'Otro',
    };
    return <Tag>{categoryLabels[category] || category}</Tag>;
  };

  const columns: ColumnsType<any> = [
    {
      title: 'Cliente',
      dataIndex: 'client_name',
      key: 'client_name',
      width: 200,
      ellipsis: true,
      render: (text: string) => text || <Text type="secondary">Sin nombre</Text>,
    },
    {
      title: 'Archivo',
      dataIndex: 'file_name',
      key: 'file_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Categoría',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: getCategoryTag,
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: getStatusTag,
    },
    {
      title: 'Confianza',
      dataIndex: 'confidence_score',
      key: 'confidence_score',
      width: 100,
      render: (score: number | null) =>
        score ? <Tag color={score >= 70 ? 'green' : score >= 40 ? 'orange' : 'red'}>{score}%</Tag> : '-',
    },
    {
      title: 'Deadline',
      dataIndex: 'proposal_deadline',
      key: 'proposal_deadline',
      width: 120,
      render: (date: string | null) =>
        date ? new Date(date).toLocaleDateString('es-CL') : '-',
    },
    {
      title: 'Creado',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString('es-CL'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_: any, record: any) => (
        <Space>
          {record.status === 'go' && (
            <Tooltip title="Generar Propuesta">
              <Button
                type="text"
                style={{ color: '#1890ff' }}
                icon={<FilePdfOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRfpId(record.id);
                  setGenerationModalOpen(true);
                }}
              />
            </Tooltip>
          )}
          <Tooltip title="Ver detalle">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/rfp/${record.id}`);
              }}
            />
          </Tooltip>
          <Tooltip title="Descargar">
            <Button
              type="text"
              icon={<DownloadOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/api/v1/rfp/${record.id}/download`, '_blank');
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const categoryOptions = [
    { value: 'mantencion_aplicaciones', label: 'Mantención Apps' },
    { value: 'desarrollo_software', label: 'Desarrollo' },
    { value: 'analitica', label: 'Analítica' },
    { value: 'ia_chatbot', label: 'IA Chatbot' },
    { value: 'ia_documentos', label: 'IA Documentos' },
    { value: 'ia_video', label: 'IA Video' },
    { value: 'otro', label: 'Otro' },
  ];

  return (
    <AppLayout>
      <Content style={{ padding: '0', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ padding: '32px' }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 32,
          }}>
            <Title level={2} style={{ margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              {getTitle()}
            </Title>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetch()}
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

          {/* Filters */}
          <div className="content-panel" style={{
            display: 'flex',
            gap: 12,
            marginBottom: 24,
            padding: '16px 24px',
            borderRadius: 8,
            alignItems: 'center',
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
              placeholder="Categoría"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
              style={{ width: 180 }}
              allowClear
            />
            {(searchText || categoryFilter) && (
              <Button
                type="link"
                onClick={() => {
                  setSearchText('');
                  setCategoryFilter(undefined);
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>

          {/* Table */}
          <div className="content-panel" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <Table
              columns={columns}
              dataSource={rfpList?.items || []}
              rowKey="id"
              loading={isLoading}
              pagination={{
                current: page,
                pageSize,
                total: rfpList?.total || 0,
                onChange: setPage,
                showSizeChanger: false,
                showTotal: (total) => <span style={{ color: 'var(--text-secondary)' }}>{total} Resultados</span>,
              }}
              scroll={{ x: 1200 }}
              size="middle"
              rowClassName="hover-lift"
              onRow={(record) => ({
                onClick: () => navigate(`/rfp/${record.id}`),
                style: { cursor: 'pointer' },
              })}
            />
          </div>
        </div>

        {/* Upload Modal */}
        <UploadModal
          open={uploadModalOpen}
          onCancel={() => setUploadModalOpen(false)}
          onSuccess={handleUploadSuccess}
        />

        <ProposalGenerationModal
          rfpId={selectedRfpId}
          open={generationModalOpen}
          onCancel={() => {
            setGenerationModalOpen(false);
            setSelectedRfpId(null);
          }}
        />
      </Content>
    </AppLayout>
  );
};

export default RFPListPage;
