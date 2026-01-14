"""
Service to generate Technical Proposal documents.
Uses Jinja2 for templating and htmldocx for HTML -> DOCX conversion.
"""
import logging
from datetime import datetime
from pathlib import Path
from io import BytesIO

# Nueva librería recomendada
from docxtpl import DocxTemplate

from utils.constantes import Constantes

logger = logging.getLogger(__name__)

# Asegúrate de que template.docx esté en esta ruta
TEMPLATES_DIR = Path(__file__).parent.parent.parent / "templates"

class ProposalGeneratorService:
    """Service to generate proposal documents using Word Templates."""

    def __init__(self):
        self.template_path = TEMPLATES_DIR / "tivit_proposal_template.docx"
        self.certifications_dir = TEMPLATES_DIR / "certs"

    def generate_docx(self, context: dict) -> BytesIO:
        """
        Fills the Word template with data.
        """
        try:
            if not self.template_path.exists():
                raise FileNotFoundError(f"No se encontró la plantilla en {self.template_path}")
                
            doc = DocxTemplate(self.template_path)
            
            # Process subdocs if present
            cert_filenames = context.pop("_certification_filenames", [])
            cert_subdocs = []
            
            for fname in cert_filenames:
                sub_path = self.certifications_dir / fname
                if sub_path.exists():
                    sd = doc.new_subdoc(sub_path)
                    cert_subdocs.append(sd)
                else:
                    logger.warning(f"Certification file not found: {sub_path}")
            
            # Pass the list (even if empty) so the template loop works
            context["certifications_section"] = cert_subdocs
            
            doc.render(context)
            
            file_stream = BytesIO()
            doc.save(file_stream)
            file_stream.seek(0)
            
            return file_stream

        except Exception as e:
            logger.error(f"Error generating DOCX from template: {e}")
            raise



    def prepare_context(self, rfp_data: dict, user_name: str = "", certification_filenames: list[str] = []) -> dict:
        data = rfp_data.get("extracted_data", {}) or {}

        country = data.get("country", "").lower()
        sede_tivit = "TIVIT Latam"
        direccion_tivit = "Dirección General"
        
        # ... (country logic unchanged) ...
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

        # Prepare Subdocs for certifications
        cert_subdocs = []
        # We need an instance of doc for subdoc, but we don't have it here yet.
        # Actually docxtpl strategy: prepare data here, but Subdoc requires the 'doc' object.
        # So we should pass the filenames in context, and create Subdocs inside generate_docx where 'doc' exists.
        
        context = {
            "title": data.get("title", "Propuesta de Servicios TIVIT"),
            "client_acronym": data.get("client_acronym", ""),
            "current_date" : datetime.now().strftime("%d/%m/%Y"),
            "sede_tivit": sede_tivit,
            "direccion_tivit": direccion_tivit,
            "country": country,
            "current_user_name": user_name,
            "summary": data.get("summary", ""),
            # Pass filenames to be processed later
            "_certification_filenames": certification_filenames
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
