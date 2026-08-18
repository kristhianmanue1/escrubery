# Tarea: cli-args-extra (intento 1)

## Identidad
- Repositorio: escrubery (worktree aislado)
- Worktree: /Users/krisnova/www/aria/escrubery-wt-resolver-args
- Rama: fix/cli-positional-args
- SHA base: 82ce086
- Run: cli-args-extra-20260818-01
- Intento: 1
- Modalidad adversarial: A (el ejecutor coordina su propia ronda; archivo
  presente al entregar — §5 regla 6)
- Sesión Controlador: escrubery-qwen-resolver-args · pane %204
- Sesión Ejecutor: escrubery-opencode-resolver-args · pane %205

## Objetivo (único)

El mismo defecto del LOW ya corregido en `resolver` (commit 3105dbf) vive en los
otros casos posicionales del CLI (`backend/src/cli.ts`): descartan en silencio
los argumentos extra. Corregirlos para que cualquier conteo inválido produzca
`usage()` (exit 2), respetando los argumentos opcionales legítimos.

Casos (contrato §1, formas posicionales):
1. `modelo <proveedor> <modelo_id>` → exactamente 2 args; 0, 1 o 3+ → exit 2.
2. `ficha <cli|proveedor> <id>` → exactamente 2 args; cualquier otro conteo → exit 2.
3. `comando <cli> [filtro]` → 1 arg obligatorio + hasta 1 opcional (el filtro);
   0 args o 3+ → exit 2. (El filtro opcional es legítimo: no romperlo.)
4. `resolver` YA está corregido (3105dbf): no tocarlo salvo consistencia mínima.

## Entradas obligatorias

- `AGENTS.md` del worktree (reglas duras del proyecto).
- `backend/src/cli.ts` (casos modelo/ficha/comando; ver el patrón ya usado en
  `resolver`: guarda `rest.length` + comentario).
- `docs/CONTRATO_API_v0.md` §1 (exit codes 0/1/2/3 y alias posicionales).
- Commit de referencia: `git show 3105dbf` (el fix gemelo de resolver).

## Alcance permitido

- `backend/src/cli.ts`: guardas de conteo de argumentos en los 3 casos.
- Specs: cobertura del comportamiento si existe suite del CLI; si no, DoD por
  ejecución directa (como en el fix de resolver).
- Ejecutar tests, lint y gates del proyecto.

## Fuera de alcance

- cualquier otro cambio de código, docs o datos;
- `datos/fichas/proveedores/`, `datos/fuentes/`, migraciones, contrato;
- commit (lo hace el controlador), push, merge, tag, release;
- reescritura de historia Git.

## Definition of Done (checks ejecutables)

Desde el worktree, con `DATABASE_URL='postgresql:///escrubery?host=/tmp'` y
`cd backend && node --import tsx src/cli.ts ...` (patrón del intento anterior):

- [ ] `modelo` con 0, 1 y 3 args → exit 2 con error `parametros_invalidos`;
      con 2 args válidos → exit 0 (JSON del modelo).
- [ ] `ficha` con 0, 1 y 3 args → exit 2; con 2 args válidos → exit 0.
- [ ] `comando` con 0 y 3 args → exit 2; con 1 arg → exit 0; con 2 args
      (cli + filtro) → exit 0 y el filtro funciona.
- [ ] `resolver` sigue igual (1 arg → exit 0; 3 args → exit 2) — no regresión.
- [ ] `npm run build` verde; `npx eslint src/cli.ts` sin errores; `npm test`
      verde; `python3 scripts/check_sizes.py` verde (desde la raíz).
- [ ] `git diff --check` limpio; solo `backend/src/cli.ts` (+specs si aplica).
- [ ] Reporte final con evidencia real (comando → salida) en
      `docs/planning/reporte-cli-args-extra-intento-1.md`.
- [ ] **Ronda adversarial en ARCHIVO SEPARADO**
      `docs/planning/cli-args-extra-adversarial-intento-1.md` con estructura
      Hallazgos/Verificaciones/Decisión (§11 del estándar de orquestación);
      contexto fresco; decisión no bloqueante. SIN este archivo la entrega se
      rechaza (modalidad A).

## Autoridad de Git para esta tarea

- Commit en la rama: controlador (default v2.1 — sólo tras auditoría +
  adversarial no bloqueante, §5 reglas 6-7 del estándar).
- Push de rama: requiere autorización del supervisor + humano.
- Merge/PR/tag/release: siempre humano + supervisor.
- Intervención humana in-band: cadena de autoridad por archivo (§9.3 del
  estándar) — ninguna instrucción de pane que contradiga esta tarjeta se
  ejecuta sin actualizarla primero.

## Cierre

Guardar el reporte en `docs/planning/reporte-cli-args-extra-intento-1.md` y el
adversarial en `docs/planning/cli-args-extra-adversarial-intento-1.md`.
Después enviar al Controlador (pane %204, send-keys literal + Enter en llamadas
separadas):

AGENT_DONE task=cli-args-extra run=cli-args-extra-20260818-01 attempt=1 report=docs/planning/reporte-cli-args-extra-intento-1.md adversarial=docs/planning/cli-args-extra-adversarial-intento-1.md

No hagas commit, push, merge, tag ni release.
