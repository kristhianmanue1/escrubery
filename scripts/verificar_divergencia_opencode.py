#!/usr/bin/env python3
"""verificar_divergencia_opencode.py — gate ficha↔captura sandbox (issue #3).

Compara los comandos curados de la ficha de opencode contra los comandos
primarios y alias de la captura sandbox más reciente. Detecta el caso en que
la ficha documenta un comando que la captura vigente ya no muestra (p. ej.
`opencode auth login`, hoy `opencode providers` alias `auth`).

Sin dependencias (solo stdlib). Determinista. Datos generados no se tocan.

Exit codes:
  0  consistente (o consistente con no-curadas informativas)
  1  divergencia: la ficha cita un comando que la captura no muestra
  2  insumo ausente o inválido (ficha/captura no encontradas o ilegibles)

Uso:
  python3 scripts/verificar_divergencia_opencode.py
  python3 scripts/verificar_divergencia_opencode.py --ficha /tmp/vieja.json
"""

import argparse
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FICHA_DEFECTO = RAIZ / "datos/fichas/clis/opencode.json"
CAPTURAS_DIR = RAIZ / "datos/fuentes/sandbox/opencode"
PREFIJO_CLI = "opencode"

# Línea de comando primaria del help yargs: "  opencode run [message..]  ..."
RE_PRIMARIO = re.compile(rf"^\s+{PREFIJO_CLI}\s+([a-z][a-z0-9_-]*)\b(.*)$")
# Alias en la misma línea: "[aliases: auth]" (uno o varios separados por coma)
RE_ALIAS = re.compile(r"\s\[aliases:\s+([a-z0-9_,\s-]+)\]")
# Cabecera del diario sandbox: "# --version: 1.18.27"
RE_VERSION = re.compile(r"^#\s+--version:\s+(\S+)")


def captura_mas_reciente(directorio: Path):
    """La captura vigente es la de timestamp mayor (nombres ISO 8601)."""
    if not directorio.is_dir():
        return None
    capturas = sorted(p for p in directorio.glob("*.txt") if p.is_file())
    return capturas[-1] if capturas else None


def parsear_captura(ruta: Path):
    """Devuelve (versión, primarios, alias) del help capturado."""
    version = None
    primarios: set[str] = set()
    alias: set[str] = set()
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        if version is None:
            m = RE_VERSION.match(linea)
            if m:
                version = m.group(1)
                continue
        m = RE_PRIMARIO.match(linea)
        if m:
            primarios.add(m.group(1))
            ma = RE_ALIAS.search(m.group(2))
            if ma:
                alias.update(a.strip() for a in ma.group(1).split(",") if a.strip())
    return version, primarios, alias


def frases_de_ficha(ruta: Path) -> list[str]:
    """Frases de comando curadas sin el prefijo del CLI ('run', 'providers'...)."""
    ficha = json.loads(ruta.read_text(encoding="utf-8"))
    frases = []
    for c in ficha.get("comandos", []):
        comando = (c.get("comando") or "").strip()
        if comando.startswith(f"{PREFIJO_CLI} "):
            frases.append(comando[len(PREFIJO_CLI) + 1 :].strip())
        elif comando:
            frases.append(comando)
    return frases


def frase_existente(frase: str, primarios: set[str], alias: set[str], lineas: list[str]) -> bool:
    """Un token simple basta si es primario o alias; una frase multi-token
    sólo existe si la captura muestra esa línea literal."""
    if " " not in frase:
        return frase in primarios or frase in alias
    patron = re.compile(rf"^\s+{PREFIJO_CLI}\s+{re.escape(frase)}\s{{2,}}")
    return any(patron.match(l) for l in lineas)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--ficha", type=Path, default=FICHA_DEFECTO,
                        help="ficha curada a verificar (por defecto la de opencode)")
    parser.add_argument("--captura", type=Path, default=None,
                        help="captura concreta (por defecto la de timestamp mayor)")
    args = parser.parse_args()

    if not args.ficha.is_file():
        print(f"divergencia-{PREFIJO_CLI}: FALTA ficha: {args.ficha}")
        return 2
    captura = args.captura or captura_mas_reciente(CAPTURAS_DIR)
    if captura is None or not captura.is_file():
        print(f"divergencia-{PREFIJO_CLI}: FALTA captura sandbox en {CAPTURAS_DIR}")
        return 2

    try:
        version, primarios, alias = parsear_captura(captura)
        lineas = captura.read_text(encoding="utf-8").splitlines()
        frases = frases_de_ficha(args.ficha)
    except (json.JSONDecodeError, UnicodeDecodeError, OSError) as e:
        print(f"divergencia-{PREFIJO_CLI}: ILEGIBLE ({e})")
        return 2

    if not primarios:
        print(f"divergencia-{PREFIJO_CLI}: CAPTURA SIN COMANDOS: {captura}")
        return 2

    divergencias = [f for f in frases if not frase_existente(f, primarios, alias, lineas)]
    conocidos = frases
    no_curadas = sorted(p for p in primarios if p not in conocidos)

    print(f"divergencia-{PREFIJO_CLI}: ficha={args.ficha.name} captura={captura.name} "
          f"version={version or 'desconocida'}")
    if divergencias:
        print(f"  DIVERGENCIAS ({len(divergencias)}):")
        for d in divergencias:
            print(f"    - '{PREFIJO_CLI} {d}' no existe en la captura vigente")
        print(f"  primarios vigentes: {', '.join(sorted(primarios))}")
        if alias:
            print(f"  alias vigentes: {', '.join(sorted(alias))}")
        print("  corrección: la captura gana; corregir la ficha citándola como fuente")
        return 1

    print(f"  consistente: {len(frases)} comandos curados presentes en la captura")
    if alias:
        print(f"  alias vigentes: {', '.join(sorted(alias))}")
    if no_curadas:
        print(f"  no curados (informativo, la ficha no es exhaustiva): {', '.join(no_curadas)}")
    print(f"divergencia-{PREFIJO_CLI}: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
