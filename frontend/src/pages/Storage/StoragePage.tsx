import React, { useEffect, useState } from 'react';
import {
    Layout,
    Breadcrumb,
    Card,
    List,
    Typography,
    Button,
    Spin,
    Empty,
    message,
    Space,
    DatePicker,
    Input,
    InputNumber,
    Row,
    Col
} from 'antd';
import {
    FolderOpenOutlined,
    FileOutlined,
    FilePdfOutlined,
    FileWordOutlined,
    EyeOutlined,
    DownloadOutlined,
    HomeOutlined,
    ArrowLeftOutlined,
} from '@ant-design/icons';
import { storageService } from '../../services/storageService';
import type { Carpeta, Archivo } from '../../services/storageService';
import AppLayout from '../../components/layout/AppLayout';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';


const { Content } = Layout;
const { Title, Text } = Typography;

const StoragePage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [currentFolder, setCurrentFolder] = useState<Carpeta | null>(null);
    const [subfolders, setSubfolders] = useState<Carpeta[]>([]);
    const [files, setFiles] = useState<Archivo[]>([]);
    /* Unused states removed */

    const [searchParams, setSearchParams] = useSearchParams();
    const folderId = searchParams.get('folderId');

    // Filters state
    const [appliedSearch, setAppliedSearch] = useState('');
    const [dateRange, setDateRange] = useState<any>(null);
    const [minProposals, setMinProposals] = useState<number | null>(null);

    useEffect(() => {
        // Reset filters when changing folder
        setAppliedSearch('');
        setDateRange(null);
        setMinProposals(null);
    }, [folderId]);

    useEffect(() => {
        loadContent(folderId);
    }, [folderId, appliedSearch, dateRange, minProposals]);

    const loadContent = async (id: string | null) => {
        setLoading(true);
        try {
            if (id) {
                // Prepare filters
                const filters: any = {};
                if (appliedSearch) filters.search = appliedSearch;
                if (dateRange) {
                    filters.start_date = dateRange[0].toISOString();
                    filters.end_date = dateRange[1].toISOString();
                }
                if (minProposals !== null) filters.min_proposals = minProposals;

                // Cargar contenido de una carpeta específica
                const data = await storageService.getFolderContent(id, filters);
                setCurrentFolder(data.carpeta);
                setSubfolders(data.subcarpetas);
                setFiles(data.archivos);
                // Construir path
                /* Path state removed temporarily
                if (data.path) {
                    setPath(data.path);
                } 
                */
            } else {
                // Cargar raíz
                const roots = await storageService.getFolders();

                // Si solo hay una carpeta raíz (lo normal), entrar directamente
                if (roots.length === 1) {
                    handleFolderClick(roots[0]);
                    return;
                }

                setCurrentFolder(null); // Estamos en raíz virtual
                setSubfolders(roots);
                setFiles([]);
                // setPath([]);
            }
        } catch (error) {
            console.error(error);
            message.error('Error al cargar contenido');
        } finally {
            setLoading(false);
        }
    };

    const handleFolderClick = (folder: Carpeta) => {
        setSearchParams({ folderId: folder.carpeta_id });
    };

    const handleBreadcrumbClick = (folderId: string | null) => {
        if (folderId) {
            setSearchParams({ folderId });
        } else {
            setSearchParams({});
        }
    };

    const handleView = async (file: Archivo) => {
        // Use a unique key for the message to control it manually
        const key = 'viewFile';
        try {
            // duration: 0 means it won't disappear automatically
            message.loading({ content: 'Generando vista previa (esto puede tardar unos segundos)...', key, duration: 0 });

            // Usar la lógica de "Nueva Pestaña" del servicio
            // This awaits the backend conversion (DOCX -> PDF) which is the slow part
            await storageService.viewFile(file.archivo_id, file.nombre);

            // Once the blob is ready and window.open is called, show success
            message.success({ content: 'Archivo abierto', key, duration: 2 });
        } catch (e) {
            console.error(e);
            message.error({ content: 'Error al abrir archivo (Pop-up bloqueado?)', key, duration: 3 });
        }
    };

    /* Preview Logic Removed - Using Browser Tab instead
    const handleClosePreview = () => {
        setPreviewVisible(false);
        setPreviewUrl(null);
        setPreviewName('');
    }; 
    */

    const handleDownload = async (file: Archivo) => {
        try {
            message.loading({ content: 'Preparando descarga...', key: 'download' });
            await storageService.downloadFile(file.archivo_id, file.nombre || 'archivo');
            message.success({ content: 'Descarga iniciada', key: 'download' });
        } catch (e) {
            message.error({ content: 'Error al descargar', key: 'download' });
        }
    };

    // Helper para iconos de archivo
    const getFileIcon = (filename: string) => {
        if (filename.endsWith('.pdf')) return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: '24px' }} />;
        if (filename.endsWith('.docx') || filename.endsWith('.doc')) return <FileWordOutlined style={{ color: '#1890ff', fontSize: '24px' }} />;
        return <FileOutlined style={{ fontSize: '24px' }} />;
    };

    return (
        <AppLayout>
            <Content style={{ padding: '24px' }}>

                {/* Header Section */}
                <div style={{ marginBottom: '24px' }}>
                    <Title level={2}>Mis Archivos</Title>
                    <Breadcrumb
                        items={[
                            {
                                title: <HomeOutlined style={{ cursor: 'pointer' }} onClick={() => handleBreadcrumbClick(null)} />,
                            },
                            // Renderizar path dinámico si tuviéramos la jerarquía completa
                            ...(currentFolder ? [{ title: currentFolder.nombre }] : [])
                        ]}
                    />
                </div>

                {/* Filters Section (Only inside GO or NO_GO folders) */}
                {currentFolder && ['go', 'no_go', 'no go'].includes((currentFolder.nombre || '').toLowerCase()) && (
                    <Card style={{ marginBottom: 24 }} bodyStyle={{ padding: '16px' }}>
                        <Row gutter={[16, 16]} align="middle">
                            <Col xs={24} sm={8} md={8}>
                                <Input.Search
                                    placeholder="Buscar proyecto o cliente..."
                                    onSearch={val => setAppliedSearch(val)}
                                    allowClear
                                    enterButton
                                />
                            </Col>
                            <Col xs={24} sm={8} md={8}>
                                <DatePicker.RangePicker
                                    style={{ width: '100%' }}
                                    onChange={val => setDateRange(val)}
                                    format="DD/MM/YYYY"
                                />
                            </Col>
                            {currentFolder.nombre?.toLowerCase() === 'go' && (
                                <Col xs={24} sm={6} md={6}>
                                    <Space>
                                        <Text type="secondary">Mín. Propuestas:</Text>
                                        <div style={{ display: 'inline-block' }}>
                                            <InputNumber
                                                min={0}
                                                placeholder="0"
                                                onChange={(val) => setMinProposals(val ? Number(val) : null)}
                                            />
                                        </div>
                                    </Space>
                                </Col>
                            )}
                        </Row>
                        {(appliedSearch || dateRange || minProposals) && (
                            <div style={{ marginTop: 8 }}>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    Filtrando por:
                                    {appliedSearch && <span style={{ marginLeft: 8 }}>Texto: "{appliedSearch}"</span>}
                                    {dateRange && <span style={{ marginLeft: 8 }}>Fecha</span>}
                                    {minProposals && <span style={{ marginLeft: 8 }}>Min. Prop: {minProposals}</span>}
                                </Text>
                                <Button
                                    type="link"
                                    size="small"
                                    onClick={() => {
                                        setAppliedSearch('');
                                        setDateRange(null);
                                        setMinProposals(null);
                                    }}
                                >
                                    Limpiar
                                </Button>
                            </div>
                        )}
                    </Card>
                )}

                {/* Action Bar (Back button mainly) */}
                {currentFolder && currentFolder.parent_id && (
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => {
                            // Navegación simple hacia atrás (a raíz por ahora, idealmente al padre real)
                            if (currentFolder.parent_id) {
                                handleBreadcrumbClick(currentFolder.parent_id);
                            } else {
                                handleBreadcrumbClick(null);
                            }
                        }}
                        style={{ marginBottom: 16 }}
                    >
                        Volver
                    </Button>
                )}

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>
                ) : (
                    <>
                        {/* Carpetas */}
                        {subfolders.length > 0 && (
                            <div style={{ marginBottom: '32px' }}>
                                <Title level={4} style={{ color: '#595959', marginBottom: 16 }}>Carpetas</Title>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                                    gap: '16px'
                                }}>
                                    {subfolders.map(folder => (
                                        <Card
                                            key={folder.carpeta_id}
                                            hoverable
                                            onClick={() => handleFolderClick(folder)}
                                            bodyStyle={{ padding: '16px', height: '100%' }}
                                            style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}
                                        >
                                            {/* Delete Button - Temporarily disabled for all folders
                                            <Button
                                                type="text"
                                                danger
                                                icon={<CloseCircleOutlined />}
                                                style={{ position: 'absolute', top: 5, right: 5, zIndex: 10 }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // TODO: Implement delete confirmation
                                                    message.info('Delete logic here');
                                                }}
                                            />
                                            */}

                                            <div style={{ flex: 1 }}>
                                                {/* Enriched View for TVTs */}
                                                {folder.client_name ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>

                                                        {/* Header: Icon + Title Group */}
                                                        <div>
                                                            <div style={{ marginBottom: '8px' }}>
                                                                <FolderOpenOutlined style={{ fontSize: '20px', color: '#faad14' }} />
                                                            </div>

                                                            {/* Project Title (Primary) */}
                                                            <Text strong style={{
                                                                fontSize: '16px',
                                                                color: '#262626',
                                                                lineHeight: '1.4',
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: 2,
                                                                WebkitBoxOrient: 'vertical',
                                                                overflow: 'hidden',
                                                                marginBottom: '4px'
                                                            }}>
                                                                {folder.client_name}
                                                            </Text>

                                                            {/* TVT Code (Subtle Subtitle) */}
                                                            <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: '8px' }}>
                                                                TVT: {folder.nombre}
                                                            </Text>
                                                        </div>

                                                        {/* Footer: Metadata */}
                                                        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '12px', marginTop: '16px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#8c8c8c' }}>
                                                                <span>Propuestas v. <strong style={{ color: '#595959' }}>{folder.version_count || 0}</strong></span>
                                                                <span>{dayjs(folder.creado).format('DD MMM YYYY')}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* Standard View (GO/NO GO) */
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '100%', padding: '8px 0' }}>
                                                        <FolderOpenOutlined style={{ fontSize: '28px', color: '#faad14' }} />
                                                        <Text strong style={{ fontSize: '16px' }}>{folder.nombre}</Text>
                                                    </div>
                                                )}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Archivos */}
                        <div>
                            <Title level={4} style={{ color: '#595959', marginBottom: 16 }}>Archivos</Title>
                            {files.length > 0 ? (
                                <List
                                    grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 6 }}
                                    dataSource={files}
                                    renderItem={file => (
                                        <List.Item>
                                            <Card hoverable actions={[
                                                <EyeOutlined key="view" onClick={() => handleView(file)} />,
                                                <DownloadOutlined key="download" onClick={() => handleDownload(file)} />
                                            ]}>
                                                <Card.Meta
                                                    avatar={getFileIcon(file.nombre || '')}
                                                    title={<Text ellipsis title={file.nombre || ''}>{file.nombre}</Text>}
                                                    description={<Text type="secondary" style={{ fontSize: '12px' }}>{dayjs(file.creado).format('DD/MM/YYYY')}</Text>}
                                                />
                                            </Card>
                                        </List.Item>
                                    )}
                                />
                            ) : (
                                subfolders.length === 0 && <Empty description="Esta carpeta está vacía" />
                            )}
                        </div>
                    </>
                )}

                {/* Preview Modal - Removed in favor of New Tab 
                <FilePreviewModal
                    visible={previewVisible}
                    onClose={handleClosePreview}
                    fileUrl={previewUrl}
                    fileName={previewName}
                    fileType={previewType}
                />
                */}
            </Content>
        </AppLayout>
    );
};

export default StoragePage;
