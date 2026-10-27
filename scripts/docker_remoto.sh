#!/usr/bin/env bash
# docker_remoto.sh — envoltorio T2 de la tarjeta migración Docker→servidor
# (docs/planning/tarjeta-migracion-docker-servidor.md).
#
# Expone un binario compatible con la superficie docker que escrubery usa
# (build -q --build-arg, info, version, image inspect, run --rm, exec, ps,
# images, pull) ejecutándola por ssh en el host de ESCRUBERY_DOCKER_SSH.
# Consumo: ESCRUBERY_DOCKER_BIN="$(dirname $0)/docker_remoto.sh" \
#          ESCRUBERY_DOCKER_SSH=<alias-ssh> <script-que-usa-docker>
#
# Contrato v0 (límites de la tarjeta):
#   - Allowlist cerrada de subcomandos: cualquier otra cosa exit 2
#     (fail-closed: la superficie remota no es un shell arbitrario).
#   - Serializado: lock local (un build a la vez); espera hasta
#     ESCRUBERY_DOCKER_LOCK_TIMEOUT (default 900 s) y luego exit 3.
#   - `build` con contexto local: el contexto viaja como tar por stdin
#     (docker/podman aceptan `-` como contexto); el resto de args pasa
#     citado seguro (printf %q).
#   - Sin paralelismo, sin reintentos (v0; mejoras = ticket propio).
set -euo pipefail

SSH_HOST="${ESCRUBERY_DOCKER_SSH:-}"
REMOTE_BIN="${ESCRUBERY_DOCKER_REMOTE_BIN:-docker}"
LOCK_TIMEOUT="${ESCRUBERY_DOCKER_LOCK_TIMEOUT:-900}"

if [[ -z "$SSH_HOST" ]]; then
  echo "docker_remoto: ESCRUBERY_DOCKER_SSH no definido (alias ssh del host remoto)" >&2
  exit 2
fi

if [[ $# -lt 1 ]]; then
  echo "docker_remoto: falta subcomando" >&2
  exit 2
fi

SUBCMD="$1"
case "$SUBCMD" in
  info|version|build|run|exec|ps|images|image|pull) ;;
  *)
    echo "docker_remoto: subcomando fuera de allowlist: '$SUBCMD' (fail-closed)" >&2
    exit 2
    ;;
esac

# --- Lock local (serializa; patrón mkdir atómico) ---
LOCK_DIR="/tmp/escrubery-docker-remoto.lock"
esperado=0
while true; do
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "$$" > "$LOCK_DIR/pid"
    trap 'rm -rf "$LOCK_DIR"' EXIT
    break
  fi
  esperado=$((esperado + 5))
  if [[ $esperado -ge $LOCK_TIMEOUT ]]; then
    echo "docker_remoto: lock ocupado más de ${LOCK_TIMEOUT}s (pid $(cat "$LOCK_DIR/pid" 2>/dev/null || echo '?'))" >&2
    exit 3
  fi
  sleep 5
done

# --- Despacho ---
ssh_exec() {
  # cita cada arg de forma segura para la línea remota
  local cmd="" a
  for a in "$@"; do
    cmd+=" $(printf '%q' "$a")"
  done
  ssh -o BatchMode=yes -o ConnectTimeout=15 "$SSH_HOST" \
    "$REMOTE_BIN$cmd"
}

# `build` con contexto local (último arg = directorio existente): el contexto
# viaja como tar por stdin y el destino remoto es `-`.
if [[ "$SUBCMD" == "build" ]]; then
  last="${!#}"
  if [[ -d "$last" ]]; then
    args=("${@:1:$#-1}")
    cmd=""
    for a in "${args[@]}"; do
      cmd+=" $(printf '%q' "$a")"
    done
    # `-` al final: contexto desde stdin
    tar -czf - -C "$last" . | ssh -o BatchMode=yes -o ConnectTimeout=15 \
      "$SSH_HOST" "$REMOTE_BIN$cmd -"
    exit $?
  fi
fi

ssh_exec "$@"
exit $?
