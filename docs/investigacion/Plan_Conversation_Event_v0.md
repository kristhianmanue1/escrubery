# Plan: conversation-event/v0 + probes read-only (issue #2)

**Contexto:** post-release v0.4.0. El issue #2 (abierto 2026-08-12) pide un contrato vendor-neutral para historial y eventos de conversaciones de CLIs antes de construir cualquier observador o persistir nada en AN-KLA. El Mediador decretó abrir el ciclo el **2026-08-21**. **Fecha:** 2026-08-21. **Estado:** PROPUESTO (espera aprobación del Mediador).
**Fase del plan v2:** post-F5 (trabajo aditivo; sin fase nueva). **Fuente:** issue #2 + decisiones de cierre del issue #1 (la sección F8-E de integración AN-KLA queda como insumo de diseño, no como alcance).

## Decisiones del Mediador (2026-08-21)

1. **Abrir ciclo** sobre el issue #2 como siguiente trabajo del servicio.
2. **Alcance:** el del issue — contrato `conversation-event/v0` + probe read-only por CLI (opencode, codex-cli, cline, kimi-code). Termina en **evidencia + contrato + decisión de adaptadores**. Sin clasificador con modelo, sin escritura automática en AN-KLA, sin daemon.
3. **No-objetivos heredados del issue:** no ingerir conversaciones reales en Git; no copiar prompts/credenciales/resultados completos; no invocar modelos; no escribir en AN-KLA desde probes; no declarar estable un formato interno solo porque hoy sea legible.

## Objetivo y criterio de cierre

