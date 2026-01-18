"""
Cliente para Gemini via Google Gen AI SDK.
Usa API Key para autenticación directa con Gemini 3 Pro.
"""
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from google import genai
from google.genai import types
import asyncio

from core.config import settings

logger = logging.getLogger(__name__)


# Precios por 1M de tokens (USD) - Gemini 3 y 2.5 (Enero 2026)
# Fuente: https://ai.google.dev/gemini-api/docs/pricing
PRICING = {
    # Gemini 3 - Modelos más recientes y potentes
    "gemini-3-pro-preview": {
        "input": 2.00,      # $2.00 / 1M input tokens (<=200K), $4.00 (>200K)
        "output": 12.00,    # $12.00 / 1M output tokens (<=200K), $18.00 (>200K)
        "thinking": 12.00,  # Tokens de pensamiento incluidos en output
    },
    "gemini-3-flash-preview": {
        "input": 0.50,      # $0.50 / 1M input tokens
        "output": 3.00,     # $3.00 / 1M output tokens
        "thinking": 3.00,   # Tokens de pensamiento incluidos en output
    },
    # Gemini 2.5 - Modelos estables
    "gemini-2.5-pro-preview": {
        "input": 1.25,      # $1.25 / 1M input tokens (<=200K), $2.50 (>200K)
        "output": 10.00,    # $10.00 / 1M output tokens (<=200K), $15.00 (>200K)
    },
    "gemini-2.5-flash-preview": {
        "input": 0.30,      # $0.30 / 1M input tokens
        "output": 2.50,     # $2.50 / 1M output tokens
    },
    "gemini-2.0-flash": {
        "input": 0.10,      # $0.10 / 1M input tokens
        "output": 0.40,     # $0.40 / 1M output tokens
    },
    # Fallback para modelos no listados
    "default": {
        "input": 2.00,
        "output": 12.00,
    }
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int, thinking_tokens: int = 0) -> float:
    """Calcula el costo en USD basado en tokens consumidos."""
    pricing = PRICING.get(model, PRICING["default"])
    
    cost = (
        (input_tokens / 1_000_000) * pricing["input"] +
        (output_tokens / 1_000_000) * pricing["output"]
    )
    
    # Thinking tokens solo para modelos que lo soporten (futuro)
    if thinking_tokens > 0 and "thinking" in pricing:
        cost += (thinking_tokens / 1_000_000) * pricing["thinking"]
    
    return cost


@dataclass
class APIConsumptionLog:
    """Registro de consumo de API."""
    timestamp: datetime
    model: str
    operation: str
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    thinking_tokens: int = 0
    latency_ms: float = 0
    cost_usd: float = 0.0
    success: bool = True
    error: str | None = None
    
    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "model": self.model,
            "operation": self.operation,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "thinking_tokens": self.thinking_tokens,
            "latency_ms": round(self.latency_ms, 2),
            "cost_usd": round(self.cost_usd, 6),
            "success": self.success,
            "error": self.error,
        }


