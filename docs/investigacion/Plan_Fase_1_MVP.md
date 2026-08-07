# Plan: Fase 1 — MVP de consulta sobre PostgreSQL

**Contexto:** la Ficha v0 (Fase 0) sirve consultas sobre JSON estáticos; F1 las sirve desde PostgreSQL con caché-al-consultar, vía CLI y HTTP, e instrumenta todo en `consultas_log`. **Fecha:** 2026-08-07. **Estado:** en-curso (T1). **Fase del plan v2:** F1. **Fuente:** ticket del Arquitecto, con `reportar_feedback` (T7) por iniciativa del Mediador.

## Objetivo y criterio de cierre

- **Objetivo:** un consumidor pregunta por un modelo o comando y recibe respuesta correcta con fuente citada, en ms desde BD, sin llamar a un modelo de IA ni a fuente externa (salvo primera consulta de un dato nuevo).
- **Cierre (plan v2 §4):** (1) consulta responde desde BD con fuente; (2) toda respuesta sobre un CLI muestra `tipo` oficial/comunitario; (3) al menos un consumidor real (ADRC o expertoGobernanza) resolvió una consulta real.

## Decisiones técnicas

- **ORM/acceso:** Kysely (SQL-first, type-safe, sin magia; no estorba la firma de F2). Migrations SQL + `pg` para el runner; Kysely para las queries de la app.
- **Feedback:** vive dentro del sistema (tabla `feedback` + `reportar_feedback`); GitHub descartado.

## Hitos (cada uno dispara ronda adversarial, §6)

- H-F1 — Cierre F1: los 3 criterios de §4 cumplidos + métrica `% consultas desde BD > 90%` sobre `consultas_log` con tráfico real.

## Tareas (1 tarea = 1 contrato + 1 salida pequeña)

- [ ] **T1 — Capa Kysely + ingesta de fichas a BD.** Kysely (schema+kysely), `ingestar` que llene `modelos`/`cli_productos`/`cli_comandos` desde `datos/fichas/`. *DoD:* `db:ingestar` idempotente; counts = 139 modelos / 7 CLIs / N comandos; 0 filas sin procedencia. **Estado:** bug de path (cwd) detectado, en fix.
- [ ] **T2 — CLI `consultar` sobre BD (caché-al-consultar).** Migrar `scripts/consultar` de JSON a BD (patrón vigente→sirve / no→obtiene). *DoD:* `consultar modelo moonshot kimi-k2-0905-preview` lee de BD y responde igual que hoy.
- [ ] **T3 — Endpoint HTTP JSON.** `POST /v0/<op>` con el contrato v0. *DoD:* `curl POST /v0/consultar_modelo` responde igual que el CLI; errores 404/400.
- [ ] **T4 — `consultas_log` + instrumentación.** Toda consulta registrada. *DoD:* tras N consultas, `consultas_log` tiene N filas con `servido_desde`+`latencia_ms`.
- [ ] **T5 — Ingesta asistida de `--help`.** Captura→hash→fecha→insert. *DoD:* `ingestar --cli claude-code --comando "--help"` crea fila en `cli_comandos` con procedencia.
- [ ] **T6 — Primer consumo real.** ADRC o expertoGobernanza resuelve una consulta vía CLI/HTTP. *DoD:* evidencia de una consulta real de un consumidor.
- [ ] **T7 — `reportar_feedback` (contrato de uso).** Tabla `feedback` + endpoint/CLI `reportar_feedback` con deduplicación y procedencia (contrato v0 §3.6). *DoD:* un `reportar_feedback` registra con `estado: nuevo`; un segundo idéntico devuelve `duplicado`.

## Riesgos / supuestos

- **Sobre-alcance (riesgo §12.1):** T5 (ingesta --help) roza Fase 3 (criterios de entrada). Si高清得 excesivo, se defer a F3. → Mitigación: T5 solo captura manual asistida, no ejecución automatizada.
- **Identidad del reportante (T7):** `configuration_fingerprint` es recomendable pero el servicio no la valida criptográficamente hasta F2 (firma). → Aceptado: en F1 es declarativa.

## Enlaces

- Política: `docs/politica-agentes.md` · Plan v2: `docs/investigacion/Plan_Iterativo_Incremental_Servicio_CLI_Modelos_v2.md`
- Contrato v0 (con §3.6 `reportar_feedback`): `docs/CONTRATO_API_v0.md`
- Memoria AN-KLA: `retrieve --query "estado post-f0" --budget 4000`
