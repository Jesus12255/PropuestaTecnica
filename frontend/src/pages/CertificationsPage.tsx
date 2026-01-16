/**
 * Página de Certificaciones
 */
import React, { useState } from 'react';
import { Layout, Typography, Button, Space, Card, List, Upload, Modal, message, Empty, Spin } from 'antd';
import {
    PlusOutlined,
    ReloadOutlined,
    InboxOutlined,
    CheckCircleOutlined,
    DeleteOutlined,
    DownloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certificationsApi } from '../lib/api';
import AppLayout from '../components/layout/AppLayout';
import type { UploadFile } from 'antd/es/upload/interface';

const { Title, Text, Paragraph } = Typography;
const { Content } = Layout;
const { Dragger } = Upload;

const CertificationsPage: React.FC = () => {
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [fileList, setFileList] = useState<UploadFile[]>([]);
    const queryClient = useQueryClient();

    // Query: Listar certificaciones
    const { data: certs, isLoading, refetch } = useQuery({
        queryKey: ['certifications'],
        queryFn: certificationsApi.list,
    });

    // Mutation: Subir certificación
    const uploadMutation = useMutation({
        mutationFn: certificationsApi.upload,
        // Eliminamos onSuccess global para manejarlo por archivo o al final
    });

    // Mutation to delete cert
    const deleteMutation = useMutation({
        mutationFn: certificationsApi.delete,
        onSuccess: () => {
            message.success('Certificación eliminada');
            queryClient.invalidateQueries({ queryKey: ['certifications'] });
        },
        onError: () => {
            message.error('Error al eliminar certificación');
        }
    });

    const handleDelete = (id: string) => {
        Modal.confirm({
            title: '¿Eliminar certificación?',
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
            const blob = await certificationsApi.download(id);
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

    const handleUpload = async () => { // Kept original signature, diff's signature was partial/incorrect
        if (fileList.length === 0) return;

        try {
            message.loading({ content: 'Iniciando carga masiva...', key: 'uploading' });

            let successCount = 0;
            let failCount = 0;

            // Procesar cada archivo
            for (const fileItem of fileList) {
                try {
                    // Acceder a originFileObj que es donde guardamos el File real
                    const file = fileItem.originFileObj as File;
                    if (!file) continue;

                    await uploadMutation.mutateAsync(file);
                    successCount++;
                } catch (error) {
                    console.error(`Error uploading ${fileItem.name}`, error);
                    failCount++;
                }
            }

            // Resultado final
            message.destroy('uploading');
            if (failCount === 0) {
                message.success(`¡${successCount} certificaciones subidas con éxito!`);
            } else {
                message.warning(`${successCount} subidas, ${failCount} fallidas.`);
            }

            // Limpieza
            setUploadModalOpen(false);
            setFileList([]);
            queryClient.invalidateQueries({ queryKey: ['certifications'] });

        } catch (error) {
            message.error('Error general en la carga masiva');
        }
    };

    const uploadProps = {
        multiple: true, // Permitir múltiples archivos
        onRemove: (file: UploadFile) => {
            setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
        },
        beforeUpload: (file: File) => {
            // Validar tipo DOCX
            const isDocx = file.name.endsWith('.docx') ||
                file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

            if (!isDocx) {
                message.error(`${file.name} no es un archivo Word (.docx)`);
                return Upload.LIST_IGNORE;
            }

            // Validar tamaño 10MB
            const isLt10M = file.size / 1024 / 1024 < 10;
            if (!isLt10M) {
                message.error(`${file.name} excede el tamaño máximo (10MB)`);
                return Upload.LIST_IGNORE;
            }

            // Agregar a la lista existente (append)
            setFileList((prev) => [
                ...prev,
                {
                    uid: (file as any).uid || Date.now().toString(), // Fallback uid
                    name: file.name,
                    status: 'done',
                    originFileObj: file,
                } as UploadFile
            ]);

            return false; // Prevent auto upload
        },
        fileList,
    };

    return (
        <AppLayout>
            <Content style={{ padding: '24px', minHeight: '100vh', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
                {/* Header Section with Gradient */}
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
                            Certificaciones
                        </Title>
                        <Text type="secondary" style={{ fontSize: 16 }}>
                            Base de conocimiento verificada para licitaciones.
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
                            Nueva Certificación
                        </Button>
                    </Space>
                </div>

                {/* Content Grid */}
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: 80 }}>
                        <Spin size="large" />
                    </div>
                ) : certs && certs.length > 0 ? (
                    <List
                        grid={{
                            gutter: 24,
                            xs: 1,
                            sm: 1,
                            md: 2,
                            lg: 3,
                            xl: 4,
                            xxl: 4,
                        }}
                        dataSource={certs}
                        className="fade-in"
                        renderItem={(cert, index) => (
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
                                                {cert.name || cert.filename}
                                            </Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {new Date(cert.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </Text>
                                        </div>
                                    </div>

                                    <div style={{
                                        flex: 1,
                                        marginBottom: 20,
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: 8,
                                        padding: 12
                                    }}>
                                        <Paragraph
                                            ellipsis={{ rows: 3 }}
                                            type="secondary"
                                            style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}
                                        >
                                            {cert.description || 'Sin descripción disponible.'}
                                        </Paragraph>

                                    </div>

                                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', paddingBottom: 16 }}>
                                        <Button
                                            type="text"
                                            icon={<DownloadOutlined />}
                                            onClick={() => handleDownload(cert.id, cert.filename)}
                                            style={{ marginRight: 8 }}
                                        />
                                        <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => handleDelete(cert.id)}
                                        />
                                    </div>

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: 12,
                                        borderTop: '1px solid #333',
                                        paddingTop: 16
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', color: '#52c41a' }}>
                                            <CheckCircleOutlined style={{ marginRight: 6 }} />
                                            <Text type="secondary" style={{ fontSize: 12 }}>Cloud Storage</Text>
                                        </div>
                                        <Text type="secondary" style={{ fontSize: 10, opacity: 0.5 }}>ID: {cert.id.slice(0, 8)}</Text>
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
                                    <Text type="secondary" style={{ fontSize: 16 }}>No hay certificaciones cargadas aún.</Text>
                                    <Button
                                        type="primary"
                                        onClick={() => setUploadModalOpen(true)}
                                        size="large"
                                        style={{ marginTop: 16, background: '#E31837', borderColor: '#E31837' }}
                                    >
                                        Subir la primera
                                    </Button>
                                </Space>
                            }
                        />
                    </div>
                )}
            </Content>

            {/* Upload Modal (Premium Style) */}
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
                styles={{ body: { padding: 0 } }}
                closeIcon={<span style={{ color: 'white', fontSize: 20 }}>×</span>}
            >
                <div style={{ padding: 40, background: '#141416' }}>
                    <Title level={3} style={{ marginBottom: 8, textAlign: 'center' }}>
                        Nueva Certificación
                    </Title>
                    <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 32 }}>
                        Sube un archivo DOCX. Nuestra IA analizará el contenido automáticamente.
                    </Paragraph>

                    <Dragger
                        {...uploadProps}
                        style={{
                            padding: '60px 20px',
                            background: '#0A0A0B',
                            border: '2px dashed #333',
                            borderRadius: 12,
                            marginBottom: 32,
                            transition: 'all 0.3s ease'
                        }}
                        disabled={uploadMutation.isPending}
                        className="certification-dragger"
                    >
                        {uploadMutation.isPending ? (
                            <div className="fade-in">
                                <Spin size="large" />
                                <div style={{ marginTop: 24 }}>
                                    <Title level={4} style={{ margin: 0 }}>Analizando documento...</Title>
                                    <Text type="secondary">Extrayendo datos clave y subiendo a la nube</Text>
                                </div>
                            </div>
                        ) : (
                            <>
                                <p className="ant-upload-drag-icon">
                                    <InboxOutlined style={{ color: '#E31837', fontSize: 64, marginBottom: 16 }} />
                                </p>
                                <p className="ant-upload-text" style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                                    Arrastra tu archivo aquí
                                </p>
                                <p className="ant-upload-hint" style={{ color: '#666' }}>
                                    o haz clic para explorar. Máximo 10MB.
                                </p>
                            </>
                        )}
                    </Dragger>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <Button
                            onClick={() => setUploadModalOpen(false)}
                            disabled={uploadMutation.isPending}
                            style={{ height: 44, borderRadius: 8 }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleUpload}
                            loading={uploadMutation.isPending}
                            disabled={fileList.length === 0}
                            style={{
                                height: 44,
                                padding: '0 32px',
                                borderRadius: 8,
                                background: '#E31837',
                                borderColor: '#E31837',
                                fontWeight: 600
                            }}
                        >
                            {uploadMutation.isPending
                                ? 'Procesando...'
                                : fileList.length > 1
                                    ? `Subir ${fileList.length} Documentos`
                                    : 'Subir Documento'}
                        </Button>
                    </div>
                </div>

                {/* Pro Tip Footer */}
                <div style={{ background: '#1A1A1D', padding: '16px 40px', borderTop: '1px solid #333' }}>
                    <Space>
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            TIP: Asegúrate de que el documento tenga una estructura clara para mejor extracción de datos.
                        </Text>
                    </Space>
                </div>
            </Modal>
        </AppLayout >
    );
};

export default CertificationsPage;
