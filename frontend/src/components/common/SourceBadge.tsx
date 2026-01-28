import React from 'react';
import { Tag, Tooltip } from 'antd';
import { FileTextOutlined, RobotOutlined, LinkOutlined } from '@ant-design/icons';
import type { RFPFile } from '../../types';

export interface SourceBadgeProps {
    /** Origen del dato: "detectado en rfp" o "detectado por ia" */
    source?: string;
    /** Referencia del documento: "NombreArchivo, Pagina X" */
    referenceDocument?: string;
    /** Lista de archivos para buscar la referencia */
    files?: RFPFile[];
    /** Callback para previsualizar archivo */
    onPreviewFile?: (file: RFPFile, page?: number) => void;
}

/**
 * Badge visual que indica el origen de la información:
 * - Azul con icono de documento: extraído del RFP
 * - Morado con icono de robot: inferido por IA
 */
export const SourceBadge: React.FC<SourceBadgeProps> = ({
    source,
    referenceDocument,
    files,
    onPreviewFile
}) => {
    if (!source && !referenceDocument) return null;

    const isFromDocument = source?.toLowerCase().includes('rfp') ||
        source?.toLowerCase().includes('documento') ||
        !!referenceDocument; // Si hay referencia especifica, es documento

    const isFromAI = source?.toLowerCase().includes('ia') ||
        source?.toLowerCase().includes('ai');

    // Intentar parsear referencia para encontrar archivo y página
    let targetFile: RFPFile | undefined;
    let targetPage: number | undefined;
    let isClickable = false;

    if (referenceDocument && files && onPreviewFile) {
        // Formato esperado: "NombreArchivo.ext, Pagina X"
        const parts = referenceDocument.split(',');
        if (parts.length > 0) {
            const filenameRaw = parts[0].trim();
            const filename = filenameRaw.toLowerCase();

            // 0. Check for 'doc_N' pattern
            const docMatch = filename.match(/^doc_(\d+)$/i);
            if (docMatch) {
                const index = parseInt(docMatch[1], 10) - 1;
                if (index >= 0 && index < files.length) {
                    targetFile = files[index];
                }
            }

            // 1. Búsqueda exacta (case-insensitive)
            if (!targetFile) {
                targetFile = files.find(f => (f.nombre || f.filename || '').toLowerCase() === filename);
            }

            // 2. Si no encuentra, intentar buscar por coincidencia parcial
            if (!targetFile) {
                targetFile = files.find(f => {
                    const fName = (f.nombre || f.filename || '').toLowerCase();
                    // Check if one contains the other (ignoring extension potentially)
                    return fName && (fName.includes(filename) || filename.includes(fName));
                });
            }

            // 3. Fallback: ignorar extension
            if (!targetFile) {
                const filenameNoExt = filename.replace(/\.[^/.]+$/, "");
                targetFile = files.find(f => {
                    const fName = (f.nombre || f.filename || '').toLowerCase();
                    const fNameNoExt = fName ? fName.replace(/\.[^/.]+$/, "") : "";
                    return fNameNoExt === filenameNoExt;
                });
            }

            // Si encontramos archivo, analizar página
            if (targetFile && parts.length > 1) {
                const pagePart = parts[1].trim().toLowerCase();
                // Buscar número
                const pageMatch = pagePart.match(/(?:pag|page|página|pg|pág)[^\d]*(\d+)/i);
                if (pageMatch) {
                    targetPage = parseInt(pageMatch[1], 10);
                } else {
                    // Fallback simple number
                    const anyNum = pagePart.match(/(\d+)/);
                    if (anyNum) targetPage = parseInt(anyNum[1], 10);
                }
            }

            if (targetFile) {
                isClickable = true;
            } else {
                console.warn("SourceBadge: No matching file for", referenceDocument, files.map(f => f.nombre || f.filename));
            }
        }
    }

    // Determinar estilo según origen
    const badgeConfig = isFromDocument ? {
        color: '#1890ff',
        backgroundColor: 'rgba(24, 144, 255, 0.1)',
        icon: isClickable ? <LinkOutlined /> : <FileTextOutlined />,
        label: isClickable ? 'Ver Ref' : 'RFP'
    } : isFromAI ? {
        color: '#722ed1',
        backgroundColor: 'rgba(114, 46, 209, 0.1)',
        icon: <RobotOutlined />,
        label: 'IA'
    } : {
        color: '#8c8c8c',
        backgroundColor: 'rgba(140, 140, 140, 0.1)',
        icon: <FileTextOutlined />,
        label: 'Ref'
    };

    const tooltipContent = (
        <div>
            {source && <div><strong>Origen:</strong> {source}</div>}
            {referenceDocument && <div><strong>Referencia:</strong> {referenceDocument}</div>}
            {isClickable && <div style={{ marginTop: 4, fontStyle: 'italic' }}>Haz clic para ver el documento</div>}
        </div>
    );

    return (
        <Tooltip title={tooltipContent}>
            <Tag
                style={{
                    cursor: isClickable ? 'pointer' : 'help',
                    marginLeft: 4,
                    fontSize: 10,
                    padding: '0 6px',
                    borderRadius: 10,
                    border: `1px solid ${badgeConfig.color}`,
                    color: badgeConfig.color,
                    backgroundColor: badgeConfig.backgroundColor,
                    transition: 'all 0.2s'
                }}
                onClick={(e) => {
                    if (isClickable && targetFile && onPreviewFile) {
                        e.stopPropagation();
                        onPreviewFile(targetFile, targetPage);
                    }
                }}
                onMouseEnter={(e) => {
                    if (isClickable) {
                        e.currentTarget.style.opacity = '0.8';
                    }
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1';
                }}
            >
                {badgeConfig.icon}
                <span style={{ marginLeft: 4 }}>
                    {referenceDocument ? (targetPage ? `Pág ${targetPage}` : 'Doc') : badgeConfig.label}
                </span>
            </Tag>
        </Tooltip>
    );
};

export default SourceBadge;
