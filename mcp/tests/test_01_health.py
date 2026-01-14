"""
Test 1: Health Check
====================
Verifica que el servidor este funcionando correctamente.
"""
import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

import requests
from config import BASE_URL, TIMEOUT, print_ok, print_fail, print_info, print_header


def test_health_check():
    """Verifica el endpoint /health."""
    print_header("TEST: Health Check")
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=TIMEOUT)
        
        assert response.status_code == 200, f"Status code: {response.status_code}"
        print_ok(f"Status code: {response.status_code}")
        
        data = response.json()
        
        required_fields = ["status", "version", "gemini_disponible", 
                          "total_certificaciones", "total_skills", "modelo_embeddings"]
        
        for field in required_fields:
            assert field in data, f"Campo '{field}' no encontrado"
            print_ok(f"Campo '{field}': {data[field]}")
        
        assert data["total_certificaciones"] > 0, "No hay certificaciones"
        assert data["total_skills"] > 0, "No hay skills"
        
        print_info(f"Certificaciones: {data['total_certificaciones']}")
        print_info(f"Skills: {data['total_skills']}")
        print_info(f"Gemini: {'Disponible' if data['gemini_disponible'] else 'No configurado'}")
        
        print_ok("Health check PASSED")
        return True
        
    except requests.exceptions.ConnectionError:
        print_fail(f"No se pudo conectar a {BASE_URL}")
        print_info("Asegurate de que el servidor este corriendo: python server.py")
        return False
    except AssertionError as e:
        print_fail(f"Assertion failed: {e}")
        return False
    except Exception as e:
        print_fail(f"Error: {e}")
        return False


def test_countries():
    """Verifica el endpoint /countries."""
    print_header("TEST: Countries")
    
    try:
        response = requests.get(f"{BASE_URL}/countries", timeout=TIMEOUT)
        
        assert response.status_code == 200
        print_ok(f"Status code: {response.status_code}")
        
        data = response.json()
        
        assert data["exito"] == True
        assert "paises" in data
        assert len(data["paises"]) > 0, "No hay paises disponibles"
        
        print_info(f"Paises disponibles: {data['total']}")
        print_info(f"Lista: {', '.join(data['paises'][:5])}...")
        
        print_ok("Countries PASSED")
        return True
        
    except Exception as e:
        print_fail(f"Error: {e}")
        return False


def test_stats():
    """Verifica el endpoint /stats."""
    print_header("TEST: Stats")
    
    try:
        response = requests.get(f"{BASE_URL}/stats", timeout=TIMEOUT)
        
        assert response.status_code == 200
        print_ok(f"Status code: {response.status_code}")
        
        data = response.json()
        
        assert data["exito"] == True
        assert "estadisticas" in data
        
        stats = data["estadisticas"]
        
        if "certificaciones" in stats:
            print_info(f"Certificaciones total: {stats['certificaciones'].get('total', 'N/A')}")
        
        if "skills" in stats:
            print_info(f"Skills total: {stats['skills'].get('total', 'N/A')}")
        
        print_ok("Stats PASSED")
        return True
        
    except Exception as e:
        print_fail(f"Error: {e}")
        return False


if __name__ == "__main__":
    results = []
    results.append(("Health Check", test_health_check()))
    results.append(("Countries", test_countries()))
    results.append(("Stats", test_stats()))
    
    print_header("RESUMEN")
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "[OK]" if result else "[FAIL]"
        print(f"  {status} {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
