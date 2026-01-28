/**
 * Modal para subir RFPs - Premium Redesign
 */
import React, { useState } from 'react';
import { Modal, Upload, message, Typography, Steps, ConfigProvider, theme, Button } from 'antd';
import {
  InboxOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  FileSearchOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
  CloseOutlined
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { RcFile } from 'antd/es/upload';
import { rfpApi } from '../../lib/api';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const { Dragger } = Upload;
const { Text, Title } = Typography;

interface UploadModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

type UploadStep = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';

const UploadModal: React.FC<UploadModalProps> = ({ open, onCancel, onSuccess }) => {
  const [step, setStep] = useState<UploadStep>('idle');
  const [fileList, setFileList] = useState<RcFile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const resetState = () => {
    setStep('idle');
    setFileList([]);
    setErrorMessage('');
  };

  const handleCancel = () => {
    if (step === 'uploading' || step === 'analyzing') {
      message.warning('Por favor espera a que termine el análisis');
      return;
    }
    resetState();
    onCancel();
  };

  const handleUpload = async () => {
    if (fileList.length === 0) return;

    setStep('uploading');
    setErrorMessage('');

    try {
      // Simulate analysis delay for effect (and to match Lottie)
      setTimeout(() => setStep('analyzing'), 2500);

      // Enviar todos los archivos
      await rfpApi.upload(fileList);

      setStep('complete');
      message.success('Proyecto analizado exitosamente');

      setTimeout(() => {
        resetState();
        onSuccess();
      }, 2000);

    } catch (error: any) {
      setStep('error');
      const errorMsg = error?.response?.data?.detail || error?.message || 'Error al procesar los archivos';
      setErrorMessage(errorMsg);
      message.error(errorMsg);
    }
  };

  const uploadProps: UploadProps = {
    name: 'files',
    multiple: true,
    fileList: fileList,
    accept: '.pdf,.docx,.xlsx,.xls',
    showUploadList: false, // We'll render custom list
    disabled: step !== 'idle',
    beforeUpload: (file) => {
      const isLt50M = file.size / 1024 / 1024 < 50;
      if (!isLt50M) {
        message.error(`${file.name} debe ser menor a 50MB`);
        return Upload.LIST_IGNORE;
      }
      setFileList(prev => [...prev, file as RcFile]);
      return false; // Prevent auto upload
    },
    onRemove: (file) => {
      setFileList(prev => prev.filter(f => f.uid !== file.uid));
    },
    onDrop(e) {
      console.log('Dropped files', e.dataTransfer.files);
    },
  };

  const getCurrentStep = () => {
    switch (step) {
      case 'idle': return 0;
      case 'uploading': return 1;
      case 'analyzing': return 2; // Split analysis into step 2
      case 'complete': return 3;
      default: return 0;
    }
  };

  // Custom Step Rendering
  const stepsItems = [
    {
      title: 'Cargar',
      description: 'Selecciona archivos',
      icon: <CloudUploadOutlined />,
    },
    {
      title: 'Subiendo',
      description: 'Transfiriendo datos',
      icon: step === 'uploading' ? <LoadingOutlined /> : <InboxOutlined />,
    },
    {
      title: 'Analizando',
      description: 'IA procesando',
      icon: step === 'analyzing' ? <LoadingOutlined /> : <FileSearchOutlined />,
    },
    {
      title: 'Listo',
      description: 'Resultados',
      icon: <CheckCircleOutlined />,
    },
  ];


  const renderRightContent = () => {
    if (step === 'idle') {
      return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <Title level={3} style={{ margin: 0, color: 'white' }}>Nuevo Proyecto</Title>
            <Text type="secondary">Sube los documentos del RFP para iniciar el análisis</Text>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', minHeight: 0, paddingRight: 4 }}>
            <Dragger
              {...uploadProps}
              style={{
                background: '#141414',
                border: '2px dashed #303030',
                borderRadius: 12,
                padding: 40,
                transition: 'all 0.3s'
              }}
              className="custom-dragger"
              height={250}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#E31837', fontSize: 48 }} />
              </p>
              <p className="ant-upload-text" style={{ color: '#e0e0e0', fontSize: 18, fontWeight: 500 }}>
                Haz clic o arrastra archivos aquí
              </p>
              <p className="ant-upload-hint" style={{ color: '#666' }}>
                Soporta PDF, DOCX, Excel (Máx. 50MB)
              </p>
            </Dragger>

            {/* File List Preview */}
            <div style={{ padding: '0 4px' }}>
              {fileList.map(file => (
                <div key={file.uid} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', marginBottom: 8,
                  background: '#1f1f1f', borderRadius: 6, border: '1px solid #303030'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                    <FileTextOutlined style={{ color: '#1890ff' }} />
                    <Text style={{ color: '#e0e0e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
                      {file.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </Text>
                  </div>
                  <CloseOutlined
                    style={{ color: '#666', cursor: 'pointer', padding: 4 }}
                    onClick={(e) => { e.stopPropagation(); uploadProps.onRemove?.(file as any); }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Button onClick={onCancel} style={{ marginRight: 12 }} type="text">Cancelar</Button>
            <Button
              type="primary"
              onClick={handleUpload}
              disabled={fileList.length === 0}
              size="large"
              style={{
                background: fileList.length > 0 ? '#E31837' : undefined,
                borderColor: fileList.length > 0 ? '#E31837' : undefined,
                opacity: fileList.length > 0 ? 1 : 0.5,
                padding: '0 40px'
              }}
            >
              Comenzar Análisis
            </Button>
          </div>
        </div>
      );
    }

    if (step === 'error') {
      return (
        <div className="fade-in" style={{ textAlign: 'center', padding: '40px 20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ color: '#ff4d4f', fontSize: 64, marginBottom: 24 }}>⚠️</div>
          <Title level={3} style={{ color: '#ff4d4f', margin: 0 }}>Error al procesar</Title>
          <Text type="secondary" style={{ marginTop: 12, display: 'block', maxWidth: 400 }}>{errorMessage}</Text>
          <Button type="primary" onClick={resetState} style={{ marginTop: 32 }} danger>
            Intentar de nuevo
          </Button>
        </div>
      );
    }

    // Uploading / Analyzing / Complete Steps
    return (
      <div className="fade-in" style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        <div style={{ width: 300, height: 300, marginBottom: 24 }}>
          {step === 'complete' ? (
            <CheckCircleOutlined style={{ fontSize: 120, color: '#52c41a', marginTop: 80 }} />
          ) : (
            <DotLottieReact
              src="https://lottie.host/4acf9c4b-b278-41e3-a574-ce4921ca7ef1/r0GKvujRyF.lottie"
              autoplay
              loop
            />
          )}
        </div>

        <Title level={4} style={{ color: 'white', marginTop: 0 }}>
          {step === 'uploading' && 'Subiendo documentos...'}
          {step === 'analyzing' && 'Analizando contenido...'}
          {step === 'complete' && '¡Análisis Completado!'}
        </Title>

        <Text type="secondary" style={{ maxWidth: 400 }}>
          {step === 'uploading' && 'Estamos transfiriendo tus archivos de forma segura.'}
          {step === 'analyzing' && 'Nuestra IA está leyendo los RFPs y cruzando información con tu base de conocimientos.'}
          {step === 'complete' && 'Tus documentos han sido procesados. Redirigiendo...'}
        </Text>
      </div>
    );
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#E31837',
          borderRadius: 8,
          colorBgBase: '#000',
        }
      }}
    >
      <Modal
        open={open}
        onCancel={handleCancel}
        footer={null}
        width={900}
        centered
        closable={step === 'idle' || step === 'complete'}
        maskClosable={step === 'idle'}
        styles={{ body: { padding: 0 } }}
        className="premium-upload-modal"
      >
        <div style={{ display: 'flex', height: '550px', background: '#141414', borderRadius: 8, overflow: 'hidden' }}>
          {/* LEFT SIDEBAR */}
          <div style={{
            width: 260,
            background: 'linear-gradient(180deg, #161616 0%, #000000 100%)',
            padding: '40px 24px',
            borderRight: '1px solid #303030',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ marginBottom: 40 }}>
              <Text strong style={{ color: 'white', fontSize: 18, letterSpacing: '1px' }}>TIVIT</Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, display: 'block', letterSpacing: 2 }}>PROPOSALS AI</Text>
            </div>

            <Steps
              direction="vertical"
              current={getCurrentStep()}
              items={stepsItems}
              size="small"
              className="custom-dark-steps"
            />

            <div style={{ marginTop: 'auto' }}>
              <div style={{
                padding: 16,
                background: 'rgba(227, 24, 55, 0.05)',
                borderRadius: 8,
                border: '1px solid rgba(227, 24, 55, 0.1)'
              }}>
                <Text style={{ color: '#E31837', fontSize: 12, fontWeight: 600 }}>Tip Pro</Text>
                <Text style={{ color: '#8c8c8c', fontSize: 11, display: 'block', marginTop: 4 }}>
                  Puedes subir múltiples archivos PDF y Excel simultáneamente para un análisis cruzado.
                </Text>
              </div>
            </div>
          </div>

          {/* RIGHT CONTENT */}
          <div style={{ flex: 1, padding: 40, position: 'relative' }}>
            {renderRightContent()}
          </div>
        </div>
      </Modal>
    </ConfigProvider>
  );
};

export default UploadModal;
