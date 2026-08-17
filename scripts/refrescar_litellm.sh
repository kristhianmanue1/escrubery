#!/usr/bin/env bash
# refrescar_litellm.sh — T6 del plan de deuda: refresco idempotente de la capa
# LiteLLM: descarga -> hash -> regenera fichas -> re-ingesta (vigencia fresca).
# Re-ejecutarlo sin cambios en la fuente no altera los hashes de contenido
# (fecha_obtencion/vigente_hasta sí se renuevan: es una obtención nueva).
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/.." && pwd)

echo "== descarga + regeneración de fichas =="
python3 "$RAIZ/scripts/generar_fichas_modelos.py"

echo "== re-ingesta en PostgreSQL =="
cd "$RAIZ/backend"
node --env-file=.env --import tsx src/db/ingestar.ts

echo "== refresco completado =="
