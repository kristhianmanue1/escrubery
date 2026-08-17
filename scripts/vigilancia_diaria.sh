#!/usr/bin/env bash
# vigilancia_diaria.sh — T5 del plan de deuda: pollers + alertas con exit codes
# diferenciados. Cadencias plan v2 §5.1: diario opencode/claude-code/codex-cli,
# semanal el resto (con repo_url; antigravity-cli sin repo queda fuera).
#
# Exit codes: 0 = OK sin alertas; 10 = hay alerta fix_seguridad/breaking_change
# en la ventana de 24 h (cualquiera, no solo nuevas); 2 = infra caída (BD
# inalcanzable, GitHub error, etc.). Nunca se mezcla "alerta real" con "infra".
#
# Estado y logs en var/vigilancia/ (gitignored). Instalación: docs/VIGILANCIA.md.
set -uo pipefail

# launchd ejecuta con PATH mínimo (/usr/bin:/bin): añadir ubicaciones estándar
# de node/python3 (Homebrew en Apple Silicon e Intel) para que los pollers arranquen.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

RAIZ=$(cd "$(dirname "$0")/.." && pwd)
BACKEND="$RAIZ/backend"
VDIR="${ESCRUBERY_VIGILANCIA_DIR:-$RAIZ/var/vigilancia}"
ESTADO="$VDIR/estado.json"
LOGDIR="$VDIR/logs"
mkdir -p "$LOGDIR"
LOG="$LOGDIR/vigilancia-$(date -u +%Y-%m-%dT%H%M%SZ).log"
exec > >(tee -a "$LOG") 2>&1
# Registra el exit code final también en corridas que terminan antes del
# epílogo (precheck, infra) — el log siempre dice cómo terminó.
trap 'rc=$?; echo "== fin (trap) — exit $rc =="; exit $rc' EXIT

DIARIOS=(opencode claude-code codex-cli)
SEMANALES=(grok-build kimi-code cline grok-cli-community)

echo "== vigilancia escrubery — $(date -u +%Y-%m-%dT%H:%M:%SZ) =="

# --- Precheck de infraestructura (exit 2, no 10: infra ≠ alerta) ---
if command -v pg_isready >/dev/null 2>&1; then
  PGURL=$(grep -E '^DATABASE_URL=' "$BACKEND/.env" 2>/dev/null | cut -d= -f2- || true)
  if ! pg_isready -q ${PGURL:+-d "$PGURL"}; then
    echo "PRECHECK FALLIDO: PostgreSQL no disponible (pg_isready). Infra caída, no es una alerta."
    exit 2
  fi
  echo "precheck: PostgreSQL OK"
else
  echo "precheck: pg_isready no disponible; se delega al primer comando (fallos de BD saldrán como exit 2)"
fi

# ¿Toca corrida semanal? (>= 7 días desde la última; primera corrida: sí)
HACER_SEMANAL=$(python3 - "$ESTADO" <<'PY'
import json, sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
p = Path(sys.argv[1])
try:
    est = json.loads(p.read_text())
    ult = datetime.fromisoformat(est["ultima_semanal"].replace("Z", "+00:00"))
    print("0" if datetime.now(timezone.utc) - ult < timedelta(days=7) else "1")
except Exception:
    print("1")
PY
)
if [ -z "$HACER_SEMANAL" ]; then
  echo "FALLO evaluando estado semanal (HACER_SEMANAL vacío): tratado como infra"
  exit 2
fi
echo "semanal este ciclo: $HACER_SEMANAL"

cd "$BACKEND"

run_node() {
  if ! node --env-file=.env --import tsx "$@"; then
    echo "FALLO DE INFRAESTRUCTURA en: $* (ver log)"
    exit 2
  fi
}

# --- Pollers (sin token: presupuesto conservador, ~4-9 req/día) ---
for cli in "${DIARIOS[@]}"; do
  echo "-- poller diario: $cli"
  run_node src/evidentia/poller_github.ts --cli "$cli"
done
if [ "$HACER_SEMANAL" = "1" ]; then
  for cli in "${SEMANALES[@]}"; do
    echo "-- poller semanal: $cli"
    run_node src/evidentia/poller_github.ts --cli "$cli"
  done
fi
# --- Poller vulnerable-mcp (fuente pasiva; solo si hay fuente configurada) ---
VMCP_FUENTE="${VULNERABLE_MCP_URL:-$RAIZ/datos/fuentes/vulnerable_mcp/advisories.json}"
if [ -f "$VMCP_FUENTE" ] || [ -n "${VULNERABLE_MCP_URL:-}" ]; then
  echo "-- poller vulnerable-mcp"
  run_node src/evidentia/poller_vulnerable_mcp.ts --fuente "$VMCP_FUENTE"
else
  echo "-- poller vulnerable-mcp: OMITIDO (sin fuente local ni VULNERABLE_MCP_URL; feed real pendiente de insumo)"
fi

# --- Alertas alta severidad (<24h) ---
echo "-- alertas"
ALERTAS_OUT="$VDIR/alertas_ultima.json"
if ! node --env-file=.env --import tsx src/evidentia/alertas.ts > "$ALERTAS_OUT"; then
  echo "FALLO DE INFRAESTRUCTURA en alertas (ver log)"
  exit 2
fi
cat "$ALERTAS_OUT"

# Marca nuevas vs conocidas, actualiza estado y decide exit (0/10).
python3 - "$ESTADO" "$ALERTAS_OUT" "$HACER_SEMANAL" <<'PY'
import json, sys
from pathlib import Path
from datetime import datetime, timezone
estado_path, alertas_path, hacer_semanal = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
raw = json.loads(alertas_path.read_text())
alertas = raw["alertas_alta_severidad_ultimas_24h"]
ids = [a["record_id"] for a in raw.get("alertas", [])]
try:
    previo = json.loads(estado_path.read_text())
    previos = set(previo.get("alertas_conocidas", []))
    ultima_semanal = previo.get("ultima_semanal")
except Exception:
    previos, ultima_semanal = set(), None
nuevas = [i for i in ids if i not in previos]
for a in raw.get("alertas", []):
    marca = "NUEVA" if a["record_id"] in nuevas else "ya conocida (no atendida)"
    print(f"ALERTA [{a['categoria']}] {a['cli']}: {a['resumen'][:80]}... ({marca})")
if nuevas:
    print(f"alertas nuevas desde la última corrida: {len(nuevas)}")
ahora = datetime.now(timezone.utc).isoformat()
estado = {
    "ultima_corrida": ahora,
    "alertas_conocidas": sorted(set(ids) | previos),
}
estado["ultima_semanal"] = ahora if hacer_semanal == "1" else (ultima_semanal or ahora)
estado_path.write_text(json.dumps(estado, indent=2) + "\n")
sys.exit(10 if alertas > 0 else 0)
PY
RC=$?
if [ "$RC" != "0" ] && [ "$RC" != "10" ]; then
  echo "FALLO procesando estado/alertas (rc=$RC): tratado como infra"
  exit 2
fi
echo "== fin — exit $RC =="
exit $RC
