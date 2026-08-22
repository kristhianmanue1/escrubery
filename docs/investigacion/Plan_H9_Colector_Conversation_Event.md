# Plan: H9 — Colector `conversation-event/v0` (de sonda a registro longitudinal)

> ⛔ **NO EJECUTAR.** Ronda adversarial independiente r2 (`docs/investigacion/hra/adversarial-plan-h9-r2.md`): veredicto **`fix-and-retry`**, 4 CRÍTICO · 6 HIGH · 8 MED · 4 LOW. Tres defectos invalidan el ciclo tal como está escrito: el criterio de cierre §7.1 lo aprueba un colector que no emite nada (C1); la regla de §3.5 apaga cline y kimi por completo —11 de 25 celdas, incluida la única `sesion_cerrada` observable— y §7.2 lo pre-absuelve (C2); el ancla de deduplicación es inestable y la clave omite `carga_sha256`, de modo que un registro mutado se fosiliza en silencio (C3). C4 escala al Mediador una objeción de premisa: **el ciclo no tiene consumidor** y su producto vive en `var/` gitignored. Este documento queda como registro, **pendiente de decreto de alcance**; no hay r3 hasta que ese decreto exista.

**Estado:** BORRADOR **r2** (BLOQUEADO por r2 independiente) — incorpora los 8 hallazgos de la ronda adversarial r1 (`docs/investigacion/hra/adversarial-plan-h9-r1.md`, veredicto `fix-and-retry`). Pendiente de r2 de revisión y de decreto del Mediador.
**Fecha:** 2026-08-22. **Origen:** decreto del Mediador (2026-08-22) eligiendo el colector como próximo ciclo.
**Insumo vinculante:** `docs/investigacion/probes/DECISION_ADAPTADORES.md` (CE-T5/CE-T6) — sus 5 decisiones son entrada, no se re-litigan; su matriz se usa **con la corrección aritmética de §1.1**.

## Cumplimiento de reglas duras (lectura obligatoria antes de decretar)

- **Regla 5 (no ejecutar los CLIs reales):** no se ejecuta ningún CLI. Se leen artefactos ya escritos en disco, igual que los probes de H6.
- **Regla 1 (procedencia):** cada evento persistido lleva `fuente` con superficie y `estabilidad: interna`. **La versión del CLI ya no se rellena con prosa** (§3.5).
- **Regla 4 (`null` es válido):** los 10 `no_disponible` de la matriz se reportan como tales. Prohibido sintetizar `sesion_cerrada` donde no existe o `turno_fallido` sin marca.
- **Regla 7 (contrato):** `conversation-event/v0` **no se modifica**. Todo el diseño de §3 cabe dentro del contrato vigente; donde no cabía (r1 CRÍTICO-1, HIGH-3) se cambió el diseño, no el contrato.

## 1. Qué responde este ciclo

H6 probó que los cinco historiales son legibles y qué cubre cada uno. Lo que dejó abierto es la diferencia entre **sonda** y **colector**:

> Una sonda lee todo una vez y reporta agregados. Un colector corre muchas veces sobre fuentes que crecen, y debe poder correr dos veces sin mentir.

Pregunta del ciclo, de ingeniería y no de investigación: **¿puede el proyecto mantener un registro longitudinal de eventos de conversación —incremental, idempotente y validado— sin tocar el contenido de las conversaciones y sin inventar procedencia?**

### 1.1 Corrección aritmética heredada (r1 CRÍTICO-2)

La matriz de CE-T5 declara *"21 ok · 5 parcial · 9 no_disponible"*. El conteo de sus propias 35 celdas da **20 ok · 5 parcial · 10 no_disponible** (una celda `nd` contada como `ok`). Este plan usa **20/5/10**. La corrección del artefacto de H6 —ciclo cerrado por decreto y publicado en v0.5.0— **no la ejecuta este plan**: requiere decreto del Mediador en forma de fe de erratas fechada, sin reescribir el histórico.

