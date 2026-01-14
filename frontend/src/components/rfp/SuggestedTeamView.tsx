/**
 * Componente para visualizar candidatos sugeridos del MCP Talent Search
 * Diseño mejorado con información detallada de cada candidato
 */
import React, { useState } from 'react';
import { 
  Card, Collapse, Tag, Space, Typography, Avatar, Badge, 
  Empty, Progress, Row, Col, Statistic, Alert, Divider, Spin
} from 'antd';
import { 
  UserOutlined, MailOutlined, TeamOutlined, TrophyOutlined,
  SafetyCertificateOutlined, CodeOutlined, GlobalOutlined, 
  StarOutlined, BulbOutlined, DownOutlined, RightOutlined,
  IdcardOutlined
} from '@ant-design/icons';
import type { SuggestedTeam, MCPCandidate } from '../../types';

const { Text, Title, Paragraph } = Typography;

interface SuggestedTeamViewProps {
  suggestedTeam: SuggestedTeam | null;
  loading?: boolean;
}

const getScoreColor = (score: number): string => {
  if (score >= 80) return '#52c41a';
  if (score >= 60) return '#1890ff';
  if (score >= 40) return '#faad14';
  return '#ff4d4f';
};

const getScoreLabel = (score: number): string => {
  if (score >= 80) return 'Excelente';
  if (score >= 60) return 'Bueno';
  if (score >= 40) return 'Regular';
  return 'Bajo';
};

const getProficiencyLabel = (level: number | undefined): string => {
  if (!level) return 'N/A';
  const labels: Record<number, string> = {
    1: 'Básico',
    2: 'Elemental',
    3: 'Intermedio',
    4: 'Avanzado',
    5: 'Experto'
  };
  return labels[level] || `Nivel ${level}`;
};

const getProficiencyColor = (level: number | undefined): string => {
  if (!level) return 'default';
  if (level >= 4) return 'green';
  if (level >= 3) return 'blue';
  if (level >= 2) return 'gold';
  return 'default';
};

/**
 * Genera una explicación de por qué el candidato es adecuado
 */
const generateMatchExplanation = (candidate: MCPCandidate, _roleDescription?: string): string => {
  const reasons: string[] = [];
  
  // Match principal
  if (candidate.match_principal) {
    reasons.push(`Tiene experiencia/certificación en "${candidate.match_principal}" que coincide directamente con los requisitos del rol.`);
  }
  
  // Score
  if (candidate.score >= 80) {
    reasons.push('Su perfil tiene una alta compatibilidad con las habilidades requeridas.');
  } else if (candidate.score >= 60) {
    reasons.push('Su perfil tiene buena compatibilidad con varios de los requisitos.');
  }
  
  // Certificaciones relevantes
  const certCount = candidate.certificaciones?.length || 0;
  if (certCount > 5) {
    reasons.push(`Cuenta con ${certCount} certificaciones que demuestran su expertise técnico.`);
  } else if (certCount > 0) {
    reasons.push(`Tiene ${certCount} certificación(es) relevante(s) para el puesto.`);
  }
  
  // Skills
  const highLevelSkills = candidate.skills?.filter(s => (s.proficiencia || 0) >= 4) || [];
  if (highLevelSkills.length > 0) {
    reasons.push(`Domina a nivel avanzado/experto: ${highLevelSkills.slice(0, 3).map(s => s.nombre).join(', ')}.`);
  }
  
  return reasons.length > 0 
    ? reasons.join(' ') 
    : 'Este candidato fue seleccionado por su perfil general que coincide con los requisitos del rol.';
};

/**
 * Componente de tarjeta de candidato expandida
 */
