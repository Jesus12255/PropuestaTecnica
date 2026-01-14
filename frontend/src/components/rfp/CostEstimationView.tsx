/**
 * Componente para visualizar la estimación de costos
 */
import React from 'react';
import { Card, Table, Tag, Space, Typography, Progress, Alert, Row, Col, Statistic, Empty } from 'antd';
import { 
  DollarOutlined, CheckCircleOutlined, 
  ExclamationCircleOutlined, ArrowUpOutlined, ArrowDownOutlined 
} from '@ant-design/icons';
import type { CostEstimation, CostBreakdownItem, ViabilityAssessment } from '../../types';
import type { ColumnsType } from 'antd/es/table';

const { Text, Paragraph } = Typography;

interface CostEstimationViewProps {
  costEstimation: CostEstimation | null;
  loading?: boolean;
}

const viabilityConfig: Record<ViabilityAssessment, { color: string; icon: React.ReactNode; label: string }> = {
  viable: { color: 'success', icon: <CheckCircleOutlined />, label: 'Viable' },
  under_budget: { color: 'success', icon: <ArrowDownOutlined />, label: 'Bajo Presupuesto' },
  over_budget: { color: 'error', icon: <ArrowUpOutlined />, label: 'Sobre Presupuesto' },
  needs_review: { color: 'warning', icon: <ExclamationCircleOutlined />, label: 'Requiere Revisión' },
};

const CostEstimationView: React.FC<CostEstimationViewProps> = ({ costEstimation, loading }) => {
  // Si está cargando
  if (loading) {
    return (
      <Card>
        <Space direction="vertical" style={{ width: '100%', textAlign: 'center', padding: '40px' }}>
          <Text>Cargando estimación de costos...</Text>
        </Space>
      </Card>
    );
  }

  // Si no hay cost_estimation
  if (!costEstimation) {
    return (
      <Card>
        <Empty
          description={
            <Space direction="vertical" size="small">
              <Text>No hay estimación de costos disponible</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                La estimación de costos se genera automáticamente al analizar el RFP.
                Si acabas de subir el documento, espera a que el análisis termine.
              </Text>
            </Space>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  const { viability, breakdown = [], currency = 'USD' } = costEstimation;
  
  // Validar que breakdown exista y no esté vacío
  if (!breakdown || breakdown.length === 0) {
    return (
      <Card>
        <Empty
          description={
            <Space direction="vertical" size="small">
              <Text>No se pudo generar el desglose de costos</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                El análisis no incluyó suficiente información para estimar los costos.
              </Text>
            </Space>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  const columns: ColumnsType<CostBreakdownItem> = [
    {
      title: 'Rol',
      dataIndex: 'role',
      key: 'role',
    },
    {
      title: 'Cantidad',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center',
      render: (qty: number) => <Tag color="blue">{qty}</Tag>,
    },
    {
      title: 'Tarifa Mensual',
      dataIndex: 'monthly_rate',
      key: 'monthly_rate',
      width: 150,
      align: 'right',
      render: (rate: number) => (
        <Text>{currency} {rate.toLocaleString()}</Text>
      ),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 150,
      align: 'right',
      render: (subtotal: number) => (
        <Text strong style={{ color: '#1890ff' }}>
          {currency} {subtotal.toLocaleString()}
        </Text>
      ),
    },
  ];

  const getViabilityAlert = () => {
    if (!viability || !viability.assessment) return null;

    const config = viabilityConfig[viability.assessment];
    if (!config) return null;

    const alertType = viability.is_viable ? 'success' : viability.assessment === 'needs_review' ? 'warning' : 'error';
    const gapPercent = viability.gap_percent ?? 0;
    const gap = viability.gap ?? 0;

    return (
      <Alert
        type={alertType}
        showIcon
        icon={config.icon}
        message={
          <Space>
            <Text strong>{config.label}</Text>
            {gap !== 0 && (
              <Tag color={gap > 0 ? 'red' : 'green'}>
                {gap > 0 ? '+' : ''}{gapPercent.toFixed(1)}% 
                ({currency} {Math.abs(gap).toLocaleString()})
              </Tag>
            )}
          </Space>
        }
        description={
          viability.recommendations && viability.recommendations.length > 0 && (
            <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
              {viability.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          )
        }
        style={{ marginBottom: 16 }}
      />
    );
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Viability Alert */}
      {getViabilityAlert()}

      {/* Summary Cards */}
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Costo Base Mensual"
              value={costEstimation.monthly_base ?? 0}
              prefix={<DollarOutlined />}
              formatter={(value) => `${currency} ${Number(value).toLocaleString()}`}
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Margen"
              value={costEstimation.margin_percent ?? 0}
              suffix="%"
              precision={1}
              valueStyle={{ color: '#722ed1', fontSize: 18 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {currency} {(costEstimation.margin_amount ?? 0).toLocaleString()}
            </Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Precio Mensual Sugerido"
              value={costEstimation.suggested_monthly || 0}
              formatter={(value) => `${currency} ${Number(value).toLocaleString()}`}
              valueStyle={{ color: '#52c41a', fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Total Proyecto"
              value={costEstimation.suggested_total || 0}
              formatter={(value) => `${currency} ${Number(value).toLocaleString()}`}
              valueStyle={{ color: '#1890ff', fontSize: 18 }}
            />
            {costEstimation.duration_months && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {costEstimation.duration_months} meses
              </Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Budget Comparison */}
      {viability && viability.client_budget && (
        <Card size="small" title="Comparación con Presupuesto del Cliente">
          <Row gutter={24} align="middle">
            <Col span={8}>
              <Statistic
                title="Presupuesto Cliente"
                value={viability.client_budget}
                formatter={(value) => `${currency} ${Number(value).toLocaleString()}`}
                valueStyle={{ fontSize: 16 }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Presupuesto Requerido"
                value={viability.required_budget}
                formatter={(value) => `${currency} ${Number(value).toLocaleString()}`}
                valueStyle={{ fontSize: 16, color: viability.is_viable ? '#52c41a' : '#ff4d4f' }}
              />
            </Col>
            <Col span={8}>
              <Progress
                type="circle"
                percent={Math.min(100, Math.round((viability.required_budget / viability.client_budget) * 100))}
                size={80}
                status={viability.is_viable ? 'success' : 'exception'}
                format={(percent) => `${percent}%`}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Cost Breakdown Table */}
      <Card size="small" title="Desglose de Costos por Rol">
        {breakdown && breakdown.length > 0 ? (
          <Table
            columns={columns}
            dataSource={breakdown}
            rowKey="role"
            loading={loading}
            pagination={false}
            size="small"
            summary={(data) => {
              const total = data.reduce((sum, item) => sum + item.subtotal, 0);
              return (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3}>
                    <Text strong>Total Base</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    <Text strong style={{ color: '#1890ff' }}>
                      {currency} {total.toLocaleString()}
                    </Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              );
            }}
          />
        ) : (
          <Empty 
            description={
              <Space direction="vertical" size="small">
                <Text type="secondary">No hay desglose de costos disponible</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  El desglose se genera durante el análisis del RFP
                </Text>
              </Space>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>

      {/* Scenario Description */}
      {costEstimation.scenario_description && (
        <Card size="small" title={`Escenario ${costEstimation.scenario}`}>
          <Paragraph>{costEstimation.scenario_description}</Paragraph>
          <Text type="secondary">Fuente: {costEstimation.source}</Text>
        </Card>
      )}
    </Space>
  );
};

export default CostEstimationView;
