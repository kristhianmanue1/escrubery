# Plan Benchmarks v0 — inteligencia sobre evaluaciones publicadas

**Estado:** en ejecución (sesión 2026-10-29; decreto del Mediador «adelante con
recomendación… commits, push, merges… no te detengas hasta concluir el módulo
completo»). **Clase:** Architectural (crea dominio nuevo + plan multi-tarea;
ADR-0001 skevi — este plan es la **fuente única de DoD**; las tarjetas lo
referencian). **Contrato:** errata 13 de `docs/CONTRATO_API_v0.md` (§3.10–3.12).

---

## 1. Decisión arquitectónica (Fase A — ejecutada)

**Alternativa B acotada**: módulo `benchmarks` dentro del servicio, tablas
propias **append-only**, adaptadores por fuente, operaciones aditivas. Ni un
byte en `datos/fichas/` (el catálogo regenerar-y-purgar no sirve para historia:
una observación vieja es un requisito aquí y un bug allí — refutación de H1).

- **No** Alternativa A: una observación no es propiedad intrínseca del modelo.
- **No** Alternativa C: duplicaría procedencia/identidad/vigilancia/gates.
- **Frontera con F4b** (crítico, quedan los mismos nombres): F4b es *ejecutar*
  evaluaciones propias con Harbor (aparcado, presupuesto); esto es *leer*
  resultados publicados por terceros. Escrubery no ejecuta evaluaciones, no
  crea rankings propios, no promedia métricas heterogéneas.

**Condiciones de falsación** (vigentes): tasa de resolución de identidad
persistentemente <30 % sobre muestra real (medida: ver §3); licencias que
prohíban re-servir datos derivados (Artificial Analysis queda fuera por eso);
volumen que desborde la instancia PostgreSQL única; consumidor que exija
verificación propia de resultados (eso es F4b).

## 2. Modelo de información (mig 018)

Cuatro tablas; tres colapsos deliberados respecto de las 8 entidades del
encargo original: `EvidenceRecord` = bloque procedencia por fila + captura
cruda hasheada (árbol congelado); `MethodologyRevision` = versión de la
definición (UNIQUE fuente+slug+versión; nueva versión ≠ variación de
rendimiento); `ComparabilityAssessment` = **derivada** en consulta
(`grupo_comparabilidad`), nunca persistida por pares (evita O(n²)); solo se
persisten incompatibilidades documentadas en la definición.

Semántica nueva del dominio: **append-only** con idempotencia por
`observacion_hash` UNIQUE (sha256 del contenido canónico de la observación:
misma publicación + mismo valor → no duplica; publicación nueva o valor
corregido → fila nueva; la historia conserva ambas evidencias). Caducidad por
**fuente** (`ventana_dias` sobre `fecha_ultima_captura`): captura vieja → las
observaciones se sirven degradadas (`pendiente_de_verificar`), nunca borradas.

Vinculación canónica: `benchmark_subjects.resuelto_*` vía `identidad_alias`
(curaduría); sin alias → NULL y `vinculacion_canonica: {resuelto: false,
motivo: sin_datos}` en la respuesta (fail-closed; la designación original se
conserva verbatim). La re-vinculación ocurre al re-ingerir, sin reescribir
historia de observaciones.

## 3. Spike de identidad (ejecutado 2026-10-29)

Muestra: 30 designaciones reales del leaderboard webdev/overall (publicación
2026-10-28) contra `resolver_identidad_modelo`.

- **Pre-curaduría: 0/30 (0 %)** — fail-closed 30/30, cero invención.
- **Post-curaduría (40 aliases validados contra catálogo vivo): 19/30 (63 %)**
  — sobre el umbral de falsación (30 %). Los 11 no resueltos son correctos por
  diseño: proveedores fuera de catálogo (deepseek, xiaomi, minimax, stepfun,
  bytedance, tencent…), modelos ausentes (kimi-k3.1-pro, gemini-4-carbon) y
  designaciones ambiguas (muse-wonder-full vs muse-wonder-1.0) — ninguno se
  vincula en silencio.

**DoD del spike:** cifra escrita aquí con método reproducible (los 30 nombres
en la tarjeta §Spike). **Cumplido.**

## 4. Fuente ingerida v0 y canal

