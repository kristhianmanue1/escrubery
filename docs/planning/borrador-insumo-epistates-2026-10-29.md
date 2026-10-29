# Borrador: insumo para epistates — operaciones de benchmarks disponibles (2026-10-29)

> **Estado: BORRADOR — SIN ENVIAR.** El envío a epistates es acto del Mediador
> (patrón de las notificaciones a skopos 08-22/08-27/10-14). Este archivo solo
> prepara el texto. Si se decreta el envío, se coloca en el repo de epistates
> (o el canal que el Mediador indique) SIN commit allá.

---

## Para epistates: escrubery ya sirve observaciones de benchmarks

Contexto: el 2026-10-13 pediste (vía Operador) que escrubery ampliara su
información sobre benchmarks de capacidades concretas para que epistates pueda
elegir mejor los modelos de su quórum. Está operativo desde el 2026-10-29
(errata 13 del contrato, `docs/investigacion/Plan_Benchmarks_v0.md`).

**Fuente ingerida v0:** Arena (ex LMArena), dataset público CC-BY-4.0 en
HuggingFace (`lmarena-ai/leaderboard-dataset`), tres arenas alineadas con tu
necesidad: `lm-arena-text` (conversación general, 419 modelos), `lm-arena-webdev`
(programación web, 152) y `lm-arena-agent` (tareas agénticas multi-turno, 51).
Próxima fuente candidata: SWE-bench Verified (canal verificado por spike
2026-10-29).

**Cómo consultar** (tres superficies, mismo contrato):

```bash
./scripts/consultar benchmarks                      # definiciones y licencias
./scripts/consultar benchmark lm-arena-webdev       # metodología + incompatibilidades
./scripts/consultar resultados modelo glm-5.3       # observaciones del modelo
```

También `POST /v0/consultar_resultados` (HTTP con X-API-Key) y las tools MCP
`listar_benchmarks` / `consultar_benchmark` / `consultar_resultados`.

**Qué obtienes por observación:** valor con incertidumbre (IC 95 %), votos,
fecha de publicación, condiciones (arena/config), `publicado_por`, procedencia
completa (URL + hash de la captura cruda custodiada, fecha de obtención,
`estado_verificacion`) y **`grupo_comparabilidad`**: observaciones con el mismo
grupo comparten fuente+definición+versión metodológica+métrica y son
directamente comparables entre sí; grupos distintos = comparabilidad limitada
o desconocida. La métrica y su unidad viajan por definición (p. ej.
`rating_bt` ~953–1810 para text/webdev; `score_agente` con signo −0.21…+0.21
para agent — escalas que NO se mezclan).

**Vinculación con tu caso de uso (quórum):** `resultados modelo <x>` casa por
identidad canónica resuelta (los nombres del leaderboard pasan por la misma
curaduría fail-closed del `resolver_identidad_modelo` que ya consumes); la
respuesta incluye la designación original verbatim y `vinculacion_canonica`
(resuelta o `sin_datos` — nunca vinculada en silencio). El `familia_arquitectura`
que usas para decorrelación sigue disponible vía `resolver`.

**Límites honestos:** son observaciones publicadas por la plataforma
(preferencia humana por votos, NO tasas de éxito en tareas); toda observación
nace `pendiente_de_verificar` (procedencia sí, veracidad de la medición no);
una observación es condicional (arena/config/esfuerzo), no una propiedad
intrínseca del modelo; si la fuente no publicó valor, verás `null`, jamás 0;
caducidad por fuente con degradación visible si dejamos de refrescarla.

**Lo que escrubery NO hace:** no ejecuta evaluaciones, no crea rankings
propios, no promedia métricas heterogéneas, no decide qué modelo usar — la
respuesta es evidencia estructurada; la decisión del quórum sigue siendo tuya.

**Si algo falta o se ve mal:** `reportar_feedback` (contrato de uso §3.6) —
los huecos de fuentes y aliases son exactamente lo que la curaduría consume.
