# Guía canónica de OpenCode en escrubery

**Qué es:** el único punto de entrada para saber cómo se usa OpenCode en este
proyecto: qué es vigente, qué es interno, qué es experimental y qué es sólo
evidencia histórica. Esta guía es un **subconjunto curado**: la lista canónica
de comandos es la captura sandbox vigente, no esta tabla.

**Versión observada y procedencia:**

| Evidencia | Versión | Fecha | Fuente |
|---|---|---|---|
| Captura sandbox vigente (canónica) | 1.18.27 | 2026-09-03 | `datos/fuentes/sandbox/opencode/2026-09-03T21:31:11.181Z.txt` |
| Captura de referencia del issue #3 | 1.18.23 | 2026-08-27 | `datos/fuentes/sandbox/opencode/2026-08-27T15:00:15.319Z.txt` |
| Observación interactiva (host del Mediador) | 1.18.29 | 2026-09-05 | sesión del Ejecutor; misma superficie de comandos que 1.18.27 |

La superficie de comandos de primer nivel es idéntica en las tres. Entre
versiones de parche no se observaron cambios de superficie (la vigilancia F3
compara el hash del `--help` en cada rebuild).

**Gate de consistencia:** `python3 scripts/verificar_divergencia_opencode.py`
(comparación ficha↔captura; corre en `scripts/ci_local.sh`). exit 0 =
consistente · 1 = divergencia · 2 = insumo ausente.

**Esta guía no es una instrucción ni un grant.** Documenta; no autoriza. Ni
ejecuta modelos, ni toca credenciales, ni amplía permisos.

---

## 1. Qué es OpenCode aquí

CLI comunitario open source (MIT, Anomaly — `anomalyco/opencode`). En el
ecosistema es el **controlador principal**: la herramienta con la que se
desarrolla el propio escrubery (dogfooding) y la que corre los modelos
configurados vía providers (GLM y otros). Ficha curada:
`datos/fichas/clis/opencode.json` — la ficha registra el subconjunto de
comandos de uso corriente; **no pretende ser exhaustiva**.

## 2. Superficie CLI vigente (estable, con cadencia rápida upstream)

Comandos de primer nivel según la captura vigente. Los flujos de uso diario
del ecosistema son: TUI, `run`, `serve`, `providers`, `models`, `agent`,
`session` y `export`.

| Comando | Qué hace | Notas |
|---|---|---|
| `opencode [proyecto]` | TUI interactiva (default) | el modo humano |
| `opencode run [mensaje..]` | no interactivo: prompt directo para scripting | flags `-m/--model`, `-c/--continue`, `-s/--session`, `--fork` |
| `opencode serve` | servidor headless con API HTTP | ver §3 |
| `opencode attach <url>` | adjuntarse a un servidor ya corriendo | |
| `opencode providers` (alias: `auth`) | gestiona providers y credenciales | `providers list` · `providers login [url]` · `providers logout [provider]`; credenciales en `~/.local/share/opencode/auth.json` |
| `opencode models [provider]` | lista modelos disponibles | |
| `opencode agent` | gestiona agentes | `create`, `list` |
| `opencode session` | gestiona sesiones | `list`, `delete <sessionID>` |
| `opencode export [sessionID]` / `import <file>` | exporta/importa sesiones como JSON | la vía **oficial** para leer historial (ver §3) |
| `opencode mcp` | gestiona servidores MCP | |
| `opencode plugin <módulo>` (alias: `plug`) | instala un plugin y actualiza config | ver §3 (experimental) |
| `opencode github` / `opencode pr <n>` | integración GitHub | no usado por el ecosistema hoy |
| `opencode upgrade` / `uninstall` | gestión del binario | |
| `opencode stats` | uso de tokens y coste | |
| `opencode web` | servidor + interfaz web | |
| `opencode acp` | servidor Agent Client Protocol | |
| `opencode db` / `debug` / `completion` | utilidades | |

**Regla de divergencia:** si esta tabla y la captura sandbox llegaran a
diferir, la captura gana y la ficha se corrige citándola — el gate (§7) existe
para cazarlo.

## 3. Capas: qué es soportado, interno y experimental

| Capa | Estabilidad | Uso recomendado en escrubery |
|---|---|---|
| CLI (`opencode …`) | soportada upstream; cadencia de releases muy rápida (parches diarios) | fijar versión por pin/sandbox; no asumir superficie estable entre minor |
| Sesiones vía `export` JSON | oficial | superficie primaria para leer historial fuera del TUI |
| API HTTP (`serve` + `attach`) | pública upstream | para controladores; sin garantía de congelamiento entre versiones |
| Almacén interno `~/.local/share/opencode/opencode.db` (SQLite) | **interna, sin compromiso de estabilidad** | sólo lecturas agregadas read-only (así lo usa el probe de H6); nunca como dependencia de producto |
| Hooks/plugins (`.opencode/plugins/`) | **experimental** (APIs `event`, `tool.execute.before`, `experimental.chat.system.transform`) | sólo el piloto H8; cada API usada tiene lecciones registradas (ver §4) |

Hallazgos del probe sobre el almacén interno (`docs/investigacion/probes/opencode-2026-08-21.md`,
815 sesiones reales): no existe marcador de `turno_fallido`, `turno_interrumpido`
ni `sesion_cerrada`; `step-finish` cuenta **pasos** de asistente, no turnos; el
evento de creación de sesión era `session.created.1`. Nada de eso debe
interpretarse como contrato.

## 4. Evidencia histórica NO reutilizable

- `docs/planning/HANDOFF_CONTROLADOR.md` — procedimiento para una sesión
  concreta (panes tmux, worktrees); es registro de un día, no procedimiento
  vigente.
