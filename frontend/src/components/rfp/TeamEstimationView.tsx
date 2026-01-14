/**
 * Componente para visualizar la estimación de equipo
 */
import React, { useState } from 'react';
import { Table, Tag, Space, Typography, Tooltip, Empty, Card, Statistic, Row, Col, InputNumber } from 'antd';
import { TeamOutlined, SafetyCertificateOutlined, CodeOutlined } from '@ant-design/icons';
import type { TeamEstimation, RoleEstimation, Seniority } from '../../types';
import type { ColumnsType } from 'antd/es/table';

const { Text, Paragraph } = Typography;

interface TeamEstimationViewProps {
  teamEstimation: TeamEstimation | null;
  loading?: boolean;
}

const seniorityColors: Record<Seniority, string> = {
  junior: 'default',
  mid: 'blue',
  senior: 'purple',
  lead: 'gold',
};

const seniorityLabels: Record<Seniority, string> = {
  junior: 'Junior',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
};

const TeamEstimationView: React.FC<TeamEstimationViewProps> = ({ teamEstimation, loading }) => {
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
      title: 'Rol',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (title: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{title}</Text>
          {record.justification && (
            <Tooltip title={record.justification}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Ver justificación
              </Text>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Cantidad',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center',
      render: (qty: number, record: RoleEstimation) => (
        <Tooltip title="Puedes editar esta cantidad">
          <InputNumber
            min={1}
            max={20}
            value={qty}
            onChange={(value) => handleQuantityChange(record.role_id, value)}
            size="small"
            style={{ width: 60 }}
          />
        </Tooltip>
      ),
    },
    {
      title: 'Seniority',
      dataIndex: 'seniority',
      key: 'seniority',
      width: 100,
      render: (seniority: Seniority) => (
        <Tag color={seniorityColors[seniority]}>
          {seniorityLabels[seniority]}
        </Tag>
      ),
    },
    {
      title: 'Dedicación',
      dataIndex: 'dedication',
      key: 'dedication',
      width: 100,
      render: (dedication: string) => (
        <Text>{dedication === 'full_time' ? 'Full Time' : 'Part Time'}</Text>
      ),
    },
    {
      title: 'Skills Requeridos',
      dataIndex: 'required_skills',
      key: 'required_skills',
      render: (skills: string[]) => (
        <Space wrap size={[4, 4]}>
          {skills.slice(0, 4).map((skill, i) => (
            <Tag key={i} icon={<CodeOutlined />} color="cyan">
              {skill}
            </Tag>
          ))}
          {skills.length > 4 && (
            <Tooltip title={skills.slice(4).join(', ')}>
              <Tag>+{skills.length - 4} más</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Certificaciones',
      dataIndex: 'required_certifications',
      key: 'required_certifications',
      render: (certs: string[]) => (
        <Space wrap size={[4, 4]}>
          {certs.slice(0, 2).map((cert, i) => (
            <Tag key={i} icon={<SafetyCertificateOutlined />} color="green">
              {cert}
            </Tag>
          ))}
          {certs.length > 2 && (
            <Tooltip title={certs.slice(2).join(', ')}>
              <Tag>+{certs.length - 2} más</Tag>
            </Tooltip>
          )}
          {certs.length === 0 && <Text type="secondary">-</Text>}
        </Space>
      ),
    },
    {
      title: 'Tarifa/Mes',
      key: 'rate',
      width: 120,
      align: 'right',
      render: (_, record) => {
        if (!record.market_rate) return <Text type="secondary">-</Text>;
        const { average, currency } = record.market_rate;
        return (
          <Tooltip title={`Rango: ${record.market_rate.min?.toLocaleString()} - ${record.market_rate.max?.toLocaleString()}`}>
            <Text strong>
              {currency} {average?.toLocaleString()}
            </Text>
          </Tooltip>
        );
      },
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal_monthly',
      key: 'subtotal_monthly',
      width: 120,
      align: 'right',
      render: (subtotal: number | null, record) => {
        if (!subtotal) return <Text type="secondary">-</Text>;
        const currency = record.market_rate?.currency || 'USD';
        return (
          <Text strong style={{ color: '#1890ff' }}>
            {currency} {subtotal.toLocaleString()}
          </Text>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Summary Cards */}
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total Personas"
              value={totalHeadcount}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Roles Diferentes"
              value={editableRoles.length}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Tipo de Estimación"
              value={
                teamEstimation.source === 'client_specified' 
                  ? 'Cliente especificó' 
                  : 'IA sugiere'
              }
              valueStyle={{ 
                color: teamEstimation.source === 'client_specified' ? '#1890ff' : '#722ed1',
                fontSize: 14 
              }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {
                teamEstimation.source === 'client_specified'
                  ? 'Equipo definido en el RFP'
                  : 'Equipo propuesto por IA'
              }
            </Typography.Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Confianza IA"
              value={Math.round(teamEstimation.confidence * 100)}
              suffix="%"
              valueStyle={{ color: teamEstimation.confidence >= 0.7 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Source info */}
      <Tag color={teamEstimation.source === 'client_specified' ? 'blue' : 'purple'}>
        {teamEstimation.source === 'client_specified' 
          ? 'Equipo especificado por el cliente' 
          : 'Equipo estimado por IA'}
      </Tag>

      {/* Team Table */}
      <Table
        columns={columns}
        dataSource={teamEstimation.roles}
        rowKey="role_id"
        loading={loading}
        pagination={false}
        size="middle"
        bordered
      />

      {/* Rationale */}
      {teamEstimation.rationale && (
        <Card size="small" title="Justificación de la Estimación">
          <Paragraph>{teamEstimation.rationale}</Paragraph>
        </Card>
      )}
    </Space>
  );
};

export default TeamEstimationView;