@dataclass
class ConsumptionTracker:
    """Tracker para monitorear consumo total de API."""
    logs: list[APIConsumptionLog] = field(default_factory=list)
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_thinking_tokens: int = 0
    total_requests: int = 0
    failed_requests: int = 0
    total_cost_usd: float = 0.0
    
    def add_log(self, log: APIConsumptionLog):
        """Agrega un log y actualiza totales."""
        self.logs.append(log)
        self.total_requests += 1
        
        if log.success:
            self.total_input_tokens += log.input_tokens
            self.total_output_tokens += log.output_tokens
            self.total_thinking_tokens += log.thinking_tokens
            self.total_cost_usd += log.cost_usd
        else:
            self.failed_requests += 1
        
        # Log to console
        self._log_to_console(log)
    
    def _log_to_console(self, log: APIConsumptionLog):
        """Imprime log formateado en consola."""
        status = "✅ SUCCESS" if log.success else "❌ FAILED"
        logger.info(
            f"\n{'='*70}\n"
            f"💎 GEMINI API CONSUMPTION LOG\n"
            f"{'='*70}\n"
            f"📅 Timestamp: {log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"🔧 Operation: {log.operation}\n"
            f"🤖 Model: {log.model}\n"
            f"📊 Status: {status}\n"
            f"⏱️  Latency: {log.latency_ms:.2f}ms\n"
            f"{'─'*70}\n"
            f"📥 Input Tokens:    {log.input_tokens:>10,}\n"
            f"📤 Output Tokens:   {log.output_tokens:>10,}\n"
            f"🧠 Thinking Tokens: {log.thinking_tokens:>10,}\n"
            f"📊 Total Tokens:    {log.total_tokens:>10,}\n"
            f"{'─'*70}\n"
            f"💵 THIS REQUEST COST: ${log.cost_usd:.6f} USD\n"
            f"{'─'*70}\n"
            f"📈 SESSION TOTALS:\n"
            f"   Requests: {self.total_requests} (Failed: {self.failed_requests})\n"
            f"   Input:    {self.total_input_tokens:,} tokens\n"
            f"   Output:   {self.total_output_tokens:,} tokens\n"
            f"   Thinking: {self.total_thinking_tokens:,} tokens\n"
            f"   💰 TOTAL SESSION COST: ${self.total_cost_usd:.6f} USD\n"
            f"{'='*70}\n"
        )
    
    def get_summary(self) -> dict:
        """Retorna resumen de consumo."""
        return {
            "total_requests": self.total_requests,
            "failed_requests": self.failed_requests,
            "success_rate": (
                (self.total_requests - self.failed_requests) / self.total_requests * 100
                if self.total_requests > 0 else 0
            ),
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_thinking_tokens": self.total_thinking_tokens,
            "total_tokens": self.total_input_tokens + self.total_output_tokens + self.total_thinking_tokens,
            "total_cost_usd": round(self.total_cost_usd, 6),
            "recent_logs": [log.to_dict() for log in self.logs[-10:]],
        }


# Tracker global
consumption_tracker = ConsumptionTracker()


# Configuraciones de modo de análisis - Gemini 3 Family
ANALYSIS_MODES = {
    "fast": {
        "model": "gemini-3-flash-preview",
        "temperature": 0.2,
        "max_output_tokens": 8192,
        "description": "Análisis rápido con Gemini 3 Flash",
    },
    "balanced": {
        "model": "gemini-3-pro-preview",
        "temperature": 0.1,
        "max_output_tokens": 8192,
        "description": "Análisis equilibrado con Gemini 3 Pro",
    },
    "deep": {
        "model": "gemini-3-pro-preview",
        "temperature": 0.05,
        "max_output_tokens": 16384,
        "description": "Análisis profundo con Gemini 3 Pro (máxima calidad)",
    },
}


