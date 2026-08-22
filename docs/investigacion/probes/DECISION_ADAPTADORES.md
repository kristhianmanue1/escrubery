# Decisión de adaptadores — conversation-event/v0 (CE-T5, 2026-08-21; extendida CE-T6 2026-08-22)

Cierre del ciclo H6 (plan `docs/investigacion/Plan_Conversation_Event_v0.md`, issue #2):
qué superficie adopta un futuro colector por CLI, con qué cobertura y riesgos. **No
implementa el colector** — ese es otro ciclo, con su propio plan, si el Mediador lo decreta.

**Extensión CE-T6 (2026-08-22, decreto del Mediador):** añadido claude-code (el CLI más
usado del Mediador quedó fuera del alcance original del issue #2). Enum del schema ampliado
a 5 CLIs. Nuevo estado del mapa: **los 5 CLIs principales con ficha viva + diario mapeado.**

## Matriz de cobertura (evidencia: probes 2026-08-21/22 sobre historiales reales)

| Tipo del contrato | opencode | codex-cli | cline | kimi-code | claude-code |
|---|---|---|---|---|---|
| `sesion_iniciada` | **ok** 691 | **ok** 254 | **ok** 174 | **ok** 30 | **ok** 158 |
| `prompt_enviado` | **ok** 3577 | **ok** 17135 | **ok** 223 | **ok** 1789 | **ok** 12687 |
| `turno_finalizado` | parcial (pasos) | **ok** (turn_id) | parcial (tarea≈turno) | **ok** (Begin/End) | **ok** (stop_reason) |
| `turno_fallido` | nd | nd | parcial | nd | parcial (isApiErrorMessage) |
| `turno_interrumpido` | nd | **ok** (reason) | parcial | **ok** (StepInterrupted) | nd |
| `compactacion` | **ok** | **ok** | nd | **ok** (nativo) | **ok** (compact_boundary) |
| `sesion_cerrada` | nd | nd | **ok** | nd | nd |

Resumen: **21 ok · 5 parcial · 9 no_disponible** (35 celdas, 5 CLIs). Los dos tipos universales
(sin excepción en los 5): `sesion_iniciada` y `prompt_enviado`.

## Superficie adoptada por CLI (todos `almacen_interno`/estabilidad `interna`)

| CLI | Superficie | Por qué | Riesgo principal |
|---|---|---|---|
| opencode | `opencode.db` (sqlite) | única fuente con join mensaje/parte; pasos step-finish correlacionables a turnos | esquema interno con migraciones propias (`migration` table); validar por versión |
| codex-cli | `rollout-*.jsonl` | turnos con `turn_id` estable; interrupciones con `reason`; es insumo oficial de `resume` | formato interno; forks re-emiten `session_meta` (deduplicar) |
| cline | `sessions.db` + `tasks/*` | único con ciclo de sesión formal (ended_at/exit_code/status) | semántica tarea≈turno difusa; 2 archivos por tarea |
| kimi-code | `wire.jsonl` (protocolo 1.7) | eventos nativos de interrupción y compactación distinguibles por tipo | protocolo interno sin doc pública; `user_input` en claro en TurnBegin (jamás proyectar) |
| claude-code | `projects/*.jsonl` | `stop_reason` distingue turno cerrado de continúa; `isSidechain` marca subagentes; `compact_boundary` explícito | formato interno; `turno_interrumpido` sin marca estable |

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

## Notas de la ronda adversarial (2026-08-21, `proceed`)

4 LOW registrados; 2 aplicados tras el veredicto (marcas `muestra_sintetica` en `carga_ref`;
números de prosa eliminados de kimi). Pendientes documentados:

- **WAL sidecars (LOW):** abrir una BD SQLite en modo WAL con `readOnly:true` puede crear
  `-shm`/`-wal` junto a la fuente (comportamiento estándar de lectura WAL; verificado por
  el adversarial con experimento controlado). No toca contenido ni repo. `immutable=1` solo
  serviría para snapshots congelados, no fuentes vivas.
- **`cli_version` en muestras (LOW → contrato v1):** las muestras globales de codex/cline
  llevan prosa donde iría una versión (válido por `minLength 1`). Para v1 del contrato:
  admitir `null` o una const `no_proyectada`.

## Evidencia

- Contrato: `datos/schemas/conversation-event-v0.schema.json` (validador ajv + 18 specs; enum 5 CLIs desde CE-T6).
- Probes: `docs/investigacion/probes/{opencode,codex-cli,cline,kimi-code}-2026-08-21.md` +
  `docs/investigacion/probes/claude-code-2026-08-22.md` (+ reportes JSON saneados en `var/probes/`, gitignored).
- Reproducibilidad: `npm run probe:conversacion -- --cli <id>` (read-only, presupuesto 0).
- Habilitación sandbox (2026-08-22, decreto 1+2): ToS kimi curado (MIT); cline ya estaba (Apache 2.0);
  Dockerfiles cline (debian-slim, binario glibc) y kimi; introspección diaria extendida a ambos —
  15 comandos cline (3.0.56) y 10 kimi (0.38.0) en inventario vivo.

---

## Fe de erratas — 2026-08-22 (autorizada por decreto del Mediador)

**Corrección aritmética del resumen de la matriz.** Donde este documento dice
**"21 ok · 5 parcial · 9 no_disponible"**, el conteo de sus propias 35 celdas da
**20 ok · 5 parcial · 10 no_disponible**. La tabla de celdas es correcta y **no se
modifica**: el error está solo en la línea de resumen.

**Mecanismo del error** (identificado en la ronda adversarial r2 del plan H9 y
reproducido por ejecución): CE-T5 cerró con 4 CLIs y **16 ok / 4 parcial / 8 nd**
sobre 28 celdas. La extensión CE-T6 añadió la columna claude-code, que aporta
**4 ok · 1 parcial · 2 nd** — de donde 20/5/10. El resumen se actualizó como si la
columna aportara 5 ok y 1 nd: una celda `no_disponible` quedó contada como `ok`.

**Alcance de la corrección:** esta nota se añade al pie sin reescribir el histórico.
El cuerpo del documento, el reporte de H6 y la release **v0.5.0 quedan tal como se
publicaron**; el dato corregido es este. Consumidores del documento (notablemente
skopos, notificado el 2026-08-22) deben tomar **20/5/10** como cifra válida.

**Procedencia de la corrección:** `docs/investigacion/hra/adversarial-plan-h9-r1.md`
(detección) y `docs/investigacion/hra/adversarial-plan-h9-r2.md` (mecanismo);
verificación por recuento programático de las celdas de la tabla de este documento.
