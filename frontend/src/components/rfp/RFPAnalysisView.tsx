import React from 'react';
import { Typography, Row, Col, Tag, List, Space } from 'antd';
import {
    CodeOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { CitationViewer } from '../common/CitationViewer';
import { SourceBadge } from '../common/SourceBadge';
import type { RFPDetail, Recommendation, RFPFile } from '../../types';

const { Title, Text } = Typography;

interface RFPAnalysisViewProps {
    rfp: RFPDetail;
    onPreviewFile?: (file: RFPFile, page?: number) => void;
}

const recommendationColors: Record<Recommendation, string> = {
    strong_go: 'green',
    go: 'lime',
    conditional_go: 'gold',
    no_go: 'orange',
    strong_no_go: 'red',
};

const RFPAnalysisView: React.FC<RFPAnalysisViewProps> = ({ rfp, onPreviewFile }) => {
    const extracted = rfp.extracted_data;

    if (!extracted) return <div className="content-panel" style={{ padding: 24 }}>No hay análisis disponible.</div>;

    return (
        <Row gutter={24}>
            <Col span={16}>
                {/* Tech Stack */}
                {extracted.tech_stack && extracted.tech_stack.length > 0 && (
                    <div className="content-panel" style={{ marginBottom: 24, padding: 24 }}>
                        <Title level={5} style={{ marginTop: 0, marginBottom: 16, color: 'var(--text-primary)' }}>
                            <CodeOutlined style={{ marginRight: 8 }} /> Stack Tecnológico
                        </Title>
                        <Space wrap>
                            {extracted.tech_stack.map((tech, i) => (
                                <Tag key={i} color="blue" style={{ padding: '4px 12px', borderRadius: 4 }}>
                                    <CitationViewer text={tech} files={rfp.files} onPreviewFile={onPreviewFile} />
                                </Tag>
                            ))}
                        </Space>
                    </div>
                )}

                {/* Risks */}
                {extracted.risks && extracted.risks.length > 0 && (
                    <div className="content-panel" style={{ marginBottom: 24, overflow: 'hidden' }}>
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                            <Title level={5} style={{ margin: 0, color: 'var(--text-primary)' }}>
                                <ExclamationCircleOutlined style={{ marginRight: 8, color: 'var(--color-warning)' }} /> Riesgos Identificados
                            </Title>
                        </div>
                        <List
                            dataSource={extracted.risks}
                            renderItem={(risk) => {
                                const severityColors: Record<string, string> = { critical: '#ff4d4f', high: '#faad14', medium: '#faad14', low: '#52c41a' };
                                return (
                                    <List.Item style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
                                        <div style={{ width: '100%' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                <Space>
                                                    <Text strong style={{ color: 'var(--text-primary)' }}>{risk.category.replace(/_/g, ' ').toUpperCase()}</Text>
                                                    <SourceBadge
                                                        referenceDocument={risk.reference_document}
                                                        files={rfp.files}
                                                        onPreviewFile={onPreviewFile}
                                                    />
                                                </Space>
                                                <Tag color={severityColors[risk.severity] || 'default'}>{risk.severity.toUpperCase()}</Tag>
                                            </div>
                                            <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{risk.description}</div>
                                        </div>
                                    </List.Item>
                                );
                            }}
                        />
                    </div>
                )}
            </Col>

            <Col span={8}>
                {/* Recommendation Reasons */}
                {extracted.recommendation_reasons && extracted.recommendation_reasons.length > 0 && rfp.recommendation && (
                    <div className="content-panel" style={{ marginBottom: 24, padding: 24, borderLeft: `4px solid ${recommendationColors[rfp.recommendation]}` }}>
                        <Title level={5} style={{ marginTop: 0, marginBottom: 16, color: 'var(--text-primary)' }}>¿Por qué esta recomendación?</Title>
                        <ul style={{ paddingLeft: 20, margin: 0, color: 'var(--text-secondary)' }}>
                            {extracted.recommendation_reasons.map((reason, idx) => (
                                <li key={idx} style={{ marginBottom: 8 }}>
                                    <CitationViewer text={reason} files={rfp.files} onPreviewFile={onPreviewFile} />
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* SLAs */}
                {extracted.sla && extracted.sla.length > 0 && (
                    <div className="content-panel" style={{ marginBottom: 24 }}>
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
                            <Title level={5} style={{ margin: 0, color: 'var(--text-primary)' }}>SLAs</Title>
                        </div>
                        {extracted.sla.map((sla, idx) => (
                            <div key={idx} style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <div style={{ color: 'var(--text-secondary)', flex: 1 }}>
                                        <CitationViewer text={sla.description} files={rfp.files} onPreviewFile={onPreviewFile} />
                                    </div>
                                    <SourceBadge
                                        source={sla.source}
                                        referenceDocument={sla.reference_document}
                                        files={rfp.files}
                                        onPreviewFile={onPreviewFile}
                                    />
                                </div>
                                <Space size={4}>
                                    {sla.is_aggressive && <Tag color="red" style={{ fontSize: 10 }}>Agresivo</Tag>}
                                    {sla.metric && <Tag style={{ fontSize: 10 }}>{sla.metric}</Tag>}
                                </Space>
                            </div>
                        ))}
                    </div>
                )}

                {/* Penalties */}
                {extracted.penalties && extracted.penalties.length > 0 && (
                    <div className="content-panel" style={{ marginBottom: 24 }}>
                        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
                            <Title level={5} style={{ margin: 0, color: 'var(--text-primary)' }}>Penalidades</Title>
                        </div>
                        {extracted.penalties.map((pen, idx) => (
                            <div key={idx} style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <div style={{ color: 'var(--text-secondary)', flex: 1 }}>
                                        <CitationViewer text={pen.description} files={rfp.files} onPreviewFile={onPreviewFile} />
                                    </div>
                                    <SourceBadge
                                        source={pen.source}
                                        referenceDocument={pen.reference_document}
                                        files={rfp.files}
                                        onPreviewFile={onPreviewFile}
                                    />
                                </div>
                                {pen.amount && <Text style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>{pen.amount}</Text>}
                            </div>
                        ))}
                    </div>
                )}
            </Col>
        </Row>
    );
};

export default RFPAnalysisView;

