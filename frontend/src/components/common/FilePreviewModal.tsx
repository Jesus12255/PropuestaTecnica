import React from 'react';
import { Modal, Button } from 'antd';

interface FilePreviewModalProps {
    visible: boolean;
    onClose: () => void;
    fileUrl: string | null;
    fileName: string;
    fileType?: string;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ visible, onClose, fileUrl, fileName }) => {

    if (!visible) return null;

    // Get auth token
    const token = localStorage.getItem('access_token');

    // Construct authenticated URL
    let authenticatedUrl = fileUrl;
    if (fileUrl && token && !fileUrl.startsWith('blob:')) {
        const separator = fileUrl.includes('?') ? '&' : '?';
        // Ensure we don't duplicate existing fragment if present (handle #page=X)
        const [base, fragment] = fileUrl.split('#');
        authenticatedUrl = `${base}${separator}access_token=${token}`;
        if (fragment) {
            authenticatedUrl += `#${fragment}`;
        }
    }

    return (
        <Modal
            title={`Vista Previa: ${fileName}`}
            open={visible}
            onCancel={onClose}
            footer={[
                <a
                    key="download"
                    href={authenticatedUrl || '#'}
                    download={fileName}
                    style={{ textDecoration: 'none' }}
                >
                    <Button type="primary">
                        Descargar
                    </Button>
                </a>,
                <Button key="close" onClick={onClose}>
                    Cerrar
                </Button>
            ]}
            width="90%"
            style={{ top: 20 }}
            styles={{ body: { height: '85vh', padding: 0, overflow: 'hidden' } }}
            destroyOnClose
        >
            {authenticatedUrl ? (
                <iframe
                    src={authenticatedUrl}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="Vista previa del documento"
                />
            ) : (
                <div style={{ padding: 20, textAlign: 'center' }}>No hay URL válida para previsualizar.</div>
            )}
        </Modal>
    );
};

export default FilePreviewModal;
