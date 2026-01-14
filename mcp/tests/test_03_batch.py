"""
Test 3: Busqueda Batch
======================
Verifica el endpoint /batch-search para Team Building.
"""
import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

import requests
from config import BASE_URL, TIMEOUT, print_ok, print_fail, print_info, print_header, print_warn


def test_batch_search_single_role():
    """Batch search con un solo rol."""
    print_header("TEST: Batch Search - Un Rol")
    
    try:
        payload = {
            "roles": [
                {
                    "rol_id": "Dev_Java",
                    "descripcion": "Java Spring Boot Microservicios",
                    "cantidad": 3
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/batch-search", json=payload, timeout=TIMEOUT)
        
        assert response.status_code == 200, f"Status: {response.status_code}"
        print_ok(f"Status code: {response.status_code}")
        
        data = response.json()
        
        assert data["exito"] == True
        assert "resultados" in data
        assert "Dev_Java" in data["resultados"]
        
        resultado = data["resultados"]["Dev_Java"]
        
        assert resultado["rol_id"] == "Dev_Java"
        assert resultado["total"] > 0, "No se encontraron candidatos"
        
        print_info(f"Rol: {resultado['rol_id']}")
        print_info(f"Candidatos: {resultado['total']}")
        
        if resultado["candidatos"]:
            c = resultado["candidatos"][0]
            print_info(f"Primer candidato: {c['nombre']}")
            print_info(f"  Certs: {len(c['certificaciones'])}, Skills: {len(c['skills'])}")
        
        print_ok("Batch search un rol PASSED")
        return True
        
    except Exception as e:
        print_fail(f"Error: {e}")
        return False


def test_batch_search_multiple_roles():
    """Batch search con multiples roles."""
    print_header("TEST: Batch Search - Multiples Roles")
    
    try:
        payload = {
            "roles": [
                {
                    "rol_id": "PM_Senior",
                    "descripcion": "Project Manager PMP Scrum Master Agile",
                    "cantidad": 2
                },
                {
                    "rol_id": "Dev_Backend",
                    "descripcion": "Java Python Node.js Backend Developer",
                    "cantidad": 3
                },
                {
                    "rol_id": "DBA",
                    "descripcion": "Oracle PostgreSQL Database Administrator",
                    "cantidad": 2
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/batch-search", json=payload, timeout=TIMEOUT)
        
        assert response.status_code == 200
        print_ok(f"Status code: {response.status_code}")
        
        data = response.json()
        
        assert data["exito"] == True
        assert data["total_roles"] == 3
        
        print_info(f"Total roles: {data['total_roles']}")
        print_info(f"Total candidatos: {data['total_candidatos']}")
        
        for rol_id in ["PM_Senior", "Dev_Backend", "DBA"]:
            assert rol_id in data["resultados"], f"Rol {rol_id} no encontrado"
            resultado = data["resultados"][rol_id]
            print_info(f"  {rol_id}: {resultado['total']} candidatos")
        
        print_ok("Batch search multiples roles PASSED")
        return True
        
    except Exception as e:
        print_fail(f"Error: {e}")
        return False


def test_batch_search_team_building():
    """Simula caso de uso real: armar equipo para RFP."""
    print_header("TEST: Team Building para RFP")
    
    try:
        payload = {
            "roles": [
                {
                    "rol_id": "Tech_Lead",
                    "descripcion": "Tech Lead Arquitecto Software Java Python Cloud AWS",
                    "cantidad": 1
                },
                {
                    "rol_id": "Senior_Dev",
                    "descripcion": "Senior Developer Full Stack React Node.js Java",
                    "cantidad": 3
                },
                {
                    "rol_id": "DevOps",
                    "descripcion": "DevOps Engineer Kubernetes Docker CI/CD Jenkins",
                    "cantidad": 1
                }
            ]
        }
        
        response = requests.post(f"{BASE_URL}/batch-search", json=payload, timeout=TIMEOUT)
        
        assert response.status_code == 200
        print_ok(f"Status code: {response.status_code}")
        
        data = response.json()
        
        print_info(f"\nEQUIPO PROPUESTO PARA RFP:")
        print_info("-" * 40)
        
        total_equipo = 0
        for rol_id, resultado in data["resultados"].items():
            print_info(f"\n{rol_id}:")
            for c in resultado["candidatos"]:
                total_equipo += 1
                certs = len(c["certificaciones"])
                skills = len(c["skills"])
                print_info(f"  - {c['nombre']}")
                print_info(f"    Email: {c['email']}")
                print_info(f"    Certs: {certs}, Skills: {skills}")
        
        print_info(f"\nTotal equipo: {total_equipo} personas")
        
        print_ok("Team Building PASSED")
        return True
        
    except Exception as e:
        print_fail(f"Error: {e}")
        return False


if __name__ == "__main__":
    results = []
    results.append(("Batch Un Rol", test_batch_search_single_role()))
    results.append(("Batch Multiples Roles", test_batch_search_multiple_roles()))
    results.append(("Team Building RFP", test_batch_search_team_building()))
    
    print_header("RESUMEN")
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "[OK]" if result else "[FAIL]"
        print(f"  {status} {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
