"""
Servicio para parsing estructurado de documentos.
Especializado en mejorar la ingesta para LLMs (Excel -> Markdown).
"""
import logging
import io
import pandas as pd
from typing import Any

logger = logging.getLogger(__name__)

class StructuredParserService:
    """Servicio para convertir documentos complejos en formatos estructurados para LLMs."""

    def parse_excel(self, content: bytes, filename: str) -> str:
        """
        Convierte un archivo Excel en una representación Markdown optimizada para LLMs.
        Preserva hojas, encabezados y estructura tabular.
        """
        try:
            logger.info(f"Parsing Excel file: {filename}")
            
            # Cargar todas las hojas
            xls = pd.ExcelFile(io.BytesIO(content))
            
            output_parts = []
            output_parts.append(f"# DOCUMENTO EXCEL: {filename}")
            
            for sheet_name in xls.sheet_names:
                output_parts.append(f"\n## HOJA: {sheet_name}")
                
                # Leer hoja
                # header=None para detectar headers dinámicamente o usar la primera fila
                df = pd.read_excel(xls, sheet_name=sheet_name)
                
                # Limpieza básica
                # Eliminar filas/columnas totalmente vacías
                df = df.dropna(how='all', axis=0)
                df = df.dropna(how='all', axis=1)
                
                if df.empty:
                    output_parts.append("(Hoja vacía)")
                    continue
                
                # Convertir a Markdown
                # index=False reduce ruido si el índice no es semántico
                markdown_table = df.to_markdown(index=False, tablefmt="github")
                
                output_parts.append(markdown_table)
            
            return "\n".join(output_parts)
            
        except Exception as e:
            logger.error(f"Error parsing Excel {filename}: {e}")
            return f"Error al procesar Excel: {str(e)}"

# Singleton
_parser_service: StructuredParserService | None = None

def get_parser_service() -> StructuredParserService:
    global _parser_service
    if _parser_service is None:
        _parser_service = StructuredParserService()
    return _parser_service
