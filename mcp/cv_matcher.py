"""
CV Matcher - Vincula CVs con matriculas usando fuzzy matching por nombre.

Los CVs estan nombrados por nombre completo (ej: "PACO ALEJANDRO PEREZ GUTIERREZ.pdf")
y necesitamos vincularlos con la matricula del colaborador en Census.xlsx.

Usa rapidfuzz para matching aproximado de strings.
"""

import re
import unicodedata
from pathlib import Path
from typing import Optional, Tuple, List, Dict
from dataclasses import dataclass
import logging

import pandas as pd

try:
    from rapidfuzz import fuzz
    RAPIDFUZZ_AVAILABLE = True
except ImportError:
    RAPIDFUZZ_AVAILABLE = False
    logging.warning("rapidfuzz no instalado. Instalar con: pip install rapidfuzz")

logger = logging.getLogger(__name__)


@dataclass
class CVMapping:
    """Resultado del matching de un CV."""
    cv_filename: str
    nombre_extraido: str
    matricula: Optional[str]
    nombre_census: Optional[str]
    confianza: float
    estado: str  # "auto", "revisar", "no_encontrado"


class CVMatcher:
    """
    Vincula CVs con matriculas usando fuzzy matching por nombre.
    
    Proceso:
    1. Extrae el nombre del filename del CV
    2. Normaliza (minusculas, sin acentos, solo letras)
    3. Compara con nombres en Census.xlsx usando multiples algoritmos
    4. Retorna la matricula con mejor score si supera el threshold
    
    Thresholds:
    - >= 80%: Match automatico (estado: "auto")
    - >= 60%: Requiere revision (estado: "revisar")  
    - < 60%: No encontrado (estado: "no_encontrado")
    """
    
    THRESHOLD_AUTO = 80      # >= 80%: match automatico
    THRESHOLD_REVIEW = 60    # >= 60%: requiere revision
    
    def __init__(self, df_census: pd.DataFrame):
        """
        Inicializa el matcher con datos del Census.
        
        Args:
            df_census: DataFrame con columnas de Matricula y Colaborador/Nome
        """
        self.df_census = df_census
        self.lookup: pd.DataFrame = pd.DataFrame()
        self._prepare_census_data()
    
    def _prepare_census_data(self):
        """Prepara datos del Census para matching."""
        colaborador_col = self._find_column(["Colaborador", "Nome"])
        matricula_col = self._find_column(["Matrícula", "Matricula"])
        
        if not colaborador_col or not matricula_col:
            raise ValueError("No se encontraron columnas de nombre/matricula en Census")
        
        # Crear lookup unico (un registro por colaborador)
        self.lookup = self.df_census[[matricula_col, colaborador_col]].drop_duplicates(
            subset=[matricula_col]
        ).copy()
        self.lookup.columns = ["matricula", "nombre"]
        self.lookup["nombre_normalizado"] = self.lookup["nombre"].apply(self._normalize)
        self.lookup["matricula"] = self.lookup["matricula"].astype(str).str.strip()
        
        logger.info(f"CVMatcher inicializado con {len(self.lookup)} colaboradores unicos")
    
    def _find_column(self, names: List[str]) -> Optional[str]:
        """Encuentra columna por nombres posibles."""
        for name in names:
            if name in self.df_census.columns:
                return name
            for col in self.df_census.columns:
                if name.lower() in col.lower():
                    return col
        return None
    
    def _normalize(self, name: str) -> str:
        """
        Normaliza un nombre para comparacion.
        
        - Convierte a minusculas
        - Remueve acentos/diacriticos
        - Mantiene solo letras y espacios
        - Normaliza espacios multiples
        """
        if not isinstance(name, str):
            return ""
        
        # Minusculas
        name = name.lower()
        
        # Remover acentos
        name = unicodedata.normalize('NFD', name)
        name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
        
        # Solo letras y espacios
        name = re.sub(r'[^a-z\s]', '', name)
        
        # Normalizar espacios
        name = ' '.join(name.split())
        
        return name
    
    def _calculate_similarity(self, name1: str, name2: str) -> float:
        """
        Calcula similitud entre dos nombres usando multiples algoritmos.
        
        Retorna promedio ponderado de:
        - ratio: similitud directa
        - partial_ratio: mejor substring match
        - token_sort_ratio: ignora orden de palabras
        """
        if not RAPIDFUZZ_AVAILABLE:
            # Fallback simple si rapidfuzz no esta disponible
            return 100.0 if name1 == name2 else 0.0
        
        score_ratio = fuzz.ratio(name1, name2)
        score_partial = fuzz.partial_ratio(name1, name2)
        score_token = fuzz.token_sort_ratio(name1, name2)
        
        # Promedio ponderado
        # token_sort_ratio tiene mas peso porque los nombres pueden estar en diferente orden
        score = (score_ratio * 0.25 + score_partial * 0.25 + score_token * 0.50)
        
        return score
    
    def match_single(self, cv_filename: str) -> CVMapping:
        """
        Encuentra la matricula para un CV.
        
        Args:
            cv_filename: Nombre del archivo (ej: "PACO ALEJANDRO PEREZ.pdf")
            
        Returns:
            CVMapping con resultado del match
        """
        # Extraer nombre del archivo (sin extension)
        name_from_file = Path(cv_filename).stem
        name_normalized = self._normalize(name_from_file)
        
        if not name_normalized:
            return CVMapping(
                cv_filename=cv_filename,
                nombre_extraido=name_from_file,
                matricula=None,
                nombre_census=None,
                confianza=0.0,
                estado="no_encontrado"
            )
        
        best_match = None
        best_score = 0.0
        best_nombre = None
        
        for _, row in self.lookup.iterrows():
            name_census = row["nombre_normalizado"]
            
            if not name_census:
                continue
            
            score = self._calculate_similarity(name_normalized, name_census)
            
            if score > best_score:
                best_score = score
                best_match = row["matricula"]
                best_nombre = row["nombre"]
        
        # Determinar estado segun threshold
        if best_score >= self.THRESHOLD_AUTO:
            estado = "auto"
        elif best_score >= self.THRESHOLD_REVIEW:
            estado = "revisar"
        else:
            estado = "no_encontrado"
            best_match = None
            best_nombre = None
        
        return CVMapping(
            cv_filename=cv_filename,
            nombre_extraido=name_from_file,
            matricula=best_match,
            nombre_census=best_nombre,
            confianza=round(best_score, 1),
            estado=estado
        )
    
    def match_all(self, cv_folder: Path) -> List[CVMapping]:
        """
        Procesa todos los CVs de una carpeta.
        
        Args:
            cv_folder: Carpeta con los CVs
            
        Returns:
            Lista de CVMapping con resultados
        """
        mappings = []
        
        if not cv_folder.exists():
            logger.warning(f"Carpeta no existe: {cv_folder}")
            return mappings
        
        cv_files = [
            f for f in cv_folder.iterdir() 
            if f.suffix.lower() in ['.pdf', '.docx', '.doc']
        ]
        
        logger.info(f"Procesando {len(cv_files)} CVs...")
        
        for filepath in cv_files:
            mapping = self.match_single(filepath.name)
            mappings.append(mapping)
            
            status_icons = {
                "auto": "OK",
                "revisar": "??",
                "no_encontrado": "XX"
            }
            icon = status_icons.get(mapping.estado, "??")
            logger.info(
                f"  [{icon}] {filepath.name[:40]:<40} -> "
                f"{mapping.matricula or 'N/A':<10} ({mapping.confianza}%)"
            )
        
        # Resumen
        auto = sum(1 for m in mappings if m.estado == "auto")
        revisar = sum(1 for m in mappings if m.estado == "revisar")
        no_encontrado = sum(1 for m in mappings if m.estado == "no_encontrado")
        
        logger.info(f"Resumen: {auto} auto, {revisar} revisar, {no_encontrado} no encontrado")
        
        return mappings
    
    def export_mapping(self, mappings: List[CVMapping], output_path: Path):
        """
        Exporta mappings a Excel para revision.
        
        Args:
            mappings: Lista de CVMapping
            output_path: Ruta del archivo Excel
        """
        status_labels = {
            "auto": "Auto OK",
            "revisar": "Revisar",
            "no_encontrado": "No encontrado"
        }
        
        data = [{
            "Archivo CV": m.cv_filename,
            "Nombre Extraido": m.nombre_extraido,
            "Matricula": m.matricula or "",
            "Nombre Census": m.nombre_census or "",
            "Confianza": f"{m.confianza}%",
            "Estado": status_labels.get(m.estado, m.estado)
        } for m in mappings]
        
        df = pd.DataFrame(data)
        df.to_excel(output_path, index=False)
        logger.info(f"Mapping exportado: {output_path}")
    
    def load_manual_mapping(self, mapping_file: Path) -> Dict[str, str]:
        """
        Carga mapping manual/corregido desde Excel.
        
        El archivo debe tener columnas "Archivo CV" y "Matricula".
        
        Args:
            mapping_file: Ruta al archivo Excel
            
        Returns:
            Dict {filename: matricula}
        """
        if not mapping_file.exists():
            return {}
        
        try:
            df = pd.read_excel(mapping_file)
        except Exception as e:
            logger.error(f"Error leyendo mapping: {e}")
            return {}
        
        mapping = {}
        
        # Buscar columnas
        filename_col = None
        matricula_col = None
        
        for col in df.columns:
            col_lower = col.lower()
            if "archivo" in col_lower or "cv" in col_lower:
                filename_col = col
            if "matricula" in col_lower or "matrícula" in col_lower:
                matricula_col = col
        
        if not filename_col or not matricula_col:
            logger.warning("No se encontraron columnas requeridas en mapping")
            return {}
        
        for _, row in df.iterrows():
            filename = str(row.get(filename_col, "")).strip()
            matricula = str(row.get(matricula_col, "")).strip()
            
            if filename and matricula and matricula.lower() not in ["", "nan", "none"]:
                mapping[filename] = matricula
        
        logger.info(f"Mapping manual cargado: {len(mapping)} entradas")
        return mapping