- Iteraciones antiguas del plugin `ankla_gate.ts` — sus claims fueron
  refutados en vivo (T6: hook directo `session.created` era código muerto;
  T7: el sello caía en `sin-session-id`; T7b: la primera llamada LLM puede ser
  la generación del título). El plugin actual es la lección; sus comentarios
  son el registro.
- Capturas sandbox de versiones pasadas (`datos/fuentes/sandbox/opencode/*.txt`)
  — cada `.txt` es una foto fechada; la vigente es la de timestamp mayor.

Regla: un handoff describe una sesión que ocurrió; no autoriza repetirla ni
describe el estado actual.

## 5. Restricciones de seguridad observadas (verificadas por ejecución)

Del reporte de verificación activa (`docs/investigacion/hra/reporte-verificacion-2026-08-22.md`,
opencode 1.18.21, contrastes V7):

- **Un deny por herramienta no niega la capacidad (V7b, CONFIRMADO en vivo):**
  con `read` denegado sobre `.env`, `bash cat .env` devolvió el token completo
  en la salida. Negar `read` NO cubre la norma; la frontera está en la
  capacidad (bash), no en la herramienta.
- **En modo no interactivo el runtime pide permiso y auto-rechaza (V7a):**
  `opencode run` sobre `.env` con `read` denegado registra
  `permission requested: read (.env); auto-rejecting`. El deny de la tool es
  real; la norma sigue abierta por V7b.
- Corolario operativo: para proteger secretos frente a un agente en opencode,
  la restricción debe cubrir **todas las vías de lectura** (o gestionarse fuera
  del runtime, nivel L4). Fichas de censo:
  `datos/fichas/curaduria/assurance_opencode.json` y
  `datos/fichas/curaduria/assurance-verificacion/opencode.json`.

## 6. Señales que NO prueban una respuesta terminal del proveedor

- **Sesión creada** (`session.created` / fila en el almacén) prueba que el
  runtime abrió una sesión, no que el proveedor respondió.
- **Primer mensaje `assistant`** puede ser el **título autogenerado** de la
  sesión (small model), no la respuesta al turno del usuario — hallazgo T7b
  en vivo: la inyección se consumía en el title-gen y el log cantaba victoria.
- **Un HTTP 204/aceptación del servidor local** prueba transporte, no
  finalización del modelo.
- **`step-finish`** marca fin de paso, no de turno (puede haber varios por
  turno).

Señal fiable: el contenido completo del part final del turno — y aun así, la
tesis del ecosistema aplica: persistencia ≠ progreso ≠ corrección; el reporte
de un agente es evidencia a corroborar, no autoridad.

## 7. Divergencias ficha↔captura y el gate

**El incidente que motivó esto:** la ficha documentaba `opencode auth login`
(desde docs oficiales del 2026-08-07). La captura 1.18.23 muestra que ese
formato ya no existe: el comando es `opencode providers` (alias `auth`) y el
login vivió como subcomando: `providers login [url]`. La ficha quedó corregida
citando la captura (regla dura #1: procedencia por dato).

**El gate:** `scripts/verificar_divergencia_opencode.py`

- Compara cada comando curado de la ficha contra los comandos primarios y
  alias de la **captura más reciente** de `datos/fuentes/sandbox/opencode/`.
- Reporta además los comandos de la captura no curados (informativo: la ficha
  no es exhaustiva).
- exit 0 consistente · 1 divergencia · 2 insumo ausente (ficha o captura no
  encontradas — falla ruidosamente, nunca pasa en silencio).
- Corre en `ci_local.sh` (paso 6/6) y a mano: `python3 scripts/verificar_divergencia_opencode.py`.
- Acepta `--ficha` / `--captura` para ensayar contra artefactos temporales
  (así se probó su no-tautología: con la ficha vieja, falla).

**Política:** la captura sandbox es la fuente de verdad de la superficie; la
ficha curada la sigue con procedencia; esta guía no repite ningún comando que
la captura no muestre.

## 8. Ejemplos mínimos (sin credenciales ni permisos amplios)

```bash
# Prompt de una sola vez sobre el proyecto actual (no interactivo)
opencode run "resume el diff de git status en una línea"

# Qué modelos hay configurados (sólo lectura de config local)
opencode models | head

# Servidor headless local y sesión adjunta
opencode serve --port 4096
opencode attach http://127.0.0.1:4096

# Historial: listar y exportar una sesión como JSON
opencode session list
opencode export <sessionID> > sesion.json
```

Ninguno requiere claves nuevas ni ejecuta escrituras fuera del proyecto. Para
introspección controlada con fines de datos, la vía canónica es el sandbox de
la vigilancia F3, no el host.

## 9. Mapa de fuentes

| Tema | Hogar canónico |
|---|---|
| Ficha curada (entidad, comandos de uso corriente, procedencia) | `datos/fichas/clis/opencode.json` |
| Superficie de comandos vigente | `datos/fuentes/sandbox/opencode/` (captura de timestamp mayor) |
| Almacén interno: qué se puede y qué no observar | `docs/investigacion/probes/opencode-2026-08-21.md` |
| Seguridad: deny de tool vs capacidad | `docs/investigacion/hra/reporte-verificacion-2026-08-22.md` |
| Censo documental de garantías (L1–L4) | `datos/fichas/curaduria/assurance_opencode.json` · reporte en `docs/investigacion/hra/reporte-censo-2026-08-22.md` |
| Plugin experimental y sus lecciones | `.opencode/plugins/ankla_gate.ts` |
| Gate de divergencia | `scripts/verificar_divergencia_opencode.py` |
