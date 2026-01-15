/**
 * Página de detalle de RFP
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout, Typography, Card, Descriptions, Tag, Button, Space,
  Spin, Modal, Input, message, Row, Col, Alert, Divider, List, Tabs,
  InputNumber, Select, DatePicker
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined,
  ExclamationCircleOutlined, CalendarOutlined, DollarOutlined,
  GlobalOutlined, CodeOutlined, TeamOutlined, SearchOutlined, ReloadOutlined,
  EditOutlined, SaveOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rfpApi } from '../lib/api';
import AppLayout from '../components/layout/AppLayout';
import { TeamEstimationView, CostEstimationView, SuggestedTeamView } from '../components/rfp';
import type { RFPStatus, Recommendation } from '../types';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Content } = Layout;
const { TextArea } = Input;

const statusColors: Record<RFPStatus, string> = {
  pending: 'default',
  analyzing: 'processing',
  analyzed: 'warning',
  go: 'success',
  no_go: 'error',
  error: 'error',
};

const statusLabels: Record<RFPStatus, string> = {
  pending: 'Pendiente',
  analyzing: 'Analizando',
  analyzed: 'Analizado',
  go: 'GO',
  no_go: 'NO GO',
  error: 'Error',
};

const recommendationColors: Record<Recommendation, string> = {
  strong_go: 'green',
  go: 'lime',
  conditional_go: 'gold',
  no_go: 'orange',
  strong_no_go: 'red',
};

const recommendationLabels: Record<Recommendation, string> = {
  strong_go: 'Muy Recomendable',
  go: 'Recomendable',
  conditional_go: 'Condicional',
  no_go: 'No Recomendable',
  strong_no_go: 'Definitivamente No',
};

const RFPDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [noGoReason, setNoGoReason] = useState('');
  const [noGoModalOpen, setNoGoModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');

  // Estado de edición
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    client_name: string;
    country: string;
    category: string;
    budget_min: number | null;
    budget_max: number | null;
    currency: string;
    tvt: string;
    proposal_deadline: string | null;
    project_duration: string;
  }>({
    client_name: '',
    country: '',
    category: '',
    budget_min: null,
    budget_max: null,
    currency: 'USD',
    tvt: '',
    proposal_deadline: null,
    project_duration: '',
  });

  // RFP data
  const { data: rfp, isLoading } = useQuery({
    queryKey: ['rfp', id],
    queryFn: () => rfpApi.get(id!),
    enabled: !!id,
  });

  // Inicializar formulario cuando se cargan los datos
  useEffect(() => {
    if (rfp) {
      setEditForm({
        client_name: rfp.client_name || '',
        country: rfp.country || '',
        category: rfp.category || '',
        budget_min: rfp.budget_min,
        budget_max: rfp.budget_max,
        currency: rfp.currency || 'USD',
        tvt: rfp.tvt || '',
        proposal_deadline: rfp.proposal_deadline,
        project_duration: rfp.project_duration || '',
      });
    }
  }, [rfp]);

  // Team estimation data
  const {
    data: teamData,
    isLoading: teamDataLoading,
  } = useQuery({
    queryKey: ['rfp-team-estimation', id],
    queryFn: () => rfpApi.getTeamEstimation(id!),
    enabled: !!id && rfp?.status !== 'pending' && rfp?.status !== 'analyzing',
  });

  // Decision mutation
  const decisionMutation = useMutation({
    mutationFn: ({ decision, reason }: { decision: 'go' | 'no_go'; reason?: string }) =>
      rfpApi.makeDecision(id!, { decision, reason }),
    onSuccess: (data) => {
      queryClient.setQueryData(['rfp', id], data);
      message.success(`Decisión registrada: ${data.decision?.toUpperCase()}`);
      if (data.decision === 'go') {
        navigate(`/rfp/${id}/questions`);
      }
    },
    onError: () => {
      message.error('Error al registrar la decisión');
    },
  });

  // Suggest team mutation
  const suggestTeamMutation = useMutation({
    mutationFn: (forceRefresh: boolean = false) => rfpApi.suggestTeam(id!, forceRefresh),
    onSuccess: (data) => {
      message.success(`Se encontraron ${data.suggested_team?.total_candidatos || 0} candidatos`);
      // Actualizar el cache directamente con los datos de la respuesta
      queryClient.setQueryData(['rfp-team-estimation', id], {
        team_estimation: data.team_estimation,
        cost_estimation: data.cost_estimation,
        suggested_team: data.suggested_team,
      });
      setActiveTab('candidates');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Error al buscar candidatos');
    },
  });

  // Update RFP mutation
  const updateRfpMutation = useMutation({
    mutationFn: (data: typeof editForm) => rfpApi.update(id!, data),
    onSuccess: (data) => {
      queryClient.setQueryData(['rfp', id], data);
      message.success('RFP actualizado exitosamente');
      setIsEditing(false);
    },
    onError: () => {
      message.error('Error al actualizar el RFP');
    },
  });

  const handleSaveEdit = () => {
    // Sanitize data -> Convert nulls to undefined for API
    const sanitizedData = {
      ...editForm,
      budget_min: editForm.budget_min ?? undefined,
      budget_max: editForm.budget_max ?? undefined,
      proposal_deadline: editForm.proposal_deadline ?? undefined,
    };
    updateRfpMutation.mutate(sanitizedData);
  };

  const handleCancelEdit = () => {
    if (rfp) {
      setEditForm({
        client_name: rfp.client_name || '',
        country: rfp.country || '',
        category: rfp.category || '',
        budget_min: rfp.budget_min,
        budget_max: rfp.budget_max,
        currency: rfp.currency || 'USD',
        tvt: rfp.tvt || '',
        proposal_deadline: rfp.proposal_deadline,
        project_duration: rfp.project_duration || '',
      });
    }
    setIsEditing(false);
  };

  const handleGo = () => {
    decisionMutation.mutate({ decision: 'go' });
  };

  const handleNoGo = () => {
    setNoGoModalOpen(true);
  };

  const confirmNoGo = () => {
    decisionMutation.mutate({ decision: 'no_go', reason: noGoReason });
    setNoGoModalOpen(false);
    setNoGoReason('');
  };

  const handleSearchCandidates = (forceRefresh: boolean = false) => {
    suggestTeamMutation.mutate(forceRefresh);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <Content style={{ padding: 24, textAlign: 'center' }}>
          <Spin size="large" />
        </Content>
      </AppLayout>
    );
  }

  if (!rfp) {
    return (
      <AppLayout>
        <Content style={{ padding: 24 }}>
          <Alert type="error" message="RFP no encontrado" />
        </Content>
      </AppLayout>
    );
  }

  const extracted = rfp.extracted_data;

  // Tab items configuration
  const tabItems = [
    {
      key: 'summary',
      label: (
        <span>
          <GlobalOutlined />
          Resumen
        </span>
      ),
      children: (
        <Row gutter={24}>
          {/* Main Info */}
          <Col span={16}>
            <Card
              title="Información del RFP"
              style={{ marginBottom: 24 }}
              extra={
                isEditing ? (
                  <Space>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={handleSaveEdit}
                      loading={updateRfpMutation.isPending}
                    >
                      Guardar
                    </Button>
                    <Button
                      icon={<CloseCircleOutlined />}
                      onClick={handleCancelEdit}
                    >
                      Cancelar
                    </Button>
                  </Space>
                ) : (
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => setIsEditing(true)}
                  >
                    Editar
                  </Button>
                )
              }
            >
              {isEditing ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Cliente</Text>
                    <Input
                      value={editForm.client_name}
                      onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                      placeholder="Nombre del cliente"
                    />
                  </div>
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>TVT</Text>
                    <Input
                      value={editForm.tvt}
                      onChange={(e) => setEditForm({ ...editForm, tvt: e.target.value })}
                      placeholder="Número TVT (ej: 001234)"
                    />
                  </div>
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}><GlobalOutlined /> País</Text>
                    <Input
                      value={editForm.country}
                      onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                      placeholder="País"
                    />
                  </div>
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Categoría</Text>
                    <Select
                      value={editForm.category || undefined}
                      onChange={(value) => setEditForm({ ...editForm, category: value })}
                      placeholder="Seleccionar categoría"
                      style={{ width: '100%' }}
                      allowClear
                    >
                      <Select.Option value="mantencion">Mantención</Select.Option>
                      <Select.Option value="desarrollo">Desarrollo</Select.Option>
                      <Select.Option value="analitica">Analítica</Select.Option>
                      <Select.Option value="ia_chatbot">IA Chatbot</Select.Option>
                      <Select.Option value="ia_documentos">IA Documentos</Select.Option>
                      <Select.Option value="ia_video">IA Video</Select.Option>
                      <Select.Option value="otro">Otro</Select.Option>
                    </Select>
                  </div>
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}><DollarOutlined /> Presupuesto Mín</Text>
                    <InputNumber
                      value={editForm.budget_min}
                      onChange={(value) => setEditForm({ ...editForm, budget_min: value })}
                      placeholder="Mínimo"
                      style={{ width: '100%' }}
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </div>
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}><DollarOutlined /> Presupuesto Máx</Text>
                    <InputNumber
                      value={editForm.budget_max}
                      onChange={(value) => setEditForm({ ...editForm, budget_max: value })}
                      placeholder="Máximo"
                      style={{ width: '100%' }}
                      formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    />
                  </div>
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Moneda</Text>
                    <Select
                      value={editForm.currency}
                      onChange={(value) => setEditForm({ ...editForm, currency: value })}
                      style={{ width: '100%' }}
                    >
                      <Select.Option value="USD">USD</Select.Option>
                      <Select.Option value="CLP">CLP</Select.Option>
                      <Select.Option value="EUR">EUR</Select.Option>
                      <Select.Option value="BRL">BRL</Select.Option>
                      <Select.Option value="MXN">MXN</Select.Option>
                      <Select.Option value="COP">COP</Select.Option>
                      <Select.Option value="PEN">PEN</Select.Option>
                    </Select>
                  </div>
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}><CalendarOutlined /> Deadline Propuesta</Text>
                    <DatePicker
                      value={editForm.proposal_deadline ? dayjs(editForm.proposal_deadline) : null}
                      onChange={(date) => setEditForm({ ...editForm, proposal_deadline: date ? date.format('YYYY-MM-DD') : null })}
                      format="DD/MM/YYYY"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Duración Proyecto</Text>
                    <Input
                      value={editForm.project_duration}
                      onChange={(e) => setEditForm({ ...editForm, project_duration: e.target.value })}
                      placeholder="Ej: 12 meses"
                    />
                  </div>
                  <div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Confianza IA</Text>
                    <Text>{rfp.confidence_score ? `${rfp.confidence_score}%` : '-'}</Text>
                  </div>
                </div>
              ) : (
                <Descriptions column={2}>
                  <Descriptions.Item label="Cliente">
                    {rfp.client_name || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="TVT">
                    {rfp.tvt || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label={<><GlobalOutlined /> País</>}>
                    {rfp.country || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Categoría">
                    {rfp.category?.replace(/_/g, ' ') || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label={<><DollarOutlined /> Presupuesto</>}>
                    {rfp.budget_min || rfp.budget_max ? (
                      `${rfp.currency} ${rfp.budget_min?.toLocaleString() || '?'} - ${rfp.budget_max?.toLocaleString() || '?'}`
                    ) : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label={<><CalendarOutlined /> Deadline Propuesta</>}>
                    {rfp.proposal_deadline ? dayjs(rfp.proposal_deadline).format('DD/MM/YYYY') : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Duración Proyecto">
                    {rfp.project_duration || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Confianza IA">
                    {rfp.confidence_score ? `${rfp.confidence_score}%` : '-'}
                  </Descriptions.Item>
                </Descriptions>
              )}

              {rfp.summary && (
                <>
                  <Divider />
                  <Title level={5}>Resumen</Title>
                  <Paragraph>{rfp.summary}</Paragraph>
                </>
              )}
            </Card>

            {/* Tech Stack */}
            {extracted?.tech_stack && extracted.tech_stack.length > 0 && (
              <Card title={<><CodeOutlined /> Stack Tecnológico</>} style={{ marginBottom: 24 }}>
                <Space wrap>
                  {extracted.tech_stack.map((tech, i) => (
                    <Tag key={i} color="blue">{tech}</Tag>
                  ))}
                </Space>
              </Card>
            )}

            {/* Risks */}
            {extracted?.risks && extracted.risks.length > 0 && (
              <Card
                title={<><ExclamationCircleOutlined /> Riesgos Identificados</>}
                style={{ marginBottom: 24 }}
              >
                <List
                  dataSource={extracted.risks}
                  renderItem={(risk) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Tag color={
                            risk.severity === 'critical' ? 'red' :
                              risk.severity === 'high' ? 'orange' :
                                risk.severity === 'medium' ? 'gold' : 'default'
                          }>
                            {risk.severity.toUpperCase()}
                          </Tag>
                        }
                        title={risk.category.replace(/_/g, ' ').toUpperCase()}
                        description={risk.description}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}
          </Col>

          {/* Sidebar */}
          <Col span={8}>
            {/* Recommendation Reasons */}
            {extracted?.recommendation_reasons && extracted.recommendation_reasons.length > 0 && (
              <Card title="Razones de la Recomendación" style={{ marginBottom: 24 }}>
                <List
                  size="small"
                  dataSource={extracted.recommendation_reasons}
                  renderItem={(reason) => (
                    <List.Item>
                      <Text>{reason}</Text>
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {/* SLAs */}
            {extracted?.sla && extracted.sla.length > 0 && (
              <Card title="SLAs" style={{ marginBottom: 24 }}>
                <List
                  size="small"
                  dataSource={extracted.sla}
                  renderItem={(sla) => (
                    <List.Item>
                      <Space direction="vertical" size={0}>
                        <Text strong>{sla.description}</Text>
                        {sla.metric && <Text type="secondary">{sla.metric}</Text>}
                        {sla.is_aggressive && <Tag color="red">Agresivo</Tag>}
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {/* Penalties */}
            {extracted?.penalties && extracted.penalties.length > 0 && (
              <Card title="Penalidades" style={{ marginBottom: 24 }}>
                <List
                  size="small"
                  dataSource={extracted.penalties}
                  renderItem={(penalty) => (
                    <List.Item>
                      <Space direction="vertical" size={0}>
                        <Text strong>{penalty.description}</Text>
                        {penalty.amount && <Text type="secondary">{penalty.amount}</Text>}
                        {penalty.is_high && <Tag color="red">Alta</Tag>}
                      </Space>
                    </List.Item>
                  )}
                />
              </Card>
            )}

            {/* Decision Info */}
            {rfp.decision && (
              <Card title="Decisión Registrada">
                <Tag color={rfp.decision === 'go' ? 'success' : 'error'} style={{ fontSize: 16, padding: '4px 12px' }}>
                  {rfp.decision.toUpperCase()}
                </Tag>
                {rfp.decision_reason && (
                  <Paragraph style={{ marginTop: 12 }}>
                    <Text strong>Razón:</Text> {rfp.decision_reason}
                  </Paragraph>
                )}
                {rfp.decided_at && (
                  <Text type="secondary">
                    {dayjs(rfp.decided_at).format('DD/MM/YYYY HH:mm')}
                  </Text>
                )}
              </Card>
            )}
          </Col>
        </Row>
      ),
    },
    {
      key: 'team',
      label: (
        <span>
          <TeamOutlined />
          Equipo Estimado
        </span>
      ),
      children: (
        <TeamEstimationView
          teamEstimation={teamData?.team_estimation || null}
          loading={teamDataLoading}
        />
      ),
    },
    {
      key: 'costs',
      label: (
        <span>
          <DollarOutlined />
          Costos
        </span>
      ),
      children: (
        <CostEstimationView
          costEstimation={teamData?.cost_estimation || null}
          loading={teamDataLoading}
        />
      ),
    },
    {
      key: 'candidates',
      label: (
        <span>
          <SearchOutlined />
          Candidatos TIVIT
        </span>
      ),
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Search Candidates Button */}
          <Card size="small">
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={() => handleSearchCandidates(false)}
                loading={suggestTeamMutation.isPending}
                disabled={!teamData?.team_estimation}
              >
                Buscar Candidatos
              </Button>
              {teamData?.suggested_team && (
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => handleSearchCandidates(true)}
                  loading={suggestTeamMutation.isPending}
                >
                  Actualizar
                </Button>
              )}
              {!teamData?.team_estimation && (
                <Text type="secondary">
                  Se requiere una estimación de equipo para buscar candidatos
                </Text>
              )}
            </Space>
          </Card>

          <SuggestedTeamView
            suggestedTeam={teamData?.suggested_team || null}
            loading={suggestTeamMutation.isPending}
          />
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <Content style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{ marginBottom: 16 }}
          >
            Volver
          </Button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0 }}>
                {rfp.client_name || rfp.file_name}
              </Title>
              <Space style={{ marginTop: 8 }}>
                <Tag color={statusColors[rfp.status]}>{statusLabels[rfp.status]}</Tag>
                {rfp.recommendation && (
                  <Tag color={recommendationColors[rfp.recommendation]}>
                    IA: {recommendationLabels[rfp.recommendation]}
                  </Tag>
                )}
              </Space>
            </div>

            {/* Decision Buttons */}
            {rfp.status === 'analyzed' && !rfp.decision && (
              <Space size="large">
                <Button
                  type="primary"
                  size="large"
                  icon={<CheckOutlined />}
                  onClick={handleGo}
                  loading={decisionMutation.isPending}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  GO
                </Button>
                <Button
                  danger
                  size="large"
                  icon={<CloseOutlined />}
                  onClick={handleNoGo}
                  loading={decisionMutation.isPending}
                >
                  NO GO
                </Button>
              </Space>
            )}

            {rfp.decision === 'go' && (
              <Button
                type="primary"
                onClick={() => navigate(`/rfp/${id}/questions`)}
              >
                Ver Preguntas
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />

        {/* NO GO Modal */}
        <Modal
          title="Confirmar NO GO"
          open={noGoModalOpen}
          onOk={confirmNoGo}
          onCancel={() => setNoGoModalOpen(false)}
          okText="Confirmar NO GO"
          okButtonProps={{ danger: true }}
        >
          <p>¿Estás seguro de marcar este RFP como NO GO?</p>
          <TextArea
            placeholder="Razón del NO GO (opcional)"
            value={noGoReason}
            onChange={(e) => setNoGoReason(e.target.value)}
            rows={4}
          />
        </Modal>
      </Content>
    </AppLayout>
  );
};

export default RFPDetailPage;
