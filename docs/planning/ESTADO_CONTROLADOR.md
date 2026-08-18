# Estado del controlador qwen — fix-resolver-args

**Actualizado:** 2026-08-18 · **Estado:** DONE (auditoría aprobada, commit hecho; push/merge/PR pendientes de autorización del supervisor y el humano)

- Run: `fix-resolver-args-20260818-01` · intento 1 (no hizo falta intento 2) · rama `fix/resolver-args-extra` · base `add1349`.
- Ejecutor opencode terminó (`AGENT_DONE` recibido); reporte: `docs/planning/reporte-fix-resolver-args-intento-1.md`.
- Auditoría independiente: APROBADA — diff ↔ reporte ↔ DoD coinciden; gates verdes (build, eslint, 140/140 tests, check_sizes, `git diff --check`); DoD verificado por ejecución (exit 2 para 0 y 3+ args; exit 0 para 1 y 2 args); sin cambios fuera de alcance ni secretos.
- **Commit:** `3105dbf261aff88c3312c1535810c9c8dfb7bde0` (solo `backend/src/cli.ts`, +3/−1). No se commitearon `.opencode/`, `.qwen/`. `docs/planning/` queda sin commitear (contiene el reporte final + esta orquestación; a criterio del supervisor/humano).
- **Pendiente de autorización (supervisor + humano):** push de la rama y merge/PR a `main`.
- Candidato a ticket propio (del adversarial): descarte silencioso de posicionales extra en los casos `modelo`, `ficha` y `comando` del CLI (misma clase de defecto; `comando` necesita guarda `> 2` por su filtro opcional legítimo).
