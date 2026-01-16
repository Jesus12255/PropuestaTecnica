/**
 * Página de Capítulos
 */
import React, { useState, useRef, useEffect } from 'react';
import { Layout, Typography, Button, Space, Card, List, Upload, Modal, message, Empty, Spin } from 'antd';
import {
    PlusOutlined,
    ReloadOutlined,
    InboxOutlined,
    FileWordOutlined,
    ReadOutlined,
    DeleteOutlined,
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
            <Content style={{ padding: '24px', minHeight: '100vh', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
                {/* Header Section */}
                <div className="fade-in" style={{
                    marginBottom: 40,
                    background: 'linear-gradient(145deg, #1f1f1f, #141416)',
                    padding: '32px',
                    borderRadius: 16,
                    border: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                }}>
                    <div>
                        <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 700, letterSpacing: '-0.5px' }}>
                            Capítulos de Propuesta
                        </Title>
                        <Text type="secondary" style={{ fontSize: 16 }}>
                            Repositorio de contenidos modulares para propuestas.
                        </Text>
                    </div>
                    <Space size="middle">
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => refetch()}
                            size="large"
                            className="stats-card"
                            style={{ border: '1px solid #444' }}
                        >
                            Refrescar
                        </Button>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setUploadModalOpen(true)}
                            size="large"
                            style={{
                                background: 'linear-gradient(135deg, #E31837 0%, #C41230 100%)',
                                border: 'none',
                                padding: '0 32px',
                                borderRadius: 8,
                                boxShadow: '0 4px 15px rgba(227, 24, 55, 0.4)',
                                fontWeight: 600,
                                height: 48
                            }}
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
                        className="fade-in"
                        renderItem={(item, index) => (
                            <List.Item style={{ animationDelay: `${index * 50}ms` }} className="fade-in">
                                <Card
                                    className="stats-card"
                                    bordered={false}
                                    style={{
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                        height: '100%',
                                        background: '#1A1A1D'
                                    }}
                                    bodyStyle={{ padding: 24, display: 'flex', flexDirection: 'column', height: '100%' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 20 }}>

                                        <div style={{ overflow: 'hidden' }}>
                                            <Text strong style={{ fontSize: 16, display: 'block', lineHeight: 1.3, marginBottom: 4 }} ellipsis>
                                                {item.name || item.filename}
                                            </Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {new Date(item.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </Text>
                                        </div>
                                    </div>

                                    <Paragraph
                                        type="secondary"
                                        ellipsis={{ rows: 3 }}
                                        style={{ flex: 1, marginBottom: 16 }}
                                    >
                                        {item.description || 'Sin descripción'}
                                    </Paragraph>

                                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                                        <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => handleDelete(item.id)}
                                        />
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: 12,
                                        borderTop: '1px solid #333',
                                        paddingTop: 16
                                    }}>
                                        <FileWordOutlined style={{ marginRight: 6, color: '#1890ff' }} />
                                        <Text type="secondary" ellipsis style={{ fontSize: 12 }}>{item.filename}</Text>
                                    </div>
                                </Card>
                            </List.Item>
                        )}
                    />
                ) : (
                    <div className="fade-in" style={{
                        background: '#1A1A1D',
                        borderRadius: 24,
                        padding: 100,
                        border: '1px dashed #333',
                        textAlign: 'center'
                    }}>
                        <Empty
                            image={<InboxOutlined style={{ fontSize: 64, color: '#333' }} />}
                            description={
                                <Space direction="vertical" align="center" size="large">
                                    <Text type="secondary" style={{ fontSize: 16 }}>No hay capítulos cargados aún.</Text>
                                    <Button
                                        type="primary"
                                        onClick={() => setUploadModalOpen(true)}
                                        size="large"
                                        style={{ marginTop: 16, background: '#E31837', borderColor: '#E31837' }}
                                    >
                                        Subir el primero
                                    </Button>
                                </Space>
                            }
                        />
                    </div>
                )}
            </Content>

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
                width={680}
                style={{ top: 20, maxWidth: '95vw' }}
                styles={{ body: { padding: 0 } }}
                closeIcon={<span style={{ color: 'white', fontSize: 20 }}>×</span>}
            >
                <div style={{ padding: '32px', background: '#141416', maxHeight: '85vh', overflowY: 'auto' }}>

                    <Title level={3} style={{ marginBottom: 8, textAlign: 'center', fontSize: '1.5rem' }}>
                        Nuevo Capítulo
                    </Title>
                    <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 24 }}>
                        Sube tus archivos DOCX. La IA analizará y extraerá la información automáticamente.
                    </Paragraph>


                    {!uploadMutation.isPending && (

                        <Dragger
                            {...uploadProps}
                            showUploadList={false}
                            style={{
                                padding: '32px 20px',
                                background: '#0A0A0B',
                                border: '2px dashed #333',
                                borderRadius: 12,
                                marginBottom: 24,
                                transition: 'all 0.3s ease',
                                cursor: uploadMutation.isPending ? 'not-allowed' : 'pointer',
                                opacity: uploadMutation.isPending ? 0.5 : 1
                            }}
                            disabled={uploadMutation.isPending}
                        >
                            <p className="ant-upload-drag-icon">
                                <ReadOutlined style={{ color: '#E31837', fontSize: 48, marginBottom: 16 }} />
                            </p>
                            <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                                Arrastra tus documentos aquí
                            </p>
                            <p className="ant-upload-hint" style={{ color: '#666' }}>
                                Formato .docx (Word). Máximo 10MB.
                            </p>
                        </Dragger>

                    )}

                    {/* File List - Scrollable */}
                    {fileList.length > 0 && (
                        <div
                            className="fade-in"
                            style={{
                                marginBottom: 24,
                                maxHeight: '40vh',
                                overflowY: 'auto',
                                paddingRight: 4, // for scrollbar appearance
                                border: '1px solid #333',
                                borderRadius: 8,
                                padding: 8,
                                background: '#0F0F10'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 8px' }}>
                                <Title level={5} style={{ margin: 0 }}>Archivos ({fileList.length})</Title>
                                {fileList.length > 1 && <Text type="secondary" style={{ fontSize: 12 }}>Desliza para ver más</Text>}
                            </div>
                            <List
                                dataSource={fileList}
                                renderItem={(item) => {
                                    const isUploading = uploadMutation.isPending;

                                    return (
                                        <List.Item style={{
                                            background: '#1F1F1F',
                                            borderRadius: 8,
                                            marginBottom: 8,
                                            padding: '12px 16px',
                                            border: '1px solid #333',
                                            transition: 'all 0.3s ease'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                                <FileWordOutlined style={{ fontSize: 24, color: '#1890ff', marginRight: 16 }} />
                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                    <Text style={{ display: 'block' }} ellipsis>{item.name}</Text>
                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                        {(item.size || 0) / 1024 / 1024 < 1 ?
                                                            `${((item.size || 0) / 1024).toFixed(0)} KB` :
                                                            `${((item.size || 0) / 1024 / 1024).toFixed(2)} MB`}
                                                        {isUploading && ' • Analizando con IA...'}
                                                    </Text>
                                                </div>
                                                {isUploading && <Spin size="small" style={{ marginLeft: 16 }} />}
                                                {!isUploading && (
                                                    <Button
                                                        type="text"
                                                        icon={<span style={{ fontSize: 18 }}>×</span>}
                                                        onClick={() => {
                                                            setFileList(prev => prev.filter(f => f.uid !== item.uid));
                                                        }}
                                                        style={{ color: '#666' }}
                                                    />
                                                )}
                                            </div>
                                            {isUploading && (
                                                <div style={{
                                                    height: 2,
                                                    background: 'linear-gradient(90deg, #E31837 0%, #ff4d4f 100%)',
                                                    marginTop: 12,
                                                    width: '100%',
                                                    borderRadius: 2,
                                                    animation: 'pulse 1.5s infinite'
                                                }} />
                                            )}
                                        </List.Item>
                                    );
                                }}
                            />
                        </div>
                    )}

                    <div ref={buttonsRef} style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 'auto' }}>
                        <Button
                            onClick={() => setUploadModalOpen(false)}
                            disabled={uploadMutation.isPending}
                            style={{ height: 40, borderRadius: 8 }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleUpload}
                            loading={uploadMutation.isPending}
                            disabled={fileList.length === 0}
                            style={{
                                height: 40,
                                padding: '0 24px',
                                borderRadius: 8,
                                background: '#E31837',
                                borderColor: '#E31837',
                                fontWeight: 600
                            }}
                        >
                            {uploadMutation.isPending ? 'Procesando...' : `Subir ${fileList.length > 0 ? `(${fileList.length})` : ''}`}
                        </Button>
                    </div>
                </div>
            </Modal>
        </AppLayout>
    );
};

export default ChaptersPage;
