import React, { useState } from 'react';
import { Table, Button, Typography, Modal, Form, Input, DatePicker, InputNumber, message, Space, Popconfirm, Layout } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import AppLayout from '../components/layout/AppLayout';
import { experiencesApi } from '../lib/api';
import type { Experience } from '../types';

const { Title, Text } = Typography;
const { Content } = Layout;
const { TextArea } = Input;

const ExperiencesPage: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const { data: experiences, isLoading } = useQuery({
        queryKey: ['experiences'],
        queryFn: experiencesApi.list,
    });

    const createMutation = useMutation({
        mutationFn: experiencesApi.create,
        onSuccess: () => {
            message.success('Experiencia creada correctamente');
            handleCloseModal();
            queryClient.invalidateQueries({ queryKey: ['experiences'] });
        },
        onError: () => {
            message.error('Error al crear experiencia');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => experiencesApi.update(id, data),
        onSuccess: () => {
            message.success('Experiencia actualizada correctamente');
            handleCloseModal();
            queryClient.invalidateQueries({ queryKey: ['experiences'] });
        },
        onError: () => {
            message.error('Error al actualizar experiencia');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: experiencesApi.delete,
        onSuccess: () => {
            message.success('Experiencia eliminada');
            queryClient.invalidateQueries({ queryKey: ['experiences'] });
        },
    });

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        form.resetFields();
    };

    const handleEdit = (record: Experience) => {
        setEditingId(record.id);
        form.setFieldsValue({
            ...record,
            fecha_inicio: dayjs(record.fecha_inicio),
            fecha_fin: record.fecha_fin ? dayjs(record.fecha_fin) : undefined,
        });
        setIsModalOpen(true);
    };

    const handleSave = (values: any) => {
        const formattedValues = {
            ...values,
            fecha_inicio: values.fecha_inicio.format('YYYY-MM-DD'),
            fecha_fin: values.fecha_fin ? values.fecha_fin.format('YYYY-MM-DD') : undefined,
        };

        if (editingId) {
            updateMutation.mutate({ id: editingId, data: formattedValues });
        } else {
            createMutation.mutate(formattedValues);
        }
    };

    const columns = [
        {
            title: 'Cliente',
            dataIndex: 'propietario_servicio',
            key: 'propietario_servicio',
            fontWeight: 'bold',
        },
        {
            title: 'Descripción',
            dataIndex: 'descripcion_servicio',
            key: 'descripcion_servicio',
            ellipsis: true,
        },
        {
            title: 'Ubicación',
            dataIndex: 'ubicacion',
            key: 'ubicacion',
        },
        {
            title: 'Inicio',
            dataIndex: 'fecha_inicio',
            key: 'fecha_inicio',
        },
        {
            title: 'Monto',
            dataIndex: 'monto_final',
            key: 'monto_final',
            render: (val: number) => val ? `$${val.toLocaleString()}` : '-',
        },
        {
            title: 'Acciones',
            key: 'actions',
            render: (_: any, record: Experience) => (
                <Space>
                    <Button icon={<EditOutlined />} type="text" onClick={() => handleEdit(record)} />
                    <Popconfirm title="¿Eliminar?" onConfirm={() => deleteMutation.mutate(record.id)}>
                        <Button icon={<DeleteOutlined />} danger type="text" />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

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
                                Experiencias y Casos de Éxito
                            </Title>
                            <Text style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                                Registro histórico de proyectos y casos relevantes.
                            </Text>
                        </div>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setIsModalOpen(true)}
                            size="large"
                        >
                            Nueva Experiencia
                        </Button>
                    </div>

                    {/* Table */}
                    <div className="content-panel" style={{ borderRadius: 8, overflow: 'hidden' }}>
                        <Table
                            columns={columns}
                            dataSource={experiences}
                            rowKey="id"
                            loading={isLoading}
                            pagination={{
                                pageSize: 10,
                                showTotal: (total) => <span style={{ color: 'var(--text-secondary)' }}>{total} Experiencias</span>,
                            }}
                            scroll={{ x: 1000 }}
                            size="middle"
                            rowClassName="hover-lift"
                        />
                    </div>
                </div>

                <Modal
                    title={null}
                    open={isModalOpen}
                    onCancel={handleCloseModal}
                    footer={null}
                    width={600}
                    closeIcon={<span style={{ color: 'var(--text-secondary)' }}>×</span>}
                    styles={{ body: { padding: 0 } }}
                >
                    <div style={{ padding: 32, background: 'var(--bg-card)', borderRadius: 8 }}>
                        <Title level={3} style={{ marginBottom: 24, textAlign: 'center', color: 'var(--text-primary)' }}>
                            {editingId ? "Editar Experiencia" : "Nueva Experiencia"}
                        </Title>

                        <Form
                            form={form}
                            layout="vertical"
                            onFinish={handleSave}
                        >
                            <Form.Item name="propietario_servicio" label={<span style={{ color: 'var(--text-secondary)' }}>Cliente / Propietario</span>} rules={[{ required: true }]}>
                                <Input placeholder="Ej: Banco Estado" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                            </Form.Item>
                            <Form.Item name="descripcion_servicio" label={<span style={{ color: 'var(--text-secondary)' }}>Descripción del Servicio</span>} rules={[{ required: true }]}>
                                <TextArea rows={3} placeholder="Ej: Implementación de sistema..." style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                            </Form.Item>
                            <Form.Item name="ubicacion" label={<span style={{ color: 'var(--text-secondary)' }}>Ubicación</span>} rules={[{ required: true }]}>
                                <Input placeholder="Ej: Santiago, Chile" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                            </Form.Item>
                            <div style={{ display: 'flex', gap: 16 }}>
                                <Form.Item name="fecha_inicio" label={<span style={{ color: 'var(--text-secondary)' }}>Fecha Inicio</span>} rules={[{ required: true }]} style={{ flex: 1 }}>
                                    <DatePicker style={{ width: '100%', background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }} />
                                </Form.Item>
                                <Form.Item name="fecha_fin" label={<span style={{ color: 'var(--text-secondary)' }}>Fecha Fin</span>} style={{ flex: 1 }}>
                                    <DatePicker style={{ width: '100%', background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }} />
                                </Form.Item>
                            </div>
                            <Form.Item name="monto_final" label={<span style={{ color: 'var(--text-secondary)' }}>Monto Final (USD/CLP)</span>}>
                                <InputNumber style={{ width: '100%', background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                            </Form.Item>
                            <div style={{ textAlign: 'right', marginTop: 32, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                <Button onClick={handleCloseModal} style={{ height: 40 }}>Cancelar</Button>
                                <Button type="primary" htmlType="submit" loading={createMutation.isPending || updateMutation.isPending} style={{ height: 40, padding: '0 24px' }}>
                                    Guardar
                                </Button>
                            </div>
                        </Form>
                    </div>
                </Modal>
            </Content>
        </AppLayout>
    );
};

export default ExperiencesPage;
