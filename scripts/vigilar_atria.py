#!/usr/bin/env python3
"""vigilar_atria.py — poller pasivo de Atria (atria-asi.ai) para la vigilancia diaria.

Atria es un proveedor candidato (observación: datos/fichas/curaduria/
integracion_atria.json): NO incorporado al catálogo aún. Este poller vigila
los tres disparadores objetivos de incorporación declarados en la observación:

  1. aparición de páginas legales (hoy /legal, /terms, /privacy, /pricing → 404)
  2. presencia de "atria" en el registro de LiteLLM (fuente primaria del
     generador de fichas; hoy ausente)
  3. hash del landing de la API (docs de producto; cambio = revisar)

Exit codes (contrato vigilancia_diaria.sh): 0 = sin cambios; 10 = disparador
detectado (revisar observación y evaluar incorporación); 2 = fallo de
red/infra (no es alerta, es infra). Estado en var/vigilancia/estado-atria.json
(gitignored). Solo stdlib; presupuesto ~6 GET/día; sin llaves.
"""

import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://www.atria-asi.ai"
PAGINAS_LEGALES = ["/legal", "/terms", "/privacy", "/pricing"]
LITELLM_URL = (
    "https://raw.githubusercontent.com/BerriAI/litellm/main/"
    "model_prices_and_context_window.json"
)
LANDING_URL = "https://api.atria-asi.ai/"


def get(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "escrubery-vigilancia/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def status_code(url: str, timeout: int = 15) -> int:
    req = urllib.request.Request(url, headers={"User-Agent": "escrubery-vigilancia/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--estado-dir", required=True, help="dir de estado (var/vigilancia)")
    args = ap.parse_args()
    estado_path = Path(args.estado_dir) / "estado-atria.json"

    try:
        legales = {p: status_code(f"{BASE}{p}") for p in PAGINAS_LEGALES}
        litellm = get(LITELLM_URL)
        tiene_atria = b"atria" in litellm.lower()
        landing = get(LANDING_URL)
        landing_sha = hashlib.sha256(landing).hexdigest()
    except Exception as exc:  # red/infra, no alerta — contrato §vigilancia
        print(f"FALLO de red vigilar atria: {exc}")
        return 2

    ahora = datetime.now(timezone.utc).isoformat()
    try:
        previo = json.loads(estado_path.read_text())
    except Exception:
        previo = {}

    cambios = []
    for pagina, codigo in legales.items():
        if codigo != 404 and previo.get("legales", {}).get(pagina) == 404:
            cambios.append(f"{pagina} pasó de 404 a {codigo} — FUENTE NUEVA")
    if tiene_atria and not previo.get("en_litellm", False):
        cambios.append("Atria apareció en LiteLLM — incorporación al generador posible")
    if previo.get("landing_sha256") not in (None, landing_sha):
        cambios.append("landing de la API cambió (docs de producto)")

    if cambios:
        print(f"ALERTA [atria] disparador de incorporación: {'; '.join(cambios)} — ver datos/fichas/curaduria/integracion_atria.json")
    else:
        base = previo.get("landing_sha256")
        base_txt = f"{base[:12]}…" if base else "primera corrida (baseline)"
        print(f"atria: sin disparadores (legales 404, litellm={'sí' if tiene_atria else 'no'}, landing {base_txt})")

    estado_path.write_text(
        json.dumps(
            {
                "ultima_corrida": ahora,
                "legales": legales,
                "en_litellm": tiene_atria,
                "landing_sha256": landing_sha,
            },
            indent=2,
        )
        + "\n"
    )
    return 10 if cambios else 0


if __name__ == "__main__":
    sys.exit(main())
