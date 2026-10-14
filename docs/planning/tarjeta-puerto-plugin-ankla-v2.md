# Tarjeta: puerto del plugin ankla_gate V1→V2 (opencode 2.x)

**Fecha:** 2026-10-14 · **Clase:** Bounded (ticket único, alcance cerrado, verificación por ejecución)
**Estado:** ejecutado y verificado; cierre propuesto al Mediador.

## Contexto

opencode 2.0.29 rechazó el plugin V1 en carga (`Plugin must export a default
definition...`): la API de plugins cambió de forma rupturista en la V2. Con el
plugin caído, la memoria enforcada H8 quedaba degradada en el runtime opencode
(sesiones sin acreditación AN-KLA; el gate de escritura inopere). El puerto fue
dejado en el árbol por una sesión anterior del mismo día, sin tarjeta ni
verificación; esta tarjeta lo curaduriza y lo verifica.

## Mapeo V1→V2 (semántica intacta)

| V1 | V2 |
|---|---|
| `export const AnklaGatePlugin: Plugin` | `export default Plugin.define({ id, setup })` |
| hook genérico `event` (session.created) | `ctx.event.subscribe()` — id en `data.sessionID` (tipado) |
| `experimental.chat.system.transform` | `ctx.session.hook("context")` — por llamada LLM del bucle del agente; el título usa el hook `title` y no la consume (paridad T7b) |
| `tool.execute.before` (bloqueo + throw) | `ctx.permission.hook("evaluate")` — action `edit` agrupa edit/write/patch (paridad HIGH-1); `effect="deny"` + mensaje = bloqueo V1; reintento pasa con sello puesto |

Mejoras mínimas del puerto (sin cambio semántico): raíz del proyecto derivada de
la URL del propio plugin (no `process.cwd()`), hook `context` async (remediación
lazy con await real), import `@opencode/plugin` (antes `@opencode-ai/plugin`).
Formatos de sello y `var/ankla-gate/log.jsonl` intactos (paridad de auditoría).

## DoD y verificación (por ejecución, salvo lo declarado)

- [x] El plugin carga en opencode 2.0.29 sin error — evidencia: ejecución viva
      (eventos en el log del día; el V1 ni siquiera cargaba).
- [x] Pieza 1 (session.created corre AN-KLA, sella, cachea): `session_created_exec`
      con `used_bytes:16229` (budget base 16384 suficiente, sin reintentos a MAX)
      y sellos `estado:"ok"` en sesiones reales del día.
- [x] Pieza 1b (entrega por llamada LLM): `system_inject` por turno con modelo
      registrado (`zai-coding-plan/glm-5.3-flash`), incluida ESTA sesión de
      trabajo (bloque de memoria recibido en el arranque, primera persona).
- [x] Prueba controlada de punta a punta: `opencode run` headless → sesión nueva
      `ses_ec45fadbcffeiML0EgE5IFIYdU`: nació → corrió AN-KLA → sello `ok` →
      inyectó al modelo. 38 eventos del día, 0 errores/degradaciones.
- [x] Paridad del gate (Pieza 2) por revisión de código: set `edit/write/patch`,
      sello inválido (`"?"`) tratado como ausente (MED-2), fallback
      `sin-session-id` conservado (T7a), deny + mensaje + reintento.
- [x] `check_sizes` verde (política §3).

## Límites declarados (honestos)

- El camino **deny/lazy no se re-ejecutó bajo V2**: su condición de gatillo
  (sesión sin sello) exige manipular el arranque del plugin. Última evidencia
  real: era V1, 2026-08-22 (`lazy_inject` ×3, `gate_pass` ×6 en
  `var/ankla-gate/log.jsonl`). Residual: prueba aislada con mock del host, si se
  decreta.
- La ausencia de inyección en la generación de título (hook `title`) se infiere
  del diseño V2 (hooks separados) + eventos observados; no se interceptó el
  system prompt del título directamente.

## Evidencia

- `var/ankla-gate/log.jsonl` (gitignored, auditoría runtime): eventos
  `2026-10-14` citados arriba; sellos `var/ankla-gate/ses_*.seal`.
- opencode `v2.0.29`; paquete AN-KLA `0.1.0b30` en `.venv` (intérprete que el
  plugin invoca, ver tarjeta de upgrade del mismo día).
