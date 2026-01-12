/**
 * Página de Login - Tema Negro con Rojo
 */
import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Tabs } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { LoginCredentials, RegisterData } from '../types';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (values: LoginCredentials) => {
    setLoading(true);
    try {
      await login(values);
      message.success('Inicio de sesión exitoso');
      navigate('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: RegisterData) => {
    setLoading(true);
    try {
      await register(values);
      message.success('Registro exitoso');
      navigate('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      message.error(err.response?.data?.detail || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  const loginForm = (
    <Form
      name="login"
      onFinish={handleLogin}
      layout="vertical"
      size="large"
    >
      <Form.Item
        name="email"
        rules={[
          { required: true, message: 'Ingresa tu email' },
          { type: 'email', message: 'Email inválido' },
        ]}
      >
        <Input 
          prefix={<MailOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />} 
          placeholder="Email" 
        />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
      >
        <Input.Password 
          prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />} 
          placeholder="Contraseña" 
        />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          Iniciar Sesión
        </Button>
      </Form.Item>
    </Form>
  );

  const registerForm = (
    <Form
      name="register"
      onFinish={handleRegister}
      layout="vertical"
      size="large"
    >
      <Form.Item
        name="full_name"
        rules={[
          { required: true, message: 'Ingresa tu nombre' },
          { min: 2, message: 'Mínimo 2 caracteres' },
        ]}
      >
        <Input 
          prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />} 
          placeholder="Nombre completo" 
        />
      </Form.Item>

      <Form.Item
        name="email"
        rules={[
          { required: true, message: 'Ingresa tu email' },
          { type: 'email', message: 'Email inválido' },
        ]}
      >
        <Input 
          prefix={<MailOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />} 
          placeholder="Email" 
        />
      </Form.Item>

      <Form.Item
        name="password"
        rules={[
          { required: true, message: 'Ingresa tu contraseña' },
          { min: 6, message: 'Mínimo 6 caracteres' },
        ]}
      >
        <Input.Password 
          prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />} 
          placeholder="Contraseña" 
        />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          Registrarse
        </Button>
      </Form.Item>
    </Form>
  );

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0A0A0B 0%, #1A0A0D 50%, #0A0A0B 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        right: '-20%',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(227, 24, 55, 0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-30%',
        left: '-10%',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(227, 24, 55, 0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <Card
        style={{
          width: 420,
          background: 'rgba(20, 20, 22, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(227, 24, 55, 0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {/* Logo */}
          <div style={{
            width: 60,
            height: 60,
            margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #E31837 0%, #FF4D4D 100%)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(227, 24, 55, 0.4)',
          }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>R</span>
          </div>
          <Title level={2} style={{ margin: 0, color: 'white' }}>
            TIVIT Proposals
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.5)' }}>
            Análisis inteligente de propuestas
          </Text>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          centered
          items={[
            {
              key: 'login',
              label: 'Iniciar Sesión',
              children: loginForm,
            },
            {
              key: 'register',
              label: 'Registrarse',
              children: registerForm,
            },
          ]}
        />

        <div style={{ 
          textAlign: 'center', 
          marginTop: 16, 
          paddingTop: 16, 
          borderTop: '1px solid rgba(255,255,255,0.1)' 
        }}>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
            Powered by Gemini AI
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
