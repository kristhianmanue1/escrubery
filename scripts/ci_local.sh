#!/usr/bin/env bash
# ci_local.sh — CI local (sustituye a GitHub Actions mientras el billing de
# Actions está agotado; se renueva mensualmente — ver docs/CI.md).
# Misma receta que .github/workflows/ci.yml: install + build + lint (sin
# --fix) + tests (PostgreSQL SIEMPRE; specs de BD nunca excluidas) + tamaños.
# Exit 0 = todo verde; cualquier fallo corta con el código del paso.
set -euo pipefail

RAIZ=$(cd "$(dirname "$0")/.." && pwd)
BACKEND="$RAIZ/backend"
t0=$SECONDS

paso() { printf '\n=== %s ===\n' "$1"; }

paso "1/5 dependencias (npm ci)"
cd "$BACKEND"
npm ci

paso "2/5 build"
npm run build

paso "3/5 lint (sin --fix)"
npx eslint "{src,apps,libs,test}/**/*.ts"

paso "4/5 tests (PostgreSQL activo; specs de BD incluidas)"
npm test

paso "5/5 gate de tamaños (politica-agentes §3)"
cd "$RAIZ"
python3 scripts/check_sizes.py

printf '\nCI LOCAL: VERDE (%s s)\n' "$((SECONDS - t0))"
