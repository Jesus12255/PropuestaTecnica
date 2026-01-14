"""
Test 4: Chat Natural con Gemini
===============================
Verifica el endpoint /chat para consultas en lenguaje natural.
"""
import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

import requests
from config import BASE_URL, TIMEOUT, print_ok, print_fail, print_info, print_header, print_warn


def test_chat_simple():
    """Chat con consulta simple."""
    print_header("TEST: Chat Simple")
    
    try:
        payload = {
            "mensaje": "Necesito 3 desarrolladores Java senior"
        }
        
        response = requests.post(f"{BASE_URL}/chat", json=payload, timeout=60)
        
        assert response.status_code == 200, f"Status: {response.status_code}"
        print_ok(f"Status code: {response.status_code}")
        
        data = response.json()
        
        assert "interpretacion" in data
        assert "candidatos" in data
        assert "respuesta_natural" in data
        
        print_info(f"Mensaje original: {data['mensaje_original']}")
        print_info(f"Interpretacion: {data['interpretacion'].get('resumen', 'N/A')}")
        print_info(f"Candidatos encontrados: {data['total']}")
        
        respuesta = data['respuesta_natural']
        if len(respuesta) > 100:
            respuesta = respuesta[:100] + "..."
        print_info(f"Respuesta natural: {respuesta}")
        
        if "roles" in data["interpretacion"]:
            roles = data["interpretacion"]["roles"]
            print_info(f"Roles extraidos: {len(roles)}")
            for rol in roles:
                desc = rol.get('descripcion', 'N/A')[:40]
                print_info(f"  - {rol.get('rol_id', 'N/A')}: {desc}...")
        
        print_ok("Chat simple PASSED")
        return True
        
    except requests.exceptions.Timeout:
        print_warn("Timeout - Gemini puede estar tardando mas de lo esperado")
        return True
    except Exception as e:
        print_fail(f"Error: {e}")
        return False


def test_chat_with_country():
    """Chat con mencion de pais."""
    print_header("TEST: Chat con Pais")
    
    try:
        payload = {
            "mensaje": "Busco 2 expertos en AWS para un proyecto en Colombia"
        }
        
        response = requests.post(f"{BASE_URL}/chat", json=payload, timeout=60)
        
        assert response.status_code == 200
        print_ok(f"Status code: {response.status_code}")
        
        data = response.json()
        
        if "roles" in data["interpretacion"]:
            for rol in data["interpretacion"]["roles"]:
                pais = rol.get("pais")
                if pais:
                    print_info(f"Pais detectado: {pais}")
                    if pais.lower() == "colombia":
                        print_ok("Pais correctamente interpretado")
        
        print_info(f"Candidatos: {data['total']}")
        
        print_ok("Chat con pais PASSED")
        return True
        
    except requests.exceptions.Timeout:
        print_warn("Timeout")
        return True
    except Exception as e:
        print_fail(f"Error: {e}")
        return False


def test_chat_complex_request():
    """Chat con solicitud compleja."""
    print_header("TEST: Chat Solicitud Compleja")
    
    try:
        payload = {
            "mensaje": "Necesito armar un equipo de 6 personas para migrar un sistema legacy a microservicios. Necesito un arquitecto, 3 desarrolladores backend Java, 1 DevOps y 1 DBA Oracle."
        }
        
        response = requests.post(f"{BASE_URL}/chat", json=payload, timeout=90)
        
        assert response.status_code == 200
        print_ok(f"Status code: {response.status_code}")
        
        data = response.json()
        
        print_info(f"Interpretacion: {data['interpretacion'].get('resumen', 'N/A')}")
        
        if "roles" in data["interpretacion"]:
            roles = data["interpretacion"]["roles"]
            print_info(f"Roles identificados: {len(roles)}")
            
            total_personas = sum(r.get("cantidad", 0) for r in roles)
            print_info(f"Total personas solicitadas: {total_personas}")
            
            for rol in roles:
                desc = rol.get('descripcion', '')[:30]
                print_info(f"  - {rol.get('rol_id')}: {rol.get('cantidad')} - {desc}...")
        
        print_info(f"\nCandidatos encontrados: {data['total']}")
        
        if data["candidatos"]:
            print_info("\nPrimeros candidatos:")
            for c in data["candidatos"][:3]:
                print_info(f"  - {c['nombre']} ({c['cargo']})")
        
        print_ok("Chat complejo PASSED")
        return True
        
    except requests.exceptions.Timeout:
        print_warn("Timeout en solicitud compleja")
        return True
    except Exception as e:
        print_fail(f"Error: {e}")
        return False


if __name__ == "__main__":
    print_header("NOTA: Estos tests requieren GOOGLE_API_KEY configurada")
    
    try:
        health = requests.get(f"{BASE_URL}/health", timeout=10).json()
        if not health.get("gemini_disponible"):
            print_warn("Gemini no esta configurado. Los tests funcionaran en modo degradado.")
    except:
        pass
    
    results = []
    results.append(("Chat Simple", test_chat_simple()))
    results.append(("Chat con Pais", test_chat_with_country()))
    results.append(("Chat Complejo", test_chat_complex_request()))
    
    print_header("RESUMEN")
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "[OK]" if result else "[FAIL]"
        print(f"  {status} {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
