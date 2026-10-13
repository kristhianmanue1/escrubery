#!/usr/bin/env python3
"""vigilar_muse_code.py — poller pasivo de muse-code (Meta) para la vigilancia diaria.

muse-code es binario cerrado SIN releases de GitHub (limitación declarada en
datos/fichas/clis/muse-code.json): el poller de releases no aplica. Vigila las
dos señales públicas que sí existen:

  1. hash sha256 del changelog de docs (dev.meta.ai/docs/muse-code/changelog)
  2. última versión del SDK oficial @muse-code/sdk en el registro npm

Exit codes (contrato vigilancia_diaria.sh): 0 = sin cambios; 10 = cambio en
alguna señal (hay que revisar el changelog); 2 = fallo de red/infra (no es
alerta, es infra). Estado en var/vigilancia/estado-muse-code.json
(gitignored, como el resto de var/vigilancia). Solo stdlib; presupuesto ~2
GET/día; sin llaves.
"""

import argparse
import hashlib
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CHANGELOG_URL = "https://dev.meta.ai/docs/muse-code/changelog"
SDK_REGISTRY = "https://registry.npmjs.org/@muse-code%2fsdk"


def get(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "escrubery-vigilancia/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--estado-dir", required=True, help="dir de estado (var/vigilancia)")
    args = ap.parse_args()
    estado_path = Path(args.estado_dir) / "estado-muse-code.json"

    try:
        changelog = get(CHANGELOG_URL)
        sdk = json.loads(get(SDK_REGISTRY).decode("utf-8"))
        latest = sdk.get("dist-tags", {}).get("latest", "")
    except Exception as exc:  # red/infra, no alerta — contrato §vigilancia
        print(f"FALLO de red vigilar muse-code: {exc}")
        return 2

    ahora = datetime.now(timezone.utc).isoformat()
    sha = hashlib.sha256(changelog).hexdigest()
    try:
        previo = json.loads(estado_path.read_text())
    except Exception:
        previo = {}

    cambios = []
    if previo.get("changelog_sha256") not in (None, sha):
        cambios.append("changelog de docs")
    if previo.get("sdk_latest") not in (None, latest):
        cambios.append(f"sdk npm ({previo.get('sdk_latest')} -> {latest})")

    if cambios:
        print(f"ALERTA [muse-code] cambio detectado en: {'; '.join(cambios)} — revisar {CHANGELOG_URL}")
    else:
        base = previo.get("changelog_sha256")
        base_txt = f"{base[:12]}…" if base else "primera corrida (baseline)"
        print(f"muse-code: sin cambios (changelog {base_txt}, sdk {latest})")

    estado_path.write_text(
        json.dumps(
            {
                "ultima_corrida": ahora,
                "changelog_sha256": sha,
                "sdk_latest": latest,
            },
            indent=2,
        )
        + "\n"
    )
    return 10 if cambios else 0


if __name__ == "__main__":
    sys.exit(main())
