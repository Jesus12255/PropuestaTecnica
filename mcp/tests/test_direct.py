"""
Test directo del servidor (sin HTTP).
======================================
Prueba las funciones internas directamente.

Uso: python tests/test_direct.py
"""
import sys
import os
import time

# Configurar encoding para Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

# Agregar directorio padre al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import print_header, print_ok, print_fail, print_info, print_warn


def run_direct_tests():
    """Ejecuta tests directamente sin servidor HTTP."""
    
    print("\n" + "="*60)
    print("     TEST DIRECTO (SIN SERVIDOR HTTP)")
    print("="*60)
    
    results = []
    
    # ==================== IMPORT TEST ====================
    print_header("TEST: Importar Modulos")
    try:
        from server import (
            initialize_vector_db,
            search_and_enrich,
            search_for_roles,
            get_all_certs_for_matricula,
            get_all_skills_for_matricula,
            get_statistics,
            RequerimientoRol,
            GOOGLE_API_KEY
        )
        print_ok("Modulos importados correctamente")
        results.append(("Import Modulos", True))
    except Exception as e:
        print_fail(f"Error importando: {e}")
        results.append(("Import Modulos", False))
        return results
    
    # ==================== INIT TEST ====================
    print_header("TEST: Inicializar Base de Datos")
    try:
        start = time.time()
        initialize_vector_db()
        elapsed = time.time() - start
        print_ok(f"Base de datos inicializada en {elapsed:.2f}s")
        results.append(("Inicializar DB", True))
    except Exception as e:
        print_fail(f"Error: {e}")
        results.append(("Inicializar DB", False))
        return results
    
    # ==================== SEARCH TEST ====================
    print_header("TEST: Busqueda con Perfil Enriquecido")
    try:
        candidatos = search_and_enrich("Java Spring Microservicios", limit=3)
        
        assert len(candidatos) > 0, "No se encontraron candidatos"
        print_ok(f"Encontrados {len(candidatos)} candidatos")
        
        c = candidatos[0]
        print_info(f"\nPrimer candidato: {c.nombre}")
        print_info(f"  Email: {c.email}")
        print_info(f"  Cargo: {c.cargo}")
        print_info(f"  Pais: {c.pais}")
        print_info(f"  Certificaciones: {len(c.certificaciones)}")
        
        for cert in c.certificaciones[:3]:
            nombre_cert = cert.nombre[:50] if len(cert.nombre) > 50 else cert.nombre
            print_info(f"    - {nombre_cert}...")
        
        print_info(f"  Skills: {len(c.skills)}")
        for skill in c.skills[:5]:
            prof = f" (nivel {skill.proficiencia})" if skill.proficiencia else ""
            print_info(f"    - {skill.nombre}{prof}")
        
        if c.lider:
            print_info(f"  Lider: {c.lider.nombre}")
        
        print_info(f"  Match: {c.match_principal}")
        print_info(f"  Score: {c.score:.2%}")
        
        print_ok("Busqueda enriquecida funciona correctamente")
        results.append(("Busqueda Enriquecida", True))
        
    except Exception as e:
        print_fail(f"Error: {e}")
        import traceback
        traceback.print_exc()
        results.append(("Busqueda Enriquecida", False))
    
    # ==================== BATCH TEST ====================
    print_header("TEST: Busqueda Batch")
    try:
        roles = [
            RequerimientoRol(rol_id="Dev_Java", descripcion="Java Spring Boot", cantidad=2),
            RequerimientoRol(rol_id="PM", descripcion="Project Manager PMP", cantidad=2),
            RequerimientoRol(rol_id="DBA", descripcion="Oracle Database", cantidad=2)
        ]
        
        resultados = search_for_roles(roles)
        
        print_info(f"Roles buscados: {len(roles)}")
        
        total = 0
        for rol_id, res in resultados.items():
            print_info(f"  {rol_id}: {res.total} candidatos")
            total += res.total
        
        print_info(f"Total candidatos: {total}")
        
        assert len(resultados) == 3, "No todos los roles tienen resultados"
        print_ok("Busqueda batch funciona correctamente")
        results.append(("Busqueda Batch", True))
        
    except Exception as e:
        print_fail(f"Error: {e}")
        results.append(("Busqueda Batch", False))
    
    # ==================== STATS TEST ====================
    print_header("TEST: Estadisticas")
    try:
        stats = get_statistics()
        
        if "certificaciones" in stats:
            print_info(f"Certificaciones: {stats['certificaciones'].get('total', 0)}")
        if "skills" in stats:
            print_info(f"Skills: {stats['skills'].get('total', 0)}")
        
        print_ok("Estadisticas obtenidas")
        results.append(("Estadisticas", True))
        
    except Exception as e:
        print_fail(f"Error: {e}")
        results.append(("Estadisticas", False))
    
    # ==================== GEMINI TEST ====================
    print_header("TEST: Configuracion Gemini")
    try:
        if GOOGLE_API_KEY:
            print_ok(f"GOOGLE_API_KEY configurada: {GOOGLE_API_KEY[:10]}...")
            results.append(("Gemini Config", True))
        else:
            print_warn("GOOGLE_API_KEY no configurada")
            print_info("El endpoint /chat funcionara en modo degradado")
            results.append(("Gemini Config", True))  # No es un error
            
    except Exception as e:
        print_fail(f"Error: {e}")
        results.append(("Gemini Config", False))
    
    # ==================== RESUMEN ====================
    print("\n" + "="*60)
    print("                    RESUMEN")
    print("="*60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "[OK]" if result else "[FAIL]"
        print(f"  {status} {name}")
    
    print(f"\n{'-'*50}")
    print(f"  Passed: {passed}/{total}")
    
    if passed == total:
        print("\n[SUCCESS] TODOS LOS TESTS PASARON")
        print("\nAhora puedes iniciar el servidor:")
        print("  python server.py")
        print("\nY luego ejecutar los tests HTTP:")
        print("  python tests/run_all_tests.py")
    else:
        print("\n[ERROR] Algunos tests fallaron")
    
    return results


if __name__ == "__main__":
    run_direct_tests()
