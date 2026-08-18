# Plan: Hardening LOWs F5 + T4b identidad de modelos

**Contexto:** post-release v0.3.0 (plan v2 completo). Dos candidatos pendientes a decisión del Mediador, ambos aprobados el 2026-08-18: saneamiento de la deuda LOW de F5 y la implementación diferida T4b (errata 1 del contrato). **Fecha:** 2026-08-18. **Estado:** borrador (espera visto bueno del Mediador).
**Fase del plan v2:** post-F5 (trabajo aditivo; sin fase nueva). **Fuente:** iniciativa del Mediador (candidatos del cierre F5).

## Decisiones del Mediador (2026-08-18)

1. **Alcance T4b:** `resolver_identidad_modelo` + exponer campos pendientes de la errata 2 (`cache_lectura_por_millon`, `pesos_abiertos`). `politica_datos_proveedor` se difiere a otro ticket.
2. **Orden:** Hardening F5 primero, luego T4b.
3. **Casos de prueba:** sin issuer_ids reales de consumidores; curaduría sintética con `fuente_tipo: curaduria_propia` (los casos reales llegan vía `reportar_feedback`).

## Objetivo y criterio de cierre

- **Objetivo:** (a) cerrar los 4 LOWs de F5 registrados en el gate adversarial; (b) implementar `resolver_identidad_modelo` (contrato §5, ADR-0002) y servir `cache_lectura_por_millon`/`pesos_abiertos`, como cambio **aditivo** del contrato v0.
- **Cierre global:** CI local verde + specs verdes + adversarial `proceed` en cada hito + contrato/bitácora actualizados.

## Hitos (cada uno dispara ronda adversarial, §6)

- **H4 — Hardening F5:** 4 LOWs corregidos, CI local verde, sin cambio de contrato público. [pendiente]
- **H5 — T4b identidad:** `resolver` operativo en las 3 superficies + campos nuevos servidos + contrato actualizado aditivamente. [pendiente]

---

## Tareas de H4 — Hardening LOWs F5

### Contrato HF5-T1 — timing-safe compare de API keys

**Presupuesto:** cabe holgado. **Entradas:** `backend/src/http/auth.guard.ts` (o módulo equivalente del guard), specs F5 existentes.
**Salidas:** guard corregido + specs.

- [ ] La comparación de claves usa `crypto.timingSafeEqual` sobre los **hashes SHA-256** (nunca sobre el largo variable del input; SHA-256 normaliza longitud y evita el throw de `timingSafeEqual`).
- [ ] Spec: clave inválida de longitud distinta a una válida → 401 (sin excepción/500).
- [ ] `npm test` verde; `cd backend && npm run build` verde.

### Contrato HF5-T2 — single-source de descripciones de tools

**Presupuesto:** cabe holgado. **Entradas:** `backend/src/mcp/server.ts`, generador de Agent Card, `docs/CONSUMO_INTERNO.md` (las descripciones viven triplicadas).
**Salidas:** módulo único de descripciones + spec anti-drift.

- [ ] Un único módulo exporta `{tool, descripcion, params}` y lo consumen el servidor MCP y el generador del Agent Card.
- [ ] Spec: tools del Agent Card generado ⊆ fuente única (nombres y descripciones idénticas).
- [ ] `npm test` verde.

### Contrato HF5-T3 — bucket por IP en 401

**Presupuesto:** cabe holgado. **Entradas:** guard F5, `docs/CONSUMO_INTERNO.md`.
**Salidas:** bucket in-memory por IP para intentos no autorizados + specs + docs.

- [ ] Intentos sin clave válida desde una misma IP se limitan con token bucket (límite configurable por env, default documentado); exceso → `429` `limite_de_tasa` + `Retry-After`.
- [ ] Spec supertest: N+1 intentos sin clave → el último es 429; con clave válida no consume del bucket de IP.
- [ ] Limitación in-memory (single-instance) documentada en `CONSUMO_INTERNO.md`.

### Contrato HF5-T4 — open handle de Jest

**Presupuesto:** cabe holgado. **Entradas:** salida de `--detectOpenHandles`, specs de BD/HTTP.
**Salidas:** cierre limpio de pools/servidores en `afterAll`.

- [ ] `cd backend && npx jest --detectOpenHandles` termina sin reportar handles abiertos (sin `--forceExit` en el script de test).
- [ ] `npm test` verde.

**Gate H4:** `bash scripts/ci_local.sh` verde + ronda adversarial (revisor independiente) → `proceed`.

---

## Tareas de H5 — T4b identidad + campos pendientes

### Contrato T4b-T0 — esquema + ingesta de campos pendientes (0.5 ciclos)

**Presupuesto:** cabe holgado. **Entradas:** mig 001/008, `scripts/generar_fichas_modelos.py`, ingesta de fichas.
**Salidas:** migración 013, ingesta ampliada, archivo de curaduría.

