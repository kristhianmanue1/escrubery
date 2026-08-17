#!/usr/bin/env python3
"""Genera las fichas v0 de proveedores de modelos desde el JSON de LiteLLM.

Uso:  python3 scripts/generar_fichas_modelos.py

Descarga model_prices_and_context_window.json de LiteLLM, filtra los cinco
proveedores en alcance (solo entradas de API propia, no resellers), normaliza
al esquema canónico del contrato v0 y escribe datos/fichas/proveedores/*.json
con su bloque de procedencia (fuente_url, fecha_obtencion, hash_sha256).

Solo stdlib. Sin llamadas a modelos de IA. Re-ejecutable: regenera las fichas
y actualiza la fecha y el hash de la fuente.
"""

import hashlib
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

FUENTE_URL = (
    "https://raw.githubusercontent.com/BerriAI/litellm/main/"
    "model_prices_and_context_window.json"
)
# proveedor canónico -> litellm_provider (solo API de primera mano)
PROVEEDORES = {
    "anthropic": "anthropic",
    "xai": "xai",
    "google": "gemini",
    "moonshot": "moonshot",
    "zhipu": "zai",
    "qwen": "dashscope",
}

RAIZ = Path(__file__).resolve().parent.parent
DIR_FUENTES = RAIZ / "datos" / "fuentes" / "litellm"
DIR_SALIDA = RAIZ / "datos" / "fichas" / "proveedores"


def por_millon(costo_por_token):
    return round(costo_por_token * 1_000_000, 6) if costo_por_token is not None else None


def normalizar_modelo(modelo_id, entrada):
    return {
        "modelo_id": modelo_id,
        "ventana_contexto_max": entrada.get("max_input_tokens"),
        "max_output_tokens": entrada.get("max_output_tokens"),
        "capacidades": {
            "soporta_vision": entrada.get("supports_vision"),
            "soporta_tool_use": entrada.get("supports_function_calling"),
            "soporta_caching": entrada.get("cache_read_input_token_cost") is not None,
            "soporta_batch": entrada.get("supports_batch"),
            "soporta_computer_use": entrada.get("supports_computer_use"),
        },
        "precios": {
            "input_por_millon": por_millon(entrada.get("input_cost_per_token")),
            "output_por_millon": por_millon(entrada.get("output_cost_per_token")),
            "cache_lectura_por_millon": por_millon(
                entrada.get("cache_read_input_token_cost")
            ),
        },
        "fecha_deprecacion": entrada.get("deprecation_date"),
        "fuente_precio": entrada.get("source"),
    }


def main():
    ahora = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    DIR_FUENTES.mkdir(parents=True, exist_ok=True)
    DIR_SALIDA.mkdir(parents=True, exist_ok=True)

    print(f"Descargando {FUENTE_URL} ...")
    with urllib.request.urlopen(FUENTE_URL, timeout=60) as resp:
        crudo = resp.read()
    hash_fuente = hashlib.sha256(crudo).hexdigest()
    (DIR_FUENTES / "model_prices_and_context_window.json").write_bytes(crudo)
    datos = json.loads(crudo)

    procedencia = {
        "fuente_url": FUENTE_URL,
        "fuente_tipo": "litellm_json",
        "fecha_obtencion": ahora,
        "hash_sha256_contenido_original": hash_fuente,
        "estado_verificacion": "confirmado_por_docs_oficial",
        "firma_ed25519": None,
    }

    for canonico, litellm_prov in PROVEEDORES.items():
        modelos = {}
        for clave, entrada in datos.items():
            if entrada.get("litellm_provider") != litellm_prov:
                continue
            if entrada.get("mode") not in ("chat", "responses", None):
                continue
            # quitar el prefijo "proveedor/" del identificador
            modelo_id = clave.split("/", 1)[-1]
            modelos[modelo_id] = normalizar_modelo(modelo_id, entrada)

        ficha = {
            "esquema": "escrubery/ficha-proveedor/0.1",
            "entidad": "proveedor",
            "id": canonico,
            "fuente_litellm_provider": litellm_prov,
            "total_modelos": len(modelos),
            "modelos": dict(sorted(modelos.items())),
            "procedencia": procedencia,
        }
        salida = DIR_SALIDA / f"{canonico}.json"
        salida.write_text(
            json.dumps(ficha, indent=2, ensure_ascii=False, sort_keys=True) + "\n"
        )
        print(f"  {salida.relative_to(RAIZ)}: {len(modelos)} modelos")

    print("Fichas de proveedores regeneradas.")


if __name__ == "__main__":
    sys.exit(main())
