/**
 * FloatingChat - Chat flotante con botón arrastrable
 * 
 * Características:
 * - Botón arrastrable a cualquier posición
 * - Popup que se despliega según posición del botón
 * - Modo Sistema (conoce todos los RFPs) y Modo RFP (contexto específico)
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Input,
    Button,
    Spin,
    Typography,
    Space,
    Avatar,
    Empty,
    message as antMessage,
    Segmented,
    ConfigProvider,
    theme
} from 'antd';
import {
    SendOutlined,
    UserOutlined,
    RobotOutlined,
    CommentOutlined,
    CloseOutlined,
    DeleteOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { rfpApi, chatApi } from '../../lib/api';
import type { ChatMessage } from '../../types';

const { Text } = Typography;
const { TextArea } = Input;

type ChatMode = 'system' | 'rfp';

// Color theme - Dark Mode TIVIT
const COLORS = {
    primary: '#E31837',         // TIVIT Red
    primaryHover: '#B91C1C',    // Darker red
    rfpBadge: '#28a745',        // Green for RFP indicator
    userBubble: '#3F1719',      // Dark red for user messages
    assistantBubble: '#27272A', // Dark gray for assistant messages
    background: '#141416',      // Card background
    messageListBg: '#0A0A0B',   // Darker background for message list
    text: '#FFFFFF',            // White text
    textSecondary: '#A1A1AA',   // Light gray text
    border: '#27272A',          // Dark border
    inputBg: '#18181B',         // Input background
    codeBg: '#3F3F46',          // Code block background
    headerGradientStart: '#E31837',
    headerGradientEnd: '#991125',
};

interface Position {
    x: number;
    y: number;
}

interface FloatingChatProps {
    rfpId: string | null;
    messages: ChatMessage[];
    onAddMessage: (message: ChatMessage) => void;
    onClearMessages: () => void;
}

const FloatingChat: React.FC<FloatingChatProps> = ({
    rfpId,
    messages,
    onAddMessage,
    onClearMessages,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [mode, setMode] = useState<ChatMode>(rfpId ? 'rfp' : 'system');
    const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
    const [hasDragged, setHasDragged] = useState(false);

    const buttonRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initialize position to bottom-right
    useEffect(() => {
        const updatePosition = () => {
            setPosition({
                x: window.innerWidth - 50,
                y: window.innerHeight - 50,
            });
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        return () => window.removeEventListener('resize', updatePosition);
    }, []);

    // Update mode when rfpId changes
    useEffect(() => {
        if (!rfpId) {
            setMode('system');
        }
    }, [rfpId]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Dragging handlers - FREE movement anywhere
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setHasDragged(false);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
    };

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDragging) return;
            setHasDragged(true);
            // Free movement - only constrain to viewport edges
            const newX = Math.max(28, Math.min(window.innerWidth - 28, e.clientX - dragStart.x));
            const newY = Math.max(28, Math.min(window.innerHeight - 28, e.clientY - dragStart.y));
            setPosition({ x: newX, y: newY });
        },
        [isDragging, dragStart]
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleClick = () => {
        // Only toggle if we didn't drag
        if (!hasDragged) {
            setIsOpen(!isOpen);
        }
        setHasDragged(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // System chat mutation
    const systemChatMutation = useMutation({
        mutationFn: (message: string) => {
            const history = messages.slice(-20).map((m) => ({
                role: m.role,
                content: m.content,
            }));
            return chatApi.system(message, history);
        },
        onSuccess: (data) => {
            onAddMessage({
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
            });
        },
        onError: (error: Error) => {
            antMessage.error(`Error: ${error.message}`);
        },
    });

    // RFP chat mutation
    const rfpChatMutation = useMutation({
        mutationFn: (message: string) => rfpApi.chatWithRfp(rfpId!, message, messages),
        onSuccess: (data) => {
            onAddMessage({
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
            });
        },
        onError: (error: Error) => {
            antMessage.error(`Error: ${error.message}`);
        },
    });

    const isLoading = systemChatMutation.isPending || rfpChatMutation.isPending;

    const handleSend = () => {
        if (!inputValue.trim() || isLoading) return;

        onAddMessage({
            id: `user-${Date.now()}`,
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date(),
        });

        if (mode === 'rfp' && rfpId) {
            rfpChatMutation.mutate(inputValue.trim());
        } else {
            systemChatMutation.mutate(inputValue.trim());
        }

        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Calculate popup position based on button location
    const getPopupStyle = (): React.CSSProperties => {
        const isLeft = position.x < window.innerWidth / 2;
        const isTop = position.y < window.innerHeight / 2;

        return {
            position: 'fixed',
            width: 380,
            height: 520,
            backgroundColor: COLORS.background,
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            border: `1px solid ${COLORS.border}`,
            overflow: 'hidden',
            ...(isLeft ? { left: Math.max(10, position.x - 20) } : { right: Math.max(10, window.innerWidth - position.x - 20) }),
            ...(isTop ? { top: position.y + 45 } : { bottom: window.innerHeight - position.y + 45 }),
        };
    };

    return (
        <ConfigProvider
            theme={{
                algorithm: theme.darkAlgorithm,
                token: {
                    colorPrimary: COLORS.primary,
                    colorBgBase: COLORS.background,
                    colorBgContainer: COLORS.background,
                    colorText: COLORS.text,
                    colorTextSecondary: COLORS.textSecondary,
                    colorBorder: COLORS.border,
                },
            }}
        >
            {/* Draggable Button */}
            <div
                ref={buttonRef}
                onMouseDown={handleMouseDown}
                onClick={handleClick}
                style={{
                    position: 'fixed',
                    left: position.x - 28,
                    top: position.y - 28,
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    backgroundColor: COLORS.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    boxShadow: '0 4px 20px rgba(227, 24, 55, 0.4)',
                    zIndex: 1001,
                    transition: isDragging ? 'none' : 'transform 0.2s, box-shadow 0.2s',
                    userSelect: 'none',
                    transform: isDragging ? 'scale(1.1)' : 'scale(1)',
                }}
            >
                {isOpen ? (
                    <CloseOutlined style={{ fontSize: 22, color: '#fff' }} />
                ) : (
                    <CommentOutlined style={{ fontSize: 26, color: '#fff' }} />
                )}
                {rfpId && !isOpen && (
                    <div
                        style={{
                            position: 'absolute',
                            top: -2,
                            right: -2,
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            backgroundColor: COLORS.rfpBadge,
                            border: '2px solid #fff',
                        }}
                    />
                )}
            </div>

            {/* Popup */}
            {isOpen && (
                <div style={getPopupStyle()}>
                    {/* Header */}
                    <div
                        style={{
                            padding: '14px 16px',
                            background: `linear-gradient(135deg, ${COLORS.headerGradientStart} 0%, ${COLORS.headerGradientEnd} 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: `1px solid ${COLORS.border}`,
                        }}
                    >
                        <Space>
                            <CommentOutlined style={{ fontSize: 20, color: '#fff' }} />
                            <Text strong style={{ color: '#fff', fontSize: 15 }}>Asistente TIVIT</Text>
                            {mode === 'rfp' && (
                                <span
                                    style={{
                                        fontSize: 10,
                                        backgroundColor: COLORS.rfpBadge,
                                        color: '#fff',
                                        padding: '2px 8px',
                                        borderRadius: 10,
                                        fontWeight: 600,
                                    }}
                                >
                                    RFP
                                </span>
                            )}
                        </Space>
                        <Button
                            type="text"
                            size="small"
                            icon={<CloseOutlined style={{ color: '#fff' }} />}
                            onClick={() => setIsOpen(false)}
                        />
                    </div>

                    {/* Mode selector (only if on RFP page) */}
                    {rfpId && (
                        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}`, backgroundColor: COLORS.background }}>
                            <Segmented
                                block
                                size="small"
                                value={mode}
                                onChange={(value) => setMode(value as ChatMode)}
                                options={[
                                    { label: '💼 Sistema', value: 'system' },
                                    { label: '📄 Este RFP', value: 'rfp' },
                                ]}
                            />
                        </div>
                    )}

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 14, backgroundColor: COLORS.messageListBg }}>
                        {messages.length === 0 ? (
                            <Empty
                                image={Empty.PRESENTED_IMAGE_SIMPLE}
                                description={
                                    <Text style={{ color: COLORS.textSecondary }}>
                                        {mode === 'system'
                                            ? '¿En qué puedo ayudarte?'
                                            : 'Pregunta sobre este RFP'}
                                    </Text>
                                }
                                style={{ marginTop: 80 }}
                            />
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    style={{
                                        display: 'flex',
                                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                        marginBottom: 14,
                                        gap: 10,
                                    }}
                                >
                                    <Avatar
                                        size="small"
                                        icon={msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                                        style={{
                                            backgroundColor: msg.role === 'user' ? COLORS.primary : '#3F3F46',
                                            flexShrink: 0,
                                        }}
                                    />
                                    <div
                                        style={{
                                            maxWidth: '78%',
                                            backgroundColor: msg.role === 'user' ? COLORS.userBubble : COLORS.assistantBubble,
                                            padding: '10px 14px',
                                            borderRadius: 12,
                                            border: msg.role === 'user' ? `1px solid ${COLORS.primary}60` : `1px solid ${COLORS.border}`,
                                        }}
                                    >
                                        <div style={{ margin: 0, fontSize: 13, color: COLORS.text }}>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    p: ({ children }) => <p style={{ margin: '0 0 8px 0', color: COLORS.text }}>{children}</p>,
                                                    ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 16, color: COLORS.text }}>{children}</ul>,
                                                    ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 16, color: COLORS.text }}>{children}</ol>,
                                                    li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
                                                    strong: ({ children }) => <strong style={{ fontWeight: 600, color: COLORS.text }}>{children}</strong>,
                                                    code: ({ children }) => <code style={{ backgroundColor: COLORS.codeBg, color: COLORS.text, padding: '2px 4px', borderRadius: 3, fontSize: 12 }}>{children}</code>,
                                                    table: ({ children }) => <table style={{ borderCollapse: 'collapse', width: '100%', margin: '8px 0', fontSize: 12, color: COLORS.text }}>{children}</table>,
                                                    thead: ({ children }) => <thead style={{ backgroundColor: COLORS.primary, color: '#fff' }}>{children}</thead>,
                                                    th: ({ children }) => <th style={{ padding: '6px 8px', textAlign: 'left', border: `1px solid ${COLORS.border}` }}>{children}</th>,
                                                    td: ({ children }) => <td style={{ padding: '6px 8px', border: `1px solid ${COLORS.border}` }}>{children}</td>,
                                                }}
                                            >
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                        <Text style={{ fontSize: 10, color: COLORS.textSecondary }}>
                                            {msg.timestamp.toLocaleTimeString('es', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </Text>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Loading */}
                    {isLoading && (
                        <div style={{ textAlign: 'center', padding: 10, backgroundColor: COLORS.background }}>
                            <Spin size="small" />
                            <Text style={{ marginLeft: 8, fontSize: 12, color: COLORS.textSecondary }}>
                                Pensando...
                            </Text>
                        </div>
                    )}

                    {/* Input */}
                    <div
                        style={{
                            padding: 12,
                            borderTop: `1px solid ${COLORS.border}`,
                            display: 'flex',
                            gap: 10,
                            backgroundColor: COLORS.background,
                        }}
                    >
                        <TextArea
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={mode === 'system' ? 'Escribe tu pregunta...' : 'Pregunta sobre el RFP...'}
                            autoSize={{ minRows: 1, maxRows: 3 }}
                            disabled={isLoading}
                            style={{ 
                                flex: 1, 
                                fontSize: 13, 
                                borderRadius: 8,
                                backgroundColor: COLORS.inputBg,
                                color: COLORS.text,
                                border: `1px solid ${COLORS.border}`
                            }}
                        />
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={handleSend}
                            disabled={!inputValue.trim() || isLoading}
                            style={{
                                alignSelf: 'flex-end',
                                backgroundColor: COLORS.primary,
                                borderColor: COLORS.primary,
                            }}
                        />
                    </div>

                    {/* Clear button */}
                    {messages.length > 0 && (
                        <div style={{ textAlign: 'center', paddingBottom: 10, backgroundColor: COLORS.background }}>
                            <Button
                                type="text"
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={onClearMessages}
                                style={{ color: COLORS.textSecondary }}
                            >
                                Limpiar
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </ConfigProvider>
    );
};

export default FloatingChat;