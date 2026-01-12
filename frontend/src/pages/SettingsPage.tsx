/**
 * Página de Configuración del Usuario
 * Diseño "masticado" para BDMs - sin términos técnicos
 */
import React from 'react';
import { Layout, Typography, Card, Row, Col, message, Spin, theme } from 'antd';
import {
  ThunderboltOutlined,
  StarOutlined,
  ExperimentOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AppLayout from '../components/layout/AppLayout';
import { authApi } from '../lib/api';

const { Title, Text, Paragraph } = Typography;
const { Content } = Layout;

interface AnalysisMode {
  key: 'fast' | 'balanced' | 'deep';
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string;
  color: string;
  recommended?: boolean;
}

const analysisModes: AnalysisMode[] = [
  {
    key: 'fast',
    icon: <ThunderboltOutlined style={{ fontSize: 48 }} />,
    title: 'Rápido',
    description: 'Análisis express en segundos',
    details: 'Ideal para una primera revisión cuando tienes prisa o muchos RFPs que procesar. Obtén lo esencial rápidamente.',
    color: '#faad14',
  },
  {
    key: 'balanced',
    icon: <StarOutlined style={{ fontSize: 48 }} />,
    title: 'Balanceado',
    description: 'El mejor equilibrio calidad-tiempo',
    details: 'Recomendado para la mayoría de casos. Análisis completo sin esperas excesivas. La opción más usada por los BDMs.',
    color: '#1890ff',
    recommended: true,
  },
  {
    key: 'deep',
    icon: <ExperimentOutlined style={{ fontSize: 48 }} />,
    title: 'Profundo',
    description: 'Análisis exhaustivo y detallado',
    details: 'Para RFPs importantes o complejos donde necesitas el máximo detalle. Toma más tiempo pero no deja nada sin revisar.',
    color: '#52c41a',
  },
];

const SettingsPage: React.FC = () => {
  const { token } = theme.useToken();
  const queryClient = useQueryClient();

  // Obtener preferencias actuales
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: authApi.getPreferences,
  });

  // Mutación para actualizar preferencias
  const updatePreferences = useMutation({
    mutationFn: authApi.updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      message.success('¡Configuración guardada!');
    },
    onError: () => {
      message.error('Error al guardar la configuración');
    },
  });

  const handleSelectMode = (mode: 'fast' | 'balanced' | 'deep') => {
    updatePreferences.mutate({ analysis_mode: mode });
  };

  const currentMode = preferences?.analysis_mode || 'balanced';

  return (
    <AppLayout>
      <Content style={{ padding: '24px', minHeight: '100vh' }}>
        <Title level={2} style={{ marginBottom: 8 }}>Configuración</Title>
        <Paragraph type="secondary" style={{ marginBottom: 32 }}>
          Personaliza cómo funciona el analizador de RFPs para ti
        </Paragraph>

        {/* Sección de Modo de Análisis */}
        <Card 
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <span>Modo de Análisis</span>
            </div>
          }
          style={{ marginBottom: 24 }}
        >
          <Paragraph style={{ marginBottom: 24 }}>
            Elige cómo quieres que se analicen tus RFPs. Esta configuración afecta 
            la velocidad y profundidad del análisis automático.
          </Paragraph>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
            </div>
          ) : (
            <Row gutter={[24, 24]}>
              {analysisModes.map((mode) => {
                const isSelected = currentMode === mode.key;
                return (
                  <Col xs={24} md={8} key={mode.key}>
                    <Card
                      hoverable
                      onClick={() => handleSelectMode(mode.key)}
                      style={{
                        borderColor: isSelected ? mode.color : token.colorBorderSecondary,
                        borderWidth: isSelected ? 2 : 1,
                        background: isSelected ? `${mode.color}08` : token.colorBgContainer,
                        cursor: updatePreferences.isPending ? 'wait' : 'pointer',
                        transition: 'all 0.3s ease',
                        height: '100%',
                        position: 'relative',
                      }}
                      styles={{
                        body: {
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          padding: 24,
                        }
                      }}
                    >
                      {/* Check de seleccionado */}
                      {isSelected && (
                        <CheckCircleFilled 
                          style={{ 
                            position: 'absolute', 
                            top: 12, 
                            right: 12, 
                            fontSize: 24,
                            color: mode.color,
                          }} 
                        />
                      )}
                      
                      {/* Badge de recomendado */}
                      {mode.recommended && (
                        <div style={{
                          position: 'absolute',
                          top: -12,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: mode.color,
                          color: 'white',
                          padding: '2px 12px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                        }}>
                          RECOMENDADO
                        </div>
                      )}

                      {/* Icono */}
                      <div style={{ 
                        color: isSelected ? mode.color : token.colorTextSecondary,
                        marginBottom: 16,
                        transition: 'color 0.3s',
                      }}>
                        {mode.icon}
                      </div>

                      {/* Título */}
                      <Title 
                        level={4} 
                        style={{ 
                          margin: 0, 
                          marginBottom: 8,
                          color: isSelected ? mode.color : token.colorText,
                        }}
                      >
                        {mode.title}
                      </Title>

                      {/* Descripción corta */}
                      <Text 
                        strong 
                        style={{ 
                          display: 'block', 
                          marginBottom: 12,
                          color: token.colorTextSecondary,
                        }}
                      >
                        {mode.description}
                      </Text>

                      {/* Detalles */}
                      <Paragraph 
                        type="secondary" 
                        style={{ 
                          margin: 0, 
                          fontSize: 13,
                          lineHeight: 1.5,
                        }}
                      >
                        {mode.details}
                      </Paragraph>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          )}
        </Card>

        {/* Información adicional */}
        <Card
          style={{ background: token.colorBgLayout }}
          styles={{ body: { padding: '16px 24px' } }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20 }}>💡</span>
            <div>
              <Text strong>¿No sabes cuál elegir?</Text>
              <br />
              <Text type="secondary">
                La mayoría de BDMs usan el modo <strong>Balanceado</strong>. Es rápido y completo 
                a la vez. Usa el modo <strong>Profundo</strong> solo para RFPs de alta complejidad 
                o cuando el cliente es muy importante.
              </Text>
            </div>
          </div>
        </Card>
      </Content>
    </AppLayout>
  );
};

export default SettingsPage;
