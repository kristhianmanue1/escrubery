#!/usr/bin/env bash
# ankla_auditoria.sh — Pieza 3 (L3 post-hoc): reporte del gate de memoria.
# Lee var/ankla-gate/log.jsonl y resume: sesiones, inyecciones al arranque vs
# lazy, bloqueos, degradaciones. --limpiar-test borra sellos/log de session_id
# test-* (las corridas de verificación no contaminan la auditoría).
set -uo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
GATE_DIR="$RAIZ/var/ankla-gate"
LOG="$GATE_DIR/log.jsonl"

if [ "${1:-}" = "--limpiar-test" ]; then
  find "$GATE_DIR" -name 'test-*.seal' -delete 2>/dev/null
  [ -f "$LOG" ] && python3 - "$LOG" <<'PY'
import json, sys
lineas = []
for l in open(sys.argv[1]):
    try:
        if not json.loads(l).get("session_id","").startswith("test-"):
            lineas.append(l)
    except Exception:
        pass
open(sys.argv[1],"w").writelines(lineas)
PY
  echo "sellos y eventos test-* limpiados"
  exit 0
fi

[ -f "$LOG" ] || { echo "sin log aún (ninguna sesión ha pasado por el gate)"; exit 0; }

python3 - "$LOG" <<'PY'
import json, sys
from collections import Counter
eventos = []
for l in open(sys.argv[1]):
    try: eventos.append(json.loads(l))
    except Exception: pass
por_tipo = Counter(e["tipo"] for e in eventos)
sesiones = {e["session_id"] for e in eventos}
arranque = {e["session_id"] for e in eventos if e["tipo"] == "session_start_inject"}
creadas = {e["session_id"] for e in eventos if e["tipo"] == "session_created_exec"}
lazy = {e["session_id"] for e in eventos if e["tipo"] == "lazy_inject"}
escribieron = {e["session_id"] for e in eventos if e["tipo"] in ("gate_pass","gate_pass_degraded")}
sin_memoria_previa = escribieron - arranque - creadas - lazy
print(json.dumps({
  "eventos_totales": len(eventos),
  "por_tipo": dict(por_tipo),
  "sesiones": len(sesiones),
  "inyeccion_al_arranque_claude": len(arranque),
  "ejecucion_al_crear_opencode": len(creadas),
  "remediadas_lazy": len(lazy),
  "sesiones_que_escribieron": len(escribieron),
  "escribieron_sin_memoria_previa": len(sin_memoria_previa),
  "detalle_sin_memoria": sorted(sin_memoria_previa)[:5],
}, ensure_ascii=False, indent=2))
PY
