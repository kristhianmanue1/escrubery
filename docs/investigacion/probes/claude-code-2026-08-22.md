# Probe claude-code — conversaciones (CE-T6, 2026-08-22)

**Ticket:** CE-T6 (extensión H6 decretada 2026-08-22: cerrar el mapa con el 5º CLI).
**Runner:** `npm run probe:conversacion -- --cli claude-code` (backend). **Modo:** read-only
sobre `~/.claude/projects/<proyecto>/<sesion>.jsonl`. Salida solo bajo `var/probes/claude-code/` (gitignored).

## Superficie usada y decisión

- **Superficie:** `almacen_interno` / `projects/*.jsonl` / estabilidad `interna`.
- Formato jsonl por sesión, con metadatos ricos por registro (`type`, `isSidechain`, `isMeta`,
  `stop_reason`, `subtype`). El más anotado de los 5 junto al wire de kimi.

## Hallazgos (158 sesiones reales; 12.6k prompts)

| Tipo del contrato | Veredicto | Conteo | Método |
|---|---|---:|---|
| `sesion_iniciada` | ok | 158 | un .jsonl por sesión (nombre = sessionId) |
| `prompt_enviado` | ok | 12687 | `type=user`/`role=user` excluyendo `isMeta`/`isSidechain` (tool-results) |
| `turno_finalizado` | ok | 1679 | `assistant.stop_reason='end_turn'` fuera de sidechains |
| `turno_fallido` | parcial | 52 | `isApiErrorMessage=true` (fallos de API; no distingue fallo de turno completo) |
| `turno_interrumpido` | no_disponible | null | sin `stop_reason` de interrupción estable observado |
| `compactacion` | ok | 8 | `subtype='compact_boundary'` + `isCompactSummary` como señal secundaria |
| `sesion_cerrada` | no_disponible | null | sin evento de cierre en el jsonl |

**Señales destacadas:**
- `isSidechain` permite separar subagentes del hilo principal — los 5 CLIs, solo claude-code lo marca explícitamente.
- `stop_reason` distingue `end_turn` (turno cerrado) de `tool_use` (turno continúa): correlación de turnos casi gratuita.

## Cambio de contrato (aditivo)

El enum `cli` del schema `conversation-event/v0` se amplía con `claude-code` (el contrato H6
original solo listaba los 4 del issue #2). Schema + tipo TS + specs actualizados (5/5 CLIs).

## Gate de privacidad (DoD)

Grep de cadenas reales de conversaciones (`DECÁLOGO SOBERANO`, `jarvis`, `krisnova`, `timbre`,
`Harness`) sobre `var/probes/claude-code/2026-08-22/`: **0 matches**. El walker solo proyecta
`type/isMeta/isSidechain/stop_reason/subtype/sessionId` — nunca `message.content`.

## Recomendación para la decisión de adaptadores (actualizada)

- **Historial y turnos:** projects/*.jsonl es la segunda superficie más rica (tras kimi wire):
  turnos por `stop_reason`, subagentes marcados, compactación con boundary explícito.
- `turno_interrumpido` sigue siendo el hueco en claude (los aborts del cliente no dejan marca).
