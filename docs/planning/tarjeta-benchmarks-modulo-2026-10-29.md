# Tarjeta: benchmarks-modulo-2026-10-29

**Clase:** Architectural (disparadores: dominio nuevo + interfaz pública nueva + plan multi-tarea — ADR-0001 skevi; el plan `docs/investigacion/Plan_Benchmarks_v0.md` es la fuente única de DoD y esta tarjeta lo referencia sin duplicarlo).
**Decreto:** «adelante con recomendación para esta sesion tines aprobados commits push merges pr etc segun se requiera adelante y no te detengas hasta concluir el modulo ocmpelto» (Operador/Mediador, 2026-10-29).
**Estado:** EJECUTADA — verificación por ejecución abajo; ronda adversarial independiente pendiente (§Adversarial).

## Qué entrega

Módulo benchmarks completo (Fases A–F del encargo en una sesión, por decreto):

1. **T-0 / D3:** refresco LiteLLM diario integrado a `scripts/vigilancia_diaria.sh` (el catálogo vivía caducado; 0/309 el 2026-10-29).
2. **Spike de identidad:** 30 designaciones reales de Arena webdev/overall → resolver. Pre-curaduría **0/30** (fail-closed 30/30); post-curaduría **19/30 (63 %)** — sobre el umbral de falsación (30 %). Los 11 restantes son correctos por diseño (proveedores fuera de catálogo, modelos ausentes, designaciones ambiguas).
3. **Mig 018 + módulo** `backend/src/benchmarks/` (dominio, ingesta append-only, adaptador Arena vía datasets-server HF, consultas) — semántica nueva: observación = hecho histórico, idempotencia por `observacion_hash` UNIQUE, sin purga.
4. **Tres operaciones aditivas** (errata 13 §3.10–3.12): `listar_benchmarks`, `consultar_benchmark`, `consultar_resultados` en CLI/HTTP/MCP; Agent Card re-firmada (12 tools).
5. **Captura real + curaduría:** 622 observaciones (419+152+51, publicadas 2026-10-28); 40 aliases de leaderboard validados contra catálogo vivo, self-hash re-sellado (`c5e59616…`).

## Verificación (por ejecución, 2026-10-29)

- `npm test` **311/311** (294 previos + 13 módulo + 4 HTTP; 0 regresiones) · `nest build` OK · `npm run lint` 0 errores (8 warnings, misma clase supertest que los 3 preexistentes) · `check_sizes` OK · `bash -n` vigilancia OK.
- Idempotencia en producción: doble corrida del adaptador → 603 duplicadas reconocidas, **0 filas duplicadas**; 19 nuevas = des-truncamiento del tope de páginas (400→419, tope ampliado a 1200 y truncamiento ahora se anuncia, nunca silencioso).
- E2E CLI: `consultar benchmarks`, `benchmark lm-arena-webdev`, `resultados modelo glm-5.3` → vinculación canónica `{resuelto: true, zhipu/glm-5.3}` con IC y procedencia completa. Defecto cazado en verificación: Postgres ordena NULLS FIRST en DESC → fila sin rating encabezaba resultados; corregido con `nulls last` explícito (ausencia ≠ 0).
- MCP smoke (`mcp:probar`): 12 tools; `verificar_evidencia` ok (551 eventos, 55 checkpoints). Higiene: fb_13 (prueba interna del arnés) triado → `rechazado` (patrón fb_2–fb_9).
- Terminal-Bench: sonda del canal RDS público del dashboard → credenciales rotas (auth failed con y sin SSL). Control positivo: el endpoint responde → canal bloqueado, no sonda inoperante. Documentado en el plan §4.

## Lotes (skevi ADR-044/045 — folio, destino, aceptación)

| Folio | Commit | Contenido | Aceptación |
|---|---|---|---|
| ESC-LOTE-20261029-05 | `8fa67c5` | refresco diario + catálogo (drift +1) | decreto sesión (transcrito arriba) |
| ESC-LOTE-20261029-06 | `75f2463` | mig 018 + módulo + superficies + Agent Card + vigilancia | decreto sesión (transcrito arriba) |
| ESC-LOTE-20261029-07 | `d7e2c96` | capturas Arena + curaduría 40 aliases | decreto sesión (transcrito arriba) |
| ESC-LOTE-20261029-08 | `aa79090` | contrato errata 13, plan, tarjeta, manifest, README, AGENTS, bitácora | decreto sesión (transcrito arriba) |
| ESC-LOTE-20261029-09 | `332013a` | fixes adversarial r1+r2 (fail-closed, procedencia, aislamiento, métrica agent) + capturas | decreto sesión (transcrito arriba) |
| ESC-LOTE-20261029-10 | (este commit) | fix r3 re-ronda: score_con_signo + saneamiento onConflict + spec realista | decreto sesión (transcrito arriba) |

**Límite declarado de la aceptación:** es una autorización de sesión transcrita
(no respuesta por folio individual); el decreto cubre expresamente «no te
detengas hasta concluir el módulo completo», lo que abarca los cuatro lotes.
El push de cada lote es ordinario (sin force), a `main` (rama única del repo).

## Spike — los 30 nombres (método reproducible)

