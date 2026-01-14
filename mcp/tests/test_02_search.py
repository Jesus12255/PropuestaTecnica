"""
Test 2: Busqueda Simple
=======================
Verifica el endpoint /search con perfiles enriquecidos.
"""
import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

import requests
from config import BASE_URL, TIMEOUT, print_ok, print_fail, print_info, print_header, print_warn


def test_search_basic():
    """Busqueda basica sin filtros."""
    print_header("TEST: Busqueda Basica")
    
    try:
        payload = {
            "consulta": "Java Spring Boot",
            "limit": 5
        }
        
        response = requests.post(f"{BASE_URL}/search", json=payload, timeout=TIMEOUT)
        
        assert response.status_code == 200, f"Status: {response.status_code}"
        print_ok(f"Status code: {response.status_code}")
        
        data = response.json()
        
        assert "candidatos" in data
        assert data["total"] > 0, "No se encontraron candidatos"
        
        print_info(f"Candidatos encontrados: {data['total']}")
        
        candidato = data["candidatos"][0]
        
        required_fields = ["matricula", "nombre", "email", "cargo", 
                          "certificaciones", "skills", "match_principal", "score"]
        
        for field in required_fields:
            assert field in candidato, f"Campo '{field}' no encontrado en candidato"
        
        print_ok("Estructura de candidato correcta")
        
        print_info(f"Primer candidato: {candidato['nombre']}")
        print_info(f"  - Certificaciones: {len(candidato['certificaciones'])}")
        print_info(f"  - Skills: {len(candidato['skills'])}")
        print_info(f"  - Match: {candidato['match_principal'][:40]}...")
        print_info(f"  - Score: {candidato['score']:.2%}")
        
        if len(candidato['certificaciones']) > 1:
            print_ok(f"Perfil enriquecido: {len(candidato['certificaciones'])} certificaciones")
        
        if len(candidato['skills']) > 1:
            print_ok(f"Perfil enriquecido: {len(candidato['skills'])} skills")
        
        print_ok("Busqueda basica PASSED")
        return True
        
    except Exception as e:
        print_fail(f"Error: {e}")
        return False


def test_search_with_country():
    """Busqueda con filtro de pais."""
    print_header("TEST: Busqueda con Filtro de Pais")
    
    try:
        payload = {
            "consulta": "AWS Cloud",
            "limit": 5,
            "pais": "Brasil"
        }
        
        response = requests.post(f"{BASE_URL}/search", json=payload, timeout=TIMEOUT)
        
        assert response.status_code == 200
        print_ok(f"Status code: {response.status_code}")
        
        data = response.json()
        
        if data["total"] > 0:
            for candidato in data["candidatos"]:
                if candidato.get("pais"):
                    assert candidato["pais"].lower() == "brasil", \
                        f"Pais incorrecto: {candidato['pais']}"
            
            print_ok(f"Filtro de pais correcto: {data['total']} candidatos de Brasil")
        else:
            print_warn("No se encontraron candidatos en Brasil para AWS Cloud")
        
        print_ok("Busqueda con pais PASSED")
        return True
        
    except Exception as e:
        print_fail(f"Error: {e}")
        return False


def test_search_enriched_profile():
    """Verifica que el perfil este completamente enriquecido."""
    print_header("TEST: Perfil Enriquecido")
    
    try:
        payload = {
            "consulta": "Oracle Database Administrator",
            "limit": 3
        }
        
        response = requests.post(f"{BASE_URL}/search", json=payload, timeout=TIMEOUT)
        
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] == 0:
            print_warn("No se encontraron candidatos para esta busqueda")
            return True
        
        candidato = data["candidatos"][0]
        
        if candidato["certificaciones"]:
            cert = candidato["certificaciones"][0]
            assert "nombre" in cert, "Certificacion sin nombre"
            assert "institucion" in cert, "Certificacion sin institucion"
            print_ok(f"Estructura de certificacion correcta")
        
        if candidato["skills"]:
            skill = candidato["skills"][0]
            assert "nombre" in skill, "Skill sin nombre"
            print_ok(f"Estructura de skill correcta")
        
        if candidato.get("lider"):
            lider = candidato["lider"]
            print_info(f"Lider: {lider.get('nombre', 'N/A')}")
            print_ok("Informacion de lider presente")
        
        print_ok("Perfil enriquecido PASSED")
        return True
        
    except Exception as e:
        print_fail(f"Error: {e}")
        return False


if __name__ == "__main__":
    results = []
    results.append(("Busqueda Basica", test_search_basic()))
    results.append(("Busqueda con Pais", test_search_with_country()))
    results.append(("Perfil Enriquecido", test_search_enriched_profile()))
    
    print_header("RESUMEN")
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "[OK]" if result else "[FAIL]"
        print(f"  {status} {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
