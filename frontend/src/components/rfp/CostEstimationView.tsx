/**
 * Componente para visualizar la estimación de costos
 * Actualizado: Diseño Premium Red & Black
 */
import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Typography, Empty, Row, Col, InputNumber } from 'antd';
import {
  DollarOutlined,
  TeamOutlined,
  CalendarOutlined,
  PercentageOutlined,
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
      <div className="content-panel" style={{ textAlign: 'center', padding: '60px' }}>
        <Space direction="vertical">
          <DollarOutlined spin style={{ fontSize: 32, color: 'var(--color-primary)' }} />
          <Text style={{ marginTop: 16 }}>Calculando estimación financiera...</Text>
        </Space>
      </div>
    );
  }

  // Si no hay cost_estimation
  if (!costEstimation) {
    return (
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
      title: 'ROL',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Text strong style={{ color: 'var(--text-primary)' }}>{role}</Text>,
    },
    {
      title: 'CANTIDAD',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center',
      render: (qty: number) => <Tag style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', fontSize: 13, padding: '2px 10px' }}>{qty}</Tag>,
    },
    {
      title: 'COSTO MERCADO/MES',
      dataIndex: 'monthly_rate',
      key: 'monthly_rate',
      width: 180,
      align: 'right',
      render: (rate: number) => (
        <Text style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
          {currency} {rate.toLocaleString()}
        </Text>
      ),
    },
    {
      title: '% DEDICACIÓN',
      key: 'dedication_percent',
      width: 140,
      align: 'center',
      render: () => <Tag color="cyan" style={{ margin: 0 }}>100%</Tag>,
    },
    {
      title: 'SUBTOTAL/MES',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 160,
      align: 'right',
      render: (subtotal: number) => (
        <Text strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>
          {currency} {subtotal.toLocaleString()}
        </Text>
      ),
    },
    {
      title: `TOTAL (${durationMonths} MESES)`,
      key: 'total_duration',
      width: 180,
      align: 'right',
      render: (_: unknown, record: CostBreakdownItem) => (
        <Text strong style={{ color: 'var(--color-success)', fontFamily: 'monospace' }}>
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
      <div className="content-panel" style={{ padding: 24, background: 'var(--bg-card)' }}>
        <Row gutter={[24, 24]}>
          {/* Costo Base Mensual */}
          <Col xs={24} sm={12} md={6}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(24, 144, 255, 0.1) 0%, rgba(24, 144, 255, 0.05) 100%)',
              padding: '20px',
              borderRadius: 12,
              border: '1px solid rgba(24, 144, 255, 0.2)',
              height: '100%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ background: '#1890ff', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <DollarOutlined style={{ color: 'white' }} />
                </div>
                <Text style={{ color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase' }}>Costo Base / Mes</Text>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {currency} {monthlyBase.toLocaleString()}
              </div>
            </div>
          </Col>

          {/* Margen Editable */}
          <Col xs={24} sm={12} md={6}>
            <div style={{
              background: 'var(--bg-tertiary)',
              padding: '20px',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              height: '100%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, justifyContent: 'space-between' }}>
                <Space>
                  <PercentageOutlined style={{ color: 'var(--color-warning)' }} />
                  <Text style={{ color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase' }}>Margen (Target)</Text>
                </Space>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <InputNumber
                  value={marginPercent}
                  onChange={(value) => setMarginPercent(value || 0)}
                  min={0}
                  max={100}
                  step={5}
                  formatter={(value) => `${value}%`}
                  parser={(value) => Number(value?.replace('%', '') || 0)}
                  style={{ width: 80, borderColor: 'var(--border-color)' }}
                />
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Valor Margen</Text>
                  <Text strong style={{ color: 'var(--color-warning)' }}>+ {currency} {marginAmount.toLocaleString()}</Text>
                </div>
              </div>
            </div>
          </Col>

          {/* Duración del Proyecto */}
          <Col xs={24} sm={12} md={6}>
            <div style={{
              background: 'var(--bg-tertiary)',
              padding: '20px',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              height: '100%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <CalendarOutlined style={{ color: 'var(--text-primary)' }} />
                </div>
                <Text style={{ color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase' }}>Duración</Text>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
                {durationMonths} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>Meses</span>
              </div>
            </div>
          </Col>

          {/* Presupuesto Total */}
          <Col xs={24} sm={12} md={6}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(82, 196, 26, 0.2) 0%, rgba(82, 196, 26, 0.05) 100%)',
              padding: '20px',
              borderRadius: 12,
              border: '1px solid rgba(82, 196, 26, 0.3)',
              height: '100%'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ background: '#52c41a', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <CalculatorOutlined style={{ color: 'white' }} />
                </div>
                <Text style={{ color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase' }}>Total Proyecto</Text>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-success)', fontFamily: 'monospace' }}>
                {currency} {totalProjectCost.toLocaleString()}
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Desglose de Costos por Rol */}
      <div className="content-panel" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)'
        }}>
          <Space>
            <TeamOutlined style={{ color: 'var(--color-primary)' }} />
            <Title level={5} style={{ margin: 0, color: 'var(--text-primary)' }}>Desglose de Costos por Rol</Title>
          </Space>
        </div>

        {breakdown && breakdown.length > 0 ? (
          <Table
            columns={columns}
            dataSource={breakdown}
            rowKey="role"
            loading={loading}
            pagination={false}
            size="middle"
            summary={() => (
              <>
                <Table.Summary.Row style={{ background: 'var(--bg-tertiary)' }}>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <Text strong style={{ color: 'var(--text-secondary)' }}>TOTAL BASE (SIN MARGEN)</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {currency} {totalMonthly.toLocaleString()}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Text strong style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {currency} {totalProject.toLocaleString()}
                    </Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
                <Table.Summary.Row style={{ background: 'rgba(82, 196, 26, 0.1)' }}>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <Text strong style={{ color: 'var(--color-success)', textTransform: 'uppercase' }}>TOTAL CON MARGEN ({marginPercent}%)</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong style={{ color: 'var(--color-success)', fontFamily: 'monospace', fontSize: 16 }}>
                      {currency} {monthlyWithMargin.toLocaleString()}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    <Text strong style={{ color: 'var(--color-success)', fontFamily: 'monospace', fontSize: 16 }}>
                      {currency} {totalProjectCost.toLocaleString()}
                    </Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </>
            )}
          />
        ) : (
          <Empty
            description="No hay desglose de costos disponible"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ margin: '40px 0' }}
          />
        )}
      </div>
    </Space>
  );
};

export default CostEstimationView;
