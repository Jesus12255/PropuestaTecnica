/**
 * ChatWidget - Componente de chat contextual inteligente
 * 
 * Soporta dos modos:
 * - General: Chat con MCP Talent Search para buscar candidatos
 * - RFP: Chat contextual con un RFP específico
 */
import React, { useState, useRef, useEffect } from 'react';
import {
    List,
    Input,
    Button,
    Spin,
    Segmented,
    Typography,
    Space,
    Avatar,
    Empty,
    message as antMessage,
} from 'antd';
import { SendOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { rfpApi, mcpApi } from '../../lib/api';
import type { ChatMessage } from '../../types';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

type ChatMode = 'general' | 'rfp';

interface ChatWidgetProps {
    /** ID del RFP actual (null si no estamos en página de RFP) */
    rfpId: string | null;
    /** Mensajes del chat (estado manejado por el padre) */
    messages: ChatMessage[];
    /** Callback para agregar un mensaje */
    onAddMessage: (message: ChatMessage) => void;
    /** Callback para limpiar mensajes */
    onClearMessages: () => void;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
    rfpId,
    messages,
    onAddMessage,
    onClearMessages,
}) => {
    const [inputValue, setInputValue] = useState('');
    const [mode, setMode] = useState<ChatMode>(rfpId ? 'rfp' : 'general');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Actualizar modo cuando cambia rfpId
    useEffect(() => {
        if (!rfpId) {
            setMode('general');
        }
    }, [rfpId]);

    // Scroll al final cuando hay nuevos mensajes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Mutación para chat RFP (con historial de conversación)
    const rfpChatMutation = useMutation({
        mutationFn: (message: string) => rfpApi.chatWithRfp(rfpId!, message, messages),
        onSuccess: (data) => {
            const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
            };
            onAddMessage(assistantMessage);
        },
        onError: (error: Error) => {
            antMessage.error(`Error: ${error.message}`);
        },
    });

    // Mutación para chat MCP
    const mcpChatMutation = useMutation({
        mutationFn: (mensaje: string) => mcpApi.chat(mensaje),
        onSuccess: (data) => {
            const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.respuesta_natural,
                timestamp: new Date(),
            };
            onAddMessage(assistantMessage);
        },
        onError: (error: Error) => {
            antMessage.error(`Error: ${error.message}`);
        },
    });

    const isLoading = rfpChatMutation.isPending || mcpChatMutation.isPending;

    const handleSend = () => {
        if (!inputValue.trim() || isLoading) return;

        // Agregar mensaje del usuario
        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date(),
        };
        onAddMessage(userMessage);

        // Enviar según el modo
        if (mode === 'rfp' && rfpId) {
            rfpChatMutation.mutate(inputValue.trim());
        } else {
            mcpChatMutation.mutate(inputValue.trim());
        }

        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: 'calc(100vh - 120px)',
        }}>
            {/* Selector de modo (solo si hay RFP) */}
            {rfpId && (
                <div style={{
                    marginBottom: 16,
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0',
                }}>
                    <Segmented
                        block
                        value={mode}
                        onChange={(value) => setMode(value as ChatMode)}
                        options={[
                            { label: 'General (Talento)', value: 'general' },
                            { label: 'RFP Actual', value: 'rfp' },
                        ]}
                    />
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                        {mode === 'general'
                            ? '💼 Busca candidatos en la base de talento de TIVIT'
                            : '📄 Pregunta sobre este RFP específico'
                        }
                    </Text>
                </div>
            )}

            {/* Lista de mensajes */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0 4px',
                marginBottom: 16,
            }}>
                {messages.length === 0 ? (
                    <Empty
                        description={
                            mode === 'general'
                                ? "Pregunta sobre candidatos: 'Busco 3 desarrolladores Java para Chile'"
                                : "Pregunta sobre el RFP: '¿Cuáles son las multas?'"
                        }
                        style={{ marginTop: 40 }}
                    />
                ) : (
                    <List
                        dataSource={messages}
                        renderItem={(msg) => (
                            <List.Item
                                style={{
                                    padding: '8px 0',
                                    border: 'none',
                                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                }}
                            >
                                <Space
                                    align="start"
                                    style={{
                                        maxWidth: '85%',
                                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                    }}
                                >
                                    <Avatar
                                        icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                                        style={{
                                            backgroundColor: msg.role === 'user' ? '#1890ff' : '#52c41a',
                                            flexShrink: 0,
                                        }}
                                    />
                                    <div style={{
                                        backgroundColor: msg.role === 'user' ? '#e6f4ff' : '#f6ffed',
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        maxWidth: '100%',
                                    }}>
                                        <Paragraph
                                            style={{
                                                margin: 0,
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                            }}
                                        >
                                            {msg.content}
                                        </Paragraph>
                                        <Text
                                            type="secondary"
                                            style={{ fontSize: 11 }}
                                        >
                                            {msg.timestamp.toLocaleTimeString('es', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </Text>
                                    </div>
                                </Space>
                            </List.Item>
                        )}
                    />
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Loading indicator */}
            {isLoading && (
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <Spin size="small" />
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                        {mode === 'general' ? 'Buscando candidatos...' : 'Analizando RFP...'}
                    </Text>
                </div>
            )}

            {/* Input area */}
            <div style={{
                display: 'flex',
                gap: 8,
                borderTop: '1px solid #f0f0f0',
                paddingTop: 12,
            }}>
                <TextArea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                        mode === 'general'
                            ? "Escribe tu consulta de talento..."
                            : "Pregunta sobre el RFP..."
                    }
                    autoSize={{ minRows: 1, maxRows: 3 }}
                    disabled={isLoading}
                    style={{ flex: 1 }}
                />
                <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isLoading}
                    style={{ alignSelf: 'flex-end' }}
                />
            </div>

            {/* Clear button */}
            {messages.length > 0 && (
                <Button
                    type="link"
                    size="small"
                    onClick={onClearMessages}
                    style={{ marginTop: 8, alignSelf: 'center' }}
                >
                    Limpiar conversación
                </Button>
            )}
        </div>
    );
};

export default ChatWidget;
