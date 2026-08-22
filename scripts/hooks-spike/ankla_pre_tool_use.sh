#!/usr/bin/env bash
# ankla_pre_tool_use.sh — Pieza 2 (L3): gate de escritura.
# Hook PreToolUse (matcher Write|Edit) de claude-code: exit 2 BLOQUEA la llamada.
# Regla: ninguna sesión escribe sin que AN-KLA se haya ejecutado en ella.
# - Sello ok (SessionStart inyectó) → pasa.
# - Sin sello → BLOQUEA la primera escritura, corre resume AHORA (lazy), sella
#   'lazy_inject' y lo registra: el reintento pasa. Garantía: AN-KLA corrió en la
#   sesión antes de escribir (ejecución verificable; la inyección al contexto solo
#   la da SessionStart — el log distingue ambos casos).
# - Sello degraded → pasa con aviso (fail-open declarado; AN-KLA caído no paraliza).
# Barrera L3 evadible (settings editables / --no-verify-equivalents): así se declara.
set -uo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
GATE_DIR="$RAIZ/var/ankla-gate"
LOG="$GATE_DIR/log.jsonl"
mkdir -p "$GATE_DIR"

INPUT=$(cat)
SID=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id",""))' 2>/dev/null || echo "")
TOOL=$(printf '%s' "$INPUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_name","?"))' 2>/dev/null || echo "?")
[ -z "$SID" ] && SID="sin-session-id"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SEAL="$GATE_DIR/$SID.seal"

log_evento() { printf '%s\n' "{\"ts\":\"$1\",\"tipo\":\"$2\",\"session_id\":\"$3\",\"tool\":\"$4\"}" >> "$LOG"; }

if [ -f "$SEAL" ]; then
  ESTADO=$(python3 -c "import json; print(json.load(open('$SEAL')).get('estado','?'))" 2>/dev/null || echo "invalido")
  if [ "$ESTADO" = "degraded" ]; then
    log_evento "$TS" "gate_pass_degraded" "$SID" "$TOOL"
    echo "ankla-gate: AN-KLA degradado en esta sesión — escritura permitida con aviso (fail-open declarado)." >&2
    exit 0
  fi
  if [ "$ESTADO" = "ok" ] || [ "$ESTADO" = "lazy_inject" ]; then
    log_evento "$TS" "gate_pass" "$SID" "$TOOL"
    exit 0
  fi
  # ESTADO invalido/'?' (JSON corrupto o campo ausente): tratar como AUSENTE y
  # caer a la remediación lazy — nunca abrir por defecto (MED-2 adversarial).
fi

# Sin sello: bloquear esta llamada y remediar lazy (AN-KLA corre AHORA en la sesión).
PY="$RAIZ/.venv/bin/python"
"$PY" -m an_kla --project-root "$RAIZ" resume --query "estado del proyecto" --budget 4096 >/dev/null 2>&1
RC=$?
if [ $RC -eq 0 ]; then
  printf '{"estado":"lazy_inject","ts":"%s"}\n' "$TS" > "$SEAL"
  log_evento "$TS" "lazy_inject" "$SID" "$TOOL"
  echo "ankla-gate: esta sesión nació SIN memoria AN-KLA (fallo del hook de arranque o arranque previo a H8). AN-KLA acaba de correr en la sesión (sello lazy). REINTENTA la escritura: pasará. Nota: el contexto no fue inyectado al arranque — el modelo no vio el checkpoint." >&2
else
  printf '{"estado":"degraded","ts":"%s"}\n' "$TS" > "$SEAL"
  log_evento "$TS" "degraded" "$SID" "$TOOL"
  echo "ankla-gate: AN-KLA no disponible (rc=$RC). Escritura bloqueada esta vez; reintentará como degraded y pasará con aviso." >&2
fi
exit 2
