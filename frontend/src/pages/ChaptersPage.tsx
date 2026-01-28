/**
 * Página de Capítulos
 */
import React, { useState, useRef, useEffect } from 'react';
import { Layout, Typography, Button, Space, List, Upload, Modal, message, Empty, Spin } from 'antd';
import {
    PlusOutlined,
    ReloadOutlined,
    InboxOutlined,
    FileWordOutlined,
    ReadOutlined,
    DeleteOutlined,
    DownloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chaptersApi } from '../lib/api';
import AppLayout from '../components/layout/AppLayout';
import type { UploadFile } from 'antd/es/upload/interface';

const { Title, Text, Paragraph } = Typography;
const { Content } = Layout;
const { Dragger } = Upload;

const ChaptersPage: React.FC = () => {
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const queryClient = useQueryClient();

    // Auto-scroll ref
    const buttonsRef = useRef<HTMLDivElement>(null);

    // Effect for auto-scroll when first file is added
    useEffect(() => {
        if (fileList.length > 0 && buttonsRef.current) {
            // Small timeout to ensure DOM render
            setTimeout(() => {
                buttonsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }
    }, [fileList.length]);

    // Query: Listar capítulos
    const { data: chapters, isLoading, refetch } = useQuery({
        queryKey: ['chapters'],
        queryFn: chaptersApi.list,
    });

    // Mutation: Subir capítulo
    const uploadMutation = useMutation({
        mutationFn: chaptersApi.upload,
    });

    // Mutation to delete chapter
    const deleteMutation = useMutation({
        mutationFn: chaptersApi.delete,
        onSuccess: () => {
            message.success('Capítulo eliminado');
            queryClient.invalidateQueries({ queryKey: ['chapters'] });
        },
        onError: () => {
            message.error('Error al eliminar capítulo');
        }
    });

    const handleDelete = (id: string) => {
        Modal.confirm({
            title: '¿Eliminar capítulo?',
            content: 'Esta acción no se puede deshacer.',
            okText: 'Eliminar',
            okType: 'danger',
            cancelText: 'Cancelar',
            onOk: () => deleteMutation.mutate(id)
        });
    };

    const handleDownload = async (id: string, filename: string) => {
        try {
            message.loading({ content: 'Descargando...', key: 'download' });
            const blob = await chaptersApi.download(id);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            message.success({ content: 'Descarga completa', key: 'download' });
        } catch (error) {
            console.error('Download error:', error);
            message.error({ content: 'Error al descargar archivo', key: 'download' });
        }
    };

    const handleUpload = async () => { // Changed signature back to original as per faithful edit rule
        if (fileList.length === 0) return;

        try {
            let successCount = 0;
            let failCount = 0;

            // Procesar cada archivo
            for (const fileItem of fileList) {
                try {
                    const file = fileItem.originFileObj as File;
                    if (!file) continue;

                    await uploadMutation.mutateAsync(file);
                    successCount++;
                } catch (error) {
                    console.error(`Error uploading ${fileItem.name}`, error);
                    failCount++;
                }
            }

            if (failCount === 0) {
                message.success(`¡${successCount} capítulos subidos con éxito!`);
            } else {
                message.warning(`${successCount} subidos, ${failCount} fallidas.`);
            }

            setUploadModalOpen(false);
            setFileList([]);
            queryClient.invalidateQueries({ queryKey: ['chapters'] });

        } catch (error) {
            message.error('Error general en la carga masiva');
        }
    };

    const uploadProps = {
        multiple: true,
        onRemove: (file: UploadFile) => {
            setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
        },
        beforeUpload: (file: File) => {
            const isDocx = file.name.endsWith('.docx') ||
                file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

            if (!isDocx) {
                message.error(`${file.name} no es un archivo Word (.docx)`);
                return Upload.LIST_IGNORE;
            }

            const isLt10M = file.size / 1024 / 1024 < 10;
            if (!isLt10M) {
                message.error(`${file.name} excede el tamaño máximo (10MB)`);
                return Upload.LIST_IGNORE;
            }

            setFileList((prev) => [
                ...prev,
                {
                    uid: (file as any).uid || Date.now().toString(),
                    name: file.name,
                    size: file.size,
                    status: 'done',
                    originFileObj: file,
                } as UploadFile
            ]);

            return false;
        },
        fileList,
    };

    return (
        <AppLayout>
            <Content style={{ padding: '0', minHeight: '100vh', background: 'var(--bg-primary)' }}>
                <div style={{ padding: '32px' }}>
                    {/* Header Section */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 32,
                    }}>
                        <div>
                            <Title level={2} style={{ margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                                Capítulos de Propuesta
                            </Title>
                            <Text style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                                Repositorio de contenidos modulares para propuestas.
                            </Text>
                        </div>
                        <Space size="middle">
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => refetch()}
                            >
                                Refrescar
                            </Button>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => setUploadModalOpen(true)}
                            >
                                Nuevo Capítulo
                            </Button>
                        </Space>
                    </div>

                    {/* Content Grid */}
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: 80 }}>
                            <Spin size="large" />
                        </div>
                    ) : chapters && chapters.length > 0 ? (
                        <List
                            grid={{
                                gutter: 24,
                                xs: 1, sm: 1, md: 2, lg: 3, xl: 4, xxl: 4,
                            }}
                            dataSource={chapters}
                            renderItem={(item) => (
                                <List.Item>
                                    <div className="content-panel hover-lift" style={{
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        padding: 24
                                    }}>
                                        <div style={{ marginBottom: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                                <FileWordOutlined style={{ marginRight: 8, color: '#1890ff', fontSize: 20 }} />
                                                <Text strong style={{ fontSize: 16, lineHeight: 1.3, color: 'var(--text-primary)' }} ellipsis>
                                                    {item.name || item.filename}
                                                </Text>
                                            </div>
                                            <Text style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                {new Date(item.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </Text>
                                        </div>

                                        <div style={{
                                            flex: 1,
                                            marginBottom: 16,
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 4,
                                            padding: 12
                                        }}>
                                            <Paragraph
                                                ellipsis={{ rows: 3 }}
                                                style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}
                                            >
                                                {item.description || 'Sin descripción disponible.'}
                                            </Paragraph>
                                        </div>

                                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                                            <Space>
                                                <Button
                                                    type="text"
                                                    icon={<DownloadOutlined />}
                                                    onClick={() => handleDownload(item.id, item.filename)}
                                                />
                                                <Button
                                                    type="text"
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => handleDelete(item.id)}
                                                />
                                            </Space>
                                        </div>
                                    </div>
                                </List.Item>
                            )}
                        />
                    ) : (
                        <div className="content-panel" style={{
                            borderRadius: 8,
                            padding: 80,
                            textAlign: 'center',
                            borderStyle: 'dashed'
                        }}>
                            <Empty
                                image={<InboxOutlined style={{ fontSize: 64, color: 'var(--text-disabled)' }} />}
                                description={
                                    <Space direction="vertical" align="center" size="large">
                                        <Text style={{ fontSize: 16, color: 'var(--text-secondary)' }}>No hay capítulos cargados aún.</Text>
                                        <Button
                                            type="primary"
                                            onClick={() => setUploadModalOpen(true)}
                                        >
                                            Subir el primero
                                        </Button>
                                    </Space>
                                }
                            />
                        </div>
                    )}
                </div>

                {/* Upload Modal */}
                <Modal
                    title={null}
                    footer={null}
                    open={uploadModalOpen}
                    onCancel={() => {
                        if (!uploadMutation.isPending) {
                            setUploadModalOpen(false);
                            setFileList([]);
                        }
                    }}
                    width={600}
                    styles={{ body: { padding: 0 } }}
                    closeIcon={<span style={{ color: 'var(--text-secondary)' }}>×</span>}
                >
                    <div style={{ padding: 32, background: 'var(--bg-card)', borderRadius: 8 }}>
                        <Title level={3} style={{ marginBottom: 8, textAlign: 'center', color: 'var(--text-primary)' }}>
                            Nuevo Capítulo
                        </Title>
                        <Paragraph style={{ textAlign: 'center', marginBottom: 24, color: 'var(--text-secondary)' }}>
                            Sube tus archivos DOCX. La IA analizará y extraerá la información automáticamente.
                        </Paragraph>

                        {!uploadMutation.isPending && (
                            <Dragger
                                {...uploadProps}
                                showUploadList={false}
                                style={{
                                    padding: '40px 20px',
                                    background: 'var(--bg-tertiary)',
                                    border: '1px dashed var(--border-color)',
                                    borderRadius: 8,
                                    marginBottom: 24,
                                }}
                                disabled={uploadMutation.isPending}
                            >
                                <p className="ant-upload-drag-icon">
                                    <ReadOutlined style={{ color: 'var(--color-primary)', fontSize: 48 }} />
                                </p>
                                <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
                                    Arrastra tus documentos aquí
                                </p>
                                <p className="ant-upload-hint" style={{ color: 'var(--text-tertiary)' }}>
                                    Formato .docx (Word). Máximo 10MB.
                                </p>
                            </Dragger>
                        )}

                        {/* File List */}
                        {fileList.length > 0 && (
                            <div style={{
                                marginBottom: 24,
                                maxHeight: '200px',
                                overflowY: 'auto',
                                border: '1px solid var(--border-color)',
                                borderRadius: 8,
                                padding: 8,
                                background: 'var(--bg-tertiary)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 8px' }}>
                                    <Text strong style={{ color: 'var(--text-primary)' }}>Archivos ({fileList.length})</Text>
                                </div>
                                <List
                                    dataSource={fileList}
                                    renderItem={(item) => (
                                        <div style={{
                                            background: 'var(--bg-card)',
                                            borderRadius: 4,
                                            marginBottom: 8,
                                            padding: '8px 12px',
                                            border: '1px solid var(--border-color)',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}>
                                            <FileWordOutlined style={{ fontSize: 20, color: '#1890ff', marginRight: 12 }} />
                                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                                <Text style={{ display: 'block', color: 'var(--text-primary)' }} ellipsis>{item.name}</Text>
                                            </div>
                                            {!uploadMutation.isPending && (
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    icon={<span style={{ fontWeight: 'bold' }}>×</span>}
                                                    onClick={() => setFileList(prev => prev.filter(f => f.uid !== item.uid))}
                                                    style={{ color: 'var(--text-tertiary)' }}
                                                />
                                            )}
                                        </div>
                                    )}
                                />
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 'auto' }}>
                            <Button
                                onClick={() => setUploadModalOpen(false)}
                                disabled={uploadMutation.isPending}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="primary"
                                onClick={handleUpload}
                                loading={uploadMutation.isPending}
                                disabled={fileList.length === 0}
                            >
                                {uploadMutation.isPending ? 'Procesando...' : `Subir ${fileList.length > 0 ? `(${fileList.length})` : ''}`}
                            </Button>
                        </div>
                    </div>
                </Modal>
            </Content>
        </AppLayout>
    );
};

export default ChaptersPage;