**Arena (ex LMArena) Leaderboard Dataset** — `lmarena-ai/leaderboard-dataset`
(HuggingFace). Elección: CC-BY-4.0 (atribución), **sin gate ni auth**, canal
machine-readable estable (datasets-server `/filter` + `/rows` respaldo),
cadencia ~semanal (lastModified observado 2026-10-29T03:05Z), 23 configs.
Ingeridas v0: `text_style_control` (419 overall), `webdev` (152 — eje
programación), `agent` (51 — arena de agentes). Métrica: rating BT con IC 95 %,
votos y rank por publicación.

**Censos y descartes documentados** (del análisis 2026-10-29): Terminal-Bench
— canal RDS público del dashboard con credenciales rotas (auth failed con y
sin SSL; endpoint vivo → control positivo: canal bloqueado, no sonda
inoperante; pendiente canal alternativo estable); Artificial Analysis — API
con key + términos que restringen redistribución (exige decreto D2, fuera por
ahora); GAIA2 gated; GPQA/MMLU-Pro/MMMU saturados; Aider dormido ~13 meses;
SWE-Lancer archivado; multimodalidad diferida sin consumidor (disparador:
`reportar_feedback`).

## 5. DoD del plan (fuente única; las tarjetas referencian)

1. ✅ Mig 018 + módulo `backend/src/benchmarks/` (dominio/ingesta/adaptador/consultas) — `npm run db:migrate` aplicada, 4 tablas.
2. ✅ Specs de los criterios verificables (encargo §13): 13 its en `benchmarks.spec.ts` + 4 HTTP en `benchmarks_http.spec.ts` — `npm test` 311/311.
3. ✅ Tres operaciones aditivas en las 3 superficies (CLI/HTTP/MCP) + errata 13 + Agent Card re-firmada (12 tools) + spec anti-drift actualizado.
4. ✅ Captura real + idempotencia probada en producción: 622 observaciones; doble corrida → 0 duplicados (603 duplicadas reconocidas, 19 nuevas = des-truncamiento).
5. ✅ Curaduría: 40 aliases validados contra catálogo vivo, self-hash re-sellado, ingesta acepta; spike 0/30 → 19/30.
6. ✅ Vigilancia: refresco LiteLLM diario (D3) + captura benchmarks diaria integrada (exit contract intacto 0/10/2; fallo adaptador = infra, no elimina nada).
7. ⬜ Ronda adversarial independiente (política §6 — al cierre del hito, con clases de defecto del catálogo skevi ADR-035) + dossier al Mediador.
8. ⬜ Registro: tarjeta + bitácora + manifest + README + AGENTS (este commit).

**Gate E1–E5 (skevi) — reevaluación obligada por ser el primer plan multi-tarea
que se EJECUTA** (gatillo de ADR-0001/0002): se mantiene **aplazado con la
misma causa** (adoptarlo al vuelo rompería CI y exigiría reescribir evidencia
histórica; ADR-0002 §No adoptado). Se reevalúa al CIERRE de este plan, con la
experiencia de su ejecución como insumo.

## 6. Límites declarados (v0)

- `publicado_por` es 'plataforma' para Arena (computa de votos propios); no
  distingue autoreporte (aplicará a fuentes que sí lo mezclan, p. ej. SWE-bench).
- Ausencia en un snapshot ≠ retiro: `retirado_en` existe pero la detección de
  retirados está diferida (el `latest` de Arena no declara retiros).
- La versión metodológica es constante (`bt-style-control-1`) con
  incompatibilidades documentadas en la definición; una revisión metodológica
  real exige curaduría (nueva fila de definición), no ocurre en silencio.
- La captura incluye `capturado_en` → el hash de captura cambia entre corridas
  aunque el contenido sea idéntico; la idempotencia vive en `observacion_hash`
  (contenido de la fila), no en el hash de la captura. La reconstrucción de
  una observación ancla su captura por hash (los archivos se custodian en git).
- Multimodalidad y fuentes T2+ fuera del alcance hasta decreto/disparador.
- **Capturas: presupuesto fail-closed y custodia** (adversarial r1): si la
  fuente declara más filas que el tope de descarga (1200/config), NO se
  ingesta nada (exit 3) — jamás ingesta parcial silenciosa; guarda de deriva
  de esquema (columnas ausentes en todas las filas → abort). Custodia diaria
  por git (patrón sandbox): crecimiento declarado ~240 KB/día; el árbol es
  evidencia y no se poda. `hash_ultima_captura` de la fuente corresponde a la
  última captura del ciclo de ingesta (nota servida en §3.11).
