"""
CV Vision OCR - Extraccion de texto de imagenes usando Gemini Flash
====================================================================

Este modulo extrae texto de imagenes encontradas en CVs (PDFs/DOCX)
usando el modelo Gemini 2.5 Flash con capacidades de vision.

Uso:
    from cv_vision import extract_text_from_images, ImageText
    
    # Extraer texto de todas las imagenes de un PDF
    results = extract_text_from_images(pdf_path)
    for img_text in results:
        print(f"Pagina {img_text.page_num}: {img_text.text}")
"""

import os
import io
import json
import base64
import hashlib
import logging
from pathlib import Path
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Configuracion
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash-exp"  # Flash con vision
VISION_CACHE_FILE = Path(__file__).parent / "vision_cache.json"
MIN_IMAGE_SIZE = 5000  # Bytes - ignorar imagenes muy pequenas (iconos)
MAX_IMAGES_PER_PDF = 20  # Limite de imagenes por PDF

# Prompt para extraccion de texto
VISION_PROMPT = """Analiza esta imagen de un CV/currículum y extrae TODO el texto visible.

Presta especial atención a:
- Certificaciones y badges (AWS, Azure, Google Cloud, Scrum, PMP, etc.)
- Logos con texto de empresas o tecnologías
- Títulos académicos o diplomas
- Nombres de cursos o capacitaciones
- Fechas y períodos
- Cualquier texto relevante para el perfil profesional

Responde SOLO con el texto extraído, sin explicaciones adicionales.
Si no hay texto legible, responde "SIN_TEXTO".
"""


@dataclass
class ImageText:
    """Texto extraido de una imagen."""
    page_num: int
    image_index: int
    text: str
    image_hash: str  # Para cache


def _get_image_hash(image_bytes: bytes) -> str:
    """Genera hash MD5 de la imagen para cache."""
    return hashlib.md5(image_bytes).hexdigest()


