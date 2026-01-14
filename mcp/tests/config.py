"""
Test de configuracion y constantes para las pruebas.
Compatible con Windows (sin caracteres Unicode especiales).
"""
import os
import sys
from pathlib import Path

# Configurar encoding para Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# URL base del servidor
BASE_URL = os.getenv("MCP_TEST_URL", "http://localhost:8083")

# Timeout para requests
TIMEOUT = 30

# Directorio del proyecto
PROJECT_DIR = Path(__file__).parent.parent


def print_ok(msg):
    print(f"[OK] {msg}")

def print_fail(msg):
    print(f"[FAIL] {msg}")

def print_info(msg):
    print(f"[INFO] {msg}")

def print_warn(msg):
    print(f"[WARN] {msg}")

def print_header(msg):
    print(f"\n{'='*60}")
    print(f" {msg}")
    print(f"{'='*60}\n")