def create_mapping_from_folder(
    cv_folder: Path,
    census_df: pd.DataFrame,
    output_review: Optional[Path] = None,
    manual_mapping: Optional[Path] = None
) -> Dict[str, str]:
    """
    Funcion de conveniencia para crear mapping completo.
    
    1. Carga mapping manual si existe
    2. Para CVs sin mapping manual, usa fuzzy matching
    3. Exporta archivo de revision
    4. Retorna mapping final (solo los confiables)
    
    Args:
        cv_folder: Carpeta con CVs
        census_df: DataFrame del Census
        output_review: Ruta para exportar revision (opcional)
        manual_mapping: Ruta del mapping manual (opcional)
        
    Returns:
        Dict {filename: matricula} solo para matches confiables
    """
    matcher = CVMatcher(census_df)
    
    # Cargar mapping manual primero
    manual = {}
    if manual_mapping and manual_mapping.exists():
        manual = matcher.load_manual_mapping(manual_mapping)
    
    # Hacer matching automatico
    all_mappings = matcher.match_all(cv_folder)
    
    # Exportar para revision
    if output_review:
        matcher.export_mapping(all_mappings, output_review)
    
    # Construir mapping final
    final_mapping = {}
    
    for m in all_mappings:
        # Priorizar mapping manual
        if m.cv_filename in manual:
            final_mapping[m.cv_filename] = manual[m.cv_filename]
        # Usar automatico solo si es confiable
        elif m.estado == "auto" and m.matricula:
            final_mapping[m.cv_filename] = m.matricula
        # Los "revisar" no se incluyen automaticamente
    
    return final_mapping
