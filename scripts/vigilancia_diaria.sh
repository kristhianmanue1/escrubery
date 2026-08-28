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
SEMANALES=(grok-build kimi-code cline grok-cli-community qwen-code)
# Seam de prueba: permite apuntar a un stub que falla (verificación de la rama
# de omisión sin tumbar el Docker real). Documentado en docs/VIGILANCIA.md.
DOCKER_BIN="${ESCRUBERY_DOCKER_BIN:-docker}"

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

FALLOS=0
run_node() {
  if ! node --env-file=.env --import tsx "$@"; then
    echo "FALLO en: $* (continuando con el resto; se reportará exit 2 al final)"
    FALLOS=$((FALLOS + 1))
    return 1
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

# --- Introspección activa F3 (presupuesto ~0: solo --help/--version en
# --- contenedor efímero; decreto Mediador 2026-08-17). Diarios siempre;
# --- semanales con ToS curado (qwen-code) cuando toca la ventana semanal.
# --- Requiere Docker: si no está disponible, se omite con nota (las ventanas
# --- de vigencia degradan los comandos solos — honesto, no silencioso).
F3_SEMANALES=(qwen-code cline kimi-code)

# Version publicada por el maintainer (la escribe el poller F2 en BD).
consultar_version() {
  cd "$BACKEND" && node --env-file=.env --import tsx -e "
import { crearKysely } from './src/db/kysely';
async function main() {
  const db = crearKysely(process.env.DATABASE_URL!);
  const r = await db.selectFrom('cli_productos').select('version_actual')
    .where('nombre', '=', process.argv[1] ?? '').executeTakeFirst();
  console.log(r?.version_actual ?? '');
  await db.destroy();
}
main();
" "$1"
}

# ¿La versión candidata ($1) es semver-Mayor que la base ($2)? Exit 0 solo si
# sí; igualdad o indecidible (alguna no parseable) → exit 1 (fail-closed:
# nunca rebuild hacia abajo; incidente cline desktop-v0.0.17, 2026-08-28).
version_es_mayor() {
  [ "$1" = "$2" ] && return 1
  node --env-file=.env --import tsx -e "
import { versionMayor } from './src/evidentia/versiones';
process.exit(versionMayor(process.argv[1] ?? '', process.argv[2] ?? '') ? 0 : 1);
" "$1" "$2"
}

# Construye la imagen del CLI con la version indicada (build-arg); falla con
# nota y FALLOS+1 (resiliente: el resto de la corrida continúa).
construir() {
  local cli="$1" imagen="$2" version="$3"
  case "$cli" in
    codex-cli) local dockerfile=Dockerfile.codex ;;
    *) local dockerfile="Dockerfile.$cli" ;;
  esac
  if ! "$DOCKER_BIN" build -q --build-arg "VERSION=$version" -t "$imagen" \
    "$RAIZ/docker/sandbox" -f "$RAIZ/docker/sandbox/$dockerfile" >/dev/null; then
    echo "FALLO construyendo $imagen (continuando con el resto)"
    FALLOS=$((FALLOS + 1))
    return 1
  fi
  return 0
}

