/**
 * Página de Certificaciones
 */
import React, { useState } from 'react';
import { Layout, Typography, Button, Space, List, Upload, Modal, message, Empty, Spin } from 'antd';
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
            <Content style={{ padding: '0', minHeight: '100vh', background: 'var(--bg-primary)' }}>
                <div style={{ padding: '32px' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 32,
                    }}>
                        <div>
                            <Title level={2} style={{ margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                                Certificaciones
                            </Title>
                            <Text style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                                Base de conocimiento verificada para licitaciones.
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
                            renderItem={(cert) => (
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
                                            <Text strong style={{ fontSize: 16, display: 'block', lineHeight: 1.3, marginBottom: 4, color: 'var(--text-primary)' }} ellipsis>
                                                {cert.name || cert.filename}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                {new Date(cert.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
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
                                                {cert.description || 'Sin descripción disponible.'}
                                            </Paragraph>
                                        </div>

                                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                                            <Space>
                                                <Button
                                                    type="text"
                                                    icon={<DownloadOutlined />}
                                                    onClick={() => handleDownload(cert.id, cert.filename)}
                                                />
                                                <Button
                                                    type="text"
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                    onClick={() => handleDelete(cert.id)}
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
                                        <Text style={{ fontSize: 16, color: 'var(--text-secondary)' }}>No hay certificaciones cargadas aún.</Text>
                                        <Button
                                            type="primary"
                                            onClick={() => setUploadModalOpen(true)}
                                        >
                                            Subir la primera
                                        </Button>
                                    </Space>
                                }
                            />
                        </div>
                    )}
                </div>

                {/* Upload Modal (Professional Style) */}
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
                    <div style={{ padding: 32, background: 'var(--bg-card)', borderRadius: '8px 8px 0 0' }}>
                        <Title level={3} style={{ marginBottom: 8, textAlign: 'center', color: 'var(--text-primary)' }}>
                            Nueva Certificación
                        </Title>
                        <Paragraph style={{ textAlign: 'center', marginBottom: 32, color: 'var(--text-secondary)' }}>
                            Sube un archivo DOCX. Nuestra IA analizará el contenido automáticamente.
                        </Paragraph>

                        <Dragger
                            {...uploadProps}
                            style={{
                                padding: '40px 20px',
                                background: 'var(--bg-tertiary)',
                                border: '1px dashed var(--border-color)',
                                borderRadius: 8,
                                marginBottom: 24,
                            }}
                            disabled={uploadMutation.isPending}
                        >
                            {uploadMutation.isPending ? (
                                <div>
                                    <Spin size="large" />
                                    <div style={{ marginTop: 24 }}>
                                        <Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>Analizando documento...</Title>
                                        <Text style={{ color: 'var(--text-secondary)' }}>Extrayendo datos clave y subiendo a la nube</Text>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className="ant-upload-drag-icon">
                                        <InboxOutlined style={{ color: 'var(--color-primary)', fontSize: 48 }} />
                                    </p>
                                    <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
                                        Arrastra tu archivo aquí
                                    </p>
                                    <p className="ant-upload-hint" style={{ color: 'var(--text-tertiary)' }}>
                                        o haz clic para explorar. Máximo 10MB.
                                    </p>
                                </>
                            )}
                        </Dragger>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
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
                                {uploadMutation.isPending
                                    ? 'Procesando...'
                                    : fileList.length > 1
                                        ? `Subir ${fileList.length} Documentos`
                                        : 'Subir Documento'}
                            </Button>
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-elevated)', padding: '16px 32px', borderTop: '1px solid var(--border-color)', borderRadius: '0 0 8px 8px' }}>
                        <Space>
                            <CheckCircleOutlined style={{ color: 'var(--color-success)' }} />
                            <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                TIP: Asegúrate de que el documento tenga una estructura clara para mejor extracción de datos.
                            </Text>
                        </Space>
                    </div>
                </Modal>
            </Content>
        </AppLayout>
    );
};

export default CertificationsPage;
