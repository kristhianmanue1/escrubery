#!/usr/bin/env python3
"""check_sizes.py — gate duro de tamaño de archivos (politica-agentes §3).

Valida los límites "duros" de la tabla de §3 de docs/politica-agentes.md.
Exit 0 si todo está dentro del límite; exit 1 listando las violaciones.

EXENTOS (§3): datos/ (generados), lockfiles, logs, VCS, caches.
"""

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# (descripción, límite duro en líneas)
REGLAS = [
    ("AGENTS.md", 300),
]
LIMITES_DOCS = 1500      # docs/**/*.md — doc de referencia
LIMITES_CODIGO = 800     # scripts/ (módulos y herramientas)

EXENTOS_DIRS = {"datos", ".git", "node_modules", "__pycache__", ".venv", "backup"}


def lineas(ruta: Path) -> int:
    try:
        return len(ruta.read_text(encoding="utf-8").splitlines())
    except (UnicodeDecodeError, OSError):
        return 0  # binario o ilegible: fuera de alcance de este gate


def main() -> int:
    violaciones = []

    for nombre, limite in REGLAS:
        ruta = RAIZ / nombre
        if ruta.exists():
            n = lineas(ruta)
            if n > limite:
                violaciones.append(f"{nombre}: {n} líneas (duro: {limite})")

    for ruta in sorted(RAIZ.rglob("*")):
        if not ruta.is_file():
            continue
        rel = ruta.relative_to(RAIZ)
        if rel.parts[0] in EXENTOS_DIRS:
            continue
        if rel.suffix == ".md" and rel.parts[0] == "docs":
            n = lineas(ruta)
            if n > LIMITES_DOCS:
                violaciones.append(f"{rel}: {n} líneas (duro: {LIMITES_DOCS})")
        elif rel.parts[0] == "scripts" and (rel.suffix == ".py" or rel.suffix == ""):
            n = lineas(ruta)
            if n > LIMITES_CODIGO:
                violaciones.append(f"{rel}: {n} líneas (duro: {LIMITES_CODIGO})")

    if violaciones:
        print("Violaciones del límite duro (politica-agentes §3):")
        for v in violaciones:
            print(f"  {v}")
        return 1
    print("check_sizes: OK — todos los archivos dentro del límite duro.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
