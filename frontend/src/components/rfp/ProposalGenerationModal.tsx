import React, { useMemo, useState, useEffect } from 'react';
import { Modal, Button, List, Typography, Tag, Skeleton, Checkbox, Input, Steps, ConfigProvider, theme, Select, Slider, Popover, Tooltip } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { rfpApi, certificationsApi, proposalApi, experiencesApi, chaptersApi, type Chapter } from '../../lib/api';

interface ChapterRecommendation {
    chapter_id: string;
    score: number;
    reason: string;
}

import {
    FilePdfOutlined,
    SearchOutlined,
    SafetyCertificateOutlined,
    LeftOutlined,
    RightOutlined,
    DollarOutlined,
    CalendarOutlined,
    GlobalOutlined,
    UserOutlined,
    StarFilled,
    FilterFilled,
    FilterOutlined
} from '@ant-design/icons';

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
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedCertIds, setSelectedCertIds] = useState<string[]>([]);
    const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);
    const [selectedChapIds, setSelectedChapIds] = useState<string[]>([]);
    const [chapSearchTerm, setChapSearchTerm] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Filters State
    const [certSearchTerm, setCertSearchTerm] = useState('');
    const [expSearchTerm, setExpSearchTerm] = useState('');
    // ADVANCED FILTERS STATE
    const [filters, setFilters] = useState({
        clients: [] as string[],
        years: [] as string[],
        countries: [] as string[],
        minAmount: 0,
        onlyRecommended: false
    });


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

    const { data: allExperiences, isLoading: isLoadingExps } = useQuery({
        queryKey: ['experiences'],
        queryFn: experiencesApi.list,
        enabled: open,
    });

    // AI RECOMMENDATIONS QUERY
    const { data: aiRecommendations, isLoading: isLoadingRecs } = useQuery({
        queryKey: ['experience-recommendations', rfpId],
        queryFn: () => experiencesApi.getRecommendations(rfpId!),
        enabled: !!rfpId && open,
        staleTime: 1000 * 60 * 60, // Cache for 1 hour to avoid re-fetching on every open
    });



    // --- SMART LOGIC: Certifications ---
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

        if (certSearchTerm) {
            const lower = certSearchTerm.toLowerCase();
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
    }, [rfp, allCerts]);

    // 4. SMART FILTERS & METADATA EXTRACTION (Memoized)
    const { filteredExperiences, filtersMetadata } = useMemo(() => {
        if (!allExperiences) return { filteredExperiences: [], filtersMetadata: { clients: [], years: [], countries: [], maxAmount: 0 } };

        // A. Extract Metadata from ALL experiences (for filter options)
        const clients = Array.from(new Set(allExperiences.map(e => e.propietario_servicio))).sort();
        const years = Array.from(new Set(allExperiences.map(e => new Date(e.fecha_inicio).getFullYear().toString()))).sort((a, b) => b.localeCompare(a));
        const countries = Array.from(new Set(allExperiences.map(e => e.ubicacion))).sort();
        const amounts = allExperiences.map(e => e.monto_final || 0);
        const maxAmount = Math.max(...amounts, 0);

        // B. Filter Logic
        let filtered = allExperiences;

        // 1. Text Search
        if (expSearchTerm) {
            const lowerTerm = expSearchTerm.toLowerCase();
            filtered = filtered.filter(e =>
                e.descripcion_servicio.toLowerCase().includes(lowerTerm) ||
                e.propietario_servicio.toLowerCase().includes(lowerTerm) ||
                e.ubicacion.toLowerCase().includes(lowerTerm)
            );
        }

        // 2. Advanced Filters
        if (filters.clients.length > 0) {
            filtered = filtered.filter(e => filters.clients.includes(e.propietario_servicio));
        }

        if (filters.years.length > 0) {
            filtered = filtered.filter(e => filters.years.includes(new Date(e.fecha_inicio).getFullYear().toString()));
        }

        if (filters.countries.length > 0) {
            filtered = filtered.filter(e => filters.countries.includes(e.ubicacion));
        }

        if (filters.minAmount > 0) {
            filtered = filtered.filter(e => (e.monto_final || 0) >= filters.minAmount);
        }

        // Mark recommended items for display (even if not filtering by them)
        const rfpKeywords = (rfp?.summary || '').toLowerCase().split(' ').filter(w => w.length > 4);

        // Create map of AI recommendations
        const aiRecMap = new Map();
        if (aiRecommendations) {
            aiRecommendations.forEach(rec => aiRecMap.set(rec.experience_id, rec));
        }

        // Check if we have valid AI recommendations
        const useAi = aiRecommendations && aiRecommendations.length > 0;

        const processed = filtered.map(e => {
            const expText = (e.descripcion_servicio + ' ' + e.propietario_servicio).toLowerCase();
            const isKeywordMatch = rfpKeywords.some(k => expText.includes(k));
            const aiRec = aiRecMap.get(e.id);

            // If AI is active, only recommendations from AI are valid.
            // If AI is not active (or returned nothing), fallback to keywords.
            const isRecommended = useAi ? !!aiRec : isKeywordMatch;

            return {
                ...e,
                isRecommended,
                aiScore: aiRec?.score || 0,
                aiReason: aiRec?.reason
            };
        });

        // If "AI Recommended" checkbox is ON, filter by it
        const finalDisplayed = filters.onlyRecommended ? processed.filter(e => e.isRecommended) : processed;

        // Default sort: Recommended first, then by date
        finalDisplayed.sort((a, b) => {
            // Prioritize AI Score if available
            if (b.aiScore !== a.aiScore) return b.aiScore - a.aiScore;

            if (a.isRecommended && !b.isRecommended) return -1;
            if (!a.isRecommended && b.isRecommended) return 1;
            return new Date(b.fecha_inicio).getTime() - new Date(a.fecha_inicio).getTime();
        });


        return {
            filteredExperiences: finalDisplayed,
            filtersMetadata: { clients, years, countries, maxAmount }
        };
    }, [allExperiences, expSearchTerm, filters, rfp, aiRecommendations]); // Added aiRecommendations dependency


    useEffect(() => {
        if (open) {
            setCurrentStep(0);
        }
    }, [open]);

    // PRE-SELECT RELEVANT CERTS
    useEffect(() => {
        if (open && allCerts && rfp?.recommended_isos && selectedCertIds.length === 0) {
            const defaults = rfp.recommended_isos
                .filter(c => c.level === 'high') // Only Strict High
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
            const blob = await proposalApi.generate(rfpId, selectedCertIds, selectedExpIds, selectedChapIds);
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

    // --- CHAPTERS LOGIC ---
    const { data: allChapters, isLoading: isLoadingChapters } = useQuery({
        queryKey: ['chapters'],
        queryFn: chaptersApi.list,
        enabled: open,
    });

    const { data: chapterRecommendations, isLoading: isLoadingChapRecs } = useQuery({
        queryKey: ['chapter-recommendations', rfpId],
        queryFn: () => chaptersApi.getRecommendations(rfpId!),
        enabled: !!rfpId && open,
        staleTime: 1000 * 60 * 60,
    });

    // Merge Chapters with Recommendations
    // Merge Chapters with Recommendations
    const displayChapters = useMemo(() => {
        if (!allChapters) return [];

        const chapRecMap = new Map<string, ChapterRecommendation>();
        if (chapterRecommendations) {
            chapterRecommendations.forEach((rec: ChapterRecommendation) => chapRecMap.set(rec.chapter_id, rec));
        }

        const processed = allChapters.map((chap: Chapter) => {
            const rec = chapRecMap.get(chap.id);
            return {
                ...chap,
                aiScore: rec?.score || 0,
                aiReason: rec?.reason
            } as Chapter & { aiScore: number, aiReason?: string };
        });

        // Initial selection logic (select high score ones by default if nothing selected yet)
        // Only run this once or if selection is empty? 
        // For now, let's just return the sorted list

        return processed.sort((a, b) => {
            // Priority to High AI Score
            return b.aiScore - a.aiScore;
        });

    }, [allChapters, chapterRecommendations]);

    // Effect to pre-select Recommended Chapters
    useEffect(() => {
        if (open && displayChapters.length > 0 && selectedChapIds.length === 0) {
            const recommendedIds = displayChapters
                .filter(c => c.aiScore >= 0.5) // Select all useful chapters by default
                .map(c => c.id);

            if (recommendedIds.length > 0) {
                // If we found recommended chapters, select them. 
                // But also maybe keep any previous selection? No, wait, if empty. Aight.
                setSelectedChapIds(recommendedIds);
            } else {
                // Fallback: Select all if none recommended? Or just let user choose.
                // Let's select all if list is small, or none.
                // Better to leave empty if no AI match, user decides.
            }
        }
    }, [open, displayChapters]);


    // CONTENT RENDERERS
    const renderStepContent = () => {
        const headerStyle = {
            marginBottom: '16px', // Reduced from 24
            paddingBottom: '0px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        };

        switch (currentStep) {
            case 0: // SUMMARY
                if (isLoadingRFP) return <Skeleton active paragraph={{ rows: 6 }} />;
                if (!rfp) return <Text>No se encontró información del RFP.</Text>;

                return (
                    <div className="fade-in">

                        <div style={{ textAlign: 'center', marginBottom: 10 }}>
                            <Title level={2} style={{ margin: '0 0 12px', fontSize: 32, fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>
                                {rfp.client_name}
                            </Title>
                            <Tag color="gold" style={{
                                marginBottom: 16, padding: '4px 12px', borderRadius: 20,
                                fontSize: 12, border: 'none', color: '#000', fontWeight: 700
                            }}>
                                <GlobalOutlined /> {rfp.country?.toUpperCase()}
                            </Tag>
                        </div>
                        <div style={{ background: '#1f1f1f', padding: '32px', borderRadius: '16px', border: '1px solid #303030' }}>
                            <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 16, display: 'flex', alignItems: 'center', color: '#e0e0e0' }}>
                                <SafetyCertificateOutlined style={{ marginRight: 10, color: '#E31837' }} />
                                Análisis Ejecutivo
                            </Typography.Title>
                            <Paragraph style={{ color: '#8c8c8c', fontSize: 15, lineHeight: 1.8, marginBottom: 0, textAlign: 'justify' }}>
                                {rfp.summary}
                            </Paragraph>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 20 }}>
                            <Text type="secondary" style={{ fontSize: 14, fontWeight: 300, color: '#a6a6a6' }}>
                                {rfp.title || rfp.file_name}
                            </Text>
                        </div>

                    </div>
                );

            case 1: // CERTIFICATIONS
                if (isLoadingCerts) return <div style={{ padding: 20 }}><Skeleton active avatar paragraph={{ rows: 4 }} /></div>;
                return (
                    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ paddingBottom: 24, padding: '0 16px 24px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Title level={4} style={{ margin: 0, marginBottom: 4, color: 'white' }}>Certificaciones</Title>
                            </div>
                            <Input
                                prefix={<SearchOutlined style={{ color: '#666' }} />}
                                placeholder="Buscar..."
                                style={{
                                    width: 240, borderRadius: 8, padding: '8px 12px',
                                    background: '#1f1f1f', border: '1px solid #333', color: 'white'
                                }}
                                onChange={e => setCertSearchTerm(e.target.value)}
                                value={certSearchTerm}
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

            case 2: // EXPERIENCES (FILTERS UPDATED)
                if (isLoadingExps) return <div style={{ padding: 20 }}><Skeleton active avatar paragraph={{ rows: 4 }} /></div>;
                return (
                    <div className="fade-in">
                        {/* Header with Search */}
                        <div style={{ ...headerStyle, flexDirection: 'column', alignItems: 'stretch', gap: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <Title level={4} style={{ margin: 0, color: 'white' }}>Experiencia Relevante</Title>
                                </div>
                                <Input
                                    prefix={<SearchOutlined style={{ color: '#666' }} />}
                                    placeholder="Buscar casos de éxito..."
                                    style={{
                                        width: 300, borderRadius: 8, padding: '8px 12px',
                                        background: '#1f1f1f', border: '1px solid #333', color: 'white'
                                    }}
                                    onChange={e => setExpSearchTerm(e.target.value)}
                                    value={expSearchTerm}
                                />
                            </div>

                            {/* SMART FILTERS TOOLBAR */}
                            <div style={{
                                display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
                            }}>
                                {/* Smart Match Checkbox */}
                                <div
                                    onClick={() => setFilters(prev => ({ ...prev, onlyRecommended: !prev.onlyRecommended }))}
                                    style={{
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                                        padding: '4px 12px', borderRadius: 6,
                                        background: filters.onlyRecommended ? 'rgba(212, 177, 6, 0.1)' : 'transparent',
                                        border: filters.onlyRecommended ? '1px solid #d4b106' : '1px solid #434343',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <StarFilled style={{ color: filters.onlyRecommended ? '#d4b106' : '#666' }} />
                                    <Text style={{ color: filters.onlyRecommended ? '#d4b106' : '#bfbfbf', fontWeight: filters.onlyRecommended ? 600 : 400, fontSize: 13 }}>
                                        Sugeridos IA
                                    </Text>
                                </div>

                                <div style={{ width: 1, height: 24, background: '#333' }} />

                                {/* Clients Select */}
                                <Select
                                    mode="multiple"
                                    allowClear
                                    style={{ minWidth: 200, flex: 1 }}
                                    placeholder="Clientes"
                                    maxTagCount="responsive"
                                    value={filters.clients}
                                    onChange={vals => setFilters(prev => ({ ...prev, clients: vals }))}
                                    options={filtersMetadata.clients.map(c => ({ label: c, value: c }))}
                                    suffixIcon={<UserOutlined style={{ color: '#666' }} />}
                                    variant="borderless"
                                    className="custom-dark-select"
                                />

                                {/* Years Select */}
                                <Select
                                    mode="multiple"
                                    allowClear
                                    style={{ width: 120 }}
                                    placeholder="Años"
                                    maxTagCount="responsive"
                                    value={filters.years}
                                    onChange={vals => setFilters(prev => ({ ...prev, years: vals }))}
                                    options={filtersMetadata.years.map(y => ({ label: y, value: y }))}
                                    suffixIcon={<CalendarOutlined style={{ color: '#666' }} />}
                                    variant="borderless"
                                    className="custom-dark-select"
                                />

                                {/* Countries Select */}
                                <Select
                                    mode="multiple"
                                    allowClear
                                    style={{ width: 140 }}
                                    placeholder="Ubicación"
                                    maxTagCount="responsive"
                                    value={filters.countries}
                                    onChange={vals => setFilters(prev => ({ ...prev, countries: vals }))}
                                    options={filtersMetadata.countries.map(c => ({ label: c, value: c }))}
                                    suffixIcon={<GlobalOutlined style={{ color: '#666' }} />}
                                    variant="borderless"
                                    className="custom-dark-select"
                                />

                                {/* Price Slider Popover */}
                                <Popover
                                    content={
                                        <div style={{ width: 250, padding: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <Text style={{ fontSize: 12 }}>Monto Mínimo</Text>
                                                <Text strong style={{ color: '#E31837' }}>${filters.minAmount.toLocaleString()}</Text>
                                            </div>
                                            <Slider
                                                min={0}
                                                max={filtersMetadata.maxAmount}
                                                step={1000}
                                                value={filters.minAmount}
                                                tooltip={{ formatter: value => `$${value?.toLocaleString()}` }}
                                                onChange={(val) => setFilters(prev => ({ ...prev, minAmount: val }))}
                                                trackStyle={{ background: '#E31837' }}
                                                handleStyle={{ borderColor: '#E31837', background: '#E31837' }}
                                            />
                                        </div>
                                    }
                                    trigger="click"
                                    placement="bottomRight"
                                >
                                    <Button
                                        icon={<DollarOutlined />}
                                        style={{
                                            background: filters.minAmount > 0 ? 'rgba(227, 24, 55, 0.1)' : 'transparent',
                                            borderColor: filters.minAmount > 0 ? '#E31837' : '#434343',
                                            color: filters.minAmount > 0 ? '#E31837' : '#bfbfbf'
                                        }}
                                    >
                                        {filters.minAmount > 0 ? `$${(filters.minAmount / 1000).toFixed(0)}k+` : 'Monto'}
                                    </Button>
                                </Popover>

                                {/* Reset Button */}
                                {(filters.clients.length > 0 || filters.years.length > 0 || filters.countries.length > 0 || filters.minAmount > 0 || filters.onlyRecommended) && (
                                    <Button
                                        type="text"
                                        icon={<FilterFilled />}
                                        danger
                                        onClick={() => setFilters({ clients: [], years: [], countries: [], minAmount: 0, onlyRecommended: false })}
                                        style={{ fontSize: 12 }}
                                    >
                                        Limpiar
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Results Grid */}
                        <div style={{ display: 'grid', gap: '16px', maxHeight: '500px', overflowY: 'auto', paddingBottom: 40, width: '100%', maxWidth: '100%' }}>
                            {filteredExperiences.map(item => {
                                const isSelected = selectedExpIds.includes(item.id);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => toggleSelection(item.id, selectedExpIds, setSelectedExpIds)}
                                        style={{
                                            padding: '24px',
                                            borderRadius: '16px',
                                            border: isSelected ? '1px solid #E31837' : (item.aiScore >= 0.8 ? '1px solid #d4b106' : (item.isRecommended ? '1px solid #4a3809' : '1px solid #333')), // Gold border for High AI match
                                            background: isSelected ? '#2a0a0f' : (item.aiScore >= 0.8 ? 'linear-gradient(145deg, #1f1f1f, #2b2508)' : '#1f1f1f'),
                                            boxShadow: isSelected ? '0 0 20px rgba(227, 24, 55, 0.1)' : 'none',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'start', gap: 20, // Align items top
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <Checkbox checked={isSelected} style={{ transform: 'scale(1.1)', marginTop: 4 }} />
                                        <div style={{ display: 'flex', gap: 20, flex: 1 }}>
                                            <div style={{ width: '100%' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Text strong style={{ display: 'block', fontSize: 16, marginBottom: 2, color: 'white' }}>{item.propietario_servicio}</Text>
                                                    {item.aiScore > 0 && (
                                                        <Tooltip title={item.aiReason || "Recomendado por IA según análisis del RFP"}>
                                                            <Tag color={item.aiScore >= 0.8 ? "#d4b106" : "blue"} style={{ color: item.aiScore >= 0.8 ? 'black' : 'white', border: 'none', height: 20, fontSize: 10, fontWeight: 700, cursor: 'help' }}>
                                                                {item.aiScore >= 0.8 ? "★ " : ""}IA MATCH {(item.aiScore * 100).toFixed(0)}%
                                                            </Tag>
                                                        </Tooltip>
                                                    )}
                                                    {item.isRecommended && !item.aiScore && (!aiRecommendations || aiRecommendations.length === 0) && <Tag color="#722ed1" style={{ border: 'none', height: 20, fontSize: 10 }}>KEYWORD MATCH</Tag>}
                                                </div>
                                                <Text style={{ display: 'block', fontSize: 14, color: '#bfbfbf', marginBottom: 4 }}>{item.descripcion_servicio}</Text>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Text style={{ fontSize: 13, color: '#666' }}>{item.ubicacion} • {new Date(item.fecha_inicio).getFullYear()}</Text>
                                                    {item.monto_final && (
                                                        <Text style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 600 }}>
                                                            USD {item.monto_final.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                                        </Text>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {(!filteredExperiences || filteredExperiences.length === 0) && (
                                <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                                    <FilterOutlined style={{ fontSize: 40, marginBottom: 16, color: '#333' }} />
                                    <p>No se encontraron experiencias con estos filtros</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 3: // CHAPTERS (NOW DYNAMIC)
                if (isLoadingChapters || isLoadingChapRecs) return <div style={{ padding: 20 }}><Skeleton active avatar paragraph={{ rows: 4 }} /></div>;

                return (
                    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {/* Header with Title and Search side-by-side */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Title level={4} style={{ margin: 0, color: 'white' }}>Capítulos</Title>
                            <Input
                                prefix={<SearchOutlined style={{ color: '#666' }} />}
                                placeholder="Buscar..."
                                style={{
                                    width: 240, borderRadius: 8, padding: '6px 12px',
                                    background: '#1f1f1f', border: '1px solid #333', color: 'white',
                                    fontSize: 13
                                }}
                                onChange={e => setChapSearchTerm(e.target.value)}
                                value={chapSearchTerm}
                            />
                        </div>

                        {(!displayChapters || displayChapters.length === 0) ? (
                            <div style={{ textAlign: 'center', padding: 40, border: '1px dashed #333', borderRadius: 8 }}>
                                <Text type="secondary">No hay capítulos disponibles.</Text>
                            </div>
                        ) : (
                            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                                <List
                                    dataSource={displayChapters}
                                    renderItem={(item) => {
                                        const isSelected = selectedChapIds.includes(item.id);
                                        const isRecommended = item.aiScore >= 0.5;
                                        const isHighMatch = item.aiScore >= 0.8;

                                        return (
                                            <List.Item
                                                onClick={() => toggleSelection(item.id, selectedChapIds, setSelectedChapIds)}
                                                style={{
                                                    padding: '20px 24px',
                                                    margin: '8px 0',
                                                    cursor: 'pointer',
                                                    borderRadius: '12px',
                                                    background: isSelected ? 'rgba(227, 24, 55, 0.08)' : '#1f1f1f',
                                                    border: isSelected ? '1px solid #E31837' : (isHighMatch ? '1px solid #d4b106' : '1px solid #303030'),
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                <List.Item.Meta
                                                    avatar={<Checkbox checked={isSelected} style={{ transform: 'scale(1.1)', marginTop: 4 }} />}
                                                    title={
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                            <Text strong style={{ fontSize: 15, color: isSelected ? '#ff4d4f' : '#e0e0e0' }}>{item.name || item.filename}</Text>
                                                            {isRecommended && (
                                                                <Tooltip title={item.aiReason}>
                                                                    {isHighMatch ? (
                                                                        <Tag color="#d4b106" style={{ color: '#000', fontWeight: 700, border: 'none', padding: '0 8px', fontSize: 10 }}>★ RECOMENDADO</Tag>
                                                                    ) : (
                                                                        <Tag color="blue" style={{ border: 'none', padding: '0 6px', fontSize: 10 }}>ÚTIL</Tag>
                                                                    )}
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                    }
                                                    description={
                                                        <Tooltip title={item.description} placement="topLeft" mouseEnterDelay={0.5}>
                                                            <div style={{
                                                                fontSize: 13,
                                                                marginTop: 4,
                                                                color: '#666',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                width: '100%'
                                                            }}>
                                                                {item.description}
                                                            </div>
                                                        </Tooltip>
                                                    }
                                                />
                                            </List.Item>
                                        );
                                    }}
                                />
                            </div>
                        )}
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
                style={{ maxWidth: '95vw', top: 20, paddingBottom: 20 }}
            >
                <div style={{ display: 'flex', height: '80vh', maxHeight: '700px', overflow: 'hidden', background: '#141414' }}>
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
                                { title: 'Capítulos', description: 'Estructura' },
                            ]}
                            className="premium-steps-dark-mode"
                            progressDot={(_, { status }) => (
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
                    <div style={{ flex: 1, minWidth: 0, background: '#141414', padding: '0', display: 'flex', flexDirection: 'column' }}>
                        {/* Scrollable Content Zone */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '48px 48px 24px 48px', scrollbarWidth: 'thin' }}>
                            {renderStepContent()}
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
                                    disabled={isGenerating}
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
                                    disabled={isLoadingChapters || isGenerating}
                                >
                                    Generar Propuesta
                                </Button>
                            ) : (
                                (() => {
                                    // Logic for Next Button State
                                    let isNextLoading = false;
                                    let loadingText = "Cargando...";

                                    if (currentStep === 0) {
                                        // On Summary, waiting for Certs to be ready for next step
                                        isNextLoading = isLoadingCerts;
                                        loadingText = "Cargando Certificaciones...";
                                    } else if (currentStep === 1) {
                                        // On Certs, waiting for Experiences/Recs for next step
                                        isNextLoading = isLoadingExps || isLoadingRecs;
                                        loadingText = "Cargando Experiencias...";
                                    }

                                    return (
                                        <Button
                                            type="primary"
                                            onClick={handleNext}
                                            size="large"
                                            loading={isNextLoading}
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
                                            {isNextLoading ? loadingText : (
                                                <>Siguiente <RightOutlined style={{ fontSize: 12, marginLeft: 8 }} /></>
                                            )}
                                        </Button>
                                    );
                                })()
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
        </ConfigProvider >
    );
};

export default ProposalGenerationModal;
