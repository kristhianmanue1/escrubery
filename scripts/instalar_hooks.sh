#!/usr/bin/env bash
# instalar_hooks.sh — instala los hooks de higiene (idempotente).
# La barrera es local y evadible con --no-verify (L3, no L4 — así se declara).
set -euo pipefail
RAIZ=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$RAIZ/.git/hooks"
ok=0
for hook in commit-msg; do
  SRC="$RAIZ/scripts/hooks/$hook"
  DST="$RAIZ/.git/hooks/$hook"
  if ! [ -f "$SRC" ]; then
    echo "instalar_hooks: no existe $SRC" >&2
    exit 1
  fi
  if [ -f "$DST" ] && cmp -s "$SRC" "$DST"; then
    echo "instalar_hooks: $hook ya instalado y actualizado"
  else
    cp "$SRC" "$DST"
    chmod +x "$DST"
    echo "instalar_hooks: $hook instalado"
  fi
  ok=$((ok + 1))
done
echo "instalar_hooks: $ok hooks listos"
