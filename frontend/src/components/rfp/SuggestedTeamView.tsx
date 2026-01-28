/**
 * Componente para visualizar candidatos sugeridos del MCP Talent Search
 * Diseño mejorado con información detallada de cada candidato
 */
import React, { useState } from 'react';
import {
  Tag, Space, Typography, Avatar, Badge,
  Empty, Progress, Row, Col, Alert, Divider, Spin
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
    <div
      className="content-panel"
      style={{
        marginBottom: 16,
        padding: '20px',
        borderLeft: `4px solid ${getScoreColor(candidate.score)}`,
        background: 'var(--bg-elevated)'
      }}
    >
      {/* Header con info básica */}
      <Row gutter={[24, 24]} align="middle">
        <Col xs={24} md={14}>
          <Space align="start" size={20}>
            <Badge count={rank} color={rank <= 3 ? 'gold' : '#8c8c8c'} offset={[-5, 5]}>
              <Avatar
                size={72}
                icon={<UserOutlined />}
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: getScoreColor(candidate.score),
                  fontSize: 32,
                  border: `2px solid ${getScoreColor(candidate.score)}`
                }}
              />
            </Badge>
            <Space direction="vertical" size={4}>
              <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>
                {candidate.nombre}
              </Title>
              <Text style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                <IdcardOutlined style={{ marginRight: 6 }} /> {candidate.cargo}
              </Text>
              {candidate.pais && (
                <Text style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                  <GlobalOutlined style={{ marginRight: 6 }} /> {candidate.pais}
                </Text>
              )}
              <Space size={8} style={{ marginTop: 8 }}>
                <Tag icon={<MailOutlined />} style={{ background: 'rgba(24, 144, 255, 0.1)', color: '#1890ff', border: 'none' }}>
                  <a href={`mailto:${candidate.email}`} style={{ color: 'inherit' }}>
                    {candidate.email}
                  </a>
                </Tag>
                <Tag style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', border: 'none' }}>
                  ID: {candidate.matricula}
                </Tag>
              </Space>
            </Space>
          </Space>
        </Col>

        <Col xs={24} md={10}>
          <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8 }}>
            <Row gutter={16} align="middle">
              <Col span={10} style={{ textAlign: 'center' }}>
                <Progress
                  type="circle"
                  percent={Math.round(candidate.score)}
                  size={70}
                  strokeColor={getScoreColor(candidate.score)}
                  trailColor="rgba(255,255,255,0.1)"
                  format={(percent) => (
                    <span style={{ fontSize: 16, fontWeight: 'bold', color: 'var(--text-primary)' }}>{percent}%</span>
                  )}
                />
                <div style={{ marginTop: 8 }}>
                  <Tag color={getScoreColor(candidate.score)} style={{ margin: 0 }}>
                    {getScoreLabel(candidate.score)}
                  </Tag>
                </div>
              </Col>
              <Col span={14}>
                {candidate.match_principal && (
                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Match Principal</Text>
                    <br />
                    <div style={{ marginTop: 4 }}>
                      <Tag icon={<StarOutlined />} color="purple" style={{ whiteSpace: 'normal', height: 'auto', padding: '4px 8px' }}>
                        {candidate.match_principal}
                      </Tag>
                    </div>
                  </div>
                )}
                <div>
                  <Space direction="vertical" size={2}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <SafetyCertificateOutlined style={{ marginRight: 6 }} /> {candidate.certificaciones?.length || 0} Certificaciones
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      <CodeOutlined style={{ marginRight: 6 }} /> {candidate.skills?.length || 0} Skills
                    </Text>
                  </Space>
                </div>
              </Col>
            </Row>
          </div>
        </Col>
      </Row>

      {/* Explicación IA */}
      <div style={{
        marginTop: 20,
        padding: '16px',
        background: 'linear-gradient(90deg, rgba(114, 46, 209, 0.1) 0%, rgba(114, 46, 209, 0.02) 100%)',
        borderRadius: 8,
        borderLeft: '2px solid #722ed1'
      }}>
        <Space align="start">
          <BulbOutlined style={{ color: '#b37feb', fontSize: 18, marginTop: 2 }} />
          <div>
            <Text strong style={{ color: '#b37feb', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ¿Por qué este candidato?
            </Text>
            <Paragraph style={{ margin: '4px 0 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>
              {matchExplanation}
            </Paragraph>
          </div>
        </Space>
      </div>

      {/* Líder */}
      {candidate.lider && (candidate.lider.nombre || candidate.lider.email) && (
        <div style={{ marginTop: 20 }}>
          <Divider style={{ margin: '0 0 12px 0', borderColor: 'var(--border-color)' }} />
          <Space>
            <TeamOutlined style={{ color: 'var(--text-tertiary)' }} />
            <Text style={{ color: 'var(--text-secondary)' }}>Líder Directo:</Text>
            <Text strong style={{ color: 'var(--text-primary)' }}>{candidate.lider.nombre || 'No especificado'}</Text>
            {candidate.lider.email && (
              <Tag icon={<MailOutlined />} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>
                <a href={`mailto:${candidate.lider.email}`} style={{ color: 'inherit' }}>
                  {candidate.lider.email}
                </a>
              </Tag>
            )}
          </Space>
        </div>
      )}

      <Divider style={{ margin: '16px 0 16px 0', borderColor: 'var(--border-color)' }} />

      {/* Skills Desplegables */}
      <div style={{ marginBottom: 12 }}>
        <div
          onClick={() => setSkillsExpanded(!skillsExpanded)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}
          className="hover-opacity"
        >
          {skillsExpanded ? <DownOutlined style={{ fontSize: 12 }} /> : <RightOutlined style={{ fontSize: 12 }} />}
          <CodeOutlined style={{ color: '#13c2c2' }} />
          <Text strong style={{ color: 'var(--text-primary)' }}>Skills Técnicos ({candidate.skills?.length || 0})</Text>
        </div>

        {skillsExpanded && (
          <div style={{ marginTop: 12, paddingLeft: 24 }}>
            {Object.entries(skillsByCategory).length > 0 ? (
              Object.entries(skillsByCategory).map(([category, skills]) => (
                <div key={category} style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    {category}
                  </Text>
                  <Space wrap size={[6, 6]}>
                    {skills.map((skill, i) => (
                      <Tag
                        key={i}
                        color={getProficiencyColor(skill.proficiencia)}
                        style={{ margin: 0, padding: '2px 8px' }}
                      >
                        {skill.nombre}
                        {skill.proficiencia && (
                          <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 11 }}>
                            • {getProficiencyLabel(skill.proficiencia)}
                          </span>
                        )}
                      </Tag>
                    ))}
                  </Space>
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
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}
          className="hover-opacity"
        >
          {certsExpanded ? <DownOutlined style={{ fontSize: 12 }} /> : <RightOutlined style={{ fontSize: 12 }} />}
          <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
          <Text strong style={{ color: 'var(--text-primary)' }}>Certificaciones ({candidate.certificaciones?.length || 0})</Text>
        </div>

        {certsExpanded && (
          <div style={{ marginTop: 12, paddingLeft: 24 }}>
            {(candidate.certificaciones?.length || 0) > 0 ? (
              <Row gutter={[12, 12]}>
                {candidate.certificaciones.map((cert, i) => (
                  <Col span={24} md={12} key={i}>
                    <div style={{
                      background: 'var(--bg-tertiary)',
                      padding: '12px',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      height: '100%'
                    }}>
                      <Space align="start">
                        <TrophyOutlined style={{ color: '#52c41a', marginTop: 4 }} />
                        <div>
                          <Text strong style={{ color: 'var(--text-primary)', display: 'block' }}>{cert.nombre}</Text>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
                            {cert.institucion || 'Institución no especificada'}
                          </Text>
                          {(cert.fecha_emision || cert.fecha_expiracion) && (
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4, color: 'var(--text-tertiary)' }}>
                              {cert.fecha_emision && `Emitida: ${cert.fecha_emision.split(' ')[0]}`}
                              {cert.fecha_emision && cert.fecha_expiracion && ' | '}
                              {cert.fecha_expiracion && `Expira: ${cert.fecha_expiracion.split(' ')[0]}`}
                            </Text>
                          )}
                        </div>
                      </Space>
                    </div>
                  </Col>
                ))}
              </Row>
            ) : (
              <Text type="secondary">No hay certificaciones registradas</Text>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Componente principal
 */
const SuggestedTeamView: React.FC<SuggestedTeamViewProps> = ({ suggestedTeam, loading }) => {
  if (loading) {
    return (
      <div className="content-panel" style={{ padding: 60, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 24 }}>
          <Text style={{ fontSize: 16 }}>Buscando leones en la base de talentos TIVIT...</Text>
        </div>
      </div>
    );
  }

  if (!suggestedTeam) {
    return (
      <Empty
        description="No hay candidatos sugeridos"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      >
        <div style={{ marginTop: 16 }}>
          <Text type="secondary">Haz clic en 'Buscar Candidatos' para consultar el sistema de talentos.</Text>
        </div>
      </Empty>
    );
  }

  if (suggestedTeam.error) {
    return (
      <Alert
        type="error"
        showIcon
        message="Error al buscar candidatos"
        description={suggestedTeam.error}
        style={{ marginBottom: 24 }}
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
        style={{ marginBottom: 24 }}
      />
    );
  }

  const resultados = suggestedTeam.resultados || {};
  const roleEntries = Object.entries(resultados);

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Resumen */}
      <div className="content-panel" style={{ padding: 24 }}>
        <Row gutter={24}>
          <Col xs={12} md={6}>
            <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 }}>Roles Buscados</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-primary)' }}>{suggestedTeam.total_roles || 0}</div>
            </div>
          </Col>
          <Col xs={12} md={6}>
            <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 }}>Candidatos</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-success)' }}>{suggestedTeam.total_candidatos || 0}</div>
            </div>
          </Col>
          <Col xs={12} md={6}>
            <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 }}>Cobertura</div>
              <div style={{
                fontSize: 24,
                fontWeight: 700,
                color: (suggestedTeam.coverage_percent || 0) >= 80 ? '#52c41a' :
                  (suggestedTeam.coverage_percent || 0) >= 50 ? '#faad14' : '#ff4d4f'
              }}>
                {Math.round(suggestedTeam.coverage_percent || 0)}%
              </div>
            </div>
          </Col>
          <Col xs={12} md={6}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 }}>Generado</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {suggestedTeam.generated_at
                  ? new Date(suggestedTeam.generated_at).toLocaleDateString()
                  : 'N/A'}
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Barra de cobertura */}
      <div className="content-panel" style={{ padding: '16px 24px' }}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <Text strong>Cobertura de Roles</Text>
          <Text type="secondary">{Math.round(suggestedTeam.coverage_percent || 0)}% cubierto</Text>
        </div>
        <Progress
          percent={Math.round(suggestedTeam.coverage_percent || 0)}
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#52c41a',
          }}
          showInfo={false}
          strokeLinecap="square"
          trailColor="var(--bg-tertiary)"
        />
      </div>

      {roleEntries.length === 0 && (
        <Alert
          type="info"
          showIcon
          message="Sin resultados detallados"
          description="Se encontraron candidatos pero no hay detalles de roles disponibles. Intente actualizar la búsqueda."
        />
      )}

      {/* Lista de roles con candidatos */}
      {roleEntries.length > 0 && (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {roleEntries.map(([roleId, roleResult]) => {
            const avgScore = roleResult.candidatos.length > 0
              ? Math.round(roleResult.candidatos.reduce((sum, c) => sum + c.score, 0) / roleResult.candidatos.length)
              : 0;

            return (
              <div key={roleId}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                  paddingLeft: 8,
                  borderLeft: '4px solid var(--color-primary)'
                }}>
                  <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>
                    {roleResult.descripcion}
                  </Title>
                  <Space>
                    <Tag color={avgScore >= 70 ? 'green' : avgScore >= 50 ? 'gold' : 'default'} style={{ fontSize: 13, padding: '4px 10px' }}>
                      Score Prom: {avgScore}%
                    </Tag>
                    <Badge
                      count={roleResult.total}
                      style={{ backgroundColor: 'var(--color-primary)' }}
                      showZero
                    />
                  </Space>
                </div>

                {roleResult.candidatos.length > 0 ? (
                  <div>
                    {roleResult.candidatos.map((candidate, index) => (
                      <CandidateCard
                        key={candidate.matricula}
                        candidate={candidate}
                        rank={index + 1}
                        roleDescription={roleResult.descripcion}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="content-panel" style={{ padding: 32, textAlign: 'center' }}>
                    <Empty
                      description="No se encontraron candidatos para este rol"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </Space>
      )}
    </Space>
  );
};

export default SuggestedTeamView;
