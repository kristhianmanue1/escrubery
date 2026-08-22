# Adversarial — Plan H9 (Colector conversation-event) — r1 — 2026-08-22

**Límite declarado:** autorrevisión del propio autor del plan, no ronda independiente (el precedente H7-T4 usó subagente aislado). Compensación: **toda afirmación se verifica por ejecución**, no por lectura. La independencia sigue faltando y debe registrarse como tal.

## Verificaciones ejecutadas

| # | Qué se verificó | Comando | Resultado |
|---|---|---|---|
| V1 | Aritmética de la matriz de CE-T5 | parser propio sobre la tabla | **ok=20 parcial=5 nd=10** (total 35) vs. **21/5/9 declarado** |
| V2 | Campos requeridos del contrato | lectura del schema | `evento_id` es `format: uuid` ("UUID v4"), `cli_version` `minLength: 1`, `additionalProperties: false` |
| V3 | Almacén gitignored | `git check-ignore -v` | `var/` ignorado en bloque (`.gitignore:27`) → `var/colector/` cubierto ✓ |
| V4 | Script de sonda existente | `package.json` | `probe:conversacion` existe ✓ |
| V5 | Anclas reales en los lectores | grep sobre `probes/*.ts` | codex lee por `split('\n')` **sin índice de línea**; sin soporte de offset |
| V6 | Relleno real de `cli_version` | grep sobre `probes/*.ts` | prosa: `'desconocida'`, `'no proyectada aquí'`, `'por sesión'` |

## Hallazgos

### CRÍTICO-1 — El diseño central viola el contrato que el propio plan promete no tocar
§3.1 define el ID de evento como `sha256(cli + ruta + ancla)`. Pero `evento_id` es `format: uuid` con `additionalProperties: false`: un hex de 64 no es un UUID y **no hay campo libre donde alojar la clave derivada**. El plan declara en §Reglas duras que el schema no se modifica (regla 7) — es decir, se contradice a sí mismo en su decisión más importante.
**Corrección propuesta:** la clave de deduplicación **no es un campo del evento, es una propiedad del índice del almacén** (`var/colector/indice.json`). `evento_id` sigue siendo UUID v4 según contrato; la garantía de idempotencia vive en el índice, derivada de `(cli, ruta_saneada, ancla)`. El contrato queda intacto y la propiedad "relee y no duplica" se conserva. Alternativa descartada: UUIDv5 determinista — pasaría `format: uuid` pero contradice la descripción "UUID v4" del propio campo.

### CRÍTICO-2 — El criterio de cierre está anclado a una matriz con la aritmética mal
La matriz de `DECISION_ADAPTADORES.md` declara **21 ok · 5 parcial · 9 nd**; el conteo real de sus propias celdas es **20 · 5 · 10** (una celda `no_disponible` contada como `ok`). El plan H9 heredó el número ("los 9 `no_disponible`") y —peor— §7 criterio 2 exige que la cobertura "coincida con la matriz de CE-T5": **un criterio de cierre que exige coincidir con un dato equivocado**.
**Corrección propuesta:** corregir el plan a 20/5/10, y **no editar en silencio** el artefacto de H6 (ciclo cerrado por decreto y publicado en v0.5.0): corresponde una fe de erratas fechada, con decreto del Mediador. Ver §Escalado.

### HIGH-3 — `cli_version` sería procedencia falsa que pasa el validador
El campo es requerido con `minLength: 1`, y los probes lo rellenan con prosa (`'desconocida'`). En una sonda eso fue LOW; en un **registro longitudinal persistente** es una violación de la regla dura 1 disfrazada de cumplimiento: la cadena satisface el schema y no transporta información. Agravante propio del colector: la versión instalada **hoy** no es la que produjo un rollout de hace dos meses — atribuirla sería inventar procedencia (regla 4).
**Corrección propuesta:** el plan debe decidirlo explícitamente, no heredarlo. Opción sobria: derivar la versión por sesión donde la fuente la trae (codex `session_meta`, opencode) y, donde no, **bloquear el ciclo tras el contrato v1** que admite `null`/`no_proyectada` — es decir, H9 depende de un ticket de contrato que el plan había mandado "aparte".

### HIGH-4 — "Reuso de los lectores de `probes/`" está sobrevendido, y el estimado depende de ello
V5 muestra que los lectores son generadores sobre el archivo completo, sin noción de offset ni reanudación (codex hace `readFileSync` + `split` de 626 archivos en cada corrida). El colector incremental exige reescribirlos, no reusarlos. CO-T2 (0.75) asume reuso; el estimado total de 2.75 es optimista por ahí.

### MED-5 — Deriva de prosa del contrato sobre la ruta del almacén
`carga_ref` describe la referencia como "bajo `var/probes/`". El plan escribe en `var/colector/`. La privacidad se sostiene (V3: `var/` ignorado en bloque), pero la descripción del contrato queda desalineada → anotar para contrato v1.

### MED-6 — La mitigación R6 no tiene ticket dueño
R6 exige revisión adversarial independiente del adaptador claude-code (el que audita es el auditado). Ningún ticket la contiene: CO-T4 sólo prevé la adversarial de hito. Riesgo de mitigación declarada y no ejecutada.

### LOW-7 — Precisión de la clave de deduplicación
`fecha_observacion` es requerida y cambia en cada corrida: debe declararse **excluida** de la clave de deduplicación, o el gate "doble corrida = 0 nuevos" es indemostrable.

### LOW-8 — Números asimétricos en §3.4
Se cita "`turno_fallido` 3/5 nd" pero `sesion_cerrada` (4/5 nd, el hueco mayor) va sin número.

## Escalado al Mediador

CRÍTICO-2 toca `docs/investigacion/probes/DECISION_ADAPTADORES.md`, artefacto de un **ciclo cerrado por decreto y publicado en la release v0.5.0**. La política prohíbe cerrar o reabrir por declaración del agente: la corrección del dato de H6 requiere decreto explícito. Propuesta: fe de erratas fechada al pie del documento, sin reescribir el histórico.

## Decisión

**`fix-and-retry`** — 2 CRÍTICO, 2 HIGH, 2 MED, 2 LOW. El plan **no debe decretarse en r1**: CRÍTICO-1 invalida el diseño central y CRÍTICO-2 invalida un criterio de cierre. Ninguno de los dos es cosmético y ambos se detectaron por ejecución, no por opinión.

## Nota metodológica

La autorrevisión encontró dos CRÍTICOS, lo que confirma su utilidad pero **no sustituye** la ronda independiente: los dos hallazgos salieron de verificar datos, y un revisor independiente habría además cuestionado premisas que el autor da por buenas (p. ej. si el registro longitudinal tiene consumidor real, o si `var/` gitignored es almacén suficiente para un dato que se quiere durable).
