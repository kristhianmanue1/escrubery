# Decisión de adaptadores — conversation-event/v0 (CE-T5, 2026-08-21)

Cierre del ciclo H6 (plan `docs/investigacion/Plan_Conversation_Event_v0.md`, issue #2):
qué superficie adopta un futuro colector por CLI, con qué cobertura y riesgos. **No
implementa el colector** — ese es otro ciclo, con su propio plan, si el Mediador lo decreta.

## Matriz de cobertura (evidencia: probes del 2026-08-21 sobre historiales reales)

| Tipo del contrato | opencode | codex-cli | cline | kimi-code |
|---|---|---|---|---|
| `sesion_iniciada` | **ok** 691 | **ok** 254 | **ok** 174 | **ok** 30 |
| `prompt_enviado` | **ok** 3577 | **ok** 17135 | **ok** 223 | **ok** 1789 |
| `turno_finalizado` | parcial 44597 (pasos) | **ok** 15230 (turn_id) | parcial 15 (tarea≈turno) | **ok** 1637 (Begin/End) |
| `turno_fallido` | nd | nd | parcial 8 (+87 sesiones failed) | nd |
| `turno_interrumpido` | nd | **ok** 604 (reason) | parcial 3 (solo cancel de sesión) | **ok** 107 |
| `compactacion` | **ok** 1 | **ok** 2077 | nd | **ok** 61 (Begin/End nativo) |
| `sesion_cerrada` | nd | nd | **ok** 168 (ended_at+exit_code) | nd |

Resumen: **16 ok · 4 parcial · 8 no_disponible** (28 celdas). Los tres tipos universales
(sin excepción en los 4): `sesion_iniciada`, `prompt_enviado`... y ninguno más — la
cobertura fuerte es por CLI.

## Superficie adoptada por CLI (todos `almacen_interno`/estabilidad `interna`)

| CLI | Superficie | Por qué | Riesgo principal |
|---|---|---|---|
| opencode | `opencode.db` (sqlite) | única fuente con join mensaje/parte; pasos step-finish correlacionables a turnos | esquema interno con migraciones propias (`migration` table); validar por versión |
| codex-cli | `rollout-*.jsonl` | turnos con `turn_id` estable; interrupciones con `reason`; es insumo oficial de `resume` | formato interno; forks re-emiten `session_meta` (deduplicar) |
| cline | `sessions.db` + `tasks/*` | único con ciclo de sesión formal (ended_at/exit_code/status) | semántica tarea≈turno difusa; 2 archivos por tarea |
| kimi-code | `wire.jsonl` (protocolo 1.7) | eventos nativos de interrupción y compactación distinguibles por tipo | protocolo interno sin doc pública; `user_input` en claro en TurnBegin (jamás proyectar) |

## Decisiones

1. **v0 del colector (si se decreta): solo artefactos**, nunca superficies que ejecuten el
   CLI (hooks/API/export) — requieren curación ToS (criterio D1 heredado del plan). Las 4
   superficies adoptadas son legibles sin ejecutar nada.
2. **`turno_fallido` es el hueco transversal** (3/4 nd): un colector por hooks lo cubriría,
   pero hooks = ejecución = ToS. Queda como candidato explícito para cuando D1 se cure.
3. **`sesion_cerrada` solo existe en cline.** El contrato lo mantiene como tipo (válido,
   observable) pero el colector debe reportar nd para los otros tres sin sintetizar.
4. **Estabilidad:** ninguna superficie es estable (todas `interna`). El colector real debe
   (a) validar contra el schema cada evento antes de persistir (fail-closed), (b) registrar
   la versión del CLI observada, (c) ante cambio de formato: veredicto `no_disponible`,
   jamás inferencia. El contrato `conversation-event/v0` ya exige `estabilidad` en `fuente`.
5. **Privacidad no negociable:** los 4 almacenes contienen conversación en claro. Las
   reglas del probe (solo type/role/counters; IDs hasheados; payloads jamás proyectados;
   salidas bajo `var/probes/` gitignored) pasan al colector tal cual. Los gates de grep
   quedan como DoD permanente.

## Qué NO entra (delimitación del issue #2)

- Clasificador con modelo, daemon/observador permanente, escritura en AN-KLA, ingesta de
  conversaciones reales al repo: fuera de alcance (no-objetivos del issue y del plan).
- La integración AN-KLA (F8-E del issue #1) consume esta decisión como insumo; su momento
  se decide aparte.

## Evidencia

- Contrato: `datos/schemas/conversation-event-v0.schema.json` (validador ajv + 18 specs).
- Probes: `docs/investigacion/probes/{opencode,codex-cli,cline,kimi-code}-2026-08-21.md`
  (+ reportes JSON saneados en `var/probes/`, gitignored).
- Reproducibilidad: `npm run probe:conversacion -- --cli <id>` (read-only, presupuesto 0).
