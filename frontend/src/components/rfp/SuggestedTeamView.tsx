/**
 * Componente para visualizar candidatos sugeridos del MCP Talent Search
 */
import React from 'react';
import { 
  Card, Collapse, Tag, Space, Typography, Avatar, List, Badge, 
  Empty, Tooltip, Progress, Row, Col, Statistic, Alert 
} from 'antd';
import { 
  UserOutlined, MailOutlined, TeamOutlined,
  SafetyCertificateOutlined, CodeOutlined, GlobalOutlined, StarOutlined
} from '@ant-design/icons';
import type { SuggestedTeam, MCPRoleResult, MCPCandidate } from '../../types';

const { Text } = Typography;
const { Panel } = Collapse;

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

const CandidateCard: React.FC<{ candidate: MCPCandidate; rank: number }> = ({ candidate, rank }) => {
  return (
    <Card 
      size="small" 
      style={{ marginBottom: 8 }}
      hoverable
    >
      <Row gutter={16} align="middle">
        {/* Avatar and basic info */}
        <Col span={6}>
          <Space>
            <Badge count={rank} color={rank <= 3 ? 'gold' : 'default'}>
              <Avatar 
                size={48} 
                icon={<UserOutlined />} 
                style={{ backgroundColor: getScoreColor(candidate.score) }}
              />
            </Badge>
            <Space direction="vertical" size={0}>
              <Text strong>{candidate.nombre}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>{candidate.cargo}</Text>
              {candidate.pais && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  <GlobalOutlined /> {candidate.pais}
                </Text>
              )}
            </Space>
          </Space>
        </Col>

        {/* Score */}
        <Col span={4} style={{ textAlign: 'center' }}>
          <Progress
            type="circle"
            percent={candidate.score}
            size={50}
            strokeColor={getScoreColor(candidate.score)}
            format={(percent) => (
              <span style={{ fontSize: 12, fontWeight: 'bold' }}>{percent}%</span>
            )}
          />
          <div>
            <Text type="secondary" style={{ fontSize: 10 }}>Match Score</Text>
          </div>
        </Col>

        {/* Match principal */}
        <Col span={4}>
          {candidate.match_principal && (
            <Tooltip title="Principal razón del match">
              <Tag color="blue" icon={<StarOutlined />}>
                {candidate.match_principal}
              </Tag>
            </Tooltip>
          )}
        </Col>

        {/* Skills */}
        <Col span={5}>
          <Space wrap size={[4, 4]}>
            {candidate.skills.slice(0, 3).map((skill, i) => (
              <Tooltip key={i} title={skill.proficiencia ? `Nivel: ${skill.proficiencia}/5` : undefined}>
                <Tag icon={<CodeOutlined />} color="cyan" style={{ fontSize: 11 }}>
                  {skill.nombre}
                </Tag>
              </Tooltip>
            ))}
            {candidate.skills.length > 3 && (
              <Tooltip title={candidate.skills.slice(3).map(s => s.nombre).join(', ')}>
                <Tag>+{candidate.skills.length - 3}</Tag>
              </Tooltip>
            )}
          </Space>
        </Col>

        {/* Certifications and Contact */}
        <Col span={5}>
          <Space direction="vertical" size={2}>
            {candidate.certificaciones.length > 0 && (
              <Space wrap size={[4, 4]}>
                {candidate.certificaciones.slice(0, 2).map((cert, i) => (
                  <Tooltip key={i} title={cert.institucion}>
                    <Tag icon={<SafetyCertificateOutlined />} color="green" style={{ fontSize: 10 }}>
                      {cert.nombre.length > 15 ? cert.nombre.substring(0, 15) + '...' : cert.nombre}
                    </Tag>
                  </Tooltip>
                ))}
              </Space>
            )}
            <Space>
              <Tooltip title={candidate.email}>
                <Tag icon={<MailOutlined />} color="default" style={{ fontSize: 11, cursor: 'pointer' }}>
                  Contactar
                </Tag>
              </Tooltip>
              {candidate.lider?.nombre && (
                <Tooltip title={`Líder: ${candidate.lider.nombre} (${candidate.lider.email || 'Sin email'})`}>
                  <Tag icon={<TeamOutlined />} style={{ fontSize: 11 }}>
                    {candidate.lider.nombre.split(' ')[0]}
                  </Tag>
                </Tooltip>
              )}
            </Space>
          </Space>
        </Col>
      </Row>
    </Card>
  );
};

