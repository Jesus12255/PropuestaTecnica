/**
 * Página de detalle de RFP
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout, Typography, Button, Space,
  Spin, Modal, Input, message, Tag, Tabs,
  Form
} from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined,
  GlobalOutlined, DollarOutlined,
  TeamOutlined, SearchOutlined, ReloadOutlined,
  BarChartOutlined, MessageOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rfpApi } from '../lib/api';
import AppLayout from '../components/layout/AppLayout';
import {
  TeamEstimationView,
  CostEstimationView,
  SuggestedTeamView,
  RFPSummaryView,
  RFPAnalysisView
} from '../components/rfp';
import ChatWidget from '../components/chat/ChatWidget';
import FilePreviewModal from '../components/common/FilePreviewModal';
import { useFilePreloader } from '../hooks/useFilePreloader';
import type { RFPStatus, Recommendation, RFPUpdate, ChatMessage, RFPFile } from '../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
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
  const [isEditing, setIsEditing] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<'go' | 'no_go' | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [form] = Form.useForm();

  // Error Modal State
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalContent, setErrorModalContent] = useState('');

  // File Preview State
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string | null; name: string; type: string } | null>(null);

  // RFP data
  const { data: rfp, isLoading } = useQuery({
    queryKey: ['rfp', id],
    queryFn: () => rfpApi.get(id!),
    enabled: !!id,
  });

  // Collect all citations for pre-loading
  const allCitations = React.useMemo(() => {
    if (!rfp?.extracted_data) return [];

    const citations: string[] = [];
    const data = rfp.extracted_data;

    if (data.risks) data.risks.forEach(r => r.reference_document && citations.push(r.reference_document));
    if (data.sla) data.sla.forEach(s => s.reference_document && citations.push(s.reference_document));
    if (data.penalties) data.penalties.forEach(p => p.reference_document && citations.push(p.reference_document));

    return citations;
  }, [rfp]);

  // Use preloader hook
  const { getFileUrl } = useFilePreloader(rfp?.files || [], allCitations);

  // Initialize form when RFP data loads
  useEffect(() => {
    if (rfp) {
      form.setFieldsValue({
        title: rfp.title,
        client_name: rfp.client_name,
        country: rfp.country,
        category: rfp.category,
        tvt: rfp.tvt,
        budget_min: rfp.budget_min,
        budget_max: rfp.budget_max,
        currency: rfp.currency,
        proposal_deadline: rfp.proposal_deadline ? dayjs(rfp.proposal_deadline) : null,
        project_duration: rfp.project_duration,
      });
    }
  }, [rfp, form]);

  // Team estimation data
  const {
    data: teamData,
    isLoading: teamDataLoading,
  } = useQuery({
    queryKey: ['rfp-team-estimation', id],
    queryFn: () => rfpApi.getTeamEstimation(id!),
    enabled: !!id && rfp?.status !== 'pending' && rfp?.status !== 'analyzing',
  });

  // Update RFP mutation
  const updateMutation = useMutation({
    mutationFn: (data: RFPUpdate) => rfpApi.update(id!, data),
    onSuccess: (data) => {
      queryClient.setQueryData(['rfp', id], data);
      message.success('Información actualizada correctamente');
      setIsEditing(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Error al actualizar');
    },
  });

  // Decision mutation
  const decisionMutation = useMutation({
    mutationFn: ({ decision, reason }: { decision: 'go' | 'no_go'; reason?: string }) =>
      rfpApi.makeDecision(id!, { decision, reason }),
    onSuccess: (data) => {
      queryClient.setQueryData(['rfp', id], data);
      message.success(`Decisión registrada: ${data.decision?.toUpperCase()}`);
      setPendingDecision(null);
      if (data.decision === 'go') {
        navigate(`/rfp/${id}/questions`);
      }
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Error al registrar la decisión';
      setErrorModalContent(errorMsg);
      setErrorModalVisible(true);
      setPendingDecision(null);
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

  const handleGo = () => {
    setPendingDecision('go');
    decisionMutation.mutate({ decision: 'go' });
  };

  const handleNoGo = () => {
    setNoGoModalOpen(true);
  };

  const confirmNoGo = () => {
    setPendingDecision('no_go');
    decisionMutation.mutate({ decision: 'no_go', reason: noGoReason });
    setNoGoModalOpen(false);
    setNoGoReason('');
  };

  const handleSearchCandidates = (forceRefresh: boolean = false) => {
    suggestTeamMutation.mutate(forceRefresh);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields();
      const updateData: RFPUpdate = {
        title: values.title,
        client_name: values.client_name,
        country: values.country,
        category: values.category,
        tvt: values.tvt,
        budget_min: values.budget_min,
        budget_max: values.budget_max,
        currency: values.currency,
        proposal_deadline: values.proposal_deadline ? values.proposal_deadline.format('YYYY-MM-DD') : null,
        project_duration: values.project_duration,
      };
      updateMutation.mutate(updateData);
    } catch (error) {
      // Validation error
    }
  };

  const handlePreviewFile = async (file: RFPFile, page?: number) => {
    try {
      const loadingMsg = message.loading('Cargando vista previa...', 0);
      const fileId = file.archivo_id || file.id;

      if (!fileId) {
        loadingMsg(); // Clear loading
        message.error('Archivo sin ID');
        return;
      }

      // Use pre-loader (returns cached or fetches)
      const { url, type } = await getFileUrl(fileId);

      let finalUrl = url;
      if (page) {
        finalUrl += `#page=${page}`;
      }

      loadingMsg(); // process finish
      setPreviewFile({
        url: finalUrl,
        name: file.nombre || file.filename || 'Documento',
        type: type || file.file_type || 'application/octet-stream'
      });
      setPreviewVisible(true);
    } catch (error) {
      message.destroy();
      message.error('Error al cargar el archivo');
      console.error(error);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    // Reset form to original values
    if (rfp) {
      form.setFieldsValue({
        title: rfp.title,
        client_name: rfp.client_name,
        country: rfp.country,
        category: rfp.category,
        tvt: rfp.tvt,
        budget_min: rfp.budget_min,
        budget_max: rfp.budget_max,
        currency: rfp.currency,
        proposal_deadline: rfp.proposal_deadline ? dayjs(rfp.proposal_deadline) : null,
        project_duration: rfp.project_duration,
      });
    }
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
          <Modal
            open={true}
            title="Error"
            footer={[<Button key="back" onClick={() => navigate('/')}>Volver</Button>]}
          >
            RFP no encontrado
          </Modal>
        </Content>
      </AppLayout>
    );
  }

  // Tab items configuration
  const tabItems = [
    {
      key: 'summary',
      label: (
        <span>
          <GlobalOutlined style={{ marginRight: 6 }} />
          Resumen
        </span>
      ),
      children: (
        <RFPSummaryView
          rfp={rfp}
          isEditing={isEditing}
          onEdit={() => setIsEditing(true)}
          onCancel={handleCancelEdit}
          onSave={handleSaveEdit}
          form={form}
          saving={updateMutation.isPending}
          onPreviewFile={handlePreviewFile}
        />
      ),
    },
    {
      key: 'analysis',
      label: (
        <span>
          <BarChartOutlined style={{ marginRight: 6 }} />
          Análisis
        </span>
      ),
      children: <RFPAnalysisView rfp={rfp} onPreviewFile={handlePreviewFile} />,
    },
    {
      key: 'team',
      label: (
        <span>
          <TeamOutlined style={{ marginRight: 6 }} />
          Equipo Estimado
        </span>
      ),
      children: (
        <TeamEstimationView
          teamEstimation={teamData?.team_estimation || null}
          loading={teamDataLoading}
          files={rfp.files}
          onPreviewFile={handlePreviewFile}
        />
      ),
    },
    {
      key: 'costs',
      label: (
        <span>
          <DollarOutlined style={{ marginRight: 6 }} />
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
      key: 'chat',
      label: (
        <span>
          <MessageOutlined style={{ marginRight: 6 }} />
          Chat
        </span>
      ),
      children: (
        <div className="content-panel" style={{ height: '600px', padding: 24 }}>
          <ChatWidget
            rfpId={id || null}
            messages={chatMessages}
            onAddMessage={(msg) => setChatMessages(prev => [...prev, msg])}
            onClearMessages={() => setChatMessages([])}
          />
        </div>
      )
    },
    {
      key: 'candidates',
      label: (
        <span>
          <SearchOutlined style={{ marginRight: 6 }} />
          Candidatos TIVIT
        </span>
      ),
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Search Candidates Button */}
          <div className="content-panel" style={{ padding: 24 }}>
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
          </div>

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
      <Content style={{ padding: '0', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ padding: '32px' }}>
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/')}
              style={{ marginBottom: 16, color: 'var(--text-secondary)', paddingLeft: 0 }}
            >
              Volver al listado
            </Button>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              background: 'var(--bg-card)',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
            }}>
              <div>
                <Space align="center" style={{ marginBottom: 8 }}>
                  <Tag color={statusColors[rfp.status]} style={{ border: 'none', padding: '4px 12px', fontSize: 12 }}>
                    {statusLabels[rfp.status].toUpperCase()}
                  </Tag>
                  {rfp.recommendation && (
                    <Tag color={recommendationColors[rfp.recommendation]} style={{ border: 'none', padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
                      IA: {recommendationLabels[rfp.recommendation]}
                    </Tag>
                  )}
                </Space>
                <Title level={2} style={{ margin: '8px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                  {rfp.client_name || rfp.file_name}
                </Title>
                <Text style={{ fontSize: 16, color: 'var(--text-secondary)' }}>
                  {rfp.title}
                </Text>
              </div>

              {/* Decision Buttons */}
              <Space size="middle">
                {rfp.status === 'analyzed' && !rfp.decision && (
                  <>
                    <Button
                      type="primary"
                      size="large"
                      icon={<CheckOutlined />}
                      onClick={handleGo}
                      loading={decisionMutation.isPending && pendingDecision === 'go'}
                      disabled={decisionMutation.isPending && pendingDecision === 'no_go'}
                      style={{
                        background: 'var(--color-success)',
                        borderColor: 'var(--color-success)',
                        height: 44,
                        padding: '0 32px'
                      }}
                    >
                      GO
                    </Button>
                    <Button
                      danger
                      size="large"
                      icon={<CloseOutlined />}
                      onClick={handleNoGo}
                      loading={decisionMutation.isPending && pendingDecision === 'no_go'}
                      disabled={decisionMutation.isPending && pendingDecision === 'go'}
                      style={{ height: 44, padding: '0 32px' }}
                    >
                      NO GO
                    </Button>
                  </>
                )}

                {rfp.decision === 'go' && (
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => navigate(`/rfp/${id}/questions`)}
                    style={{ height: 44 }}
                  >
                    Ver Preguntas
                  </Button>
                )}
              </Space>
            </div>
          </div>

          {/* Tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
            className="professional-tabs"
            style={{ marginTop: 24 }}
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

          {/* Error Modal */}
          <Modal
            open={errorModalVisible}
            footer={[
              <Button key="ok" type="primary" onClick={() => setErrorModalVisible(false)}>
                Entendido
              </Button>
            ]}
            onCancel={() => setErrorModalVisible(false)}
            closable={false}
            title={
              <Space>
                <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 22 }} />
                <span style={{ fontSize: 18 }}>Error al procesar decisión</span>
              </Space>
            }
          >
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 16, color: 'var(--text-primary)' }}>
                {errorModalContent}
              </p>
              <div style={{
                marginTop: 16,
                padding: 12,
                background: 'var(--bg-tertiary)',
                borderRadius: 8,
                border: '1px solid var(--border-color)'
              }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  <Space align="start">
                    <ExclamationCircleOutlined />
                    <span>
                      Verifica que los datos del RFP estén completos (especialmente el TVT) y que tengas permisos para crear carpetas.
                    </span>
                  </Space>
                </Text>
              </div>
            </div>
          </Modal>
        </div>

        {/* File Preview Modal */}
        {previewFile && (
          <FilePreviewModal
            visible={previewVisible}
            onClose={() => setPreviewVisible(false)}
            fileUrl={previewFile.url}
            fileName={previewFile.name}
            fileType={previewFile.type}
          />
        )}
      </Content>
    </AppLayout>
  );
};

export default RFPDetailPage;
