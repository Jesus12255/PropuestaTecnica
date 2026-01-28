import React from 'react';
import {
    Typography, Descriptions, Button, Space, Form, Input,
    Select, InputNumber, DatePicker, Tag, Divider, Row, Col
} from 'antd';
import {
    EditOutlined, FileTextOutlined, GlobalOutlined, AppstoreOutlined,
    NumberOutlined, DollarOutlined, CalendarOutlined, ClockCircleOutlined,
    RobotOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { CitationViewer } from '../common/CitationViewer';
import type { RFPDetail, RFPFile } from '../../types';

const { Title, Text, Paragraph } = Typography;

interface RFPSummaryViewProps {
    rfp: RFPDetail;
    isEditing: boolean;
    onEdit: () => void;
    onCancel: () => void;
    onSave: () => void;
    form: any;
    saving?: boolean;
    onPreviewFile?: (file: RFPFile, page?: number) => void;
}

const RFPSummaryView: React.FC<RFPSummaryViewProps> = ({
    rfp,
    isEditing,
    onEdit,
    onCancel,
    onSave,
    form,
    saving = false,
    onPreviewFile
}) => {
    // Helpers
    const validateTVT = (_: unknown, value: string) => {
        if (value && !/^\d*$/.test(value)) {
            return Promise.reject('Solo se permiten números');
        }
        return Promise.resolve();
    };

    const formatCategory = (category: string | null | undefined): string => {
        if (!category) return '-';
        return category
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    return (
        <div className="content-panel" style={{ padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
                <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>Información del Proyecto</Title>
                {!isEditing ? (
                    <Button type="text" icon={<EditOutlined />} onClick={onEdit}>Editar</Button>
                ) : (
                    <Space>
                        <Button size="small" onClick={onCancel}>Cancelar</Button>
                        <Button size="small" type="primary" onClick={onSave} loading={saving}>Guardar</Button>
                    </Space>
                )}
            </div>

            {!isEditing ? (
                <>
                    <Descriptions column={2} labelStyle={{ color: 'var(--text-secondary)' }} contentStyle={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        <Descriptions.Item label={<><FileTextOutlined style={{ marginRight: 4 }} /> Nombre</>} span={2}>
                            {rfp.title || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={<><GlobalOutlined style={{ marginRight: 4 }} /> País</>}>
                            {rfp.country || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={<><AppstoreOutlined style={{ marginRight: 4 }} /> Categoría</>}>
                            {formatCategory(rfp.category)}
                        </Descriptions.Item>
                        <Descriptions.Item label={<><NumberOutlined style={{ marginRight: 4 }} /> TVT</>}>
                            {rfp.tvt || '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={<><DollarOutlined style={{ marginRight: 4 }} /> Presupuesto</>}>
                            {rfp.budget_min || rfp.budget_max ? (
                                `${rfp.currency} ${rfp.budget_min?.toLocaleString() || '?'} - ${rfp.budget_max?.toLocaleString() || '?'}`
                            ) : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={<><CalendarOutlined style={{ marginRight: 4 }} /> Deadline</>}>
                            {rfp.proposal_deadline ? dayjs(rfp.proposal_deadline).format('DD/MM/YYYY') : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label={<><ClockCircleOutlined style={{ marginRight: 4 }} /> Duración</>}>
                            <CitationViewer text={rfp.project_duration || '-'} files={rfp.files} onPreviewFile={onPreviewFile} />
                        </Descriptions.Item>
                        <Descriptions.Item label={<><RobotOutlined style={{ marginRight: 4 }} /> Confianza IA</>}>
                            <Tag color={rfp.confidence_score && rfp.confidence_score > 80 ? 'green' : 'gold'}>
                                {rfp.confidence_score ? `${rfp.confidence_score}%` : '-'}
                            </Tag>
                        </Descriptions.Item>
                    </Descriptions>
                </>
            ) : (
                <Form form={form} layout="vertical">
                    <Row gutter={16}>
                        <Col span={12}><Form.Item label="Nombre" name="title"><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item label="Cliente" name="client_name"><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item label="País" name="country"><Input /></Form.Item></Col>
                        <Col span={12}>
                            <Form.Item label="Categoría" name="category">
                                <Select>
                                    <Select.Option value="desarrollo_software">Desarrollo Software</Select.Option>
                                    <Select.Option value="mantencion_aplicaciones">Mantención App</Select.Option>
                                    <Select.Option value="analitica">Analítica y Datos</Select.Option>
                                    <Select.Option value="ia_chatbot">IA & Chatbots</Select.Option>
                                    <Select.Option value="ia_documentos">IA Documental</Select.Option>
                                    <Select.Option value="ia_video">IA Video</Select.Option>
                                    <Select.Option value="otro">Otro</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="TVT"
                                name="tvt"
                                rules={[{ validator: validateTVT }]}
                                tooltip="Solo números. Puede iniciar con 0."
                            >
                                <Input placeholder="Ej: 15.000 (sin puntos)" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Presupuesto Mín" name="budget_min">
                                <InputNumber
                                    style={{ width: '100%' }}
                                    placeholder="Mínimo"
                                    formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Presupuesto Máx" name="budget_max">
                                <InputNumber
                                    style={{ width: '100%' }}
                                    placeholder="Máximo"
                                    formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item label="Moneda" name="currency">
                                <Select placeholder="Moneda">
                                    <Select.Option value="USD">USD</Select.Option>
                                    <Select.Option value="CLP">CLP</Select.Option>
                                    <Select.Option value="UF">UF</Select.Option>
                                    <Select.Option value="BRL">BRL</Select.Option>
                                    <Select.Option value="MXN">MXN</Select.Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Deadline Propuesta" name="proposal_deadline">
                                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item label="Duración Proyecto" name="project_duration">
                                <Input placeholder="Ej: 12 meses" />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            )}

            {rfp.summary && (
                <>
                    <Divider style={{ borderColor: 'var(--border-color)', margin: '24px 0' }} />
                    <Title level={5} style={{ color: 'var(--text-primary)' }}>Resumen Ejecutivo</Title>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        <CitationViewer text={rfp.summary} files={rfp.files} onPreviewFile={onPreviewFile} />
                    </div>
                </>
            )}

            {rfp.decision && (
                <>
                    <Divider style={{ borderColor: 'var(--border-color)', margin: '24px 0' }} />
                    <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>DECISIÓN REGISTRADA</span>
                    </div>
                    <Tag color={rfp.decision === 'go' ? 'success' : 'error'} style={{ fontSize: 16, padding: '4px 12px', textAlign: 'center', marginBottom: 16 }}>
                        {rfp.decision.toUpperCase()}
                    </Tag>
                    {rfp.decision_reason && (
                        <Paragraph style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
                            <Text strong style={{ color: 'var(--text-primary)' }}>Razón:</Text> {rfp.decision_reason}
                        </Paragraph>
                    )}
                    {rfp.decided_at && (
                        <div style={{ marginTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Registrado el {dayjs(rfp.decided_at).format('DD/MM/YYYY HH:mm')}
                            </Text>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default RFPSummaryView;