F3_ESTADO="ok"
if command -v "$DOCKER_BIN" >/dev/null 2>&1 && "$DOCKER_BIN" info >/dev/null 2>&1; then
  # ¿La última release conocida (poller F2) es más nueva que la version del
  # sandbox (cli_productos.version_actual)? Si sí, rebuild con --pull: sin
  # esto la imagen cachea el npm install y el inventario queda congelado en
  # la versión del primer build (HIGH adversarial r2; criterio §6.2).
  CLIS_F3=("${DIARIOS[@]}")
  [ "$HACER_SEMANAL" = "1" ] && CLIS_F3+=("${F3_SEMANALES[@]}")
  for cli in "${CLIS_F3[@]}"; do
    echo "-- F3 introspección: $cli"
    IMAGEN="escrubery-sandbox-$cli"
    if ! "$DOCKER_BIN" image inspect "$IMAGEN" >/dev/null 2>&1; then
      echo "   imagen $IMAGEN ausente: construyendo (@latest; si diverge, se autocorrige mañana)"
      if ! construir "$cli" "$IMAGEN" "latest"; then continue; fi
    else
      # Version del binario del sandbox vs version_publicada (poller) en BD:
      # rebuild solo si la publicada es semver-Mayor (la capa npm se invalida
      # naturalmente porque cambia el comando; sin --no-cache, presupuesto ~0).
      # "!=" admitía contaminación hacia abajo (incidente cline 2026-08-28).
      V_SANDBOX=$("$DOCKER_BIN" run --rm "$IMAGEN" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+[0-9.]*([-._][0-9A-Za-z.]+)?' | head -1)
      V_BD=$(consultar_version "$cli")
      if [ -z "$V_BD" ]; then
        echo "   aviso: sin version_publicada en BD para $cli (¿query fallo?); sin rebuild"
      elif [ -n "$V_SANDBOX" ] && version_es_mayor "$V_BD" "$V_SANDBOX"; then
        echo "   versión publicada ($V_BD) > sandbox ($V_SANDBOX): rebuild @${V_BD}"
        if ! construir "$cli" "$IMAGEN" "$V_BD"; then continue; fi
      fi
    fi
    run_node src/f3/sandbox_introspeccion.ts "$cli"
  done
else
  # Incidencia 2026-08-21: esta omisión vivía solo como nota enterrada en el
  # log y el inventario vivo quedó congelado un día sin señal visible. Ahora
  # se marca como ALERTA y queda en estado.json (f3_introspeccion) para el
  # operador. Exit sin cambio por decreto F3-T2 (omisión honesta ≠ infra caída).
  echo "ALERTA [introspeccion_omitida] Docker no disponible: F3 omitida hoy; los comandos degradan por caducidad solos (inventario vivo congelado hasta que Docker vuelva)"
  F3_ESTADO="omitida_docker"
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
python3 - "$ESTADO" "$ALERTAS_OUT" "$HACER_SEMANAL" "$F3_ESTADO" <<'PY'
import json, sys
from pathlib import Path
from datetime import datetime, timezone
estado_path, alertas_path = Path(sys.argv[1]), Path(sys.argv[2])
hacer_semanal, f3_estado = sys.argv[3], sys.argv[4]
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
    "f3_introspeccion": f3_estado,
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

# --- F4a: checkpoint del día + sello RFC 3161 (corre también con RC=10 y con
# --- FALLOS>0: ancla lo que haya; solo se omite si la infra murió antes).
echo "-- checkpoint + sello (F4a)"
run_node src/evidentia/cli_checkpoint.ts
run_node src/evidentia/cli_sellar.ts

# --- Custodia git de checkpoints (AUTORIZADO por el Mediador 2026-08-17):
# commit+push de SOLO datos/checkpoints/ — el anclaje externo es TSA + remoto.
if git -C "$RAIZ" status --porcelain -- datos/checkpoints 2>/dev/null | grep -q .; then
  if git -C "$RAIZ" add datos/checkpoints && \
     git -C "$RAIZ" commit -m "chore(checkpoint): anclaje diario $(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null; then
    if git -C "$RAIZ" push origin main >/dev/null 2>&1; then
      echo "custodia: checkpoint commiteado y pusheado (anclaje externo completo)"
    else
      echo "FALLO push de checkpoints (custodia degradada a local; revisar credencial gh)"
      FALLOS=$((FALLOS + 1))
    fi
  else
    echo "FALLO commit de checkpoints"
    FALLOS=$((FALLOS + 1))
  fi
fi

if [ "$FALLOS" -gt 0 ]; then
  echo "== fin — exit 2 ($FALLOS fallo(s) de poller/introspección durante la corrida) =="
  exit 2
fi
echo "== fin — exit $RC =="
exit $RC
