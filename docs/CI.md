# CI — nube desactivada por presupuesto, CI local vigente

> Para agentes futuros (decisión del Mediador, 2026-08-17). Este archivo es el
> puntero canónico; el detalle operativo vive aquí y en `bitacora_ciclos.md`.

## Situación

- **GitHub Actions sin presupuesto** (billing agotado; **se renueva cada mes**).
  El workflow `ci` está en `.github/workflows/ci.yml` **desactivado como
  auto-trigger** (`on: workflow_dispatch`) para no acumular corridas fallidas
  rojas. No es un fallo del código: la corrida `32050842683` nunca arrancó
  ("recent account payments have failed or your spending limit…").
- **CI vigente = local**: `scripts/ci_local.sh` (misma receta: npm ci + build +
  eslint sin `--fix` + `npm test` con PostgreSQL siempre + `check_sizes.py`).
  Correrlo y pegar salida es evidencia válida de gate en este repo.
- **`gh` disponible con scope administrador** en `kristhianmanue1/escrubery`
  (ver runs, jobs, workflows, releases, etc.). `commit`/`push` siguen
  requiriendo autorización del Mediador como siempre (AGENTS.md §Git).

## Reglas para agentes

1. **Gate de CI = `scripts/ci_local.sh` verde** (exit 0) mientras Actions
   esté sin presupuesto. No reclamar "CI verde en la nube" — no existe.
2. Al cerrar un ticket, el reporte cita la salida del CI local (o del gate
   local manual, política §5) como evidencia.
3. **Re-activación mensual**: cuando el presupuesto se renueve, el Mediador
   (o un agente autorizado) cambia `on:` del workflow a
   `on: { push: {}, pull_request: {} }`, hace push y verifica con
   `gh run list --limit 1`. Ese commit re-activa el criterio "verde en CI" del
   plan de deuda (§Cierre global).
4. Prueba manual sin esperar push: `gh workflow run ci` + `gh run watch`.
5. `check_sizes.py` y `npm test` corren igual en local y en la nube — no hay
   recetas divergentes.

## Historial

- 2026-08-17: push inicial del workflow → corrida bloqueada por billing →
  desactivado auto-trigger + CI local creado el mismo día (fila T3bis en
  `bitacora_ciclos.md`).