const RolePanel: React.FC<{ roleId: string; roleResult: MCPRoleResult }> = ({ roleId, roleResult }) => {
  const avgScore = roleResult.candidatos.length > 0
    ? Math.round(roleResult.candidatos.reduce((sum, c) => sum + c.score, 0) / roleResult.candidatos.length)
    : 0;

  return (
    <Panel
      key={roleId}
      header={
        <Space>
          <Text strong>{roleResult.descripcion}</Text>
          <Badge count={roleResult.total} style={{ backgroundColor: '#1890ff' }} />
          <Tag color={avgScore >= 70 ? 'green' : avgScore >= 50 ? 'gold' : 'default'}>
            Score promedio: {avgScore}%
          </Tag>
        </Space>
      }
    >
      {roleResult.candidatos.length > 0 ? (
        <List
          dataSource={roleResult.candidatos}
          renderItem={(candidate, index) => (
            <CandidateCard candidate={candidate} rank={index + 1} />
          )}
        />
      ) : (
        <Empty description="No se encontraron candidatos para este rol" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Panel>
  );
};

const SuggestedTeamView: React.FC<SuggestedTeamViewProps> = ({ suggestedTeam }) => {
  // Debug logging - más detallado
  console.log('SuggestedTeamView - suggestedTeam:', JSON.stringify(suggestedTeam, null, 2));
  console.log('SuggestedTeamView - mcp_available:', suggestedTeam?.mcp_available);
  console.log('SuggestedTeamView - resultados:', suggestedTeam?.resultados);
  console.log('SuggestedTeamView - total_candidatos:', suggestedTeam?.total_candidatos);

  if (!suggestedTeam) {
    console.log('SuggestedTeamView - No suggestedTeam provided');
    return (
      <Empty
        description="No hay candidatos sugeridos. Haz clic en 'Buscar Candidatos' para consultar el sistema de talentos."
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  if (suggestedTeam.error) {
    console.log('SuggestedTeamView - Error:', suggestedTeam.error);
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
    console.log('SuggestedTeamView - MCP not available');
    return (
      <Alert
        type="warning"
        showIcon
        message="MCP Talent Search no disponible"
        description="El servicio de búsqueda de talentos no está disponible en este momento. Por favor, intente más tarde."
      />
    );
  }

  // Asegurarse de que resultados existe y es un objeto
  const resultados = suggestedTeam.resultados || {};
  const roleEntries = Object.entries(resultados);
  
  console.log('SuggestedTeamView - roleEntries:', roleEntries);
  console.log('SuggestedTeamView - roleEntries.length:', roleEntries.length);

  // Si no hay resultados, mostrar mensaje
  if (roleEntries.length === 0) {
    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Summary Cards */}
        <Row gutter={16}>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Roles Buscados"
                value={suggestedTeam.total_roles || 0}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Candidatos Encontrados"
                value={suggestedTeam.total_candidatos || 0}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#52c41a' }}
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
      {/* Summary Cards */}
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Roles Buscados"
              value={suggestedTeam.total_roles}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Candidatos Encontrados"
              value={suggestedTeam.total_candidatos}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Cobertura"
              value={suggestedTeam.coverage_percent}
              suffix="%"
              valueStyle={{ 
                color: suggestedTeam.coverage_percent >= 80 ? '#52c41a' : 
                       suggestedTeam.coverage_percent >= 50 ? '#faad14' : '#ff4d4f' 
              }}
            />
          </Card>
        </Col>
        <Col span={6}>
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

      {/* Coverage Progress */}
      <Card size="small" title="Cobertura por Rol">
        <Progress
          percent={suggestedTeam.coverage_percent}
          status={suggestedTeam.coverage_percent >= 80 ? 'success' : 'normal'}
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
          format={(percent) => `${percent}% de roles cubiertos con candidatos`}
        />
      </Card>

      {/* Candidates by Role */}
      {roleEntries.length > 0 ? (
        <Collapse defaultActiveKey={[roleEntries[0]?.[0]]}>
          {roleEntries.map(([roleId, roleResult]) => (
            <RolePanel key={roleId} roleId={roleId} roleResult={roleResult} />
          ))}
        </Collapse>
      ) : (
        <Empty description="No hay roles para mostrar" />
      )}
    </Space>
  );
};

export default SuggestedTeamView;
