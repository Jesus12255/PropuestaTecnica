import React, { useMemo, useState, useEffect } from 'react';
import { Modal, Button, List, Typography, Tag, Skeleton, Divider, Checkbox, Input, Steps, ConfigProvider, theme, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { rfpApi, certificationsApi, proposalApi } from '../../lib/api';
import {
    FilePdfOutlined,
    SearchOutlined,
    SafetyCertificateOutlined,
    LeftOutlined,
    RightOutlined,
    ProjectOutlined,
    FileTextOutlined,
    CheckCircleFilled,
    ClockCircleFilled,
    GlobalOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface ProposalGenerationModalProps {
    rfpId: string | null;
    open: boolean;
    onCancel: () => void;
}

// MOCK DATA
const MOCK_EXPERIENCES = [
    { id: 'exp1', name: 'Sistema de Gestión Crediticia', client: 'Banco Estado', year: '2023', description: 'Implementación de motor de reglas de crédito y workflow BPMN.' },
    { id: 'exp2', name: 'Plataforma de Atención Ciudadana', client: 'IPS', year: '2022', description: 'Digitalización de trámites y ventanilla única.' },
    { id: 'exp3', name: 'Migración Cloud 50+ Apps', client: 'Codelco', year: '2023', description: 'Migración de aplicaciones legacy a AWS.' },
    { id: 'exp4', name: 'App Gestión de Riego', client: 'Indap', year: '2021', description: 'Aplicación móvil offline-first para gestión en terreno.' },
    { id: 'exp5', name: 'Portal de Proveedores', client: 'Falabella', year: '2024', description: 'Microservicios Spring Boot y Frontend React.' }
];

const MOCK_CHAPTERS = [
    { id: 'chap1', name: '01. Resumen Ejecutivo', required: true },
    { id: 'chap2', name: '02. Entendimiento del Problema', required: true },
    { id: 'chap3', name: '03. Solución Propuesta', required: true },
    { id: 'chap4', name: '04. Metodología (Agile/Scrum)', required: false },
    { id: 'chap5', name: '05. Equipo de Trabajo', required: false },
    { id: 'chap6', name: '06. Cronograma de Implementación', required: false },
    { id: 'chap7', name: '07. Plan de Calidad (QA)', required: false },
    { id: 'chap8', name: '08. Oferta Económica', required: true },
];

const ProposalGenerationModal: React.FC<ProposalGenerationModalProps> = ({
    rfpId,
    open,
    onCancel,
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedCertIds, setSelectedCertIds] = useState<string[]>([]);
    const [selectedExpIds, setSelectedExpIds] = useState<string[]>(['exp1', 'exp3']);
    const [selectedChapIds, setSelectedChapIds] = useState<string[]>(MOCK_CHAPTERS.map(c => c.id));
    const [isGenerating, setIsGenerating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const { data: rfp, isLoading: isLoadingRFP } = useQuery({
        queryKey: ['rfp', rfpId],
        queryFn: () => rfpApi.get(rfpId!),
        enabled: !!rfpId && open,
    });

    const { data: allCerts, isLoading: isLoadingCerts } = useQuery({
        queryKey: ['certifications'],
        queryFn: certificationsApi.list,
        enabled: open,
    });

    const isLoading = isLoadingRFP || isLoadingCerts;

    const displayCertifications = useMemo(() => {
        if (!allCerts) return [];
        const recommendationsMap = new Map<string, 'high' | 'medium' | 'low'>();
        if (rfp?.recommended_isos) {
            rfp.recommended_isos.forEach(rec => recommendationsMap.set(rec.id, rec.level));
        }
        let processed = allCerts.map(cert => ({
            ...cert,
            level: recommendationsMap.get(cert.id)
        }));
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            processed = processed.filter(c =>
                c.name.toLowerCase().includes(lower) ||
                (c.description && c.description.toLowerCase().includes(lower))
            );
        }
        const priorityMap: Record<string, number> = { high: 4, medium: 3, low: 2, undefined: 1 };
        return processed.sort((a, b) => {
            const levelA = a.level || 'undefined';
            const levelB = b.level || 'undefined';
            return priorityMap[levelB] - priorityMap[levelA];
        });
    }, [rfp, allCerts, searchTerm]);

    useEffect(() => {
        if (open) {
            setCurrentStep(0);
        }
    }, [open]);

    useEffect(() => {
        if (open && allCerts && rfp?.recommended_isos && selectedCertIds.length === 0) {
            const defaults = rfp.recommended_isos
                .filter(c => c.level === 'high' || c.level === 'medium')
                .map(c => c.id);
            if (defaults.length > 0) {
                setSelectedCertIds(defaults);
            }
        }
    }, [open, rfp, allCerts]);

    const handleNext = () => setCurrentStep(prev => prev + 1);
    const handlePrev = () => setCurrentStep(prev => prev - 1);

    const getLevelBadge = (level: string) => {
        switch (level) {
            case 'high': return <Tag color="#d4b106" style={{ color: '#000', fontWeight: 700, border: 'none', padding: '0 8px' }}>★ RECOMENDADA</Tag>;
            case 'medium': return <Tag color="gray" style={{ border: 'none' }}>Relevante</Tag>;
            default: return null;
        }
    };

    const handleGenerate = async () => {
        if (!rfpId) return;
        setIsGenerating(true);
        try {
            const blob = await proposalApi.generate(rfpId, selectedCertIds);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const filename = `Propuesta_${rfp?.client_name || 'TIVIT'}.docx`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            Modal.success({ title: '¡Documento Listo!', content: 'Tu propuesta se ha generado exitosamente.' });
        } catch (error) {
            console.error(error);
            Modal.error({ title: 'Error', content: 'No se pudo generar el documento.' });
        } finally {
            setIsGenerating(false);
        }
    };

    const toggleSelection = (id: string, list: string[], setList: (ids: string[]) => void) => {
        setList(list.includes(id) ? list.filter(i => i !== id) : [...list, id]);
    };

    // CONTENT RENDERERS
    const renderStepContent = () => {
        if (!rfp) return null;

        // No more "Card" style. Integrated content.
        const headerStyle = {
            marginBottom: '24px',
            borderBottom: '1px solid #333',
            paddingBottom: '16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        };

        switch (currentStep) {
            case 0: // SUMMARY
                return (
                    <div className="fade-in">
                        {/* Hero Section */}
                        <div style={{ textAlign: 'center', marginBottom: 40 }}>

                            <Tag color="gold" style={{
                                marginBottom: 16, padding: '4px 12px', borderRadius: 20,
                                fontSize: 12, border: 'none', color: '#000', fontWeight: 700
                            }}>
                                <GlobalOutlined /> {rfp.country?.toUpperCase()}
                            </Tag>
                            <Title level={2} style={{ margin: '0 0 12px', fontSize: 32, fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>
                                {rfp.client_name}
                            </Title>
                            <Text type="secondary" style={{ fontSize: 18, fontWeight: 300, color: '#a6a6a6' }}>
                                {rfp.title || rfp.file_name}
                            </Text>
                        </div>

                        {/* Summary Block - Direct Integration */}
                        <div style={{ background: '#1f1f1f', padding: '32px', borderRadius: '16px', border: '1px solid #303030' }}>
                            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', color: '#e0e0e0' }}>
                                <SafetyCertificateOutlined style={{ marginRight: 10, color: '#E31837' }} />
                                Análisis Ejecutivo
                            </Typography.Title>
                            <Paragraph style={{ color: '#8c8c8c', fontSize: 15, lineHeight: 1.8, marginBottom: 0, textAlign: 'justify' }}>
                                {rfp.summary}
                            </Paragraph>
                        </div>
                    </div>
                );

            case 1: // CERTIFICATIONS
                return (
                    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ paddingBottom: 24, padding: '0 16px 24px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Title level={4} style={{ margin: 0, marginBottom: 4, color: 'white' }}>Certificaciones</Title>
                                <Text style={{ color: '#8c8c8c' }}>Selecciona las credenciales para este cliente</Text>
                            </div>
                            <Input
                                prefix={<SearchOutlined style={{ color: '#666' }} />}
                                placeholder="Buscar..."
                                style={{
                                    width: 240, borderRadius: 8, padding: '8px 12px',
                                    background: '#1f1f1f', border: '1px solid #333', color: 'white'
                                }}
                                onChange={e => setSearchTerm(e.target.value)}
                                value={searchTerm}
                            />
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                            <List
                                dataSource={displayCertifications}
                                renderItem={(item) => {
                                    const isSelected = selectedCertIds.includes(item.id);
                                    return (
                                        <List.Item
                                            style={{
                                                padding: '20px 24px',
                                                margin: '8px 0',
                                                cursor: 'pointer',
                                                borderRadius: '12px',
                                                background: isSelected ? 'rgba(227, 24, 55, 0.08)' : '#1f1f1f',
                                                border: isSelected ? '1px solid #E31837' : '1px solid #303030',
                                                transition: 'all 0.2s',
                                            }}
                                            onClick={() => toggleSelection(item.id, selectedCertIds, setSelectedCertIds)}
                                        >
                                            <List.Item.Meta
                                                avatar={<Checkbox checked={isSelected} style={{ transform: 'scale(1.1)', marginTop: 4 }} />}
                                                title={
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <Text strong style={{ fontSize: 15, color: isSelected ? '#ff4d4f' : '#e0e0e0' }}>{item.name}</Text>
                                                        {item.level && getLevelBadge(item.level)}
                                                    </div>
                                                }
                                                description={<Text style={{ fontSize: 13, marginTop: 4, display: 'block', color: '#666' }}>{item.description}</Text>}
                                            />
                                        </List.Item>
                                    );
                                }}
                            />
                        </div>
                    </div>
                );

            case 2: // EXPERIENCES
                return (
                    <div className="fade-in">
                        <div style={headerStyle}>
                            <Title level={4} style={{ margin: 0, color: 'white' }}>Experiencia Relevante</Title>
                            <Tag color="#1f1f1f" style={{ border: '1px solid #333', color: '#8c8c8c' }}>Base de Conocimiento</Tag>
                        </div>
                        <div style={{ display: 'grid', gap: '16px' }}>
                            {MOCK_EXPERIENCES.map(item => {
                                const isSelected = selectedExpIds.includes(item.id);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => toggleSelection(item.id, selectedExpIds, setSelectedExpIds)}
                                        style={{
                                            padding: '24px',
                                            borderRadius: '16px',
                                            border: isSelected ? '1px solid #E31837' : '1px solid #333',
                                            background: isSelected ? '#2a0a0f' : '#1f1f1f',
                                            boxShadow: isSelected ? '0 0 20px rgba(227, 24, 55, 0.1)' : 'none',
                                            cursor: 'pointer',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'start',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: 20 }}>
                                            <div style={{
                                                width: 48, height: 48,
                                                background: isSelected ? '#E31837' : '#262626',
                                                borderRadius: '14px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: isSelected ? 'white' : '#8c8c8c',
                                                fontSize: 20
                                            }}>
                                                <ProjectOutlined />
                                            </div>
                                            <div>
                                                <Text strong style={{ display: 'block', fontSize: 16, marginBottom: 4, color: 'white' }}>{item.name}</Text>
                                                <Space size={8} split={<Divider type="vertical" style={{ borderColor: '#434343' }} />}>
                                                    <Text style={{ fontSize: 13, color: '#E31837' }}>{item.client}</Text>
                                                    <Text style={{ fontSize: 13, color: '#666' }}>{item.year}</Text>
                                                </Space>
                                                <Paragraph ellipsis={{ rows: 2 }} style={{ margin: '8px 0 0', color: '#8c8c8c', fontSize: 13 }}>
                                                    {item.description}
                                                </Paragraph>
                                            </div>
                                        </div>
                                        <Checkbox checked={isSelected} style={{ transform: 'scale(1.1)' }} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );

            case 3: // CHAPTERS
                return (
                    <div className="fade-in">
                        <div style={headerStyle}>
                            <Title level={4} style={{ margin: 0, color: 'white' }}>Estructura del Documento</Title>
                        </div>
                        <List
                            dataSource={MOCK_CHAPTERS}
                            renderItem={item => {
                                const isSelected = selectedChapIds.includes(item.id);
                                return (
                                    <List.Item style={{ padding: '16px 0', borderBottom: '1px solid #333' }}>
                                        <div
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                            onClick={() => toggleSelection(item.id, selectedChapIds, setSelectedChapIds)}
                                        >
                                            <div style={{ marginRight: 20, color: isSelected ? '#E31837' : '#434343', transition: 'color 0.3s' }}>
                                                {isSelected ? <CheckCircleFilled style={{ fontSize: 22 }} /> : <ClockCircleFilled style={{ fontSize: 22 }} />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <Text style={{
                                                    color: isSelected ? 'white' : '#666',
                                                    fontWeight: isSelected ? 600 : 400,
                                                    fontSize: 16,
                                                    transition: 'all 0.3s'
                                                }}>
                                                    {item.name}
                                                </Text>
                                            </div>
                                            {item.required && <Tag style={{ borderRadius: 10, border: 'none', background: '#262626', color: '#666' }}>Requerido</Tag>}
                                        </div>
                                    </List.Item>
                                );
                            }}
                        />
                    </div>
                );
            default: return null;
        }
    };

    return (
        <ConfigProvider
            theme={{
                algorithm: theme.darkAlgorithm,
                token: {
                    colorPrimary: '#E31837', // TIVIT RED
                    borderRadius: 8,
                    colorBgBase: '#000',
                }
            }}
        >
            <Modal
                open={open}
                onCancel={onCancel}
                width={1000}
                centered
                footer={null}
                styles={{ body: { padding: 0 } }}
                closeIcon={null}
                className="premium-wizard-dark-red"
            >
                <div style={{ display: 'flex', height: '700px', overflow: 'hidden', borderRadius: '16px', boxShadow: '0 24px 48px rgba(0,0,0,0.5)', background: '#141414' }}>
                    {/* SIDEBAR: Gradient Deep Dark RED */}
                    <div style={{
                        width: '280px',
                        background: 'linear-gradient(180deg, #161616 0%, #000000 100%)', // Harder Dark
                        padding: '40px 32px',
                        display: 'flex',
                        flexDirection: 'column',
                        color: 'white',
                        position: 'relative',
                        overflow: 'hidden',
                        borderRight: '1px solid #262626'
                    }}>
                        {/* Decorative Circle */}
                        <div style={{
                            position: 'absolute', top: -100, left: -50, width: 300, height: 300,
                            background: 'radial-gradient(circle, rgba(227, 24, 55, 0.08) 0%, rgba(0,0,0,0) 70%)', // Fainter Red Glow
                            pointerEvents: 'none'
                        }} />

                        <div style={{ marginBottom: 60, display: 'flex', alignItems: 'center', gap: 14, position: 'relative', zIndex: 1 }}>

                            <div>
                                <Text strong style={{ color: 'white', fontSize: 18, lineHeight: 1, letterSpacing: '1px' }}>TIVIT</Text>
                                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, display: 'block', letterSpacing: 2 }}>PROPOSALS AI</Text>
                            </div>
                        </div>

                        <Steps
                            direction="vertical"
                            current={currentStep}
                            items={[
                                { title: 'Resumen', description: 'Contexto' },
                                { title: 'Certificaciones', description: 'Credenciales' },
                                { title: 'Experiencia', description: 'Evidencia' },
                                { title: 'Contenidos', description: 'Índice' },
                            ]}
                            className="premium-steps-dark-mode"
                            progressDot={(dot, { index, status }) => (
                                <div style={{
                                    width: 10, height: 10, borderRadius: '50%',
                                    background: status === 'process' ? '#E31837' : (status === 'finish' ? '#434343' : '#262626'),
                                    boxShadow: status === 'process' ? '0 0 10px #E31837' : 'none',
                                    border: status === 'wait' ? '1px solid #333' : 'none',
                                    transition: 'all 0.3s'
                                }} />
                            )}
                        />

                        <div style={{ marginTop: 'auto', position: 'relative', zIndex: 1 }}>
                            <Button type="text" onClick={onCancel} style={{ color: 'rgba(255,255,255,0.4)', paddingLeft: 0, textTransform: 'uppercase', fontSize: 11, letterSpacing: 1 }}>
                                <LeftOutlined /> Salir
                            </Button>
                        </div>
                    </div>

                    {/* CONTENT AREA: Deep Matte Black - Integrated Layout */}
                    <div style={{ flex: 1, background: '#141414', padding: '0', display: 'flex', flexDirection: 'column' }}>
                        {/* Scrollable Content Zone */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '48px 48px 24px 48px', scrollbarWidth: 'thin' }}>
                            {isLoading ? <Skeleton active paragraph={{ rows: 10 }} /> : renderStepContent()}
                        </div>

                        {/* Fixed Actions Footer */}
                        <div style={{
                            padding: '24px 48px',
                            borderTop: '1px solid #262626',
                            background: '#141414',
                            display: 'flex', justifyContent: 'flex-end', gap: 16, alignItems: 'center'
                        }}>
                            {currentStep > 0 && (
                                <Button
                                    onClick={handlePrev}
                                    size="large"
                                    type="text"
                                    style={{ color: '#666' }}
                                >
                                    Volver
                                </Button>
                            )}

                            {currentStep === 3 ? (
                                <Button
                                    type="primary"
                                    onClick={handleGenerate}
                                    loading={isGenerating}
                                    size="large"
                                    icon={<FilePdfOutlined />}
                                    style={{
                                        background: 'linear-gradient(90deg, #E31837 0%, #9c0c22 100%)',
                                        borderColor: 'transparent',
                                        borderRadius: '30px',
                                        padding: '0 40px',
                                        height: '50px',
                                        fontWeight: 600,
                                        boxShadow: '0 10px 30px rgba(227, 24, 55, 0.4)'
                                    }}
                                >
                                    Generar Propuesta
                                </Button>
                            ) : (
                                <Button
                                    type="primary"
                                    onClick={handleNext}
                                    size="large"
                                    style={{
                                        borderRadius: '30px',
                                        padding: '0 40px',
                                        height: '50px',
                                        background: '#262626',
                                        border: '1px solid #333',
                                        color: '#fff',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    Siguiente <RightOutlined style={{ fontSize: 12, marginLeft: 8 }} />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
        </ConfigProvider>
    );
};

export default ProposalGenerationModal;