## 2. Alcance (fail-closed contra la ambición)

**Adentro:** núcleo del colector (índice de deduplicación + cursores + validación fail-closed) · lectores incrementales para los 5 CLIs · almacén local append-only · re-corrida verificada · gates de privacidad como DoD permanente.

**Afuera (no-objetivos, heredados del issue #2 y de CE-T5):** daemon u observador permanente · hooks (= ejecución = ToS sin curar) · clasificador con modelo · escritura en AN-KLA · ingesta de conversaciones al repo · exposición por API/MCP (el contrato sigue siendo **de diseño, no servido**) · cambios al schema.

## 3. Diseño

### 3.1 Idempotencia: la clave vive en el índice, no en el evento (r1 CRÍTICO-1)

`evento_id` es `format: uuid` y el schema tiene `additionalProperties: false`: **no hay campo del evento donde alojar una clave derivada**, y el contrato no se toca. Por tanto:

- `evento_id` es **UUID v4**, según contrato.
- La **clave de deduplicación es una propiedad del almacén, no del evento**: `var/colector/indice.json` guarda `sha256(cli_id + ruta_relativa_saneada + ancla)`, donde `ancla` es el identificador estable de la fuente (`turn_id` en codex, `rowid` en SQLite, índice de línea en JSONL).
- **Excluido de la clave:** `fecha_observacion` (cambia en cada corrida) y todo campo derivado del momento de lectura (r1 LOW-7). Si entrara, el gate de doble corrida sería indemostrable.
- **Cursor por fuente** (`var/colector/cursores.json`): optimización de lectura, avanzado **solo tras persistir**. El índice es la garantía; el cursor no. Un cursor borrado o corrupto degrada a "relee y no duplica", jamás a "duplica" — y eso es un test, no una aspiración (CO-T0).

**Criterio de aceptación duro:** doble corrida sin actividad nueva → **0 eventos nuevos** en los 5 CLIs, y almacén de eventos bit-idéntico. Este es el gate que separa H9 de H6.

### 3.2 Validación fail-closed (decisión 4 de CE-T5)

Cada evento se valida contra el schema con el validador existente (`backend/src/probes/conversation_event.ts`, 18 specs) **antes** de persistir. Evento inválido = descartado y **contado**; jamás persistido "en bruto para arreglarlo luego". El conteo de descartes es salida obligatoria: un salto en descartes es la señal de deriva de formato. Ante formato desconocido: `no_disponible` para ese tipo en esa corrida, nunca inferencia, y el colector sigue con los demás tipos en vez de abortar.

### 3.3 Privacidad (decisión 5, DoD permanente)

Las cinco fuentes contienen conversación en claro. Reglas heredadas sin relajación: solo `type`/`role`/contadores; IDs hasheados; payloads jamás proyectados; `user_input` de kimi (en claro en `TurnBegin`) nunca tocado; salidas bajo `var/` (ignorado en bloque, `.gitignore:27` — verificado por ejecución en r1/V3).

**El riesgo sube respecto de H6:** una sonda deja un reporte efímero; un colector acumula un almacén persistente. Por eso el gate de grep con tokens reales de las 5 fuentes se corre **en cada ticket**, y el ignorado se verifica con `git check-ignore`, no leyendo el `.gitignore`.

### 3.4 Lo que el colector NO puede arreglar

`turno_fallido` (**3/5 nd**) y `sesion_cerrada` (**4/5 nd**, el hueco mayor) siguen huecos: son límite de las fuentes, no del colector. El reporte lo dirá en esos términos y no dejará que la acumulación de volumen parezca cobertura.

### 3.5 Versión del CLI: no emitir antes que inventar (r1 HIGH-3)

`cli_version` es requerido con `minLength: 1`. Los probes de H6 lo rellenan con prosa (`'desconocida'`, `'no proyectada aquí'`): en una sonda fue LOW, en un registro longitudinal persistente sería **procedencia falsa que pasa el validador** — viola la regla 1 mientras satisface el schema. Agravante propio del colector: la versión instalada hoy **no es** la que produjo un rollout de hace dos meses; atribuirla sería inventar (regla 4).

**Regla del ciclo:** la versión se toma de la fuente por sesión donde la fuente la trae (codex `session_meta`, opencode). **Donde la fuente no la trae, el evento no se emite** y el tipo se reporta `no_disponible` con motivo `sin_version_en_fuente`. Fail-closed: no emitir es honesto; emitir `"desconocida"` no lo es. Consecuencia aceptada: la cobertura real de este ciclo puede quedar por debajo de la matriz de CE-T5, y eso **es un resultado, no un fallo** (§7.2).

## 4. Tickets

| Ticket | Contenido | est. |
|---|---|---|
| **CO-T0** | Núcleo: almacén append-only, índice de deduplicación, cursores, validación fail-closed, contadores de descarte. Fixtures **sintéticas** + tests de: idempotencia, cursor borrado, cursor corrupto, evento inválido, fuente truncada, `fecha_observacion` fuera de la clave. | 0.75 |
| **CO-T1** | **Lectores incrementales** (reescritura, no reuso — r1 HIGH-4): los lectores de `probes/` son generadores sobre archivo completo sin offset ni reanudación. Se dotan de reanudación por ancla + adaptador codex-cli end-to-end sobre historial real. | 1.0 |
| **CO-T2** | Adaptadores restantes: claude-code, opencode, cline, kimi-code. `no_disponible` honesto por celda, incluido `sin_version_en_fuente` (§3.5). **Incluye la revisión adversarial independiente del adaptador claude-code** (mitigación R6, r1 MED-6: ticket dueño explícito). | 1.0 |
| **CO-T3** | Gate de idempotencia sobre los 5 (doble corrida = 0 nuevos, almacén idéntico) + gates de privacidad + CI local verde + métricas de corrida. | 0.5 |
| **CO-T4** | Reporte al Mediador + ronda adversarial de hito + cierre. | 0.25 |

**Total estimado: 3.5 ciclos** (r1 corrigió 2.75 al alza: +0.25 por reescritura de lectores, +0.25 por la adversarial de claude-code, +0.25 por §3.5).

## 5. Riesgos y mitigaciones

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | **WAL sidecars** (LOW elevado desde H6): abrir SQLite viva en modo WAL crea `-shm`/`-wal` junto a la fuente; un colector repetido lo hace muchas veces sobre datos reales del Mediador. | Decreto §6 P4. No toca contenido ni repo; `immutable=1` no aplica a fuentes vivas. Alternativa preferida: copia a `var/` antes de leer. |
| R2 | **Volumen de la primera corrida** (codex 17135 prompts; claude-code 12687). | Ventana acotada por decreto (§6 P3); corrida por CLI, nunca las 5 fuentes en una transacción. |
| R3 | **Deriva de formato** (`opencode.db` tiene tabla `migration` propia). | Versión observada por corrida; salto de descartes como alarma; `no_disponible`, nunca inferencia. |
| R4 | **Regresión de privacidad** por acumulación. | Gate de grep por ticket + `git check-ignore` ejecutado. |
| R5 | **Falso sentido de cobertura**: mucho volumen de los tipos fáciles se lee como observabilidad resuelta. | El reporte publica cobertura por tipo, no volumen total, y repite los huecos de §3.4. |
| R6 | **El que audita es el auditado**: claude-code es harness de este proyecto y ahora fuente colectada. | Revisión adversarial independiente del adaptador, **con ticket dueño: CO-T2**. |
| R7 | **Deriva de prosa del contrato** (r1 MED-5): `carga_ref` describe "bajo `var/probes/`"; el colector escribe en `var/colector/`. | La privacidad se sostiene (`var/` ignorado en bloque). Anotar para contrato v1 junto con `cli_version`. |

## 6. Preguntas para el Mediador (requieren decreto antes de ejecutar)

- **P1 — Destino de persistencia.** (a) JSONL append-only bajo `var/colector/` gitignored *(recomendado: ciclo reversible, no compromete la BD servida)*; (b) tabla PostgreSQL; (c) eventos firmados en Evidentia. (b) y (c) convierten esto en superficie de producto y merecen decreto propio.
- **P2 — Enganche.** ¿Manual (`npm run colector:conversacion`) o dentro de `scripts/vigilancia_diaria.sh`? *Recomendado: manual en v0; enganchar sólo tras el gate de CO-T3.*
- **P3 — Ventana de la primera corrida.** ¿Historial completo o acotado (p. ej. 30 días)? *Recomendado: acotado en CO-T1, completo en CO-T3 tras probar idempotencia.*
- **P4 — WAL sidecars (R1).** ¿Autorizado leer repetidamente los almacenes vivos de opencode/cline, o se exige copia previa a `var/`? *Recomendado: copia previa — coste bajo, elimina la clase de riesgo.*
- **P5 — `cli_version` (§3.5).** ¿Se acepta la regla fail-closed "no emitir antes que inventar" dentro de v0 *(recomendado, mantiene el contrato intacto)*, o se abre `conversation-event/v1` que admita `null`/`no_proyectada`? Nota de regla 7: cerrada la Fase 2, sólo caben cambios aditivos o versión nueva — relajar un requerido **exige v1**, no cabe como parche a v0.

## 7. Criterio de cierre

1. Doble corrida sobre los 5 CLIs → **0 eventos nuevos** y almacén de eventos idéntico.
2. Cobertura real por tipo y CLI **medida y publicada**, contrastada contra la matriz corregida de §1.1 (20/5/10); las diferencias se explican por evidencia — incluidas las bajas legítimas por `sin_version_en_fuente` (§3.5). *No se exige coincidencia: se exige explicación.*
3. Gates de privacidad: 0 matches de grep con tokens reales de las 5 fuentes; almacén verificado gitignored por ejecución.
4. CI local verde; `check_sizes` OK; contrato `conversation-event/v0` **sin modificar** (salvo decreto P5, que abriría v1 en ticket aparte).
5. Ronda adversarial de hito con veredicto `proceed`, **independiente** (subagente aislado), no autorrevisión.
6. Decreto de cierre del Mediador. Ninguna fase se cierra por declaración del agente.

## Referencias

- Contrato: `datos/schemas/conversation-event-v0.schema.json` · validador `backend/src/probes/conversation_event.ts`.
- Decisión de adaptadores: `docs/investigacion/probes/DECISION_ADAPTADORES.md` (CE-T5/CE-T6) — ver corrección §1.1.
- Probes y evidencia por CLI: `docs/investigacion/probes/*.md`.
- Ronda adversarial r1: `docs/investigacion/hra/adversarial-plan-h9-r1.md`.
- Plan e issue de origen: `docs/investigacion/Plan_Conversation_Event_v0.md`, issue #2 (cerrado).

## Registro adversarial

| Ronda | Veredicto | Hallazgos | Resolución en este documento |
|---|---|---|---|
| r1 (2026-08-22, autorrevisión con verificación por ejecución) | `fix-and-retry` | 2 CRÍTICO, 2 HIGH, 2 MED, 2 LOW | CRÍTICO-1 → §3.1 (clave en el índice, `evento_id` UUID v4 intacto) · CRÍTICO-2 → §1.1 (20/5/10) y §7.2 (de "coincidir" a "explicar") · HIGH-3 → §3.5 + P5 · HIGH-4 → CO-T1 reescritura, estimado 2.75→3.5 · MED-5 → R7 · MED-6 → R6 con dueño CO-T2 · LOW-7 → §3.1 exclusión de `fecha_observacion` · LOW-8 → §3.4 con 4/5 |
