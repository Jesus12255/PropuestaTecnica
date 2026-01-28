import logging
import os
import tempfile
import pythoncom
from docx2pdf import convert

logger = logging.getLogger(__name__)

def convert_word_to_pdf(content: bytes, filename: str) -> bytes | None:
    """
    Convierte un archivo Word (doc/docx) a PDF.
    Retorna los bytes del PDF o None si falla.
    """
    logger.info(f"Starting conversion for {filename}")
    
    # Preserve extension for Word to recognize format
    ext = os.path.splitext(filename)[1].lower()
    if not ext:
        ext = ".docx"
        
    tmp_doc_path = None
    tmp_pdf_path = None
    
    try:
        # Create temp file
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_doc:
            tmp_doc.write(content)
            tmp_doc_path = tmp_doc.name
            
        tmp_pdf_path = tmp_doc_path.replace(ext, ".pdf")
        
        # Initialize COM for this thread
        pythoncom.CoInitialize()
        
        try:
            # Convert
            convert(tmp_doc_path, tmp_pdf_path)
            
            if os.path.exists(tmp_pdf_path):
                with open(tmp_pdf_path, "rb") as f:
                    pdf_content = f.read()
                logger.info(f"Successfully converted {filename} to PDF ({len(pdf_content)} bytes)")
                return pdf_content
            else:
                logger.error("PDF file was not created")
                return None
                
        finally:
             pythoncom.CoUninitialize()
             
    except Exception as e:
        logger.error(f"Conversion failed for {filename}: {e}")
        return None
        
    finally:
        # Cleanup
        try:
            if tmp_doc_path and os.path.exists(tmp_doc_path):
                os.remove(tmp_doc_path)
            if tmp_pdf_path and os.path.exists(tmp_pdf_path):
                os.remove(tmp_pdf_path)
        except Exception as e:
            logger.warning(f"Cleanup error: {e}")
