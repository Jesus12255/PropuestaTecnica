"""
Cliente para conectar con MCP Talent Search Server.
Permite buscar candidatos reales de TIVIT basado en roles requeridos.
"""
import logging
from typing import Any

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


class MCPTalentClient:
    """Cliente para el servidor MCP de busqueda de talento."""
    
    def __init__(self, base_url: str | None = None):
        """
        Inicializa el cliente MCP.
        
        Args:
            base_url: URL del servidor MCP. Por defecto usa settings.MCP_TALENT_URL
        """
        self.base_url = base_url or settings.MCP_TALENT_URL
        self.timeout = 60.0  # Batch search puede tardar
    
    async def health_check(self) -> bool:
        """
        Verifica si el servidor MCP esta disponible.
        
        Returns:
            True si el servidor responde correctamente
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except Exception as e:
            logger.warning(f"MCP health check failed: {e}")
            return False
    
    async def search_team(self, roles: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Busca candidatos para multiples roles usando batch-search.
        
        Args:
            roles: Lista de roles con formato:
                [
                    {
                        "rol_id": "Dev_Java_Sr",
                        "descripcion": "Java Spring Boot Microservicios",
                        "pais": "Chile",
                        "cantidad": 7
                    }
                ]
        
        Returns:
            Respuesta del MCP con candidatos por rol
        """
        logger.info(f"Searching team for {len(roles)} roles via MCP")
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/batch-search",
                    json={"roles": roles}
                )
                response.raise_for_status()
                result = response.json()
                
                logger.info(
                    f"MCP search completed: {result.get('total_candidatos', 0)} candidates found"
                )
                return result
                
        except httpx.TimeoutException:
            logger.error("MCP request timed out")
            return {
                "exito": False,
                "error": "Timeout al buscar candidatos",
                "resultados": {},
                "total_candidatos": 0
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"MCP HTTP error: {e.response.status_code}")
            return {
                "exito": False,
                "error": f"Error HTTP: {e.response.status_code}",
                "resultados": {},
                "total_candidatos": 0
            }
        except Exception as e:
            logger.error(f"MCP request failed: {e}")
            return {
                "exito": False,
                "error": str(e),
                "resultados": {},
                "total_candidatos": 0
            }
    
    async def search_single(
        self, 
        query: str, 
        limit: int = 10, 
        country: str | None = None
    ) -> dict[str, Any]:
        """
        Busqueda simple de candidatos.
        
        Args:
            query: Descripcion del perfil buscado
            limit: Maximo de resultados
            country: Filtro por pais
        
        Returns:
            Lista de candidatos
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/search",
                    json={
                        "consulta": query,
                        "limit": limit,
                        "pais": country
                    }
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"MCP single search failed: {e}")
            return {
                "exito": False,
                "error": str(e),
                "candidatos": [],
                "total": 0
            }
    
    async def get_countries(self) -> list[str]:
        """
        Obtiene lista de paises disponibles en el MCP.
        
        Returns:
            Lista de paises
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.base_url}/countries")
                response.raise_for_status()
                data = response.json()
                return data.get("paises", [])
        except Exception as e:
            logger.error(f"Failed to get countries: {e}")
            return []


def convert_team_estimation_to_mcp_roles(
    team_estimation: dict[str, Any],
    country: str
) -> list[dict[str, Any]]:
    """
    Convierte team_estimation de Gemini a formato MCP batch-search.
    
    Args:
        team_estimation: Estimacion de equipo generada por Gemini
        country: Pais del RFP
    
    Returns:
        Lista de roles en formato MCP
    """
    mcp_roles = []
    
    roles = team_estimation.get("roles", [])
    
    for role in roles:
        # Construir descripcion con skills y certificaciones
        descripcion_parts = []
        
        # Agregar titulo del rol
        if role.get("title"):
            descripcion_parts.append(role["title"])
        
        # Agregar skills requeridos
        if role.get("required_skills"):
            descripcion_parts.extend(role["required_skills"])
        
        # Agregar certificaciones requeridas
        if role.get("required_certifications"):
            descripcion_parts.extend(role["required_certifications"])
        
        descripcion = " ".join(descripcion_parts)
        
        # Cantidad: pedir mas de los necesarios (minimo 5, o el doble + 3)
        cantidad_requerida = role.get("quantity", 1)
        cantidad_buscar = max(cantidad_requerida * 2 + 3, 5)
        
        mcp_roles.append({
            "rol_id": role.get("role_id", f"Role_{len(mcp_roles) + 1}"),
            "descripcion": descripcion,
            "pais": country,
            "cantidad": cantidad_buscar
        })
    
    return mcp_roles


# Singleton instance
_mcp_client: MCPTalentClient | None = None


def get_mcp_client() -> MCPTalentClient:
    """Get or create MCP client singleton."""
    global _mcp_client
    if _mcp_client is None:
        _mcp_client = MCPTalentClient()
    return _mcp_client
