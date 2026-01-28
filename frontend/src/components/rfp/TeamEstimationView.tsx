/**
 * Componente para visualizar la estimación de equipo
 */
import React, { useState } from 'react';
import { Table, Tag, Space, Typography, Tooltip, Empty, Row, Col, InputNumber } from 'antd';
import {
  TeamOutlined,
  InfoCircleOutlined,
  UserOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { CitationViewer } from '../common/CitationViewer';
import type { TeamEstimation, RoleEstimation, Seniority, RFPFile } from '../../types';
import type { ColumnsType } from 'antd/es/table';

const { Text, Title } = Typography;

interface TeamEstimationViewProps {
  teamEstimation: TeamEstimation | null;
  loading?: boolean;
  files: RFPFile[] | undefined;
  onPreviewFile?: (file: RFPFile, page?: number) => void;
}

const seniorityColors: Record<Seniority, string> = {
  junior: 'default',
  mid: 'processing', // Blue-ish
  senior: 'purple',
  lead: 'gold',
};

const seniorityLabels: Record<Seniority, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
};

const TeamEstimationView: React.FC<TeamEstimationViewProps> = ({ teamEstimation, loading, files, onPreviewFile }) => {
  // Estado para manejar roles editables
  const [editableRoles, setEditableRoles] = useState<RoleEstimation[]>(
    teamEstimation?.roles || []
  );

  // Actualizar roles cuando cambie teamEstimation
  React.useEffect(() => {
    if (teamEstimation?.roles) {
      setEditableRoles(teamEstimation.roles);
    }
  }, [teamEstimation]);

  // Función para actualizar la cantidad de un rol
  const handleQuantityChange = (roleId: string, newQuantity: number | null) => {
    if (newQuantity === null || newQuantity < 1) return;

    setEditableRoles(prevRoles =>
      prevRoles.map(role =>
        role.role_id === roleId
          ? { ...role, quantity: newQuantity }
          : role
      )
    );
  };

  // Calcular total headcount dinámico
  const totalHeadcount = editableRoles.reduce((sum, role) => sum + role.quantity, 0);

  if (!teamEstimation) {
    return (
      <Empty
        description="No hay estimación de equipo disponible"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  const columns: ColumnsType<RoleEstimation> = [
    {
      title: 'ROL',
      dataIndex: 'title',
      key: 'title',
      width: 220,
      render: (title: string, record) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ color: 'var(--text-primary)', fontSize: 15 }}>{title}</Text>
          {record.justification && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              <CitationViewer text={record.justification} files={files} onPreviewFile={onPreviewFile} />
            </div>
          )}
        </Space>
      ),
    },
    {
      title: 'CANTIDAD',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      align: 'center',
      render: (qty: number, record: RoleEstimation) => (
        <Tooltip title="Puedes editar esta cantidad">
          <InputNumber
            min={1}
            max={20}
            value={qty}
            onChange={(value) => handleQuantityChange(record.role_id, value)}
            size="middle"
            style={{ width: 70, textAlign: 'center' }}
          />
        </Tooltip>
      ),
    },
    {
      title: 'SENIORITY',
      dataIndex: 'seniority',
      key: 'seniority',
      width: 120,
      align: 'center',
      render: (seniority: Seniority) => (
        <Tag
          color={seniorityColors[seniority]}
          style={{ width: 80, textAlign: 'center', margin: 0, fontWeight: 600 }}
        >
          {seniorityLabels[seniority]}
        </Tag>
      ),
    },
    {
      title: 'DEDICACIÓN',
      dataIndex: 'dedication',
      key: 'dedication',
      width: 120,
      align: 'center',
      render: (dedication: string) => (
        <Text style={{ color: 'var(--text-secondary)' }}>
          {dedication === 'full_time' ? 'Full Time' : 'Part Time'}
        </Text>
      ),
    },
    {
      title: 'SKILLS REQUERIDOS',
      dataIndex: 'required_skills',
      key: 'required_skills',
      width: 200,
      render: (skills: string[]) => (
        <Space wrap size={[4, 4]}>
          {skills.slice(0, 3).map((skill, i) => (
            <Tag key={i} style={{ fontSize: 11, margin: 0, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
              {skill}
            </Tag>
          ))}
          {skills.length > 3 && (
            <Tooltip title={skills.slice(3).join(', ')}>
              <Tag style={{ fontSize: 11, margin: 0, cursor: 'help' }}>+{skills.length - 3}</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'TARIFA/MES',
      key: 'rate',
      width: 140,
      align: 'right',
      render: (_, record) => {
        if (!record.market_rate) return <Text type="secondary">-</Text>;
        const { average, currency } = record.market_rate;
        return (
          <Tooltip title={`Rango: ${record.market_rate.min?.toLocaleString()} - ${record.market_rate.max?.toLocaleString()}`}>
            <Text style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {currency} {average?.toLocaleString()}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'SUBTOTAL',
      dataIndex: 'subtotal_monthly',
      key: 'subtotal_monthly',
      width: 140,
      align: 'right',
      render: (subtotal: number | null, record) => {
        if (!subtotal) return <Text type="secondary">-</Text>;
        const currency = record.market_rate?.currency || 'USD';
        return (
          <Text strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace', fontSize: 15 }}>
            {currency} {subtotal.toLocaleString()}
          </Text>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Summary Cards */}
      <div className="content-panel" style={{ padding: '24px' }}>
        <Row gutter={24}>
          <Col span={8}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(227, 24, 55, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <TeamOutlined style={{ fontSize: 24, color: 'var(--color-primary)' }} />
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Personas</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{totalHeadcount}</div>
              </div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <UserOutlined style={{ fontSize: 24, color: 'var(--color-success)' }} />
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Roles Diferentes</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{editableRoles.length}</div>
              </div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: 'rgba(245, 158, 11, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <RobotOutlined style={{ fontSize: 24, color: 'var(--color-warning)' }} />
              </div>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Confianza IA</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                  {Math.round(teamEstimation.confidence * 100)}%
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      <div className="content-panel" style={{ overflow: 'hidden' }}>
        {/* Source info header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-tertiary)'
        }}>
          <Space>
            <Title level={5} style={{ margin: 0, color: 'var(--text-primary)' }}>Desglose de Equipo</Title>
            <Tooltip title={teamEstimation.source === 'client_specified' ? 'El cliente definió explícitamente estos roles' : 'La IA sugirió estos roles basándose en los requerimientos'}>
              <Tag color={teamEstimation.source === 'client_specified' ? 'blue' : 'purple'} style={{ border: 'none' }}>
                {teamEstimation.source === 'client_specified' ? 'Solicitado por Cliente' : 'Sugerido por IA'}
              </Tag>
            </Tooltip>
          </Space>
        </div>

        {/* Team Table */}
        <Table
          columns={columns}
          dataSource={teamEstimation.roles}
          rowKey="role_id"
          loading={loading}
          pagination={false}
          size="middle"
          scroll={{ x: 1000 }}
        />
      </div>

      {/* Rationale */}
      {teamEstimation.rationale && (
        <div className="content-panel" style={{ padding: 24 }}>
          <Space align="center" style={{ marginBottom: 16 }}>
            <InfoCircleOutlined style={{ color: 'var(--color-info)' }} />
            <Text strong style={{ fontSize: 16 }}>Justificación de la Estimación</Text>
          </Space>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: 24, borderLeft: '2px solid var(--color-info)' }}>
            <CitationViewer text={teamEstimation.rationale} files={files} onPreviewFile={onPreviewFile} />
          </div>
        </div>
      )}
    </Space>
  );
};

export default TeamEstimationView;
