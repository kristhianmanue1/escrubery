# Adversarial — cli-args-extra — intento 1 — 2026-08-18

- Run: `cli-args-extra-20260818-01` · intento 1 · rama `fix/cli-positional-args` · base `82ce086`
- Modalidad A (§5 regla 6): ronda coordinada por el ejecutor, subagente de contexto fresco (`general`, sin historial de autoría), previa a la entrega.
- Objeto: diff sin commitear de `backend/src/cli.ts` (+6/−0) — guardas de conteo de posicionales en `modelo` (exactamente 2), `ficha` (exactamente 2) y `comando` (1 obligatorio + filtro opcional, es decir 0 o 3+ → inválido), conservando las guardas de contenido preexistentes (strings vacíos). Patrón gemelo del fix `resolver` (3105dbf).

## Verificaciones (ejecutadas por el revisor, no por el autor)

| Verificación | Resultado |
|---|---|
| `modelo` 0/1/3/5 args | exit 2, `parametros_invalidos` por stderr, stdout vacío ✓ |
| `modelo moonshot kimi-k2-0905-preview` (2 args válidos) | exit 0, JSON §3.1 ✓ |
| `comando` 0/3/5 args | exit 2 ✓ |
| `comando claude-code` (1 arg) / `comando claude-code mcp` (2 args) | exit 0 ambos; filtro real: 17 comandos → 1 (`claude mcp`) ✓ |
| `ficha` 0/1/3/5 args | exit 2 ✓; `ficha cli claude-code` → exit 0 ✓ |
| `resolver` (sin regresión) | 0/3 args → exit 2; 1 y 2 args siguen por su camino (exit 0/1 según datos) ✓ |
| Contenido `""` (`modelo "" ""`, `comando ""`, `ficha cli ""`) | exit 2 vía guarda de contenido — idéntico al comportamiento pre-diff ✓ |
| `listar`, `oficialidad`, `feedback` | inalterados (exit 0 / validación preexistente) ✓ |
| Consumidores (`rg` en scripts/, README, AGENTS.md, docs/, backend) | ninguna invocación con args en exceso; `scripts/consultar` es passthrough `"$@"`; `vigilancia_diaria.sh` no usa `cli.ts` ✓ |
| `npx eslint src/cli.ts` / `npx tsc --noEmit` | exit 0 / exit 0 ✓ |
| `npm test` | 15 suites, 140/140 ✓ |
| `python3 scripts/check_sizes.py` / `git diff --check` | OK / limpio ✓ |
| Diff acotado al alcance | solo `backend/src/cli.ts` +6/−0 ✓ |

## Hallazgos

**Aplicables a este diff: ninguno** (BLOCKER/HIGH/MED/LOW: 0).

Las guardas replican el patrón gemelo de `resolver`; el orden guarda-conteo → guarda-contenido no puede divergir (ambas terminan en el mismo `usage()`/exit 2), y las guardas de contenido siguen siendo necesarias para el caso length-correcta + string vacío. Paridad con HTTP (`v0.controller.ts:53-58`) y MCP (`server.ts`, JSON-schema `required`): esas superficies no tienen posicionales; el diff solo exige la aridad que el contrato §1 documenta.

Observaciones preexistentes, fuera del alcance declarado de la tarjeta:

1. **[LOW, preexistente]** `listar`, `oficialidad` y `feedback` aún descartan extras en silencio (`listar X Y` → exit 0). Misma clase de defecto; la tarjeta los excluye explícitamente. Candidato a ticket de seguimiento.
2. **[NIT, preexistente]** args de solo espacios (`"   "`) pasan ambas guardas (truthy) y caen en `sin_datos` exit 1 en vez de exit 2. Sin cambio respecto al comportamiento pre-diff.
3. **[NIT, preexistente]** `process.exit(2)` dentro del `try` salta el `finally { db.destroy() }` — patrón idéntico al ya aprobado en `resolver`/`fatal()`; irrelevante al morir el proceso.

Correcciones aplicables aplicadas: ninguna (no hubo hallazgos aplicables).

## Decisión

**proceed** — El diff hace exactamente lo que la tarjeta pide, con matriz completa verificada por ejecución independiente (0/1/2/3/5 por caso), el filtro opcional de `comando` preservado y funcional, cero regresiones, ningún consumidor afectado y todos los gates verdes. Los hallazgos restantes son preexistentes y están correctamente excluidos por el alcance de la tarjeta; registrar el ítem 1 como candidato a ticket propio.
