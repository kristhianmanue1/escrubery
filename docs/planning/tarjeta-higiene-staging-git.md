# Tarea: higiene-staging-git (propuesta de ticket)

**Estado:** PROPUESTO — espera decreto del Mediador. **Fecha:** 2026-08-21.
**Origen:** desviación registrada en `bitacora_ciclos.md` (commit `466af40` incorporó
`docs/investigacion/Propuesta_Harness_Runtime_Assurance.md` fuera del alcance de su mensaje).
**Tamaño estimado:** 0.25 ciclos.

## Objetivo (único)

Eliminar la clase de defecto, no el caso. El incidente de `466af40` no fue un error de
juicio: fue la primitiva. `git add -A` compone el commit **por ausencia de exclusión** —
el contenido depende de qué quedó suelto en el árbol de trabajo, no de qué se quiso
entregar. Mientras esa primitiva siga en uso, el defecto se repite con probabilidad 1.

Observación que fija el diagnóstico: `scripts/vigilancia_diaria.sh:233` ya hace lo
correcto (`git add datos/checkpoints`, staging explícito por ruta) porque fue escrito con
la disciplina que se exige a una acción automatizada. El trabajo manual quedó con la
primitiva más débil. Se trata de nivelar hacia arriba.

## Alcance permitido

1. **`AGENTS.md` §Git — regla nueva (aditiva, ≤3 líneas):** el staging se hace por ruta
   explícita. `git add -A`, `git add .` y `git commit -a` quedan prohibidos para trabajo
   de agente. Antes de commitear, `git status --porcelain` se revisa y todo path que entre
   debe corresponder al alcance declarado en el mensaje.

2. **Gate mecánico `scripts/hooks/pre-commit` + instalador idempotente:**
   falla (exit 1) cuando el índice contiene un archivo **antes sin trackear** (`git diff
   --cached --diff-filter=A --name-only`) cuyo path no aparezca citado en el mensaje del
   commit, salvo rutas en una allow-list corta y justificada (`datos/fuentes/`,
   `datos/checkpoints/`, `docs/investigacion/probes/`).
   - Nota honesta: `.git/hooks/` **no se versiona** (verificado: hoy no hay ninguno
     instalado y no hay husky). El hook vive en `scripts/hooks/` y se instala con
     `scripts/instalar_hooks.sh`; es una barrera local, evadible con `--no-verify`.
     En la escala L1–L4 de la propuesta HRA esto es **L3 (verificada)**, no L4. Declararlo
     así en el propio ticket es parte del entregable: el proyecto no se auto-sobrevende.

3. **Verificación por ejecución (DoD):** commit de prueba con un archivo nuevo no citado →
   rechazado; el mismo archivo citado en el mensaje → aceptado; commit sin archivos nuevos →
   no afectado; `datos/checkpoints/` (ruta del job automático de las 09:00) → no afectado,
   comprobado contra `scripts/vigilancia_diaria.sh` sin modificarlo.

## Fuera de alcance

- Reescribir la historia de `466af40` (decidido en contra; ver bitácora).
- Tocar `scripts/vigilancia_diaria.sh` — ya cumple la regla.
- Cualquier `commit`/`push` sin autorización explícita del Mediador (`AGENTS.md` §Git).

## Criterio de aceptación

Regla en `AGENTS.md`, hook + instalador con los 4 casos de la §3 verificados por ejecución
con salida citada, `python3 scripts/check_sizes.py` verde, CI local verde. El ticket declara
su propio peldaño (L3) y no afirma enforcement que no tiene.