const CandidateCard: React.FC<{ 
  candidate: MCPCandidate; 
  rank: number;
  roleDescription: string;
}> = ({ candidate, rank, roleDescription }) => {
  const [skillsExpanded, setSkillsExpanded] = useState(false);
  const [certsExpanded, setCertsExpanded] = useState(false);

  // Agrupar skills por categoría
  const skillsByCategory: Record<string, typeof candidate.skills> = {};
  (candidate.skills || []).forEach(skill => {
    const cat = skill.categoria || 'Otros';
    if (!skillsByCategory[cat]) {
      skillsByCategory[cat] = [];
    }
    skillsByCategory[cat].push(skill);
  });

  const matchExplanation = generateMatchExplanation(candidate, roleDescription);

  return (
    <Card 
      style={{ marginBottom: 16 }}
      styles={{ body: { padding: '16px 20px' } }}
    >
      {/* Header con info básica */}
      <Row gutter={[16, 16]} align="middle">
        <Col xs={24} md={14}>
          <Space align="start" size={16}>
            <Badge count={rank} color={rank <= 3 ? 'gold' : '#8c8c8c'} offset={[-5, 5]}>
              <Avatar 
                size={64} 
                icon={<UserOutlined />} 
                style={{ 
                  backgroundColor: getScoreColor(candidate.score),
                  fontSize: 28
                }}
              />
            </Badge>
            <Space direction="vertical" size={2}>
              <Title level={5} style={{ margin: 0 }}>
                {candidate.nombre}
              </Title>
              <Text type="secondary">
                <IdcardOutlined /> {candidate.cargo}
              </Text>
              {candidate.pais && (
                <Text type="secondary">
                  <GlobalOutlined /> {candidate.pais}
                </Text>
              )}
              <Space size={8} style={{ marginTop: 4 }}>
                <Tag icon={<MailOutlined />} color="blue">
                  <a href={`mailto:${candidate.email}`} style={{ color: 'inherit' }}>
                    {candidate.email}
                  </a>
                </Tag>
                <Tag color="default">
                  ID: {candidate.matricula}
                </Tag>
              </Space>
            </Space>
          </Space>
        </Col>
        
        <Col xs={24} md={10}>
          <Card size="small" style={{ background: '#fafafa' }}>
            <Row gutter={16} align="middle">
              <Col span={12} style={{ textAlign: 'center' }}>
                <Progress
                  type="circle"
                  percent={Math.round(candidate.score)}
                  size={70}
                  strokeColor={getScoreColor(candidate.score)}
                  format={(percent) => (
                    <span style={{ fontSize: 16, fontWeight: 'bold' }}>{percent}%</span>
                  )}
                />
                <div style={{ marginTop: 4 }}>
                  <Tag color={getScoreColor(candidate.score)}>
                    {getScoreLabel(candidate.score)}
                  </Tag>
                </div>
              </Col>
              <Col span={12}>
                {candidate.match_principal && (
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Match Principal:</Text>
                    <br />
                    <Tag icon={<StarOutlined />} color="purple">
                      {candidate.match_principal.length > 25 
                        ? candidate.match_principal.substring(0, 25) + '...' 
                        : candidate.match_principal}
                    </Tag>
                  </div>
                )}
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    <SafetyCertificateOutlined /> {candidate.certificaciones?.length || 0} Certs
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    <CodeOutlined /> {candidate.skills?.length || 0} Skills
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Explicación IA */}
      <div style={{ 
        marginTop: 16, 
        padding: '12px 16px', 
        background: 'rgba(114, 46, 209, 0.1)',
        borderRadius: 8,
        border: '1px solid rgba(114, 46, 209, 0.3)'
      }}>
        <Space align="start">
          <BulbOutlined style={{ color: '#b37feb', fontSize: 18, marginTop: 2 }} />
          <div>
            <Text strong style={{ color: '#b37feb', fontSize: 12 }}>
              ¿Por qué este candidato?
            </Text>
            <Paragraph style={{ margin: '4px 0 0 0', fontSize: 13, color: 'rgba(255, 255, 255, 0.85)' }}>
              {matchExplanation}
            </Paragraph>
          </div>
        </Space>
      </div>

      {/* Líder */}
      {candidate.lider && (candidate.lider.nombre || candidate.lider.email) && (
        <div style={{ marginTop: 16 }}>
          <Divider style={{ margin: '0 0 12px 0' }} />
          <Space>
            <TeamOutlined style={{ color: '#1890ff' }} />
            <Text strong>Líder Directo:</Text>
            <Text>{candidate.lider.nombre || 'No especificado'}</Text>
            {candidate.lider.email && (
              <Tag icon={<MailOutlined />} color="default">
                <a href={`mailto:${candidate.lider.email}`} style={{ color: 'inherit' }}>
                  {candidate.lider.email}
                </a>
              </Tag>
            )}
          </Space>
        </div>
      )}

      <Divider style={{ margin: '16px 0 12px 0' }} />

      {/* Skills Desplegables */}
      <div style={{ marginBottom: 12 }}>
        <div 
          onClick={() => setSkillsExpanded(!skillsExpanded)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {skillsExpanded ? <DownOutlined /> : <RightOutlined />}
          <CodeOutlined style={{ color: '#13c2c2' }} />
          <Text strong>Skills Técnicos ({candidate.skills?.length || 0})</Text>
        </div>
        
        {skillsExpanded && (
          <div style={{ marginTop: 12, paddingLeft: 24 }}>
            {Object.entries(skillsByCategory).length > 0 ? (
              Object.entries(skillsByCategory).map(([category, skills]) => (
                <div key={category} style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
                    {category}:
                  </Text>
                  <div style={{ marginTop: 4 }}>
                    <Space wrap size={[4, 4]}>
                      {skills.map((skill, i) => (
                        <Tag 
                          key={i} 
                          color={getProficiencyColor(skill.proficiencia)}
                          style={{ marginBottom: 2 }}
                        >
                          {skill.nombre}
                          {skill.proficiencia && (
                            <span style={{ marginLeft: 4, opacity: 0.7 }}>
                              ({getProficiencyLabel(skill.proficiencia)})
                            </span>
                          )}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                </div>
              ))
            ) : (
              <Text type="secondary">No hay skills registrados</Text>
            )}
          </div>
        )}
      </div>

      {/* Certificaciones Desplegables */}
      <div>
        <div 
          onClick={() => setCertsExpanded(!certsExpanded)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {certsExpanded ? <DownOutlined /> : <RightOutlined />}
          <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
          <Text strong>Certificaciones ({candidate.certificaciones?.length || 0})</Text>
        </div>
        
        {certsExpanded && (
          <div style={{ marginTop: 12, paddingLeft: 24 }}>
            {(candidate.certificaciones?.length || 0) > 0 ? (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {candidate.certificaciones.map((cert, i) => (
                  <Card 
                    key={i} 
                    size="small" 
                    style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}
                  >
                    <Space direction="vertical" size={0}>
                      <Space>
                        <TrophyOutlined style={{ color: '#52c41a' }} />
                        <Text strong style={{ fontSize: 13 }}>{cert.nombre}</Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12, marginLeft: 22 }}>
                        {cert.institucion || 'Institución no especificada'}
                      </Text>
                      {(cert.fecha_emision || cert.fecha_expiracion) && (
                        <Text type="secondary" style={{ fontSize: 11, marginLeft: 22 }}>
                          {cert.fecha_emision && `Emitida: ${cert.fecha_emision.split(' ')[0]}`}
                          {cert.fecha_emision && cert.fecha_expiracion && ' | '}
                          {cert.fecha_expiracion && `Expira: ${cert.fecha_expiracion.split(' ')[0]}`}
                        </Text>
                      )}
                    </Space>
                  </Card>
                ))}
              </Space>
            ) : (
              <Text type="secondary">No hay certificaciones registradas</Text>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

/**
 * Componente principal
 */
const SuggestedTeamView: React.FC<SuggestedTeamViewProps> = ({ suggestedTeam, loading }) => {
  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text>Buscando candidatos en la base de talentos TIVIT...</Text>
          </div>
        </div>
      </Card>
    );
  }

  if (!suggestedTeam) {
    return (
      <Empty
        description="No hay candidatos sugeridos. Haz clic en 'Buscar Candidatos' para consultar el sistema de talentos."
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  if (suggestedTeam.error) {
    return (
      <Alert
        type="error"
        showIcon
        message="Error al buscar candidatos"
        description={suggestedTeam.error}
      />
    );
  }

  if (suggestedTeam.mcp_available === false) {
    return (
      <Alert
        type="warning"
        showIcon
        message="MCP Talent Search no disponible"
        description="El servicio de búsqueda de talentos no está disponible en este momento. Por favor, intente más tarde."
      />
    );
  }

  const resultados = suggestedTeam.resultados || {};
  const roleEntries = Object.entries(resultados);

  if (roleEntries.length === 0) {
    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Row gutter={16}>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Roles Buscados"
                value={suggestedTeam.total_roles || 0}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Candidatos Encontrados"
                value={suggestedTeam.total_candidatos || 0}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Statistic
                title="Cobertura"
                value={suggestedTeam.coverage_percent || 0}
                suffix="%"
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>
        <Alert
          type="info"
          showIcon
          message="Sin resultados detallados"
          description="Se encontraron candidatos pero no hay detalles de roles disponibles. Intente actualizar la búsqueda."
        />
      </Space>
    );
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Resumen */}
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Roles Buscados"
              value={suggestedTeam.total_roles || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Candidatos"
              value={suggestedTeam.total_candidatos || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Cobertura"
              value={Math.round(suggestedTeam.coverage_percent || 0)}
              suffix="%"
              valueStyle={{ 
                color: (suggestedTeam.coverage_percent || 0) >= 80 ? '#52c41a' : 
                       (suggestedTeam.coverage_percent || 0) >= 50 ? '#faad14' : '#ff4d4f' 
              }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Generado"
              value={suggestedTeam.generated_at 
                ? new Date(suggestedTeam.generated_at).toLocaleDateString() 
                : 'N/A'}
              valueStyle={{ fontSize: 14, color: '#8c8c8c' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Barra de cobertura */}
      <Card size="small">
        <div style={{ marginBottom: 8 }}>
          <Text strong>Cobertura de Roles</Text>
        </div>
        <Progress
          percent={Math.round(suggestedTeam.coverage_percent || 0)}
          status={(suggestedTeam.coverage_percent || 0) >= 80 ? 'success' : 'normal'}
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
          format={(percent) => `${percent}% de roles con candidatos encontrados`}
        />
      </Card>

      {/* Lista de roles con candidatos */}
      <Collapse 
        defaultActiveKey={roleEntries.length > 0 ? [roleEntries[0][0]] : []}
        expandIconPosition="start"
        items={roleEntries.map(([roleId, roleResult]) => {
          const avgScore = roleResult.candidatos.length > 0
            ? Math.round(roleResult.candidatos.reduce((sum, c) => sum + c.score, 0) / roleResult.candidatos.length)
            : 0;

          return {
            key: roleId,
            label: (
              <Row align="middle" gutter={16} style={{ width: '100%' }}>
                <Col flex="auto">
                  <Space>
                    <TeamOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                    <Text strong style={{ fontSize: 15 }}>{roleResult.descripcion}</Text>
                  </Space>
                </Col>
                <Col>
                  <Space size={12}>
                    <Badge 
                      count={`${roleResult.total} candidato${roleResult.total !== 1 ? 's' : ''}`} 
                      style={{ backgroundColor: '#1890ff' }} 
                    />
                    <Tag color={avgScore >= 70 ? 'green' : avgScore >= 50 ? 'gold' : 'default'}>
                      Score Prom: {avgScore}%
                    </Tag>
                  </Space>
                </Col>
              </Row>
            ),
            children: roleResult.candidatos.length > 0 ? (
              <Space direction="vertical" size={0} style={{ width: '100%' }}>
                {roleResult.candidatos.map((candidate, index) => (
                  <CandidateCard 
                    key={candidate.matricula} 
                    candidate={candidate} 
                    rank={index + 1}
                    roleDescription={roleResult.descripcion}
                  />
                ))}
              </Space>
            ) : (
              <Empty 
                description="No se encontraron candidatos para este rol" 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
              />
            )
          };
        })}
      />
    </Space>
  );
};

export default SuggestedTeamView;