def _load_cache() -> Dict[str, str]:
    """Carga cache de textos ya extraidos."""
    if VISION_CACHE_FILE.exists():
        try:
            with open(VISION_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Error cargando cache de vision: {e}")
    return {}


def _save_cache(cache: Dict[str, str]) -> None:
    """Guarda cache de textos extraidos."""
    try:
        with open(VISION_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"Error guardando cache de vision: {e}")


def _call_gemini_vision(image_bytes: bytes) -> Optional[str]:
    """
    Llama a Gemini Flash con una imagen y retorna el texto extraido.
    """
    if not GOOGLE_API_KEY:
        logger.error("GOOGLE_API_KEY no configurada")
        return None
    
    try:
        import httpx
        
        # Convertir imagen a base64
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        
        # Detectar tipo de imagen
        if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
            mime_type = "image/png"
        elif image_bytes[:2] == b'\xff\xd8':
            mime_type = "image/jpeg"
        else:
            mime_type = "image/png"  # Default
        
        # Request a Gemini
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GOOGLE_API_KEY}"
        
        payload = {
            "contents": [{
                "parts": [
                    {"text": VISION_PROMPT},
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": image_b64
                        }
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 1024
            }
        }
        
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            
            data = response.json()
            
            # Extraer texto de la respuesta
            if "candidates" in data and len(data["candidates"]) > 0:
                candidate = data["candidates"][0]
                if "content" in candidate and "parts" in candidate["content"]:
                    parts = candidate["content"]["parts"]
                    if len(parts) > 0 and "text" in parts[0]:
                        text = parts[0]["text"].strip()
                        # Filtrar respuestas que indican que no hay texto
                        if text and text not in ["SIN_TEXTO", "SIN_TEXT", "NO_TEXT", ""]:
                            return text
            
            return None
            
    except Exception as e:
        logger.error(f"Error llamando a Gemini Vision: {e}")
        return None


def extract_images_from_pdf(pdf_path: Path) -> List[tuple]:
    """
    Extrae imagenes de un PDF.
    Retorna lista de (page_num, image_index, image_bytes).
    """
    images = []
    
    try:
        import fitz  # PyMuPDF
        
        doc = fitz.open(pdf_path)
        
        for page_num, page in enumerate(doc, 1):
            image_list = page.get_images(full=True)
            
            for img_index, img_info in enumerate(image_list):
                try:
                    xref = img_info[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    
                    # Filtrar imagenes muy pequenas (iconos, bullets, etc.)
                    if len(image_bytes) < MIN_IMAGE_SIZE:
                        continue
                    
                    images.append((page_num, img_index, image_bytes))
                    
                    if len(images) >= MAX_IMAGES_PER_PDF:
                        logger.info(f"Limite de {MAX_IMAGES_PER_PDF} imagenes alcanzado para {pdf_path.name}")
                        break
                        
                except Exception as e:
                    logger.warning(f"Error extrayendo imagen {img_index} de pagina {page_num}: {e}")
                    continue
            
            if len(images) >= MAX_IMAGES_PER_PDF:
                break
        
        doc.close()
        
    except Exception as e:
        logger.error(f"Error procesando PDF {pdf_path}: {e}")
    
    return images


def extract_images_from_docx(docx_path: Path) -> List[tuple]:
    """
    Extrae imagenes de un DOCX.
    Retorna lista de (page_num, image_index, image_bytes).
    Nota: DOCX no tiene concepto de pagina, usamos 0.
    """
    images = []
    
    try:
        from docx import Document
        import zipfile
        
        # DOCX es un ZIP, las imagenes estan en word/media/
        with zipfile.ZipFile(docx_path, 'r') as zip_ref:
            media_files = [f for f in zip_ref.namelist() if f.startswith('word/media/')]
            
            for img_index, media_file in enumerate(media_files):
                try:
                    image_bytes = zip_ref.read(media_file)
                    
                    # Filtrar imagenes muy pequenas
                    if len(image_bytes) < MIN_IMAGE_SIZE:
                        continue
                    
                    # Solo imagenes (no otros media)
                    if not any(media_file.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.bmp']):
                        continue
                    
                    images.append((0, img_index, image_bytes))  # page_num=0 para DOCX
                    
                    if len(images) >= MAX_IMAGES_PER_PDF:
                        break
                        
                except Exception as e:
                    logger.warning(f"Error extrayendo imagen {media_file}: {e}")
                    continue
                    
    except Exception as e:
        logger.error(f"Error procesando DOCX {docx_path}: {e}")
    
    return images


def extract_text_from_images(
    file_path: Path,
    use_cache: bool = True
) -> List[ImageText]:
    """
    Extrae texto de todas las imagenes de un CV (PDF o DOCX).
    
    Args:
        file_path: Ruta al archivo PDF o DOCX
        use_cache: Si usar cache de textos ya extraidos
    
    Returns:
        Lista de ImageText con el texto extraido de cada imagen
    """
    results = []
    cache = _load_cache() if use_cache else {}
    cache_updated = False
    
    # Determinar tipo de archivo
    suffix = file_path.suffix.lower()
    
    if suffix == ".pdf":
        images = extract_images_from_pdf(file_path)
    elif suffix in [".docx", ".doc"]:
        images = extract_images_from_docx(file_path)
    else:
        logger.warning(f"Formato no soportado para vision: {suffix}")
        return results
    
    if not images:
        logger.debug(f"No se encontraron imagenes relevantes en {file_path.name}")
        return results
    
    logger.info(f"Procesando {len(images)} imagenes de {file_path.name} con Gemini Vision...")
    
    for page_num, img_index, image_bytes in images:
        image_hash = _get_image_hash(image_bytes)
        
        # Verificar cache
        if use_cache and image_hash in cache:
            text = cache[image_hash]
            logger.debug(f"  Cache hit para imagen {img_index} de pagina {page_num}")
        else:
            # Llamar a Gemini Vision
            text = _call_gemini_vision(image_bytes)
            
            if text:
                cache[image_hash] = text
                cache_updated = True
                logger.info(f"  Extraido texto de imagen {img_index} (pag {page_num}): {text[:50]}...")
            else:
                # Guardar en cache como vacio para no reprocesar
                cache[image_hash] = ""
                cache_updated = True
        
        if text:
            results.append(ImageText(
                page_num=page_num,
                image_index=img_index,
                text=text,
                image_hash=image_hash
            ))
    
    # Guardar cache si hubo cambios
    if cache_updated:
        _save_cache(cache)
    
    return results


def process_cv_with_vision(file_path: Path) -> str:
    """
    Procesa un CV y retorna todo el texto de imagenes concatenado.
    Util para agregar al texto principal del CV.
    
    Returns:
        String con todo el texto extraido de imagenes, separado por newlines
    """
    image_texts = extract_text_from_images(file_path)
    
    if not image_texts:
        return ""
    
    # Concatenar todos los textos
    all_texts = []
    for img_text in image_texts:
        prefix = f"[Imagen pag.{img_text.page_num}]" if img_text.page_num > 0 else "[Imagen]"
        all_texts.append(f"{prefix} {img_text.text}")
    
    return "\n".join(all_texts)


# ============================================
# CLI para pruebas
# ============================================

if __name__ == "__main__":
    import sys
    
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    
    if len(sys.argv) < 2:
        print("Uso: python cv_vision.py <archivo.pdf|archivo.docx>")
        print("\nEjemplo:")
        print("  python cv_vision.py cvs/JUAN_PEREZ.pdf")
        sys.exit(1)
    
    file_path = Path(sys.argv[1])
    
    if not file_path.exists():
        print(f"Error: Archivo no encontrado: {file_path}")
        sys.exit(1)
    
    print(f"\nProcesando: {file_path.name}")
    print("=" * 50)
    
    # Extraer texto de imagenes
    results = extract_text_from_images(file_path, use_cache=True)
    
    if not results:
        print("No se encontraron imagenes con texto en el archivo.")
    else:
        print(f"\nSe encontraron {len(results)} imagenes con texto:\n")
        
        for img_text in results:
            print(f"--- Pagina {img_text.page_num}, Imagen {img_text.image_index} ---")
            print(img_text.text)
            print()
    
    # Mostrar texto combinado
    combined = process_cv_with_vision(file_path)
    if combined:
        print("\n" + "=" * 50)
        print("TEXTO COMBINADO PARA INDEXACION:")
        print("=" * 50)
        print(combined)
