/**
 * Página de preguntas para el cliente
 */
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout, Typography, Card, Button, Space, Spin, Alert,
  List, Tag, message, Tooltip
} from 'antd';
import {
  ArrowLeftOutlined, CopyOutlined, ReloadOutlined,
  QuestionCircleOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rfpApi } from '../lib/api';
import AppLayout from '../components/layout/AppLayout';
import ProposalGenerationModal from '../components/rfp/ProposalGenerationModal';

const { Title, Text, Paragraph } = Typography;
const { Content } = Layout;

const priorityColors: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'default',
};

const categoryLabels: Record<string, string> = {
  scope: 'Alcance',
  technical: 'Técnico',
  commercial: 'Comercial',
  timeline: 'Timeline',
  team: 'Equipo',
  sla: 'SLA',
  legal: 'Legal',
};

const QuestionsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [generationModalOpen, setGenerationModalOpen] = React.useState(false);

  const { data: rfp, isLoading: rfpLoading } = useQuery({
    queryKey: ['rfp', id],
    queryFn: () => rfpApi.get(id!),
    enabled: !!id,
  });

  const { data: questions, isLoading: questionsLoading } = useQuery({
    queryKey: ['rfp-questions', id],
    queryFn: () => rfpApi.getQuestions(id!),
    enabled: !!id,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => rfpApi.regenerateQuestions(id!),
    onSuccess: (data) => {
      queryClient.setQueryData(['rfp-questions', id], data);
      message.success('Preguntas regeneradas');
    },
    onError: () => {
      message.error('Error al regenerar preguntas');
    },
  });

  const copyToClipboard = () => {
    if (!questions || !rfp) return;

    const text = `PREGUNTAS PARA ${rfp.client_name || 'CLIENTE'}
${'='.repeat(50)}

${questions.map((q, i) => `${i + 1}. [${q.category?.toUpperCase() || 'GENERAL'}] ${q.question}
   Contexto: ${q.context || '-'}
`).join('\n')}
`;

    navigator.clipboard.writeText(text);
    message.success('Preguntas copiadas al portapapeles');
  };

  const isLoading = rfpLoading || questionsLoading;

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

  // Agrupar por categoría
  const groupedQuestions = questions?.reduce((acc, q) => {
    const cat = q.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(q);
    return acc;
  }, {} as Record<string, typeof questions>);

  return (
    <AppLayout>
      <Content style={{ padding: 24 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/rfp/${id}`)}
            style={{ marginBottom: 16 }}
          >
            Volver al RFP
          </Button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Title level={2} style={{ margin: 0 }}>
                <QuestionCircleOutlined /> Preguntas para el Cliente
              </Title>
              <Text type="secondary">{rfp.client_name || rfp.file_name}</Text>
            </div>

            <Space>
              {rfp.status === 'go' && (
                <Button
                  type="primary"
                  icon={<FilePdfOutlined />}
                  onClick={() => setGenerationModalOpen(true)}
                  className="btn-primary-blue"
                >
                  Generar Propuesta
                </Button>
              )}
              <Button
                icon={<ReloadOutlined />}
                onClick={() => regenerateMutation.mutate()}
                loading={regenerateMutation.isPending}
              >
                Regenerar
              </Button>
              <Button
                icon={<CopyOutlined />}
                onClick={copyToClipboard}
              >
                Copiar Todo
              </Button>
            </Space>
          </div>
        </div>

        {/* Info */}
        <Alert
          type="info"
          message="Estas preguntas fueron generadas por IA basándose en la información faltante o ambigua del RFP."
          style={{ marginBottom: 24 }}
        />

        {/* Questions by Category */}
        {groupedQuestions && Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
          <Card
            key={category}
            title={
              <Space>
                <Tag color="blue">{categoryLabels[category] || category.toUpperCase()}</Tag>
                <Text type="secondary">{categoryQuestions?.length} preguntas</Text>
              </Space>
            }
            style={{ marginBottom: 16 }}
          >
            <List
              dataSource={categoryQuestions}
              renderItem={(question, index) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                      }}>
                        {index + 1}
                      </div>
                    }
                    title={
                      <Space>
                        <Text strong>{question.question}</Text>
                        {question.priority && (
                          <Tag color={priorityColors[question.priority]}>
                            {question.priority.toUpperCase()}
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <div>
                        {question.context && (
                          <Paragraph type="secondary" style={{ marginBottom: 4 }}>
                            <Text strong>Contexto:</Text> {question.context}
                          </Paragraph>
                        )}
                        {question.why_important && (
                          <Tooltip title={question.why_important}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              ¿Por qué es importante?
                            </Text>
                          </Tooltip>
                        )}
                      </div>
                    }
                  />
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(question.question);
                      message.success('Pregunta copiada');
                    }}
                  />
                </List.Item>
              )}
            />
          </Card>
        ))}

        {(!questions || questions.length === 0) && (
          <Alert
            type="warning"
            message="No hay preguntas generadas"
            description="Haz clic en 'Regenerar' para generar preguntas basadas en el análisis del RFP."
          />
        )}

        <ProposalGenerationModal
          rfpId={id || null}
          open={generationModalOpen}
          onCancel={() => setGenerationModalOpen(false)}
        />
      </Content>
    </AppLayout>
  );
};

export default QuestionsPage;