- [ ] Mig 013: `modelos` + `precio_cache_lectura_por_millon NUMERIC(12,6)`, `pesos_abiertos BOOLEAN`, `familia_arquitectura TEXT` (todo nullable — regla: `null` si la fuente no declara).
- [ ] La ingesta carga `cache_lectura_por_millon` desde la ficha generada (el dato YA existe, p. ej. qwen3.8-max = 0.25).
- [ ] Curaduría nueva `datos/fichas/curaduria/identidad_modelos.json` (capa separada de los generados, §7): `familia_arquitectura`/`pesos_abiertos` por modelo/familia **solo donde la fuente pública lo declara**, con bloque `procedencia` completo (`fuente_tipo: curaduria_propia`, `fuente_url` a docs oficiales, fecha, hash del contenido curado).
- [ ] `npm run db:migrate` aplica; `SELECT` de verificación: ≥1 fila con precio de caché y la curaduría cargada; `npm test` verde; `check_sizes.py` verde.

### Contrato T4b-T1 — módulo resolver (1 ciclo)

**Presupuesto:** cabe holgado. **Entradas:** shape original §3.4 (git `d43c134^:docs/CONTRATO_API_v0.md`), curaduría T0.
**Salidas:** mig 014 (tabla `identidad_alias` con procedencia por fila), módulo de resolución, specs.

- [ ] Resolución por `issuer_id` (alias curados: sufijos de harness, aliases documentados) y por `{modelo_id, endpoint}` (mapa de endpoints públicos curado).
- [ ] Respuesta = shape §3.4 original: `resuelto`, `identidad_canonica {proveedor, modelo_id, familia_arquitectura, pesos_abiertos}`, `advertencias[]`, `procedencia`. Campos no declarados → `null`.
- [ ] **Nunca adivina:** identificador no resoluble → `resuelto: false` (sin inferencia silenciosa).
- [ ] Specs: alias conocido resuelve; desconocido → `resuelto:false`; sufijo de harness (caso semilla sintético); endpoint conocido/desconocido; params inválidos → error de validación.

### Contrato T4b-T2 — superficies CLI/HTTP/MCP + Agent Card (1 ciclo)

**Presupuesto:** cabe holgado. **Entradas:** módulo de consultas F1, guard F5, Agent Card T0-F5.
**Salidas:** operación en las 3 superficies + card regenerada y firmada + goldens.

- [ ] CLI: `./scripts/consultar resolver <issuer_id>` → JSON `resuelto:true` exit 0; no resoluble → exit 1 (`sin_datos`, primera clase); params inválidos → exit 2.
- [ ] HTTP: `POST /v0/resolver_identidad_modelo` tras el guard (401 sin clave); errores §4 coherentes (404 sin_datos / 400 params).
- [ ] MCP: tool nueva; Agent Card regenerado + firmado + `verificarAgentCard` OK.
- [ ] Goldens de respuesta (patrón T1b): alias conocido, no resoluble, por endpoint.
- [ ] `consultar modelo qwen qwen3.8-max` ahora incluye `precios.cache_lectura_por_millon` y `pesos_abiertos` (shape §3.1 aditivo).

### Contrato T4b-T3 — contrato + docs + bitácora (0.5 ciclos)

**Presupuesto:** cabe holgado. **Entradas:** contrato vigente, CONSUMO_INTERNO, bitácora.
**Salidas:** contrato actualizado (aditivo), docs, bitácora.

- [ ] Contrato: operación nueva como **§3.9** (no reutiliza los números retirados §3.4/§3.5 — disciplina de congelamiento); errata 2 actualizada (`cache_lectura_por_millon`/`pesos_abiertos` ya disponibles; `tarifa_vigente_desde` sigue no disponible — la fuente no la declara); §5 actualiza el estado de T4b.
- [ ] `docs/CONSUMO_INTERNO.md`: tool nueva + ejemplos.
- [ ] `bitacora_ciclos.md`: filas H4 y H5 con ciclos est./reales/desv.
- [ ] `python3 scripts/check_sizes.py` verde.

**Gate H5:** CI local verde + ronda adversarial con verificaciones §6 (procedencia de la curaduría nueva, oficial/comunitario intacto, aditividad del contrato) → `proceed`.

---

## Riesgos / supuestos

- **`tarifa_vigente_desde` sigue sin fuente** → permanece no disponible y se documenta (honestidad, no relleno).
- **Curaduría sintética:** los seeds de aliases/endpoints son de fuentes públicas declaradas; los casos reales de consumidores llegan vía `reportar_feedback` y amplían la tabla.
- **Resolución acotada:** el resolver solo resuelve contra catálogo BD + alias curados; nada de fuzzy-matching adivinatorio.
- **Buckets in-memory** (single-instance) — documentado, igual que el rate-limit F5.
- **Contrato congelado:** todo cambio es aditivo; si algo exigiera ruptura, se escala al Mediador (versión v1).

## Enlaces

- Política: `docs/politica-agentes.md` · Plantillas: `docs/plantillas-agente.md`
- Contrato: `docs/CONTRATO_API_v0.md` · Shape §3.4 original: `git show d43c134^:docs/CONTRATO_API_v0.md`
- LOWs F5 origen: `bitacora_ciclos.md` (gate F5, 2026-08-17) · ADR-0002: deuda de expertoGobernanza (citado en `docs/investigacion/Analisis_Critico_Plan_y_Propuesta_de_Cambios.md`)
