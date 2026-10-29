# Tarjeta: spike-canal-swebench-2026-10-29

**Clase:** Spike (ADR-0001: pregunta escrita + criterio de respuesta; salida = respuesta con evidencia; sin código de producción).
**Decreto:** «Adelante con recomendaciones: … (2) spike del canal de SWE-bench y trae la respuesta escrita» (2026-10-29).

## Pregunta

¿Existe un canal machine-readable **estable, público y sin registro** para los resultados de SWE-bench (la pieza T1 faltante del eje programación, con Terminal-Bench bloqueado por credenciales rotas)?

**Criterio de respuesta:** canal encontrado = URL fija + extracción probada localmente + metadatos suficientes para el modelo de observación (métrica, fecha, sujeto compuesto, condiciones, verificación). Negativo = sondeos documentados con códigos.

## Sondas ejecutadas (2026-10-29)

| Sonda | Resultado |
|---|---|
| `GET https://huggingface.co/api/datasets/princeton-nlp/SWE-bench_Verified` | 200 — card SIN `leaderboards`; el dataset son las 500 instancias, no resultados |
| `GET https://huggingface.co/api/datasets/SWE-bench/SWE-bench` | 200 — ídem (2.294 instancias); el canal `.eval_results` de model cards sigue descentrado (por modelo, no agregado) |
| `GET https://www.swebench.com/` (HTML crudo) | 200 — **NO es SPA**: el HTML lleva el leaderboard completo embebido como `<script type="application/json" id="leaderboard-data">` |
| Extracción probada localmente (curl + regex + json.loads) | ✅ parseable en una pasada: **323 resultados run-level** en 5 leaderboards (Verified 180 · Lite 84 · Test/Full 24 · Multimodal 22 · Multilingual 13) |

## Claves por resultado (relevantes para el modelo de escrubery)

`agent` + `agent_org` (harness), `model_display` + `model_org` (modelo), `resolved` (métrica), `date`, `cost`/`instance_cost`/`instance_calls`, `reasoning_effort` (condición de config), `checked` (**verificado por el equipo SWE-bench** vs autoreporte), `warning` (caveats declarados), `os_model`, `folder`/`logs` (trazas S3 públicas), `mini-swe-agent_version` (versión de herramienta), `per_instance_details` (resolución por instancia).

## Respuesta

**SÍ hay canal viable**: `https://www.swebench.com/` es un sitio estático cuyo HTML embebido ES el leaderboard (el botón "Download JSON" de la UI consume ese mismo bloque). Extracción trivial y probada. Sin auth, sin gate, gratuito. Mapeo natural al dominio: subject = sistema_compuesto (`agent` + `model_display` verbatim), `checked:true` → `publicado_por: plataforma` (verificado por el equipo), `checked:false` → `tercero` (autoreporte — distinción que Arena no exigía y aquí sí existe), condiciones = `{reasoning_effort, coste, versiones de harness, os_model}`, fecha_publicacion = `date`.

## Riesgos declarados

1. **El HTML no está versionado**: la fuente puede reescribir historia sin aviso → mitigación estructural: la captura cruda diaria hasheada (mismo molde Arena) ES nuestra historia; append-only ya lo soporta.
2. Licencia del sitio: el repo GitHub del equipo es MIT y el sitio es del mismo equipo con trazas S3 públicas; revisión ToS breve antes del adaptador (regla §7 política: licencias antes de añadir fuente).
3. `model_display` son nombres de marketing ("Claude 4.5 Opus") → pasan por curaduría de aliases (fail-closed sin alias, igual que Arena).

## Recomendación

Próximo ticket Bounded **`adaptador-swebench`** (F1 del Plan_Benchmarks_v0): reutilizar el molde del adaptador Arena (captura cruda hasheada del HTML completo → extracción del bloque JSON → normalización → ingesta append-only), priorizando el leaderboard **Verified** (180 resultados, el canónico). Disparador de ejecución: decreto del Mediador.
