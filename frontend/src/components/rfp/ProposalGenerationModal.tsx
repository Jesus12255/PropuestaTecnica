import React, { useMemo, useState, useEffect } from 'react';
import { Modal, Button, List, Typography, Tag, Skeleton, Divider, Result, Checkbox, Space, Input } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { rfpApi, certificationsApi, proposalApi } from '../../lib/api';
import { FilePdfOutlined, SearchOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { Certification } from '../../types';

const { Title, Text, Paragraph } = Typography;

interface ProposalGenerationModalProps {
    rfpId: string | null;
    open: boolean;
    onCancel: () => void;
}

const ProposalGenerationModal: React.FC<ProposalGenerationModalProps> = ({
    rfpId,
    open,
    onCancel,
}) => {
    const [selectedCertIds, setSelectedCertIds] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // 1. Obtener detalle del RFP (incluyendo recommended_isos)
    const { data: rfp, isLoading: isLoadingRFP } = useQuery({
        queryKey: ['rfp', rfpId],
        queryFn: () => rfpApi.get(rfpId!),
        enabled: !!rfpId && open,
    });

    // 2. Obtener lista completa de certificaciones para saber los nombres
    const { data: allCerts, isLoading: isLoadingCerts } = useQuery({
        queryKey: ['certifications'],
        queryFn: certificationsApi.list,
        enabled: open,
    });

    const isLoading = isLoadingRFP || isLoadingCerts;

    // 3. Procesar y ordenar recomendaciones
    const displayCertifications = useMemo(() => {
        if (!allCerts) return [];

        const recommendationsMap = new Map<string, 'high' | 'medium' | 'low'>();
        if (rfp?.recommended_isos) {
            rfp.recommended_isos.forEach(rec => recommendationsMap.set(rec.id, rec.level));
        }

        let processed = allCerts.map(cert => ({
            ...cert,
            level: recommendationsMap.get(cert.id) // undefined if not recommended
        }));

        // Filter by search term
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            processed = processed.filter(c =>
                c.name.toLowerCase().includes(lower) ||
                (c.description && c.description.toLowerCase().includes(lower))
            );
        }

        // Sort by priority: high > medium > low > undefined
        const priorityMap: Record<string, number> = { high: 4, medium: 3, low: 2, undefined: 1 };

        return processed.sort(
            (a, b) => {
                const levelA = a.level || 'undefined';
                const levelB = b.level || 'undefined';
                return priorityMap[levelB] - priorityMap[levelA];
            }
        );
    }, [rfp, allCerts, searchTerm]);

    // 4. Pre-seleccionar High y Medium al cargar (solo la primera vez que se abre)
    useEffect(() => {
        if (open && allCerts && rfp?.recommended_isos && selectedCertIds.length === 0) {
            const defaults = rfp.recommended_isos
                .filter(c => c.level === 'high' || c.level === 'medium')
                .map(c => c.id);
            setSelectedCertIds(defaults);
        } else if (!open) {
            setSelectedCertIds([]);
            setSearchTerm('');
        }
    }, [open, rfp, allCerts]);


    const getLevelBadge = (level: string) => {
        switch (level) {
            case 'high':
                return <Tag color="#faad14" style={{ color: 'black', fontWeight: 500 }}>Alta Relevancia</Tag>; // Dorado/Ambar
            case 'medium':
                return <Tag color="#1890ff">Media</Tag>; // Azul Tech
            case 'low':
                return <Tag color="default">Baja</Tag>;
            default:
                return null;
        }
    };

    const handleGenerate = async () => {
        if (!rfpId) return;
        setIsGenerating(true);
        try {
            const blob = await proposalApi.generate(rfpId, selectedCertIds);

            // Crear URL para descarga
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            // Tratar de obtener nombre del RFP para el archivo
            const filename = `Propuesta_${rfp?.client_name || 'TIVIT'}.docx`;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();

            Modal.success({
                title: 'Propuesta Generada',
                content: 'El documento se ha descargado exitosamente.',
                onOk: onCancel,
            });
        } catch (error) {
            console.error(error);
            Modal.error({
                title: 'Error',
                content: 'Hubo un problema al generar la propuesta. Intente nuevamente.',
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const toggleSelection = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedCertIds(prev => [...prev, id]);
        } else {
            setSelectedCertIds(prev => prev.filter(cid => cid !== id));
        }
    };

    return (
        <Modal
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#fff1f0', padding: '8px', borderRadius: '50%' }}>
                        <FilePdfOutlined style={{ fontSize: '20px', color: '#ff4d4f' }} />
                    </div>
                    <div>
                        <Title level={5} style={{ margin: 0 }}>Generar Propuesta Técnica</Title>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Seleccione activos para incluir en el documento</Text>
                    </div>
                </div>
            }
            open={open}
            onCancel={onCancel}
            width={800}
            centered
            bodyStyle={{ padding: '24px' }}
            footer={[
                <Button key="cancel" onClick={onCancel} size="large" style={{ borderRadius: '6px' }}>
                    Cancelar
                </Button>,
                <Button
                    key="generate"
                    type="primary"
                    icon={<FilePdfOutlined />}
                    onClick={handleGenerate}
                    loading={isLoading || isGenerating}
                    disabled={isLoading || !rfp}
                    size="large"
                    style={{ background: '#ff4d4f', borderColor: '#ff4d4f', borderRadius: '6px' }}
                >
                    Generar Documento ({selectedCertIds.length})
                </Button>,
            ]}
        >
            {isLoading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
            ) : rfp ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Header Card */}
                    <div style={{
                        padding: '20px',
                        background: '#1f1f1f',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        color: 'white'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <Text style={{ color: '#8c8c8c', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Cliente</Text>
                            <Tag color="gold" style={{ border: 'none', color: '#000', fontWeight: 500 }}>{rfp.country?.toUpperCase()}</Tag>
                        </div>
                        <Title level={3} style={{ marginTop: 0, color: 'white', marginBottom: '4px' }}>
                            {rfp.client_name}
                        </Title>
                        <Text style={{ color: '#d9d9d9', fontSize: '14px' }}>{rfp.title || rfp.file_name}</Text>

                        <Divider style={{ borderColor: '#434343', margin: '16px 0' }} />

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'start' }}>
                            <SafetyCertificateOutlined style={{ color: '#faad14', fontSize: '16px', marginTop: '4px' }} />
                            <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, color: '#f0f0f0', fontSize: '13px', lineHeight: '1.6' }}>
                                {rfp.summary}
                            </Paragraph>
                        </div>
                    </div>

                    {/* Certifications Section - Dark Theme Applied Here */}
                    <div style={{
                        border: '1px solid #303030',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        background: '#141414',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}>
                        <div style={{
                            padding: '16px',
                            borderBottom: '1px solid #303030',
                            background: '#1f1f1f',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}>
                            <div>
                                <Text strong style={{ fontSize: '15px', color: '#fff' }}>Catálogo de Certificaciones</Text>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                    <Text type="secondary" style={{ fontSize: '12px', color: '#8c8c8c' }}>
                                        {displayCertifications.length} disponibles
                                    </Text>
                                    {selectedCertIds.length > 0 && (
                                        <Tag color="#135200" style={{ margin: 0, fontSize: '10px', border: '1px solid #237804', color: '#95de64' }}>
                                            {selectedCertIds.length} seleccionados
                                        </Tag>
                                    )}
                                </div>
                            </div>
                            <Input
                                placeholder="Buscar certificación..."
                                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                                style={{ width: 250, borderRadius: '6px', background: '#333', borderColor: '#434343', color: 'white' }}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                allowClear
                                className="dark-search-input" // Note: Might need global CSS or inline styles override for AntD input classes if not taking effect.
                            />
                        </div>

                        <div style={{
                            maxHeight: '350px',
                            overflowY: 'auto',
                            padding: '0'
                        }}>
                            {displayCertifications.length > 0 ? (
                                <List
                                    itemLayout="horizontal"
                                    dataSource={displayCertifications}
                                    renderItem={(item) => {
                                        const isSelected = selectedCertIds.includes(item.id);
                                        return (
                                            <List.Item
                                                style={{
                                                    padding: '12px 16px',
                                                    cursor: 'pointer',
                                                    // Dark mode background logic
                                                    background: isSelected ? '#1a2e14' : 'transparent',
                                                    borderLeft: isSelected ? '4px solid #52c41a' : '4px solid transparent',
                                                    transition: 'all 0.2s',
                                                    borderBottom: '1px solid #303030'
                                                }}
                                                // Using inline hover simulation/class is tricky in pure inline. relying on default or adding className if users have global CSS.
                                                // For now, standard List item hover from AntD might be slight gray, which is fine on dark.
                                                onClick={() => toggleSelection(item.id, !isSelected)}
                                            >
                                                <List.Item.Meta
                                                    avatar={
                                                        <Checkbox
                                                            checked={isSelected}
                                                            style={{ marginTop: '8px' }}
                                                        />
                                                    }
                                                    title={
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            {/* Explicitly setting text color to white/light-green for dark bg */}
                                                            <Text strong style={{ color: isSelected ? '#73d13d' : '#f0f0f0', fontSize: '14px' }}>
                                                                {item.name}
                                                            </Text>
                                                            {item.level ? getLevelBadge(item.level) : null}
                                                        </div>
                                                    }
                                                    description={
                                                        <div style={{ marginTop: '4px' }}>
                                                            {item.description && (
                                                                <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, fontSize: '12px', color: '#8c8c8c' }}>
                                                                    {item.description}
                                                                </Paragraph>
                                                            )}
                                                            {item.location && (
                                                                <Text type="secondary" style={{ fontSize: '10px', marginTop: '4px', display: 'block', color: '#595959' }}>
                                                                    ID Doc: {item.filename || 'N/A'}
                                                                </Text>
                                                            )}
                                                        </div>
                                                    }
                                                />
                                            </List.Item>
                                        );
                                    }}
                                />
                            ) : (
                                <Result
                                    status="info"
                                    icon={<SearchOutlined style={{ color: '#434343' }} />}
                                    title={<span style={{ color: '#d9d9d9' }}>No se encontraron certificaciones</span>}
                                    subTitle={<span style={{ color: '#8c8c8c' }}>Intente con otros términos de búsqueda.</span>}
                                    style={{ padding: '24px' }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <Result status="error" title="Error al cargar datos del RFP" />
            )}
        </Modal>
    );
};

export default ProposalGenerationModal;
