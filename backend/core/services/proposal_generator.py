"""
Service to generate Technical Proposal documents.
Uses Jinja2 for templating and htmldocx for HTML -> DOCX conversion.
"""
from models.rfp import RFPSubmission
import logging
import tempfile
import os
from datetime import datetime
from pathlib import Path
from io import BytesIO

# Nueva librería recomendada
from docxtpl import DocxTemplate

from utils.constantes import Constantes
from core.storage.hybrid_storage import get_storage_service

logger = logging.getLogger(__name__)

# Asegúrate de que template.docx esté en esta ruta
TEMPLATES_DIR = Path(__file__).parent.parent.parent / "templates"

class ProposalGeneratorService:
    """Service to generate proposal documents using Word Templates."""

    def __init__(self):
        self.template_path = TEMPLATES_DIR / "tivit_proposal_template.docx"
        self.certifications_dir = TEMPLATES_DIR / "certs"
        self.storage_service = get_storage_service()

    def generate_docx(self, context: dict) -> BytesIO:
        """
        Fills the Word template with data.
        """
        temp_files = []
        try:
            if not self.template_path.exists():
                raise FileNotFoundError(f"No se encontró la plantilla en {self.template_path}")
                
            doc = DocxTemplate(self.template_path)
            
            # Process subdocs if present
            cert_locations = context.pop("_certification_locations", [])
            cert_subdocs = []
            
            for uri in cert_locations:
                try:
                    # Create a temporary file
                    # delete=False because we need to close it before docxtpl reads it (on Windows especially)
                    fd, temp_path = tempfile.mkstemp(suffix=".docx")
                    os.close(fd)
                    temp_files.append(temp_path)
                    
                    logger.info(f"Downloading certification from {uri} to {temp_path}")
                    
                    # Download file content
                    content = self.storage_service.download_file(uri)
                    
                    # Write to temp file
                    with open(temp_path, "wb") as f:
                        f.write(content)
                        
                    # Create subdoc
                    sd = doc.new_subdoc(temp_path)
                    cert_subdocs.append(sd)
                    
                except Exception as e:
                    logger.error(f"Error processing certification {uri}: {e}")
                    # Continue with other certifications even if one fails
            
            # Pass the list (even if empty) so the template loop works
            context["certifications_section"] = cert_subdocs

            # Process chapter subdocs
            chap_locations = context.pop("_chapter_locations", [])
            chap_subdocs = []
            
            for uri in chap_locations:
                try:
                    fd, temp_path = tempfile.mkstemp(suffix=".docx")
                    os.close(fd)
                    temp_files.append(temp_path)
                    
                    logger.info(f"Downloading chapter from {uri} to {temp_path}")
                    content = self.storage_service.download_file(uri)
                    
                    with open(temp_path, "wb") as f:
                        f.write(content)
                        
                    sd = doc.new_subdoc(temp_path)
                    chap_subdocs.append(sd)
                    
                except Exception as e:
                    logger.error(f"Error processing chapter {uri}: {e}")

            context["chapters_section"] = chap_subdocs
            
            doc.render(context)
            
            file_stream = BytesIO()
            doc.save(file_stream)
            file_stream.seek(0)
            
            return file_stream

        except Exception as e:
            logger.error(f"Error generating DOCX from template: {e}")
            raise
        finally:
            # Cleanup temp files
            for path in temp_files:
                try:
                    if os.path.exists(path):
                        os.unlink(path)
                except Exception as e:
                    logger.warning(f"Failed to delete temp file {path}: {e}")



    def prepare_context(self, rfp_data: dict, rfp: RFPSubmission, user_name: str = "", certification_locations: list[str] = [], experiences: list = [], chapter_locations: list[str] = []) -> dict:
        # Extract the combined data dictionary which contains merged DB and JSON fields
        data = rfp_data.get("extracted_data", {}) or {}

        country = (rfp.country or "").lower()
        sede_tivit = "TIVIT Latam"
        direccion_tivit = "Dirección General"
        
        if Constantes.Countries.PERU in country:
            sede_tivit = "TIVIT Perú Tercerización de Procesos, Servicios y Tecnología S.A.C."
            direccion_tivit = "Av. Antonio Miró Quesada 425, Piso 18, Oficina 1811, Magdalena del Mar, Lima, Perú"
        elif Constantes.Countries.CHILE in country:
            sede_tivit = "TIVIT Chile Tercerización de Procesos, Servicios y Tecnología SpA"
            direccion_tivit = "Av. Los Jardines 927, Ciudad Empresarial, Huechuraba, Santiago, Chile"
        elif Constantes.Countries.ARGENTINA in country:
            sede_tivit = "TIVIT Argentina S.A."
            direccion_tivit = "Olga Cossettini 1545, Piso 1, Puerto Madero, C1107CEK, Buenos Aires, Argentina"
        elif Constantes.Countries.COLOMBIA in country:
            sede_tivit = "TIVIT Colombia S.A.S."
            direccion_tivit = "Carrera 7 # 71-21, Torre B, Piso 12, Bogotá, Colombia"
        elif Constantes.Countries.BRAZIL in country:
            sede_tivit = "TIVIT Terceirização de Processos, Serviços e Tecnologia S.A."
            direccion_tivit = "Rua Bento Branco de Andrade Filho, 621, Jardim Dom Bosco, São Paulo, SP, Brasil"
        elif Constantes.Countries.ECUADOR in country:
            sede_tivit = "TIVIT Ecuador Cía. Ltda."
            direccion_tivit = "Av. República de El Salvador N34-127 y Suiza, Edificio Murano, Piso 9, Quito, Ecuador"

        # Formatear experiencias
        formatted_experiences = []
        for idx, exp in enumerate(experiences, 1):
            formatted_experiences.append({
                "item": idx,
                "descripcion": exp.descripcion_servicio,
                "propietario": exp.propietario_servicio,
                "ubicacion": exp.ubicacion,
                "inicio": exp.fecha_inicio.strftime("%Y") if exp.fecha_inicio else "",
                "fin": exp.fecha_fin.strftime("%Y") if exp.fecha_fin else "Actualidad",
                "monto": f"{exp.monto_final:,.2f}" if exp.monto_final else "N/A"
            })

        context = {
            "title": data.get("title", "Propuesta de Servicios TIVIT"),
            "client_acronym": data.get("client_acronym", ""),
            "current_date" : datetime.now().strftime("%d/%m/%Y"),
            "sede_tivit": sede_tivit,
            "direccion_tivit": direccion_tivit,
            "country": country,
            "current_user_name": user_name,
            "summary": data.get("summary", ""),
            "tvt": rfp.tvt or "######",
            "_certification_locations": certification_locations,
            "_chapter_locations": chapter_locations,
            "experiencias": formatted_experiences
        }
        
        # Mezclar todo por si acaso
        context.update(data)
        
        return context


# Singleton instance
_proposal_service: ProposalGeneratorService | None = None


def get_proposal_generator() -> ProposalGeneratorService:
    """Get or create proposal generator singleton."""
    global _proposal_service
    if _proposal_service is None:
        _proposal_service = ProposalGeneratorService()
    return _proposal_service
