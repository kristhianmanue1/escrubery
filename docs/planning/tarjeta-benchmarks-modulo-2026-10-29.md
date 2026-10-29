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
| ESC-LOTE-20261029-08 | (este commit) | contrato errata 13, plan, tarjeta, manifest, README, AGENTS, bitácora | decreto sesión (transcrito arriba) |

**Límite declarado de la aceptación:** es una autorización de sesión transcrita
(no respuesta por folio individual); el decreto cubre expresamente «no te
detengas hasta concluir el módulo completo», lo que abarca los cuatro lotes.
El push de cada lote es ordinario (sin force), a `main` (rama única del repo).

## Spike — los 30 nombres (método reproducible)

Claude Opus 5.5 (Max) · GPT-6 Astra (Max) · Gemini 4 Carbon (High) · Muse Wonder Full (Max) · Kimi K3.1 Pro (Max) · Qwen3.8-Max · Grok 4.7 (xHigh) · GLM-5.3 (Max) · GLM-5.3-Flash · Kimi K2.6 · DeepSeek-V4.1-Flash-20261017 (Max) · MiMo-V2.6-Flash · Claude Opus 5 (High) · GPT-5.6 Sol (xHigh, Codex Harness) · Muse Spark 1.3 (Max) · GLM-5.2 (Max) · Kimi K3 (Max) · Qwen3.8-Flash-Next · Grok 4.6 (High) · Claude Sonnet 5.5 (xHigh) · Gemini 3.8 Flash (High) · MiniMax-M3.1-Flash · Step 5 Preview (High) · Seed2.1 Pro Preview · GPT-5.5 (xHigh, Codex Harness) · Kimi K2.7 Code · GLM-5 · Hy4 preview · Gemini 3 Pro · Claude Haiku 5.5 (High).

## Adversarial

Pendiente la ronda INDEPENDIENTE (política §6) al cierre del hito — con clases
de defecto del catálogo skevi ADR-035 (entrada no confiable e inyección;
contrato roto; test que no prueba el requisito). El análisis del encargo incluyó
autorrevisión declarada H1–H7 (H1 refutada: el dominio actual no absorbe evals
sin cambios — la purga lo impide; H3 débil por diseño, medida por el spike).

## Límites de la sesión

Sin AN-KLA (sin decreto de escritura). Fuentes T2+ (Artificial Analysis exige
decreto D2; SWE-bench sin canal archivo estable verificado) y multimodalidad
quedan documentadas, no ingeridas. La detección de retirados y
`publicado_por ≠ plataforma` quedan diferidas (plan §6).
