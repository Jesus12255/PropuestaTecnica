import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
// import { DocRenderer } from "@cyntler/react-doc-viewer"; // Removed due to export error

interface DocRendererProps {
    mainState: {
        currentDocument?: {
            uri?: string;
            fileData?: string | ArrayBuffer | Blob;
            fileName?: string;
            fileType?: string;
        };
    };
}

const DocxRenderer: React.FC<DocRendererProps> & { fileTypes: string[]; weight: number } = ({ mainState: { currentDocument } }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!currentDocument || !containerRef.current) return;

        const renderDoc = async () => {
            try {
                let blob: Blob;

                // Si ya tenemos data/blob (no siempre disponible directamente en currentDocument dependiendo de la lib)
                if (currentDocument.fileData) {
                    blob = new Blob([currentDocument.fileData]);
                } else if (currentDocument.uri) {
                    // Fetch blob si es una URL (local blob url o remote)
                    const response = await fetch(currentDocument.uri);
                    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
                    blob = await response.blob();
                } else {
                    return;
                }

                if (containerRef.current) {
                    containerRef.current.innerHTML = ""; // Limpiar
                    console.log("Rendering DOCX blob of size:", blob.size);

                    if (blob.size === 0) {
                        throw new Error("El archivo está vacío (0 bytes).");
                    }

                    // INSPECCIÓN Y AUTO-CORRECCIÓN DE BASE64
                    const textHeader = await blob.slice(0, 50).text();
                    console.log("File header (first 50 chars):", textHeader);

                    // Si empieza con "UEsDB", es casi seguro un ZIP en Base64
                    // Check also for data:application... which is a Data URI
                    if (textHeader.startsWith("UEsDB") || textHeader.startsWith("data:")) {
                        console.warn("DETECTED BASE64/DATA URI ENCODED FILE! decoding...");
                        try {
                            let base64Text = await blob.text();

                            // Handle Data URI
                            if (base64Text.startsWith("data:")) {
                                console.log("Is Data URI, stripping header...");
                                const parts = base64Text.split(",");
                                if (parts.length > 1) {
                                    base64Text = parts[1]; // Get only the base64 part key
                                }
                            }

                            // Limpiar posibles espacios o newlines
                            const cleanBase64 = base64Text.trim();
                            const binaryString = atob(cleanBase64);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }
                            blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                            console.log("Successfully decoded Base64 blob to binary. New size:", blob.size);
                        } catch (decodeErr) {
                            console.error("Failed to decode Base64:", decodeErr);
                        }
                    } else if (!textHeader.startsWith("PK")) {
                        console.warn("File does not start with PK (Zip signature). It might be corrupted or raw text.");
                    }

                    await renderAsync(blob, containerRef.current, undefined, {
                        inWrapper: false,
                        ignoreWidth: false,
                        ignoreHeight: false,
                        ignoreFonts: false,
                        breakPages: true,
                        ignoreLastRenderedPageBreak: true,
                        experimental: true,
                        trimXmlDeclaration: true,
                        useBase64URL: true,
                        debug: true,
                    });
                }
            } catch (err: any) {
                console.error("Error rendering DOCX:", err);
                const msg = err instanceof Error ? err.message : String(err);
                setError(`No se pudo visualizar el documento DOCX. Detalle: ${msg}`);
            }
        };

        renderDoc();
    }, [currentDocument]);

    if (!currentDocument) return null;

    return (
        <div
            id="docx-renderer"
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                overflow: 'auto',
                backgroundColor: '#f0f2f5', // Slightly gray background to pop the pages
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}
        >
            {/* Warning Banner */}
            {!error && (
                <div style={{
                    marginBottom: '16px',
                    padding: '8px 16px',
                    backgroundColor: '#fffbe6',
                    border: '1px solid #ffe58f',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#faad14',
                    width: 'fit-content',
                    maxWidth: '100%',
                    textAlign: 'center'
                }}>
                    ⚠️ <strong>Vista Previa Aproximada:</strong> El formato puede variar respecto al original. Para ver el diseño exacto, por favor descargue el archivo.
                </div>
            )}

            {error && (
                <div style={{ color: 'red', textAlign: 'center', padding: 20 }}>
                    <p style={{ fontWeight: 'bold' }}>{error}</p>
                    <p style={{ fontSize: '12px', color: '#666' }}>Intenta descargar el archivo para verificar su integridad. <br /> {error}</p>
                </div>
            )}

            {/* Custom Styles for styling the docx-preview output */}
            <style>{`
                /* Target the wrapper of docx-preview */
                .docx-wrapper {
                    background: transparent !important; 
                    padding: 0 !important;
                }
                /* Target the pages */
                .docx-wrapper > section.docx {
                    /* background: white !important;  <-- Removed to allow doc background */
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    margin-bottom: 20px !important;
                    /* padding: 40px !important; <-- Removed to respect doc margins */
                }
            `}</style>
        </div>
    );
};

export default DocxRenderer;

DocxRenderer.fileTypes = ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
DocxRenderer.weight = 1;
