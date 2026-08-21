# Vigilancia diaria (T5 — plan de deuda)

`scripts/vigilancia_diaria.sh` corre los pollers de GitHub (diario:
opencode/claude-code/codex-cli; semanal: grok-build/kimi-code/cline/
grok-cli-community — antigravity-cli queda fuera hasta tener `repo_url`),
el poller pasivo de Vulnerable MCP y `evidentia:alertas`.

**Exit codes:** `0` OK sin alertas · `10` alerta `fix_seguridad`/`breaking_change`
en 24 h (cualquiera, no solo nuevas — no se silencian las no atendidas) ·
`2` infra caída (BD inalcanzable, GitHub, etc.). Estado en `var/vigilancia/estado.json`
(gitignored); logs fechados en `var/vigilancia/logs/`.

**Alertas de operación (2026-08-21):** además de las alertas de changelog, la
corrida emite `ALERTA [introspeccion_omitida] ...` cuando Docker no está
disponible y la introspección F3 se omite (el inventario vivo queda congelado
hasta que Docker vuelva; los comandos degradan por caducidad solos — omisión
honesta por decreto F3-T2, no cambia el exit code). El campo
`f3_introspeccion` de `estado.json` registra `ok | omitida_docker` por corrida.
**Seam de prueba:** `ESCRUBERY_DOCKER_BIN` permite apuntar el binario de Docker
a un stub que falla, para verificar esa rama sin tumbar el Docker real.

## Instalación (launchd — acción del Mediador)

`~/Library/LaunchAgents/com.escrubery.vigilancia.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.escrubery.vigilancia</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string>
    <string>/Users/krisnova/www/aria/escrubery/scripts/vigilancia_diaria.sh</string>
  </array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/Users/krisnova/www/aria/escrubery/var/vigilancia/launchd.out.log</string>
  <key>StandardErrorPath</key><string>/Users/krisnova/www/aria/escrubery/var/vigilancia/launchd.err.log</string>
</dict></plist>
```

```bash
mkdir -p ~/Library/LaunchAgents
# guardar el plist arriba y luego:
launchctl load ~/Library/LaunchAgents/com.escrubery.vigilancia.plist
launchctl start com.escrubery.vigilancia   # corrida manual inmediata
# para desinstalar: launchctl unload ~/Library/LaunchAgents/com.escrubery.vigilancia.plist
```

La métrica "<24 h" solo se declara operativa tras la primera corrida instalada.
Sin token de GitHub (insumo opcional del Mediador): presupuesto conservador
(~4-9 req/día, muy por debajo de 60 req/h).

**Nota (2026-08-17):** el script exporta `PATH` con las ubicaciones estándar de
Homebrew porque launchd arranca con PATH mínimo (`node: command not found` en la
primera corrida instalada). Si node vive en otra ruta, ajustar la línea del PATH.

## Semántica de versiones (F3)

- `cli_productos.version_actual` = **versión publicada** por el maintainer (última release de GitHub; la escribe el poller).
- `cli_comandos.version_confirmada` = versión del binario del sandbox que corroboró el comando (la escribe la introspección).
- `cli_productos.fecha_ultima_version` = fecha de **observación** del sandbox (no fecha de publicación de la release).
- Rebuild: solo cuando sandbox != publicada, con `--build-arg VERSION` (el npm install re-ejecuta solo cuando la versión cambia de verdad).
