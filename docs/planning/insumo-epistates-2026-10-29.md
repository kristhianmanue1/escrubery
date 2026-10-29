# Insumo para epistates — operaciones de benchmarks disponibles (2026-10-29)

> Versión FINAL (el borrador del mismo día queda sustituido). Entregado al
> repo de epistates (`docs/evidencia/`) SIN commit allá, por decreto del
> Mediador 2026-10-29 — su proceso decide qué hace con él.

---

## Para epistates: escrubery ya sirve observaciones de benchmarks

Contexto: el 2026-10-13 pediste (vía Operador) que escrubery ampliara su
información sobre benchmarks de capacidades concretas para que epistates pueda
elegir mejor los modelos de su quórum. Está operativo desde el 2026-10-29
(errata 13 del contrato, `docs/investigacion/Plan_Benchmarks_v0.md`), con DOS
fuentes ingeridas y consulta end-to-end.

**Fuentes ingeridas:**

1. **Arena (ex LMArena)** — dataset público CC-BY-4.0 (HF): preferencia humana
   por votos pareados. `lm-arena-text` (conversación general, 419 modelos),
   `lm-arena-webdev` (programación web, 152), `lm-arena-agent` (tareas
   agénticas multi-turno, 51). Rating BT ~953–1810 con IC 95 % (agent usa
   score propio con signo; las escalas NO se mezclan).
2. **SWE-bench Verified** — leaderboard oficial (JSON embebido de swebench.com;
   repo del equipo MIT): **tasas de éxito reales** resolviendo issues de
   GitHub, 180 resultados run-level de pares **agente+modelo** (157
   compuestos; 60 verificados por el equipo, 120 autoreportes marcados como
   tales), con `warning` del equipo conservado y costes/config por run.

**Cómo consultar** (tres superficies, mismo contrato):

```bash
./scripts/consultar benchmarks                      # definiciones y licencias
./scripts/consultar benchmark swe-bench-verified    # metodología + incompatibilidades
./scripts/consultar resultados modelo glm-5         # el cruce de fuentes:
# lm-arena-text 1457 (rating BT) · lm-arena-webdev 1436 (rating BT)
# swe-bench-verified 72.8 % resueltas (mini-SWE-agent · GLM 5, autoreporte)
```

También `POST /v0/consultar_resultados` (HTTP con X-API-Key) y las tools MCP
`listar_benchmarks` / `consultar_benchmark` / `consultar_resultados`.

**Qué obtienes por observación:** valor con unidad e incertidumbre (cuando la
fuente la publica), fecha de publicación, condiciones (arena/config/esfuerzo/
agente/harness/costes), `publicado_por` (plataforma verificada vs tercero
autoreporte), procedencia completa (URL + hash de la captura cruda custodiada
en git + fecha de obtención + `estado_verificacion`) y **`grupo_comparabilidad`**:
mismo grupo = misma fuente+definición+versión metodológica+métrica →
directamente comparables entre sí; grupos distintos = comparabilidad limitada
o desconocida (las incompatibilidades documentadas viajan con cada definición).

**Vinculación con tu caso de uso (quórum):** `resultados modelo <x>` casa por
identidad canónica resuelta (los display names pasan por la misma curaduría
fail-closed del `resolver_identidad_modelo` que ya consumes); la respuesta
conserva la designación original verbatim y `vinculacion_canonica` (resuelta o
`sin_datos` — nunca vinculada en silencio; los modelos históricos de SWE-bench
que no están en el catálogo first-party quedan sin resolver por diseño). El
`familia_arquitectura` que usas para decorrelación sigue disponible vía
`resolver`. Ojo semántico: un resultado de SWE-bench mide al PAR agente+modelo
bajo su harness — no lo trates como propiedad intrínseca del modelo.

**Límites honestos:** observaciones publicadas por terceros (`pendiente_de_
verificar`: procedencia sí, veracidad de la medición no); preferencia humana
≠ tasa de éxito; valor ausente = `null`, jamás 0; caducidad por fuente con
degradación visible si dejamos de refrescarla; capturas diarias custodiadas =
nuestra historia es independiente de que la fuente reescriba la suya.

**Lo que escrubery NO hace:** no ejecuta evaluaciones, no crea rankings
propios, no promedia métricas heterogéneas, no decide qué modelo usar — la
respuesta es evidencia estructurada; la decisión del quórum sigue siendo tuya.

**Si algo falta o se ve mal:** `reportar_feedback` (contrato de uso §3.6) —
los huecos de fuentes y aliases son exactamente lo que la curaduría consume.
