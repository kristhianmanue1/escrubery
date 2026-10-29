# Tarjeta: casos reales del resolver + higiene de la cola de feedback

**Fecha:** 2026-10-29 · **Clase:** Bounded (ticket único, alcance cerrado, verificación por ejecución)
**Estado:** ejecutado y verificado.
**Origen:** análisis de candidatos de producto por decreto del Mediador («analiza y dame recomendaciones…» + «adelante con recomendaciones», 2026-10-29). Primer candidato priorizado por el criterio skevi coste-contra-consumidor: único con consumidor vivo (adrc-mini) y tráfico real ya registrado.

## Alcance

1. **Higiene de la cola de feedback** (contrato §3.6): 9 de 12 filas en estado `nuevo` desde 2026-08-07 — triaje con verificación por ejecución.
2. **Goldens del resolver con casos reales:** minar `consultas_log` (217 consultas, 50 del resolver; tráfico adrc-mini + probes de operación) y fijar el comportamiento observado como tests.
3. **Errata 12 del contrato:** los ejemplos de §3.1/§3.6 usaban identificadores retirados del catálogo por drift del upstream (origen fb_1, 2026-08-07).

## Cambios

1. `backend/src/consultas/resolver.spec.ts`: bloque «casos reales del tráfico (golden, consultas_log 2026-10)» — 5 its herméticos (BD de test aislada, semillas = réplicas fieles de las filas reales de `identidad_modelos.json` y del catálogo):
   - `claude-sonnet-5-cowork` → identidad subyacente + advertencia de sufijo de harness (caso observado en tráfico, NO cubierto por la matriz manual 8/8 del 10-27);
   - `zai-coding-plan/glm-5.3` → zhipu/glm-5.3 (alias del consumidor adrc-mini);
   - `qwen3.8-max` + endpoint dashscope → resuelto vía endpoint curado;
   - `kimi-k2-0905-preview` + endpoint moonshot → null fail-closed (el ejemplo del contrato §3.1 retirado por drift; verificado en vivo contra la BD real antes de sembrar);
   - `--foo` → null: valor con forma de flag tratado como dato literal, nunca como opción (hardening observado en tráfico).
2. `docs/CONTRATO_API_v0.md`: **errata 12** (aclaratoria) — ejemplo de §3.1 pasa de `kimi-k2-0905-preview` (ausente del catálogo) a `kimi-k2.6` con valores reales (ventana 262144; 0.95/4/0.16 por 1M); ejemplo de §3.6 pasa de `kimi-k3` a `kimi-k2.6`; nota nueva: los identificadores de ejemplos son ilustrativos, no promesa de vigencia; `resolver` es la operación de verificación.
3. BD (tienda operacional, precedente triaje 10-27): fb_1 → `resuelto`; fb_2–fb_9 → `rechazado` (pruebas internas del canal: HTTP, MCP ×5, probe adversarial, probe matriz cli-args — sin hallazgo de producto).

## Verificación (por ejecución)

- fb_1 verificado antes de sentenciar: `kimi-k3` NO existía en BD el 2026-08-07 (reclamo verdadero entonces); hoy existe como fila pero caducada; y el ejemplo §3.1 (`kimi-k2-0905-preview`) está ausente del catálogo — errata 12 cierra la clase completa.
- Matriz en vivo (BD real) ANTES de sembrar: cowork → resuelto con advertencia; kimi-k2-0905-preview+moonshot → sin_datos; qwen3.8-max+dashscope → resuelto; `--foo` → sin_datos literal.
- Gates: `npm test` **294/294** (289 previas + 5 goldens), `npm run lint` 0 errores (3 warnings preexistentes), `nest build` OK, `check_sizes` OK.

## Límites declarados

- Los goldens replican lo observado en `identidad_modelos.json` + catálogo al 2026-10-29; si el upstream re-agrega p. ej. `kimi-k2-0905-preview`, el golden negativo fuerza una actualización consciente (así se diseñó).
- La matriz de `consultas_log` se fija como goldens solo para el resolver; `consultar_modelo`/`ficha`/`comando` quedan con su cobertura previa (los 217 registros no aportan casos nuevos de esas operaciones).
- El catálogo completo está caducado al momento del ticket (ventana 24 h §4.2, último refresco 10-27) — degradación honesta documentada, no defecto; el resolver no filtra por vigencia y los goldens tampoco.

## Lote

- **Folio:** ESC-LOTE-20261029-04 — PROPUESTO en sesión (dosier con rutas, mensaje, evidencia, riesgos); **ACEPTADO** por decreto del Mediador «adelante con recomendacion» (2026-10-29T19:12:09Z), registrado contra el folio; ejecución: commit + push ordinario. La errata 12 no dispara notificación a skopos (aclaratoria, sin cambio de enum/shapes).
