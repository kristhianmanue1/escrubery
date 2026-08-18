# Handoff — controlador qwen (orquestación multiagente, topología T1)

**Fecha:** 2026-08-18 · **De:** Qwen Code supervisor (sesión externa, auditor) · **Para:** qwen-code controlador en tmux `escrubery-qwen-resolver-args`

## Quién eres y dónde estás

Eres el **controlador/auditor** de una tarea delegada en el proyecto **escrubery**, bajo el estándar de orquestación `~/www/AAA_notas_kristhianManuel/aria ideas/orquetacionMultiagenteTemporal/orquestacion-codex-opencode-tmux.md` (topología T1: tú en tmux, ejecutor opencode en tmux, wake-up por AGENT_DONE). Un **supervisor externo** (otro agente Qwen Code) y el **humano orquestador** observan; ellos autorizan merge/PR.

- **Worktree (tu jurisdicción):** `/Users/krisnova/www/aria/escrubery-wt-resolver-args`
- **Rama:** `fix/resolver-args-extra` · **SHA base:** `add1349`
- **Tu sesión/pane tmux:** `escrubery-qwen-resolver-args` · `%204`
- **Sesión/pane del ejecutor:** `escrubery-opencode-resolver-args` · `%205`

## Estado del proyecto (contexto transferido)

- escrubery = servicio de inteligencia sobre modelos y CLIs de IA (NestJS + PostgreSQL + Kysely en `backend/`). Plan v2 (F0–F5) COMPLETO + release v0.3.0.
- El 2026-08-18 se cerraron **H4** (hardening F5) y **H5** (T4b: operación nueva `resolver_identidad_modelo`, contrato §3.9, en CLI/HTTP/MCP). Commits ya en `origin/main` (`75e13ed`, `7bf0d94`, `8294356`, `7ce01eb`).
- **Reglas duras del repo** (lee `AGENTS.md` del worktree al empezar): procedencia obligatoria en todo dato; `datos/fichas/proveedores/` y `datos/fuentes/` NUNCA se editan a mano; `null` antes que inferir; commits convencionales pequeños; español en docs, snake_case en JSON; gate = `bash scripts/ci_local.sh` desde la raíz (o sus partes: build + eslint sin --fix + npm test + `python3 scripts/check_sizes.py`).

## La tarea (piloto del circuito de orquestación)

Fix del **LOW registrado en el adversarial de H5**: el CLI `consultar resolver` (backend/src/cli.ts, caso `resolver`) tolera 3+ argumentos posicionales y descarta en silencio los extras; el contrato exige exit 2 (uso) ante params inválidos. Detalle y DoD: **`docs/planning/tarjeta-fix-resolver-args-intento-1.md`** (léela completa).

## Tu ciclo de trabajo

1. Lee `AGENTS.md` del worktree y la tarjeta completa.
2. **Lanza al ejecutor** en el pane `%205` (ya existe la sesión, con un shell):
   ```bash
   tmux send-keys -l -t %205 -- 'opencode'
   tmux send-keys -t %205 Enter
   ```
   Espera con UNA inspección (`tmux capture-pane -p -t %205 -S -40`) a ver el prompt `Ask anything`; recién entonces:
   ```bash
   tmux send-keys -l -t %205 -- 'Lee completamente docs/planning/tarjeta-fix-resolver-args-intento-1.md y ejecuta la tarea. No hagas commit.'
   tmux send-keys -t %205 Enter
   ```
   Confirma UNA vez que la tarea aparece (capture-pane). Permisos del ejecutor ya abiertos vía `.opencode/opencode.json` del worktree.
3. **Pausa real:** termina tu turno (WAITING_EXTERNAL). Sin polling, sin sleep, sin capture-pane repetidos.
4. El ejecutor te despertará con `AGENT_DONE task=fix-resolver-args run=fix-resolver-args-20260818-01 attempt=1 report=docs/planning/reporte-fix-resolver-args-intento-1.md` (send-keys a tu pane `%204` + Enter).
5. **Audita críticamente** (el reporte es una afirmación, no verdad): `git status --short`, `git diff`, gates (`npm run build`, `npx eslint src/cli.ts` y afectados, `npm test`, `python3 scripts/check_sizes.py` desde la raíz), correspondencia DoD↔diff↔reporte, secretos y cambios fuera de alcance.
6. Si hay fallas: tarjeta de corrección inmutable (intento N+1) + relanza al ejecutor (TUI nueva sin `--continue` si necesitas contexto fresco) + vuelve a WAITING_EXTERNAL.
7. Si todo pasa: **tienes autorización para commitear** en la rama `fix/resolver-args-extra` (commit convencional, chico, solo los archivos de la tarea; NADA de push/merge/PR/tag — eso lo autorizan el supervisor y el humano). Deja constancia del SHA en el reporte final.
8. Al terminar (o ante bloqueo que no puedas resolver), escribe el estado en `docs/planning/ESTADO_CONTROLADOR.md` y avisa: el humano y el supervisor leerán ese archivo. Formato de bloqueo: `AGENT_BLOCKED task=... reason=...`.

## Autoridad (resumen)

| Operación | Ejecutor opencode | Tú (qwen) | Supervisor + humano |
|---|---|---|---|
| editar worktree | sí (alcance tarjeta) | no editas código del fix | no mientras trabajen |
| tests/lint/gates | sí | sí (verificación independiente) | sí |
| commit en la rama | NO | sí, cuando lo consideres adecuado | supervisan |
| push / merge / PR / tag | NO | NO | sí (autorización) |

## Prohibiciones

- push, merge, PR, tag, release, reescritura de historia.
- tocar `datos/fichas/proveedores/`, `datos/fuentes/`, `.an-kla/`, el repo principal (`/Users/krisnova/www/aria/escrubery`) — solo este worktree.
- commitear `.qwen/`, `.opencode/` (configs de permisos de esta orquestación).
- leer/pegar secretos; nada de claves en archivos ni en tus reportes.
