# Tarjeta: adaptador-swebench-2026-10-29

**Clase:** Bounded (F1 del Plan_Benchmarks_v0; archivos de producción existentes + patrón probado del adaptador Arena; sin contrato nuevo — reutiliza las 3 operaciones de la errata 13).
**Decreto:** «(1) ejecuta adaptador-swebench (scope Verified, ToS registrada, captura HTML cruda, curaduría fail-closed de aliases)… (4) autorizo el tag v0.6.0» (2026-10-29).
**Estado:** EJECUTADA — verificación por ejecución abajo.

## Qué entrega

- `backend/src/benchmarks/adaptador_swebench.ts` (`npm run benchmarks:ingestar-swebench`): fetch del HTML de swebench.com (2 reintentos, timeout 30 s), extracción del JSON embebido `#leaderboard-data` (regex exportada para specs), scope **Verified only** (los otros 4 leaderboards declarados en notas), guarda de deriva de esquema (claves obligatorias en todas las filas → abort), captura cruda = **HTML completo hasheado** en `datos/fuentes/benchmarks/swebench/`, ingesta append-only con idempotencia por `observacion_hash`.
- Sujetos **sistema_compuesto** (`agente · modelo`, componentes verbatim en columnas) — primeros del dominio; vinculación canónica por `model_display` vía `identidad_alias` (fail-closed).
- `publicado_por`: `checked:true` → `plataforma` (verificado por el equipo SWE-bench) / `false` → `tercero` (autoreporte) — la distinción que Arena no daba. `warning` del equipo conservado verbatim en condiciones. `resolved` en porcentaje 0–100 sin reescalar.
- `backend/src/benchmarks/swebench.spec.ts` (8 its), vigilancia con segundo adaptador (aislados entre sí), curaduría **+10 aliases** validados contra catálogo (72 totales; self-hash `e2e825df…`).
- **ToS registrada** (regla §7): sitio sin términos propios; repo del equipo **MIT** (verificado vía API 2026-10-29); submissions con trazas S3 públicas por diseño.

## Verificación (por ejecución, 2026-10-29)

- Ingesta real: **180 observaciones run-level** (157 subjects; 60 verificadas / 120 autoreporte; 0 filas parciales). **Doble corrida → 0 duplicadas** (180 idempotentes; hash del HTML idéntico entre corridas).
- `npm test` **322/322** (314 + 8 nuevos) · `nest build` OK · `bash -n` vigilancia OK.
- E2E del criterio §16 del encargo, cruzando fuentes: `consultar resultados modelo glm-5` → lm-arena-text 1457 rating_bt · lm-arena-webdev 1436 rating_bt · **swe-bench-verified 72.8 % resueltas** (mini-SWE-agent · GLM 5, autoreporte `tercero`) — preferencia humana Y tasa de éxito real, con condiciones y procedencia por observación.
- Dominio total tras F1: **802 observaciones** en 4 definiciones de 2 fuentes.

## Lote

| Folio | Contenido | Aceptación |
|---|---|---|
| ESC-LOTE-20261029-12 | adaptador + specs + curaduría + captura cruda + docs + insumo epistates final | decreto sesión 2026-10-29 (transcrito arriba) |

## Límites

- `resolved` sin IC (la fuente no publica intervalo por run); `fecha_ejecucion` null (solo `date` de publicación).
- Modelos históricos (Claude 3.x, GPT-4o, Gemini 2.x, DeepSeek, MiniMax, Llama…) y designaciones ambiguas ("Multiple", "Undisclosed", harnesses como entradas) quedan **sin alias** — fail-closed por diseño; el catálogo de escrubery es proveedores API first-party y esos modelos no están.
- Guard `JEST_WORKER_ID` para que el import en specs no dispare la captura (lección del primer run del spec).