class GeminiClient:
    """Cliente para interactuar con Gemini via Google Gen AI SDK."""
    
    def __init__(self):
        """Inicializa el cliente de Gemini con API Key."""
        # Obtener API Key
        api_key = settings.GOOGLE_API_KEY
        if not api_key:
            raise ValueError("GOOGLE_API_KEY no configurado")
        
        # Crear cliente con API Key
        self.client = genai.Client(api_key=api_key)
        
        # Usar modelo Gemini 3 Pro
        self.model_id = settings.GEMINI_MODEL
        
        logger.info(f"Gemini client initialized with API Key")
        logger.info(f"Gemini model: {self.model_id}")
    
    def _extract_json_from_text(self, text: str | None) -> Any:
        """
        Extrae JSON válido de un texto que puede contener datos extra.
        Maneja casos donde Gemini devuelve JSON con texto adicional.
        """
        if text is None:
            raise ValueError("Response text is None - model may have returned empty response")
        
        text = text.strip()
        
        # Primero intentar parsear directamente
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        
        # Buscar array JSON
        if '[' in text:
            start = text.find('[')
            # Encontrar el cierre correspondiente
            depth = 0
            for i, char in enumerate(text[start:], start):
                if char == '[':
                    depth += 1
                elif char == ']':
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start:i+1])
                        except json.JSONDecodeError:
                            break
        
        # Buscar objeto JSON
        if '{' in text:
            start = text.find('{')
            depth = 0
            for i, char in enumerate(text[start:], start):
                if char == '{':
                    depth += 1
                elif char == '}':
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start:i+1])
                        except json.JSONDecodeError:
                            break
        
        # Último intento: buscar con regex
        json_pattern = r'(\[[\s\S]*\]|\{[\s\S]*\})'
        matches = re.findall(json_pattern, text)
        for match in matches:
            try:
                return json.loads(match)
            except json.JSONDecodeError:
                continue
        
        # Si nada funciona, lanzar error
        raise json.JSONDecodeError("No valid JSON found", text, 0)
    
    def _extract_token_counts(self, response) -> tuple[int, int, int]:
        """Extrae conteo de tokens de la respuesta."""
        input_tokens = 0
        output_tokens = 0
        thinking_tokens = 0
        
        try:
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                metadata = response.usage_metadata
                input_tokens = getattr(metadata, 'prompt_token_count', 0) or 0
                output_tokens = getattr(metadata, 'candidates_token_count', 0) or 0
                thinking_tokens = getattr(metadata, 'thoughts_token_count', 0) or 0
        except Exception as e:
            logger.warning(f"Could not extract token counts: {e}")
        
        return input_tokens, output_tokens, thinking_tokens
    
    async def analyze_document(
        self, 
        document_content: str,
        prompt: str,
        temperature: float = 0.1,
        max_output_tokens: int = 8192,
        analysis_mode: Literal["fast", "balanced", "deep"] = "balanced",
    ) -> dict[str, Any]:
        """
        Analiza un documento con Gemini via API Key.
        
        Args:
            document_content: Contenido del documento (texto extraído)
            prompt: Prompt para el análisis
            temperature: Temperatura para generación (ignorada si se usa analysis_mode)
            max_output_tokens: Máximo de tokens de salida (ignorado si se usa analysis_mode)
            analysis_mode: Modo de análisis (fast/balanced/deep)
            
        Returns:
            Dict con el resultado del análisis parseado desde JSON
        """
        # Obtener configuración del modo
        mode_config = ANALYSIS_MODES.get(analysis_mode, ANALYSIS_MODES["balanced"])
        model_to_use = mode_config["model"]
        temp_to_use = mode_config["temperature"]
        max_tokens = mode_config["max_output_tokens"]
        
        start_time = time.time()
        log = APIConsumptionLog(
            timestamp=datetime.now(),
            model=model_to_use,
            operation=f"analyze_document ({analysis_mode})",
        )
        
        try:
            # Construir prompt completo
            full_prompt = f"""
{prompt}

DOCUMENTO A ANALIZAR:
---
{document_content}
---

Responde ÚNICAMENTE con JSON válido siguiendo el schema indicado.
"""
            
            logger.info(f"Analyzing document with Gemini API")
            logger.info(f"  Mode: {analysis_mode} ({mode_config['description']})")
            logger.info(f"  Model: {model_to_use}")
            logger.info(f"  Temperature: {temp_to_use}")
            
            # Generar contenido usando la nueva API
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=model_to_use,
                contents=full_prompt,
                config={
                    "temperature": temp_to_use,
                    "max_output_tokens": max_tokens,
                    "response_mime_type": "application/json",
                },
            )
            
            # Extraer tokens
            input_tokens, output_tokens, thinking_tokens = self._extract_token_counts(response)
            log.input_tokens = input_tokens
            log.output_tokens = output_tokens
            log.thinking_tokens = thinking_tokens
            log.total_tokens = input_tokens + output_tokens + thinking_tokens
            
            # Calcular costo
            log.cost_usd = calculate_cost(model_to_use, input_tokens, output_tokens, thinking_tokens)
            
            # Parsear respuesta JSON
            result = json.loads(response.text)
            
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = True
            consumption_tracker.add_log(log)
            
            logger.info("Document analysis completed successfully")
            return result
            
        except json.JSONDecodeError as e:
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = False
            log.error = f"Invalid JSON: {str(e)}"
            consumption_tracker.add_log(log)
            
            logger.error(f"Failed to parse Gemini response as JSON: {e}")
            # Intentar extraer JSON de la respuesta
            if 'response' in dir() and hasattr(response, 'text'):
                return {"raw_response": response.text, "error": "Invalid JSON response"}
            return {"error": "Invalid JSON response"}
            
        except Exception as e:
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = False
            log.error = str(e)
            consumption_tracker.add_log(log)
            
            logger.error(f"Error analyzing document: {e}")
            raise
    
    async def analyze_pdf_bytes(
        self,
        pdf_bytes: bytes,
        prompt: str,
        temperature: float = 0.1,
        max_output_tokens: int = 8192,
    ) -> dict[str, Any]:
        """
        Analiza un PDF directamente desde bytes con Gemini.
        
        Args:
            pdf_bytes: Contenido del PDF en bytes
            prompt: Prompt para el análisis
            temperature: Temperatura para generación
            max_output_tokens: Máximo de tokens de salida
            
        Returns:
            Dict con el resultado del análisis
        """
        start_time = time.time()
        log = APIConsumptionLog(
            timestamp=datetime.now(),
            model=self.model_id,
            operation="analyze_pdf_bytes",
        )
        
        try:
            logger.info(f"Analyzing PDF with Gemini API ({self.model_id})")
            
            # Crear parte con el PDF usando types.Part
            pdf_part = types.Part.from_bytes(
                data=pdf_bytes,
                mime_type="application/pdf",
            )
            
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_id,
                contents=[pdf_part, prompt],
                config={
                    "temperature": temperature,
                    "max_output_tokens": max_output_tokens,
                    "response_mime_type": "application/json",
                },
            )
            
            input_tokens, output_tokens, thinking_tokens = self._extract_token_counts(response)
            log.input_tokens = input_tokens
            log.output_tokens = output_tokens
            log.thinking_tokens = thinking_tokens
            log.total_tokens = input_tokens + output_tokens + thinking_tokens
            log.cost_usd = calculate_cost(self.model_id, input_tokens, output_tokens, thinking_tokens)
            
            result = json.loads(response.text)
            
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = True
            consumption_tracker.add_log(log)
            
            return result
            
        except Exception as e:
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = False
            log.error = str(e)
            consumption_tracker.add_log(log)
            
            logger.error(f"Error analyzing PDF: {e}")
            raise
    
    async def generate_questions(
        self,
        rfp_data: dict[str, Any],
        prompt: str,
        temperature: float = 0.3,
    ) -> list[dict[str, Any]]:
        """
        Genera preguntas basadas en el análisis del RFP.
        
        Args:
            rfp_data: Datos extraídos del RFP
            prompt: Prompt para generación de preguntas
            temperature: Temperatura para generación
            
        Returns:
            Lista de preguntas generadas
        """
        start_time = time.time()
        log = APIConsumptionLog(
            timestamp=datetime.now(),
            model=self.model_id,
            operation="generate_questions",
        )
        
        try:
            full_prompt = f"""
{prompt}

DATOS DEL RFP ANALIZADO:
```json
{json.dumps(rfp_data, ensure_ascii=False, indent=2)}
```

Genera las preguntas en formato JSON como un array de objetos.
"""
            
            logger.info("Generating questions with Gemini API")
            
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_id,
                contents=full_prompt,
                config={
                    "temperature": temperature,
                    "max_output_tokens": 4096,
                    "response_mime_type": "application/json",
                },
            )
            
            input_tokens, output_tokens, thinking_tokens = self._extract_token_counts(response)
            log.input_tokens = input_tokens
            log.output_tokens = output_tokens
            log.thinking_tokens = thinking_tokens
            log.total_tokens = input_tokens + output_tokens + thinking_tokens
            log.cost_usd = calculate_cost(self.model_id, input_tokens, output_tokens, thinking_tokens)
            
            # Usar el helper para extraer JSON válido (maneja datos extra)
            result = self._extract_json_from_text(response.text)
            
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = True
            consumption_tracker.add_log(log)
            
            # Extraer lista de preguntas
            if isinstance(result, dict) and "questions" in result:
                return result["questions"]
            elif isinstance(result, list):
                return result
            else:
                return []
                
        except Exception as e:
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = False
            log.error = str(e)
            consumption_tracker.add_log(log)
            
            logger.error(f"Error generating questions: {e}")
            raise
    
    async def chat(
        self,
        message: str,
        context: str | None = None,
        temperature: float = 0.7,
    ) -> str:
        """
        Chat simple con Gemini.
        
        Args:
            message: Mensaje del usuario
            context: Contexto adicional (opcional)
            temperature: Temperatura para generación
            
        Returns:
            Respuesta del modelo
        """
        start_time = time.time()
        log = APIConsumptionLog(
            timestamp=datetime.now(),
            model=self.model_id,
            operation="chat",
        )
        
        try:
            prompt = message
            if context:
                prompt = f"Contexto:\n{context}\n\nPregunta: {message}"
            
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_id,
                contents=prompt,
                config={
                    "temperature": temperature,
                    "max_output_tokens": 2048,
                },
            )
            
            input_tokens, output_tokens, thinking_tokens = self._extract_token_counts(response)
            log.input_tokens = input_tokens
            log.output_tokens = output_tokens
            log.thinking_tokens = thinking_tokens
            log.total_tokens = input_tokens + output_tokens + thinking_tokens
            log.cost_usd = calculate_cost(self.model_id, input_tokens, output_tokens, thinking_tokens)
            
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = True
            consumption_tracker.add_log(log)
            
            return response.text
            
        except Exception as e:
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = False
            log.error = str(e)
            consumption_tracker.add_log(log)
            
            logger.error(f"Error in chat: {e}")
            raise

    async def generate_json(
        self,
        prompt: str,
        temperature: float = 0.1,
        max_output_tokens: int = 4096,
    ) -> Any:
        """
        Genera una respuesta en formato JSON a partir de un prompt libre.
        """
        start_time = time.time()
        log = APIConsumptionLog(
            timestamp=datetime.now(),
            model=self.model_id,
            operation="generate_json",
        )
        
        try:
            logger.info("Generating JSON with Gemini API")
            
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_id,
                contents=prompt,
                config={
                    "temperature": temperature,
                    "max_output_tokens": max_output_tokens,
                    "response_mime_type": "application/json",
                },
            )
            
            input_tokens, output_tokens, thinking_tokens = self._extract_token_counts(response)
            log.input_tokens = input_tokens
            log.output_tokens = output_tokens
            log.thinking_tokens = thinking_tokens
            log.total_tokens = input_tokens + output_tokens + thinking_tokens
            log.cost_usd = calculate_cost(self.model_id, input_tokens, output_tokens, thinking_tokens)
            
            # Helper to extract valid JSON
            result = self._extract_json_from_text(response.text)
            
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = True
            consumption_tracker.add_log(log)
            
            return result
            
        except Exception as e:
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = False
            log.error = str(e)
            consumption_tracker.add_log(log)
            
            logger.error(f"Error generating JSON: {e}")
            raise
    
    async def analyze_with_grounding(
        self,
        document_content: str,
        prompt: str,
        temperature: float = 0.1,
        max_output_tokens: int = 16384,
    ) -> dict[str, Any]:
        """
        Analiza un documento con Gemini usando Google Search Grounding.
        Permite a Gemini buscar información actual en internet (ej: tarifas de mercado).
        
        IMPORTANTE: Grounding funciona con modelos Gemini 3 Pro, 3 Flash, 2.5 Pro, 2.5 Flash, y 2.0 Flash.
        
        Args:
            document_content: Contenido del documento (texto extraído)
            prompt: Prompt para el análisis (debe instruir a usar Google Search)
            temperature: Temperatura para generación
            max_output_tokens: Máximo de tokens de salida
            
        Returns:
            Dict con el resultado del análisis parseado desde JSON
        """
        # Usar Gemini 3 Flash para grounding (mejor balance calidad/precio con grounding)
        grounding_model = "gemini-3-flash-preview"
        
        start_time = time.time()
        log = APIConsumptionLog(
            timestamp=datetime.now(),
            model=grounding_model,
            operation="analyze_with_grounding",
        )
        
        try:
            # Construir prompt completo
            full_prompt = f"""
{prompt}

DOCUMENTO A ANALIZAR:
---
{document_content}
---

Responde UNICAMENTE con JSON valido siguiendo el schema indicado.
"""
            
            logger.info(f"Analyzing document with Grounding (Google Search)")
            logger.info(f"  Model: {grounding_model}")
            logger.info(f"  Temperature: {temperature}")
            
            # Configurar herramienta de Google Search para grounding
            google_search_tool = types.Tool(
                google_search=types.GoogleSearch()
            )
            
            # Generar contenido con grounding habilitado
            # NOTA: No usamos response_mime_type con grounding porque puede causar conflictos
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=grounding_model,
                contents=full_prompt,
                config={
                    "temperature": temperature,
                    "max_output_tokens": max_output_tokens,
                    "tools": [google_search_tool],
                    # No usar response_mime_type con grounding - parseamos manualmente
                },
            )
            
            # Extraer tokens
            input_tokens, output_tokens, thinking_tokens = self._extract_token_counts(response)
            log.input_tokens = input_tokens
            log.output_tokens = output_tokens
            log.thinking_tokens = thinking_tokens
            log.total_tokens = input_tokens + output_tokens + thinking_tokens
            
            # Calcular costo (usar pricing de flash para grounding)
            log.cost_usd = calculate_cost(grounding_model, input_tokens, output_tokens, thinking_tokens)
            
            # Obtener texto de respuesta - manejar diferentes formatos
            response_text = None
            
            # Primero intentar .text
            if hasattr(response, 'text') and response.text:
                response_text = response.text
            # Luego intentar desde candidates
            elif hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'content') and candidate.content:
                    if hasattr(candidate.content, 'parts') and candidate.content.parts:
                        for part in candidate.content.parts:
                            if hasattr(part, 'text') and part.text:
                                response_text = part.text
                                break
            
            if not response_text:
                logger.warning("Response text is empty, checking raw response...")
                logger.warning(f"Response type: {type(response)}")
                logger.warning(f"Response dir: {[attr for attr in dir(response) if not attr.startswith('_')]}")
                raise ValueError("Model returned empty response - no text content found")
            
            # Parsear respuesta JSON
            result = self._extract_json_from_text(response_text)
            
            # Agregar metadata de grounding si está disponible
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                    grounding_meta = candidate.grounding_metadata
                    
                    # Extraer web search queries
                    web_queries = []
                    if hasattr(grounding_meta, 'web_search_queries'):
                        web_queries = list(grounding_meta.web_search_queries or [])
                    elif hasattr(grounding_meta, 'search_entry_point'):
                        # Fallback para formato antiguo
                        web_queries = getattr(grounding_meta, 'search_queries', [])
                    
                    # Extraer grounding chunks (fuentes web)
                    chunks = []
                    if hasattr(grounding_meta, 'grounding_chunks'):
                        for chunk in (grounding_meta.grounding_chunks or []):
                            if hasattr(chunk, 'web') and chunk.web:
                                chunks.append({
                                    'uri': getattr(chunk.web, 'uri', ''),
                                    'title': getattr(chunk.web, 'title', '')
                                })
                    
                    # Extraer grounding supports
                    supports_count = 0
                    if hasattr(grounding_meta, 'grounding_supports'):
                        supports_count = len(grounding_meta.grounding_supports or [])
                    
                    result['_grounding_metadata'] = {
                        'web_search_queries': web_queries,
                        'grounding_chunks': chunks,
                        'grounding_supports_count': supports_count,
                    }
            
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = True
            consumption_tracker.add_log(log)
            
            logger.info("Document analysis with grounding completed successfully")
            return result
            
        except json.JSONDecodeError as e:
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = False
            log.error = f"Invalid JSON: {str(e)}"
            consumption_tracker.add_log(log)
            
            logger.error(f"Failed to parse Gemini grounding response as JSON: {e}")
            if 'response' in dir() and response is not None:
                # Intentar extraer JSON de todas formas
                try:
                    text = getattr(response, 'text', None)
                    if text:
                        return self._extract_json_from_text(text)
                except Exception:
                    pass
                return {"raw_response": str(response), "error": "Invalid JSON response"}
            return {"error": "Invalid JSON response"}
            
        except Exception as e:
            log.latency_ms = (time.time() - start_time) * 1000
            log.success = False
            log.error = str(e)
            consumption_tracker.add_log(log)
            
            logger.error(f"Error analyzing document with grounding: {e}")
            raise


# Singleton instance
_gemini_client: GeminiClient | None = None


def get_gemini_client() -> GeminiClient:
    """Get or create Gemini client singleton."""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client


def get_consumption_summary() -> dict:
    """Obtiene resumen de consumo de API."""
    return consumption_tracker.get_summary()
