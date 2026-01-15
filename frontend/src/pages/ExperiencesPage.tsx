import React, { useState } from 'react';
import { Table, Button, Card, Typography, Modal, Form, Input, DatePicker, InputNumber, message, Space, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, ProjectOutlined, EditOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import AppLayout from '../components/layout/AppLayout';
import { experiencesApi } from '../lib/api';
import type { Experience } from '../types';

const { Title } = Typography;
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
            <div style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                    <Title level={2}><ProjectOutlined /> Experiencias y Casos de Éxito</Title>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)} size="large" style={{ background: '#E31837' }}>
                        Nueva Experiencia
                    </Button>
                </div>

                <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <Table
                        columns={columns}
                        dataSource={experiences}
                        rowKey="id"
                        loading={isLoading}
                    />
                </Card>

                <Modal
                    title={editingId ? "Editar Experiencia" : "Nueva Experiencia"}
                    open={isModalOpen}
                    onCancel={handleCloseModal}
                    footer={null}
                >
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleSave}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                            }
                        }}
                    >
                        <Form.Item name="propietario_servicio" label="Cliente / Propietario" rules={[{ required: true }]}>
                            <Input placeholder="Ej: Banco Estado" />
                        </Form.Item>
                        <Form.Item name="descripcion_servicio" label="Descripción del Servicio" rules={[{ required: true }]}>
                            <TextArea rows={3} placeholder="Ej: Implementación de sistema..." />
                        </Form.Item>
                        <Form.Item name="ubicacion" label="Ubicación" rules={[{ required: true }]}>
                            <Input placeholder="Ej: Santiago, Chile" />
                        </Form.Item>
                        <div style={{ display: 'flex', gap: 16 }}>
                            <Form.Item name="fecha_inicio" label="Fecha Inicio" rules={[{ required: true }]} style={{ flex: 1 }}>
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                            <Form.Item name="fecha_fin" label="Fecha Fin" style={{ flex: 1 }}>
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </div>
                        <Form.Item name="monto_final" label="Monto Final (USD/CLP)">
                            <InputNumber style={{ width: '100%' }} />
                        </Form.Item>
                        <div style={{ textAlign: 'right', marginTop: 16 }}>
                            <Button onClick={handleCloseModal} style={{ marginRight: 8 }} htmlType="button">Cancelar</Button>
                            <Button type="primary" htmlType="submit" loading={createMutation.isPending || updateMutation.isPending} style={{ background: '#E31837' }}>
                                Guardar
                            </Button>
                        </div>
                    </Form>
                </Modal>
            </div>
        </AppLayout>
    );
};

export default ExperiencesPage;
