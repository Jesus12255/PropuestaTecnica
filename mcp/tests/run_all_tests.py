"""
Script principal para ejecutar todos los tests.
================================================

Uso:
    python tests/run_all_tests.py              # Ejecutar todos
    python tests/run_all_tests.py --quick      # Solo tests rapidos (sin chat)
    python tests/run_all_tests.py --chat-only  # Solo tests de chat
"""
import sys
import os
import time
import argparse

# Configurar encoding para Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

# Agregar el directorio tests al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import BASE_URL, print_header, print_ok, print_fail, print_info, print_warn

# Importar todos los modulos de test
import test_01_health
import test_02_search
import test_03_batch
import test_04_chat


def check_server_running():
    """Verifica que el servidor este corriendo."""
    import requests
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        return response.status_code == 200
    except:
        return False


def run_all_tests(include_chat=True, chat_only=False):
    """Ejecuta todos los tests y retorna resultados."""
    
    print("\n" + "="*60)
    print("    MCP TALENT SEARCH - SUITE DE TESTS v3.0")
    print("="*60)
    
    print_info(f"URL del servidor: {BASE_URL}")
    
    # Verificar servidor
    if not check_server_running():
        print_fail("El servidor no esta corriendo")
        print_info("Inicia el servidor con: python server.py")
        return False
    
    print_ok("Servidor conectado")
    
    all_results = []
    start_time = time.time()
    
    if not chat_only:
        # ==================== HEALTH TESTS ====================
        print_header("MODULO 1: Health & Sistema")
        results = [
            ("Health Check", test_01_health.test_health_check()),
            ("Countries", test_01_health.test_countries()),
            ("Stats", test_01_health.test_stats()),
        ]
        all_results.extend(results)
        
        # ==================== SEARCH TESTS ====================
        print_header("MODULO 2: Busqueda Simple")
        results = [
            ("Busqueda Basica", test_02_search.test_search_basic()),
            ("Busqueda con Pais", test_02_search.test_search_with_country()),
            ("Perfil Enriquecido", test_02_search.test_search_enriched_profile()),
        ]
        all_results.extend(results)
        
        # ==================== BATCH TESTS ====================
        print_header("MODULO 3: Busqueda Batch")
        results = [
            ("Batch Un Rol", test_03_batch.test_batch_search_single_role()),
            ("Batch Multiples Roles", test_03_batch.test_batch_search_multiple_roles()),
            ("Team Building RFP", test_03_batch.test_batch_search_team_building()),
        ]
        all_results.extend(results)
    
    # ==================== CHAT TESTS ====================
    if include_chat or chat_only:
        print_header("MODULO 4: Chat Natural (Gemini)")
        
        import requests
        try:
            health = requests.get(f"{BASE_URL}/health", timeout=5).json()
            if not health.get("gemini_disponible"):
                print_warn("GOOGLE_API_KEY no configurada - tests en modo degradado")
        except:
            pass
        
        results = [
            ("Chat Simple", test_04_chat.test_chat_simple()),
            ("Chat con Pais", test_04_chat.test_chat_with_country()),
            ("Chat Complejo", test_04_chat.test_chat_complex_request()),
        ]
        all_results.extend(results)
    
    # ==================== RESUMEN FINAL ====================
    elapsed = time.time() - start_time
    
    print("\n" + "="*60)
    print("                    RESUMEN FINAL")
    print("="*60)
    
    passed = sum(1 for _, r in all_results if r)
    failed = sum(1 for _, r in all_results if not r)
    total = len(all_results)
    
    for name, result in all_results:
        status = "[OK]" if result else "[FAIL]"
        print(f"  {status} {name}")
    
    print(f"\n{'-'*50}")
    print(f"  Total:    {total} tests")
    print(f"  Passed:   {passed}")
    print(f"  Failed:   {failed}")
    print(f"  Tiempo:   {elapsed:.2f}s")
    print(f"{'-'*50}")
    
    if failed == 0:
        print("\n[SUCCESS] TODOS LOS TESTS PASARON\n")
        return True
    else:
        print(f"\n[ERROR] {failed} TEST(S) FALLARON\n")
        return False


def main():
    parser = argparse.ArgumentParser(description="Ejecutar tests del MCP Talent Search API")
    parser.add_argument("--quick", action="store_true", help="Solo tests rapidos (sin chat)")
    parser.add_argument("--chat-only", action="store_true", help="Solo tests de chat")
    parser.add_argument("--url", type=str, help="URL del servidor (default: http://localhost:8083)")
    
    args = parser.parse_args()
    
    if args.url:
        import config
        config.BASE_URL = args.url
    
    success = run_all_tests(
        include_chat=not args.quick,
        chat_only=args.chat_only
    )
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
