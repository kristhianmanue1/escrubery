# Análisis: incorporación de Atria (atria-asi.ai) y TypeSafe (docs.typesafe.ai) al catálogo

**Fecha:** 2026-10-14 · **Fuente de la petición:** Mediador · **Clase del eventual ticket:** Bounded (TypeSafe) / Observación (Atria)
**Precisión del Mediador que condiciona el análisis:** Atria no publica precios porque hoy es gratuito con límite de tokens para uso y prueba; el ecosistema lo estará usando en ese régimen (declaración registrada con atribución en `datos/fichas/curaduria/integracion_atria.json`).

## 1. Qué son (verificado contra fuentes primarias)

### Atria — proveedor chat first-party, un modelo
- `Atria-Dawn`: contexto 512K, entrada **solo texto**, salida hasta 65,536 tokens por parámetro de request.
- Triple superficie: OpenAI Chat Completions (`/v1/chat/completions`), Anthropic Messages (`/v1/messages`, `x-api-key` + `anthropic-version: 2023-06-01`), OpenAI Responses (`/v1/responses`).
- Integraciones documentadas paso a paso: claude-code, codex-cli (≥0.154.0, catálogo con `input_modalities: ["text"]`), WorkBuddy, Qoder, OpenClaw, Hermes.
- Rate limit por cuenta compartido entre las 3 APIs (docs: `x-rpm-limit: 60`, `Retry-After`, `x-rpm-remaining`).
- **No está en LiteLLM** (0 de 4,070 entradas) · **sin precios publicados** (verificado: 404 en `/pricing`, cero menciones) · **sin legales** (404 en `/legal`, `/terms`, `/privacy`) · **sin identidad del operador** (sitio principal = SPA 1.6 KB en Aliyun OSS Singapur).

### TypeSafe — paradigma nuevo: "System One", no chat
- `Jev 1.13` no genera texto: evalúa preguntas tipadas (Choice/Score/Noul) contra un `state` y devuelve valores tipados + probabilidades calibradas + confidence. API propia `POST /v1/systemone`; `GET /v1/models`.
- **En LiteLLM**: 3 entradas (`jev-1.13.0`, `jev-latest`, `jev-preview`), provider `typesafe`, `mode: evaluation`, `$42/Btok` entrada (output gratis) — cruce directo con `docs.typesafe.ai/models`.
- Contexto 64K por request (32K `state` + pregunta más larga), entrada solo texto, inglés primario.
- Legal **legible**: DPA + MCA + Privacy en `typesafe.ai/legal/*`, compromiso explícito de **no entrenar con datos de clientes**, ZDR enterprise.
- SDKs oficiales Python/JS; agent skill drop-in para Claude Code/Codex. Dato de mercado: Databricks hospeda un endpoint **OpenJev** (Qwen 3.5 4B) vía la misma API System One — la interfaz se expande a terceros.

## 2. Análisis crítico — choque con la casa

| Pieza | Atria | TypeSafe |
|---|---|---|
| Capa generada (regla #3) | ❌ Sin entrada LiteLLM no hay ficha canónica | ⚠️ Existe, pero el generador filtra `mode != chat/responses/None` (línea 97): requiere decisión de diseño, no una línea |
| Contrato v0 | Calza 1:1 (chat), pero nacería ~80% null | Rompe supuestos (output=0 real, sin texto generado): cambio **aditivo** pos-Fase 2 (campo de modo/superficie) documentado en `CONTRATO_API_v0` |
| Procedencia (regla #1) | Precios y política de datos: **null con causa** (fuente inexistente); gratuidad solo atribuible al Mediador, no servible como dato de catálogo | ✅ Precios oficiales cruzables; política de datos confirmable día 1 |
| Gobernanza | First-party indemostrable | First-party clara |
| Riesgos | Operador opaco, Aliyun SG, 1 modelo text-only, 60 rpm, sin SLA/legales; el null de **política de datos es el más serio para un ecosistema que lo va a usar**: quién entrena con el contenido enviado es desconocido (lección meta/Contributor) | Límites "ajustando dinámicamente" (declarado por ellos); aliases móviles (`jev-preview`) — riesgo de alias ya curado en meta/Contributor |

## 3. Veredicto y plan

**TypeSafe — SÍ incorporar** (ticket Bounded):
1. `typesafe` en PROVEEDORES + ampliar filtro a `mode: evaluation` con manejo aditivo (campo de modo/superficie de API; `salida=0` legítimo) + nota en `CONTRATO_API_v0` y mig si la BD lo exige.
2. `politica_datos` entry typesafe (capturas legal+privacy+models con hash; no-entrena confirmado; ZDR enterprise).
3. Curaduría de aliases `jev-latest`/`jev-preview` → `jev-1.13.0` (patrón meta/Contributor).
4. Gates + poller (docs + releases de SDK).

**Atria — Observación ahora, incorporación con disparadores.** La gratuidad explica el null de precios pero **no crea una fuente publicada**: el catálogo no puede servir "gratis" como precio confirmado, solo registrarlo con atribución al Mediador (hecho en `integracion_atria.json`). Disparadores de incorporación plena: (a) LiteLLM lo agregue — el refresco semanal lo detecta sin costo; (b) publiquen pricing/legal citables. Mientras tanto, la observación curada documenta el modelo, superficies, límites, nulls con causa y la declaración del Mediador.

**Advertencia operativa para el ecosistema (mientras no haya privacy policy):** tratar todo contenido enviado a Atria como no-confidencial y presuntamente utilizable por el operador; no enviar código propietario ni datos sensibles sin decisión explícita del Mediador.

**Higiene:** la observación vive como `integracion_atria.json` porque la ingesta tolera (skip) los prefijos whitelisteado `assurance|integracion|politica_datos_` y **falla cerrada** con cualquier otro prefijo nuevo (ingestar.ts:133) — un nombre como `candidato_*` rompería CI.

## 4. Nota de ecosistema

Jev es potencialmente útil *para los propios artefactos* (juicios estructurados de curaduría/triaje con confidence), pero eso es decisión separada: Fase 0-1 prohíbe invocar modelos para responder consultas del servicio. El uso de Atria por artefactos hermanos (claude-code/codex como frontales) es compatible con las guías del propio proveedor y no requiere cambios en escrubery más allá de esta observación.
