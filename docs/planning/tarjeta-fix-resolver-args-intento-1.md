# Tarea: fix-resolver-args (intento 1)

## Identidad
- Repositorio: escrubery (worktree aislado)
- Worktree: /Users/krisnova/www/aria/escrubery-wt-resolver-args
- Rama: fix/resolver-args-extra
- SHA base: add1349
- Run: fix-resolver-args-20260818-01
- Intento: 1
- Sesión controlador (qwen): escrubery-qwen-resolver-args · pane %204
- Sesión ejecutor (tú, opencode): escrubery-opencode-resolver-args · pane %205

## Objetivo (único)

Corregir el LOW del adversarial H5: el caso `resolver` del CLI (`backend/src/cli.ts`) tolera 3+ argumentos posicionales y descarta en silencio los extras. Debe rechazarlos con `usage()` (exit 2), igual que el resto de usos inválidos.

## Entradas obligatorias

- `AGENTS.md` del worktree (reglas duras del proyecto).
- `backend/src/cli.ts` (caso `resolver`, ~línea 115).
- Contrato: `docs/CONTRATO_API_v0.md` §1 (exit codes 0/1/2/3) y §3.9 (formas válidas del resolver).

## Alcance permitido

- `backend/src/cli.ts`: validación de cantidad de argumentos en el caso `resolver` (1 arg = issuer_id; 2 args = modelo_id + endpoint; cualquier otra cantidad → `usage()`).
- Specs: añadir/ajustar cobertura del comportamiento (si existe spec del CLI; si no, la verificación será manual por DoD).
- Ejecutar tests, lint y gates del proyecto.

## Fuera de alcance

- cualquier otro cambio de código, docs o datos;
- `datos/fichas/proveedores/`, `datos/fuentes/`, migraciones, contrato;
- commit (lo hace el controlador), push, merge, tag, release;
- reescritura de historia Git.

## Definition of Done (checks ejecutables)

- [ ] `cd /Users/krisnova/www/aria/escrubery-wt-resolver-args && ./scripts/consultar resolver a b c` → exit 2 con error `parametros_invalidos` por stdout/stderr según patrón del CLI. *(El wrapper `scripts/consultar` corre desde el repo con su `.env`; si el worktree no tiene `.env`, verifica directo con node: `cd backend && DATABASE_URL=... node --import tsx src/cli.ts resolver a b c` → exit 2. Deja constancia del comando exacto usado.)*
- [ ] `./scripts/consultar resolver claude-sonnet-5-cowork` → exit 0, JSON `resuelto:true` (1 arg sigue funcionando).
- [ ] `./scripts/consultar resolver qwen3.8-max https://dashscope.aliyuncs.com` → exit 0 (2 args sigue funcionando).
- [ ] `cd backend && npm run build` verde; `npx eslint src/cli.ts` sin errores; `npm test` verde (140+ tests).
- [ ] `python3 scripts/check_sizes.py` verde (desde la raíz del worktree).
- [ ] `git diff --check` limpio; solo archivos del alcance tocados.
- [ ] Reporte final con evidencia real (comando → salida) en `docs/planning/reporte-fix-resolver-args-intento-1.md`.
- [ ] Ronda adversarial con contexto fresco (subagente propio): hallazgos BLOCKER/HIGH/MED/LOW, correcciones aplicables repetidas, decisión `proceed` documentada en el reporte.

## Nota de entorno

La BD real (`escrubery`) está disponible en el host (socket `/tmp`); la BD de test (`escrubery_test`) la crean los specs. No necesitas migrar nada: este fix es solo de validación del CLI.

## Cierre

Guarda el reporte en `docs/planning/reporte-fix-resolver-args-intento-1.md`. Después envía al controlador (pane %204, send-keys literal + Enter en llamadas separadas):

```text
AGENT_DONE task=fix-resolver-args run=fix-resolver-args-20260818-01 attempt=1 report=docs/planning/reporte-fix-resolver-args-intento-1.md
```

No hagas commit, push, merge, tag ni release.
