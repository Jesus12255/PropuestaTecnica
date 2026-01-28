/**
 * Tabla de RFPs
 */
import React from 'react';
import { Table, Tag, Button, Space, Tooltip, Popover } from 'antd';
import {
  EyeOutlined,
  CalendarOutlined,
  QuestionCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { RFPSummary, RFPStatus, Recommendation } from '../../types';
import dayjs from 'dayjs';

interface RFPTableProps {
  data: RFPSummary[];
  pagination: TablePaginationConfig;
}

const statusConfig: Record<RFPStatus, { color: string; label: string }> = {
  pending: { color: 'default', label: 'Pendiente' },
  analyzing: { color: 'processing', label: 'Analizando' },
  analyzed: { color: 'warning', label: 'Analizado' },
  go: { color: 'success', label: 'GO' },
  no_go: { color: 'error', label: 'NO GO' },
  error: { color: 'error', label: 'Error' },
};

const recommendationConfig: Record<Recommendation, { color: string; label: string }> = {
  strong_go: { color: 'green', label: 'Muy Recomendable' },
  go: { color: 'lime', label: 'Recomendable' },
  conditional_go: { color: 'gold', label: 'Condicional' },
  no_go: { color: 'orange', label: 'No Recomendable' },
  strong_no_go: { color: 'red', label: 'No Participar' },
};

// Helper component: Status Help Popover
const StatusHelpPopover: React.FC = () => {
  const content = (
    <div style={{ maxWidth: 350 }}>
      <div style={{ marginBottom: 8 }}>
        <Tag color="default">Pendiente</Tag>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          RFP recién cargado, esperando análisis
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Tag color="processing">Analizando</Tag>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          IA procesando el documento
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Tag color="warning">Analizado</Tag>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          Análisis completado, esperando decisión
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Tag color="success">GO</Tag>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          Decisión tomada - Participar en la licitación
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Tag color="error">NO GO</Tag>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          Decisión tomada - No participar
        </div>
      </div>
      <div>
        <Tag color="error">Error</Tag>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          Problema durante el análisis
        </div>
      </div>
    </div>
  );

  return (
    <Popover content={content} title="Estados del RFP" trigger="hover">
      <QuestionCircleOutlined style={{ marginLeft: 4, color: '#888', cursor: 'help' }} />
    </Popover>
  );
};

// Helper component: Recommendation Help Popover
const RecommendationHelpPopover: React.FC = () => {
  const content = (
    <div style={{ maxWidth: 380 }}>
      <div style={{ marginBottom: 8 }}>
        <Tag color="green">Muy Recomendable</Tag>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          Alta probabilidad de éxito, equipo capacitado y alineado con la estrategia
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Tag color="lime">Recomendable</Tag>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          Cumple requisitos principales, riesgo moderado y manejable
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Tag color="gold">Condicional</Tag>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          Requiere evaluación adicional, recursos específicos o análisis de viabilidad
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Tag color="orange">No Recomendable</Tag>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          Riesgos significativos identificados, presupuesto insuficiente o alcance poco claro
        </div>
      </div>
      <div>
        <Tag color="red">No Participar</Tag>
        <div style={{ marginTop: 4, fontSize: 12 }}>
          No cumple requisitos mínimos, fuera de alcance o incompatible con capacidades
        </div>
      </div>
    </div>
  );

  return (
    <Popover content={content} title="Niveles de Recomendación" trigger="hover">
      <QuestionCircleOutlined style={{ marginLeft: 4, color: '#888', cursor: 'help' }} />
    </Popover>
  );
};

const RFPTable: React.FC<RFPTableProps> = ({ data, pagination }) => {
  const navigate = useNavigate();

  const columns: ColumnsType<RFPSummary> = [
    {
      title: 'Cliente',
      dataIndex: 'client_name',
      key: 'client_name',
      render: (text, record) => (
        <Button type="link" onClick={() => navigate(`/rfp/${record.id}`)}>
          {text || record.file_name}
        </Button>
      ),
    },
    {
      title: 'Nombre del Proyecto',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (text) => text || '-',
    },
    {
      title: 'País',
      dataIndex: 'country',
      key: 'country',
      width: 100,
      render: (text) => text || '-',
    },
    {
      title: 'Categoría',
      dataIndex: 'category',
      key: 'category',
      width: 160,
      render: (text) => text ? (
        <Tag>{text.replace(/_/g, ' ')}</Tag>
      ) : '-',
    },
    {
      title: 'Presupuesto',
      key: 'budget',
      width: 150,
      render: (_, record) => {
        if (!record.budget_min && !record.budget_max) return '-';
        return `${record.currency} ${(record.budget_min || record.budget_max)?.toLocaleString()}`;
      },
    },
    {
      title: 'Deadline',
      dataIndex: 'proposal_deadline',
      key: 'proposal_deadline',
      width: 120,
      render: (date) => date ? (
        <Tooltip title={dayjs(date).format('DD/MM/YYYY')}>
          <Space>
            <CalendarOutlined />
            {dayjs(date).format('DD/MM')}
          </Space>
        </Tooltip>
      ) : '-',
    },
    {
      title: (
        <span>
          Recomendación
          <RecommendationHelpPopover />
        </span>
      ),
      dataIndex: 'recommendation',
      key: 'recommendation',
      width: 160,
      render: (rec: Recommendation | null) => rec ? (
        <Tag color={recommendationConfig[rec].color}>
          {recommendationConfig[rec].label}
        </Tag>
      ) : '-',
    },
    {
      title: (
        <span>
          Estado
          <StatusHelpPopover />
        </span>
      ),
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: RFPStatus) => (
        <Tag color={statusConfig[status].color}>
          {statusConfig[status].label}
        </Tag>
      ),
    },
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
      render: (date) => dayjs(date).format('DD/MM/YY'),
    },
    {
      title: 'Acciones',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Ver detalles">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/rfp/${record.id}`)}
            />
          </Tooltip>
          {(record.status === 'analyzed' || record.status === 'go' || record.status === 'no_go') && (
            <Tooltip title="Ver análisis">
              <Button
                type="text"
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => navigate(`/rfp/${record.id}`)}
              />
            </Tooltip>
          )}
          <Tooltip title="Descargar RFP">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => {
                // TODO: Implement download functionality
                console.log('Download RFP:', record.id);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="content-panel" style={{ borderRadius: 8, overflow: 'hidden', padding: 0 }}>
      {/* Clean Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-secondary)'
      }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 15, fontWeight: 600 }}>
          Listado de Propuestas
        </h3>
        <Space size="small">
          <Button type="text" size="small" icon={<DownloadOutlined />} />
        </Space>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        pagination={pagination}
        scroll={{ x: 1400 }}
        size="middle"
        rowClassName="hover-lift"
      />
    </div>
  );
};

export default RFPTable;