Claude Opus 5.5 (Max) · GPT-6 Astra (Max) · Gemini 4 Carbon (High) · Muse Wonder Full (Max) · Kimi K3.1 Pro (Max) · Qwen3.8-Max · Grok 4.7 (xHigh) · GLM-5.3 (Max) · GLM-5.3-Flash · Kimi K2.6 · DeepSeek-V4.1-Flash-20261017 (Max) · MiMo-V2.6-Flash · Claude Opus 5 (High) · GPT-5.6 Sol (xHigh, Codex Harness) · Muse Spark 1.3 (Max) · GLM-5.2 (Max) · Kimi K3 (Max) · Qwen3.8-Flash-Next · Grok 4.6 (High) · Claude Sonnet 5.5 (xHigh) · Gemini 3.8 Flash (High) · MiniMax-M3.1-Flash · Step 5 Preview (High) · Seed2.1 Pro Preview · GPT-5.5 (xHigh, Codex Harness) · Kimi K2.7 Code · GLM-5 · Hy4 preview · Gemini 3 Pro · Claude Haiku 5.5 (High).

## Adversarial

**Ronda independiente EJECUTADA (2026-10-29, subagente contexto fresco, mismo
proveedor que el autor — decorrelación parcial declarada):** verificación por
ejecución de todas las cifras (311 tests, 622 obs, 622 hashes únicos, +40
aliases, cadena hash↔captura) ✅ y hallazgos: 2 HIGH (procedencia §3.11
prometida y no servida; truncamiento silencioso posible en respaldo /rows),
4 MED, 8 LOW → decisión **fix-and-retry**. Fixes aplicados en el mismo
ticket (lote 09): procedencia representativa servida en `consultar_benchmark`
(+spec); fail-closed de presupuesto en AMBAS ramas del canal (abort en vez de
aviso — captura incompleta → no se ingesta nada); `total_coincidencias`
real + bandera `truncado` (+spec); guarda de deriva de esquema sobre filas
crudas; custodia git diaria de capturas (patrón sandbox, crecimiento
declarado ~240 KB/día); spec de regresión del `nulls last`; log del error
tragado en el fallback; `|| true` eliminado; scope de fuente en
`versiones_metodologia`.

**El fix-and-retry cazó un defecto real en producción:** la guarda de esquema
abortó la corrida del agente — la config `agent` publica `score` (no
`rating`, mapeo declarado en la card del dataset) y las 51 observaciones
originales de agent se habían ingerido con `valor NULL` (el MED 4 predicho,
ya ocurrido). Corrección: normalizador con mapa por config
(`campo_original_metrica` queda en condiciones), DELETE documentado de las 51
filas defectuosas (bug del adaptador, no hecho de la fuente; las capturas
crudas que las anclan permanecen intactas en git como evidencia del
incidente) y re-ingesta con valores correctos. Las tablas del módulo NO
están encadenadas en Evidentia (decisión D4) — la corrección no rompe
ninguna evidencia sellada.

**Segundo incidente cazado en verificación (r2):** la arena agent publica
`score` en escala 0–1 (IPS) — NO un rating BT (~1500). Mezclar escalas bajo
`rating_bt` habría inducido comparaciones engañosas (H7): separamos métrica y
unidad por definición (`score_agente`/`score_0_1`), DELETE documentado de las
51 filas con etiqueta errónea y re-ingesta. Estado final verificado: agent 51
obs (todas con valor, max 0.21), text 419, webdev 152 — 622 totales.

**Lección operativa del día:** datasets-server `/filter` sufre 500/502
transitorios por config; el adaptador ahora aísla configs (un fallo no bloquea
a los demás; exit 3 parcial declarado) y aborta sin ingerir cuando el respaldo
`/rows` no puede cubrir el split completo (text: 11.132 filas > tope 1200).

**Tercer incidente (r3, re-ronda adversarial):** la re-ronda de confirmación
consultó la fuente en vivo y refutó la escala declarada: el score de agent es
**con signo** (−0.208…+0.209, centrado en ~0), no 0–1 — `score_0_1` era
metadato falso servido por la API (exactamente la clase de daño que r2 quería
reparar). Fix aplicado según prescripción: `score_con_signo` + objetivo sin
claim de rango, `asegurarDefinicion` ahora sanea `metrica_principal`/`unidad`
en el onConflict (sin esto, corregir dominio.ts no reparaba la BD), UPDATE
documentado de 51 observaciones + 1 definición (etiqueta de unidad; los
valores siempre fueron correctos), spec con valor realista con signo y asserts
de métrica/unidad por config. Estado final verificado por SELECT: agent 51
(min −0.208 / max 0.209), text 419 (953–1528), webdev 152 (1071–1810), 314/314.

Seguimiento declarado (LOW, sin ticket propio): validación runtime de tipos
del body HTTP (clase preexistente en todos los endpoints); retención de
capturas a largo plazo (~88 MB/año, revisar en F); residual teórico del
fail-closed si la fuente dejara de declarar `num_rows_total` (trade-off
documentado en el adaptador).

## Límites de la sesión

Sin AN-KLA (sin decreto de escritura). Fuentes T2+ (Artificial Analysis exige
decreto D2; SWE-bench sin canal archivo estable verificado) y multimodalidad
quedan documentadas, no ingeridas. La detección de retirados y
`publicado_por ≠ plataforma` quedan diferidas (plan §6).
