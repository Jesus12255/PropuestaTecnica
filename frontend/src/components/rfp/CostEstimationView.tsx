/**
 * Componente para visualizar la estimación de costos
 * Actualizado: Simplificado con cálculos de costo total por duración
 */
import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, Typography, Empty, Row, Col, Statistic, InputNumber } from 'antd';
import { 
  DollarOutlined, TeamOutlined, CalendarOutlined, PercentageOutlined,
  CalculatorOutlined
} from '@ant-design/icons';
import type { CostEstimation, CostBreakdownItem } from '../../types';
import type { ColumnsType } from 'antd/es/table';

const { Text, Title } = Typography;

interface CostEstimationViewProps {
  costEstimation: CostEstimation | null;
  loading?: boolean;
}

const CostEstimationView: React.FC<CostEstimationViewProps> = ({ costEstimation, loading }) => {
  // Estado para margen editable
  const [marginPercent, setMarginPercent] = useState<number>(0);

  // Actualizar margen cuando cambia costEstimation
  useEffect(() => {
    if (costEstimation?.margin_percent) {
      setMarginPercent(costEstimation.margin_percent);
    }
  }, [costEstimation]);

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
              </Text>
            </Space>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    );
  }

  const { breakdown = [], currency = 'USD' } = costEstimation;
  const durationMonths = costEstimation.duration_months || 1;
  
  // Cálculos
  const monthlyBase = costEstimation.monthly_base ?? 0;
  const marginAmount = monthlyBase * (marginPercent / 100);
  const monthlyWithMargin = monthlyBase + marginAmount;
  const totalProjectCost = monthlyWithMargin * durationMonths;

  // Columnas de la tabla con Costo Mercado/Mes y % Tiempo
  const columns: ColumnsType<CostBreakdownItem> = [
    {
      title: 'Rol',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Text strong>{role}</Text>,
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
      title: 'Costo Mercado/Mes',
      dataIndex: 'monthly_rate',
      key: 'monthly_rate',
      width: 160,
      align: 'right',
      render: (rate: number) => (
        <Text>{currency} {rate.toLocaleString()}</Text>
      ),
    },
    {
      title: '% Dedicación',
      key: 'dedication_percent',
      width: 120,
      align: 'center',
      render: () => <Tag color="cyan">100%</Tag>,
    },
    {
      title: 'Subtotal/Mes',
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
    {
      title: `Total (${durationMonths} meses)`,
      key: 'total_duration',
      width: 160,
      align: 'right',
      render: (_: unknown, record: CostBreakdownItem) => (
        <Text strong style={{ color: '#52c41a' }}>
          {currency} {(record.subtotal * durationMonths).toLocaleString()}
        </Text>
      ),
    },
  ];

  // Total de la tabla
  const totalMonthly = breakdown.reduce((sum, item) => sum + item.subtotal, 0);
  const totalProject = totalMonthly * durationMonths;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Resumen Principal */}
      <Card>
        <Row gutter={[24, 24]}>
          {/* Costo Base Mensual */}
          <Col xs={24} sm={12} md={6}>
            <Card 
              size="small" 
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none' }}
            >
              <Statistic
                title={<Text style={{ color: 'rgba(255,255,255,0.85)' }}>Costo Base Mensual</Text>}
                value={monthlyBase}
                prefix={<DollarOutlined />}
                formatter={(value) => `${currency} ${Number(value).toLocaleString()}`}
                valueStyle={{ color: '#fff', fontSize: 20 }}
              />
            </Card>
          </Col>

          {/* Margen Editable */}
          <Col xs={24} sm={12} md={6}>
            <Card size="small" style={{ background: '#1f1f1f', border: '1px solid #303030' }}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <PercentageOutlined /> Margen (editable)
                </Text>
                <Space>
                  <InputNumber
                    value={marginPercent}
                    onChange={(value) => setMarginPercent(value || 0)}
                    min={0}
                    max={100}
                    step={5}
                    formatter={(value) => `${value}%`}
                    parser={(value) => Number(value?.replace('%', '') || 0)}
                    style={{ width: 100 }}
                  />
                  <Text type="secondary">
                    = {currency} {marginAmount.toLocaleString()}
                  </Text>
                </Space>
              </Space>
            </Card>
          </Col>

          {/* Duración del Proyecto */}
          <Col xs={24} sm={12} md={6}>
            <Card size="small" style={{ background: '#1a3a1a', border: '1px solid #274d27' }}>
              <Statistic
                title={<Text style={{ color: '#95de64' }}><CalendarOutlined /> Duración Proyecto</Text>}
                value={durationMonths}
                suffix="meses"
                valueStyle={{ color: '#95de64', fontSize: 20 }}
              />
            </Card>
          </Col>

          {/* Presupuesto Total */}
          <Col xs={24} sm={12} md={6}>
            <Card 
              size="small" 
              style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', border: 'none' }}
            >
              <Statistic
                title={<Text style={{ color: 'rgba(255,255,255,0.85)' }}>Presupuesto Total</Text>}
                value={totalProjectCost}
                prefix={<CalculatorOutlined />}
                formatter={(value) => `${currency} ${Number(value).toLocaleString()}`}
                valueStyle={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Desglose de Costos por Rol */}
      <Card 
        size="small" 
        title={
          <Space>
            <TeamOutlined />
            <span>Desglose de Costos por Rol</span>
          </Space>
        }
      >
        {breakdown && breakdown.length > 0 ? (
          <Table
            columns={columns}
            dataSource={breakdown}
            rowKey="role"
            loading={loading}
            pagination={false}
            size="small"
            summary={() => (
              <>
                <Table.Summary.Row style={{ background: 'rgba(24, 144, 255, 0.1)' }}>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <Text strong>Total Base (sin margen)</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong style={{ color: '#1890ff' }}>
                      {currency} {totalMonthly.toLocaleString()}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Text strong style={{ color: '#52c41a' }}>
                      {currency} {totalProject.toLocaleString()}
                    </Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row style={{ background: 'rgba(82, 196, 26, 0.15)' }}>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <Title level={5} style={{ margin: 0, color: '#52c41a' }}>TOTAL CON MARGEN</Title>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Title level={5} style={{ margin: 0, color: '#52c41a' }}>
                      {currency} {monthlyWithMargin.toLocaleString()}
                    </Title>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Title level={5} style={{ margin: 0, color: '#52c41a' }}>
                      {currency} {totalProjectCost.toLocaleString()}
                    </Title>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </>
            )}
          />
        ) : (
          <Empty 
            description={
              <Space direction="vertical" size="small">
                <Text type="secondary">No hay desglose de costos disponible</Text>
              </Space>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>
    </Space>
  );
};

export default CostEstimationView;
