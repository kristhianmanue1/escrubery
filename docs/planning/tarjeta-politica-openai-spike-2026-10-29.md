# Tarjeta: spike — politica_datos `openai` por rutas alternas (platform/developers)

**Fecha:** 2026-10-29 · **Clase:** Spike (pregunta con respuesta acotada, sin código de producción)
**Estado:** ejecutado y verificado (resultado negativo, documentado).
**Origen:** análisis de candidatos 2026-10-29 — `openai` es uno de los dos huecos genuinos de `politica_datos_proveedores` (los otros `null` raíz — google/zhipu — son por diseño, no huecos). Hipótesis: si `platform.openai.com/docs/models` es capturable (probado 10-27, hash `793a8d7f…`), quizá las rutas legales del mismo dominio también.

## Pregunta

¿Existe una ruta capturable (HTTP 200 con texto legal legible) para los términos/políticas de OpenAI desde este entorno, por `platform.openai.com` u otro dominio derivado?

## Ejecución (2026-10-29)

| Ruta | Resultado |
|---|---|
| `platform.openai.com/legal/terms` | 403 |
| `platform.openai.com/legal/data-privacy` | 403 |
| `platform.openai.com/policies/terms-of-service` | 403 |
| `platform.openai.com/legal/row-terms-of-use` | 403 |
| `platform.openai.com/legal` | 403 |
| `platform.openai.com/docs/api-terms` | 301 → `developers.openai.com/api/docs/api-terms` |
| `developers.openai.com/api/docs/api-terms` | 404 (SPA shell 478 KB; los matches de «training» provienen del bundle JS, no de texto legal) |
| `developers.openai.com/{api-terms, terms, row-terms}` | 404 |

## Respuesta

**No.** `platform.openai.com/legal/*` está tras el mismo Cloudflare que `openai.com/policies/*` (patrón xai); el dominio nuevo `developers.openai.com` es una SPA sin rutas legales servidas. La única ruta abierta conocida del dominio sigue siendo `platform.openai.com/docs/models` (catálogo, no texto legal).

## Cambio

- `datos/fichas/curaduria/politica_datos_proveedores.json`: entrada `openai` — `fecha_obtencion` → 2026-10-29, `notas` extendida con las dos verificaciones (10-27 y 10-29) y las rutas probadas. `entrena_con_contenido` permanece `null` (regla dura #4: no se infiere). JSON válido, `check_sizes` OK.

## Límites declarados

- No se probaron rutas de pago ni autenticadas (Fases 0–1: solo fuentes públicas gratuitas).
- `xai` queda como único otro hueco genuino, sin ruta conocida; su `null` con causa es la respuesta correcta.
- Reintento futuro solo con disparador: OpenAI publique legal en ruta nueva/capturable, o cambio de CDN.
- **Lote:** ESC-LOTE-20261029-04 — PROPUESTO en sesión; **ACEPTADO** por decreto del Mediador «adelante con recomendacion» (2026-10-29T19:12:09Z) contra el folio; commit + push ordinario (mismo lote que `tarjeta-casos-reales-resolver-2026-10-29.md`).