- **Objetivo:** (a) definir y versionar el contrato JSON `conversation-event/v0` (draft 2020-12, `additionalProperties: false`, como exige la deuda MEDIUM del issue #1); (b) un probe **read-only** por CLI que demuestre qué superficies soportadas (export, API local, hooks, `--json`) permiten reconstruir: historial de sesión, envío de prompt, fin/fallo/interrupción de turno, compactación, cierre; (c) un documento de decisión de adaptadores: qué superficie se adopta por CLI y por qué, con riesgos.
- **Cierre global:** contrato versionado + 4 probes ejecutados contra historiales locales reales con evidencia sanitizada (conteos y conformidad, jamás contenido) + decisión de adaptadores documentada + CI local verde + adversarial `proceed`.

## Hitos (cada uno dispara ronda adversarial, §6)

- **H6 — Contrato + probes + decisión de adaptadores:** todo el ciclo (2.5 ciclos est.). Adversarial al cierre.

## Supuestos y criterios operativos

- **Los probes leen artefactos locales del propio usuario; NO ejecutan los CLIs** → no toca el alcance D1 (ToS de ejecución). Se documenta el criterio en el plan de cada probe.
- **Privacidad:** la evidencia que entra al repo es conteo de eventos por tipo, versión de CLI, ruta de superficie usada y veredicto de conformidad. Prohibido contenido de conversación (el no-objetivo #1 del issue). Los artefactos crudos de trabajo viven en `var/probes/` (gitignored).
- **Fuente de verdad por superficie soportada** (investigación local 2026-08-12, issue #2): opencode = SQLite/export JSON/API HTTP; codex = `rollout-*.jsonl` + hooks + `exec --json`; cline = hooks + `history --json` + SDK; kimi = hooks + Wire + export ZIP/MD. Cada probe valida la candidata **soportada** (documentada), no el volcado interno crudo, y degrada a `null`/`pendiente_de_verificar` cuando no puede afirmar (regla dura #4).

## Tareas

### Contrato CE-T0 — Contrato `conversation-event/v0` (0.5 ciclos)

**Presupuesto:** cabe holgado. **Entradas:** schema propuesto en el issue #2, `docs/CONTRATO_API_v0.md` (estilo de procedencia), esquemas Evidentia.
**Salidas:** `datos/schemas/conversation-event-v0.schema.json` + muestras sintéticas validadas + spec de validación.

- [ ] Schema draft 2020-12 con `additionalProperties: false`, `required` explícito y enum cerrado de tipos de evento: `sesion_iniciada | prompt_enviado | turno_finalizado | turno_fallido | turno_interrumpido | compactacion | sesion_cerrada`.
- [ ] Todo evento lleva bloque `procedencia` minimal (`cli`, `cli_version`, `superficie`, `fuente_tipo`, `fecha_observacion`) — sin `fuente_url` obligatoria cuando la fuente es artefacto local (se declara `ejecucion_local_supervisada`-análogo: `artefacto_local_readonly`).
- [ ] Muestras sintéticas: 1 evento válido por tipo + ≥3 casos inválidos (propiedad extra, tipo fuera de enum, falta de required). Spec que los valida (AJV u oro del repo si ya existe validador).
- [ ] `check_sizes.py` verde; el schema se declara en `docs/CONTRATO_API_v0.md` como anexo NO-servido (documento de diseño, no operación API — sin cambio del contrato congelado).

### Contrato CE-T1 — Probe opencode (0.5 ciclos)

**Entradas:** historial SQLite local (`opencode.db`), export JSON / API HTTP según disponibilidad. **Salidas:** `backend/src/probes/opencode.ts` + evidencia sanitizada + notas.

- [ ] Runner `npm run probe:conversacion -- --cli opencode` que SOLO lee (sin escribir nada fuera de `var/probes/`).
- [ ] Reporta por sesión encontrada: conteos por tipo de evento mapeable al contrato + superficie usada + veredicto de conformidad por tipo (`ok | parcial | no_disponible`).
- [ ] Cero contenido de conversación en stdout/archivos de evidencia (gate: revisión manual + grep de palabras del historial real en los artefactos generados).
- [ ] Evidencia resumida a `docs/investigacion/probes/opencode-2026-08-XX.md` (conteos, versiones, decisión recomendada).

### Contrato CE-T2 — Probe codex-cli (0.5 ciclos)

Igual patrón sobre `rollout-*.jsonl` + índice (+ `exec --json` como superficie de eventos en vivo si aplica sin ejecutar el CLI: se documenta si queda fuera por regla de no-ejecución).

- [ ] Igual DoD que CE-T1 adaptado a rollout/índice; detección de compactación y cierre según lo que el formato soportado exponga; lo no observable → `no_disponible` (nunca inferir).

### Contrato CE-T3 — Probe cline (0.5 ciclos)

Igual patrón sobre transcript/messages por sesión + `history --json` como superficie declarada.

- [ ] Igual DoD que CE-T1; si `history --json` requiere ejecutar el CLI (aunque sea read-only), se documenta el criterio D1 y NO se ejecuta sin curación ToS — el probe opera solo sobre artefactos.

### Contrato CE-T4 — Probe kimi-code (0.5 ciclos)

Igual patrón sobre `state.json` + `wire.jsonl` por agente (+ export ZIP/MD como superficie).

- [ ] Igual DoD que CE-T1; export ZIP puede requerir ejecución → mismo criterio D1 que CE-T3: artefactos primero, superficies de ejecución documentadas como pendientes de curación ToS.

### Contrato CE-T5 — Decisión de adaptadores + cierre (0.25 ciclos, absorbido en T1-T4 si sobra margen)

**Salidas:** `docs/investigacion/probes/DECISION_ADAPTADORES.md` + bitácora + comentario de cierre en el issue #2.

- [ ] Tabla por CLI: superficie adoptada, eventos cubiertos (`ok`), parciales, no disponibles, riesgos (inestabilidad de formato, ToS pendiente).
- [ ] Recomendación explícita de qué entra a un futuro colector y qué queda fuera (sin implementarlo).
- [ ] Bitácora actualizada (fila por ticket con ciclos est/reales/desviación); comentario en el issue #2 con el enlace a la decisión.

**Gate H6:** `bash scripts/ci_local.sh` verde + ronda adversarial (revisor independiente verifica: probes read-only de verdad — sin writes fuera de `var/`, sin contenido de conversación en el repo, schema estricto, honestidad de `no_disponible`) → `proceed`.

## Riesgos / supuestos

- **Formatos internos inestables** (regla del issue): los probes declaran la superficie usada y su vigencia; nada se declara estable por existir.
- **Historiales locales insuficientes** (p. ej. sin sesiones recientes de cline/kimi en esta máquina): el probe lo reporta como `sin_datos` honesto y la decisión de adaptadores queda `pendiente_de_verificar` para ese CLI — no se fabrica evidencia.
- **ToS:** leer artefactos propios no ejecuta CLIs (criterio documentado); cualquier superficie que exija ejecución queda explícitamente excluida hasta curación (hereda D1).
- **Tamaño del repo:** evidencias van a `docs/investigacion/probes/` solo en forma resumida; gate `check_sizes.py` en cada ticket.

## Enlaces

- Issue #2 (origen y investigación de superficies): https://github.com/kristhianmanue1/escrubery/issues/2
- Issue #1 cierre (F8-E como insumo de diseño): https://github.com/kristhianmanue1/escrubery/issues/1#issuecomment-5373421265
- Plantilla y política: `docs/plantillas-agente.md`, `docs/politica-agentes.md`
