#!/usr/bin/env bash
# Arnés de docker_remoto.sh (T2 de la tarjeta migración) — verificación con
# stub de ssh: nada toca un host real. Patrón de la casa: no-tautología
# (el stub falla si el envoltorio no hace lo que dice).
set -u
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
WRAP="$RAIZ/scripts/docker_remoto.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
FALLOS=0
ok() { echo "  OK: $1"; }
mal() { echo "  FALLO: $1"; FALLOS=$((FALLOS + 1)); }

# stub de ssh: registra argv y stdin; simula eco del comando remoto
mkdir -p "$TMP/bin"
cat > "$TMP/bin/ssh" <<STUB
#!/usr/bin/env bash
echo "\$@" >> "$TMP/argv.log"
cat > "$TMP/stdin.\$(date +%s%N)"
echo "stub-remote-ok"
STUB
chmod +x "$TMP/bin/ssh"
export PATH="$TMP/bin:$PATH"
export ESCRUBERY_DOCKER_SSH=stub-host

echo "== 1. sin ESCRUBERY_DOCKER_SSH -> exit 2"
( env -u ESCRUBERY_DOCKER_SSH bash "$WRAP" info >/dev/null 2>&1 ); [[ $? -eq 2 ]] && ok "exit 2 sin host" || mal "debería exit 2"

echo "== 2. subcomando fuera de allowlist -> exit 2"
bash "$WRAP" rmi imagen >/dev/null 2>&1; [[ $? -eq 2 ]] && ok "exit 2 rmi rechazado" || mal "allowlist no cierra"

echo "== 3. passthrough info: comando remoto citado"
out=$(bash "$WRAP" info 2>/dev/null); [[ "$out" == "stub-remote-ok" ]] && ok "info pasa por ssh" || mal "info no llegó"
grep -q "docker info" "$TMP/argv.log" && ok "remoto: 'docker info'" || mal "comando remoto incorrecto: $(tail -1 "$TMP/argv.log")"

echo "== 4. build con contexto local: tar por stdin con el Dockerfile dentro"
mkdir -p "$TMP/ctx" && echo "FROM scratch" > "$TMP/ctx/Dockerfile"
rm -f "$TMP"/stdin.*
out=$(bash "$WRAP" build -q --build-arg VERSION=1.2.3 -t img:1 "$TMP/ctx" 2>/dev/null)
[[ "$out" == "stub-remote-ok" ]] && ok "build ejecutó" || mal "build falló"
last=$(tail -1 "$TMP/argv.log")
echo "$last" | grep -q "build" && echo "$last" | grep -q -- "-" && ok "remoto termina en contexto '-'" || mal "sin '-': $last"
tar -tzf "$TMP"/stdin.* 2>/dev/null | grep -q "Dockerfile" && ok "stdin es tar con Dockerfile" || mal "stdin no es tar del contexto"

echo "== 5. run --rm sin contexto: pasa textual"
rm -f "$TMP"/stdin.*
bash "$WRAP" run --rm img:1 --version >/dev/null 2>&1
tail -1 "$TMP/argv.log" | grep -q "run --rm img:1 --version" && ok "run textual" || mal "run alterado: $(tail -1 "$TMP/argv.log")"

echo "== 6. lock liberado tras corrida"
[[ ! -d /tmp/escrubery-docker-remoto.lock ]] && ok "lock limpio" || { mal "lock huérfano"; rm -rf /tmp/escrubery-docker-remoto.lock; }

echo "== fin: $FALLOS fallos"
[[ $FALLOS -eq 0 ]]
