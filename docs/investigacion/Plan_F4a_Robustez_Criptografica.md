# Plan: F4a — Robustez criptográfica (CAGF completo, subset §7 del plan v2)

**Contexto:** F3 cerrada; la cadena Evidentia detecta manipulación pero un atacante con acceso a la BD podría re-hacerla completa sin rastro (Referencia_Traza_Firma §5). Este plan añade **agregación Merkle + checkpoint firmado + sello RFC 3161** sobre la base de F2, sin rehacer la firma. **Fecha:** 2026-08-17. **Estado:** r2 (correcciones adversarial r1 aplicadas). **Fase del plan v2:** F4 (§7). **Fuente:** recomendación del Ejecutor aprobada por el Mediador.

## Alcance y no-alcance

- **Dentro:** Merkle RFC 6962 sobre eventos, checkpoint del tip firmado y archivado off-BD, sellado RFC 3161 con TSA público gratuito (verificación con `openssl ts`), prueba de inclusión verificable por tercero, specs de eslabones (incl. poller→version_actual, residual F3), integración en vigilancia y `evidentia:verificar`.
- **Fuera (F4b, requiere presupuesto/decisiones del Mediador):** batería Harbor/Terminal-Bench (llama modelos = costo real), capa de seguridad activa (canary tokens, whitelist de red, agent-bom), anclaje NOM-151, log público tipo Certificate Transparency, **custodia tiered KMS de la clave y CRL/revocación pública** (asignadas a F4 en Referencia §5 — diferidas explícitamente a F4b con visto del Mediador).

## Objetivo y criterio de cierre

- **Objetivo:** que borrar/re-hacer la cadena sea **criptográficamente detectable por un tercero sin acceso a la BD**, con custodia externa del ancla (git remoto + TSA).
- **Cierre (verificables):** (1) prueba de inclusión de un evento valida offline con solo el checkpoint archivado; (2) checkpoint alterado falla; (3) sello RFC 3161 verifica **offline** con `openssl ts -verify` (firma CMS + cadena contra CAfile del sistema + EKU timestamping + imprint); (4) `evidentia:verificar` reporta sellado por checkpoint; **(5) demo de omisión: BD con eventos borrados y cadena re-hecha → `evidentia:verificar` FALLA por discrepancia contra el checkpoint archivado (count y/o raíz)** — este es el punto del plan.

## Decisiones técnicas fijadas (r1)

- **Merkle = RFC 6962 real** (no duplicar-última): hoja `SHA256(0x00 ‖ bytes(hash_evento))`, nodo interior `SHA256(0x01 ‖ L ‖ R)`, split en la mayor potencia de 2 < n (habilita pruebas de consistencia m→n gratis para F4b). Bytes exactos: hashes hex decodificados a 32 bytes; concatenación binaria.
- **`eventos_hasta` = `max(id)` cubierto** (no cardinal): el checkpoint ancla el prefijo `id ≤ eventos_hasta`; inserts posteriores NO lo invalidan (spec lo demuestra).
- **Archivo de checkpoint** (`datos/checkpoints/<ts>.json`, commiteable): `{payload, sig, key_id, alg}` donde `payload` = JCS exacto firmado de `{tip_hash, merkle_root, eventos_hasta, creado_en}` (ISO string). `firmado_json` en BD = TEXT verbatim idéntico al archivo (spec byte-a-byte). La verificación SIEMPRE usa los bytes almacenados; nunca re-serializa desde TIMESTAMPTZ.
- **Imprint del sello = SHA-256 de los bytes exactos de `firmado_json`** (ancla también `creado_en`/firma/contador, no solo el root). Nonce RFC 3161: descartado explícitamente — la custodia git del TSR es el mecanismo anti-reuso.
- **TSA:** default `https://freetsa.org/tsr`; alternos reales: DigiCert (`http://timestamp.digicert.com`), Sectigo, GlobalSign (Google NO opera TSA público). Override `ESCRUBERY_TSA_URL`. Verificación con **`openssl ts -verify`** (CLI; `node:crypto` no parsea PKCS#7; sin deps npm nuevas).
- **Modelo de confianza del sello (honesto):** la verificación offline prueba coherencia criptográfica + encadenamiento del cert de la TSA a raíces públicas del sistema + EKU timestamping. La honestidad de la TSA es un **supuesto**, no un teorema; mitigado por (a) TSA de reputación y (b) custodia git del TSR + push a remoto.
- **`eventos_changelog.checkpoint_id` (mig 006, siempre null):** queda **deprecado** (comentario en mig 012 + contrato) — el modelo de prefijos lo reemplaza sin mutar eventos.
- **Sellado pendiente:** la vigilancia reintenta a diario TODOS los pendientes (oldest-first, un POST c/u). "Evento anclado" = existe checkpoint sellado con `eventos_hasta ≥ id` (cobertura transitiva del último sellado); `pendientes` es informativo, no error.

## Hitos

- **H1 — Agregación e inclusión:** T0–T2. [pendiente]
- **H2 — Sello externo + custodia:** T3–T4. [pendiente]
- **H3 — Eslabones blindados:** T5–T6. [pendiente]

## Tareas y contratos

### T0 — Mig `012_checkpoints.sql`

- [ ] `checkpoints(id, tip_evento_id, eventos_hasta INT UNIQUE, merkle_root, firmado_json TEXT, key_id, sig, timestamp_rfc3161 BYTEA, tsa_url, external_anchor JSONB, creado_en)`. `UNIQUE(eventos_hasta)` = enforcement duro del skip idempotente. Comentario: `checkpoint_id` de eventos queda deprecado. Sin tocar `eventos_changelog`.

### T1 — Construcción de checkpoint (`evidentia:checkpoint`)

- [ ] Merkle RFC 6962 sobre `hash_evento` (bytes) del prefijo completo; checkpoint `{payload JCS, sig, key_id, alg}` insertado + archivado; idempotente (misma raíz → skip, garantizado por UNIQUE).
- [ ] Specs: vectores 1/2/3/7 hojas con raíces de implementación de referencia independiente (Python `hashlib` en el spec como oráculo); **prefijo estable**: tras insertar evento N+1, el root del checkpoint anterior re-computa idéntico y sus pruebas siguen verificando.

### T2 — Prueba de inclusión (`evidentia:prueba-inclusion`)

- [ ] `{record_id, hash_evento, leaf_index, merkle_path[], merkle_root, eventos_hasta}` (path en convención RFC 6962: sibling + dirección L/R por nivel, derivable de `leaf_index`) verificable offline por tercero (spec: recompute independiente); path alterado → raíz distinta; evento fuera de rango → error explícito.

### T3 — Sello RFC 3161 (`evidentia:sellar`)

- [ ] Query/reply/verify vía `openssl ts` (CLI): `openssl ts -query -data <firmado_json> -sha256` (imprint = SHA-256 único sobre los bytes), POST, TSR → BD + archivo `datos/checkpoints/<ts>.tsr`; `external_anchor = {tipo, tsa, hash_anclado}`.
- [ ] Verificación offline: `openssl ts -verify -in <tsr> -queryfile <q> -CAfile <sistema>` falla con TSR corrupto/forjado (spec con fixture real archivado).
- [ ] Red caída → `pendiente_sello`; reintento diario (todos los pendientes, oldest-first); NADA local bloquea.

### T4 — Integración + detección de omisión

- [ ] Vigilancia: checkpoint+sello al FINAL (tras pollers/introspección/alertas); corre también con RC=10 y con `FALLOS>0` (ancla lo que haya); solo se omite en precheck/infra. Fallo de sello → nota + `FALLOS+1`.
- [ ] **`evidentia:verificar` endurecido:** por checkpoint: (a) firma Ed25519 de `firmado_json` contra keyring; (b) archivo↔BD byte-idéntico; (c) recompute del root sobre el prefijo vivo `id ≤ eventos_hasta` vs root guardado; (d) **re-verificar cada TSR** con `openssl ts -verify` contra el queryfile regenerado de `firmado_json` (TSR corrupto/forjado → fallo, no "sellado"). Reporta `{checkpoints, sellados, pendientes, ultimo_checkpoint, cola_sin_anclar_desde}`; archivo huérfano en `datos/checkpoints/` (sin fila) → fallo.
- [ ] **Spec de omisión (criterio de cierre 5):** BD de test con eventos borrados y cadena re-hecha → verificar FALLA contra el checkpoint archivado.
- [ ] Contrato §2.3 aditivo: checkpoints/sello/verificación documentados.
- [ ] **Custodia (bloqueante, insumo #1):** flujo git de `datos/checkpoints/` — propuesta: autorización permanente para que la vigilancia haga `git add datos/checkpoints/ && git commit -m "checkpoint: <ts>" && git push` (solo esa ruta); alternativa: handoff diario al Mediador. El anclaje externo TSA **+ git remoto** es lo que hace la omisión detectable por un tercero.

### T5 — Specs de eslabones (residual F3)

- [ ] Spec: poller escribe `version_actual` con mock de releases (sin red); regex tag→versión contra los 9 tags patológicos del adversarial F3-r4.

### T6 — Reporte de cobertura §7

- [ ] `evidentia:verificar --json` lista eventos `confirmado_por_prueba_propia` y su anclaje; nota en bitácora (históricos previos al primer checkpoint: cubiertos por el checkpoint más antiguo que los ancle).

## Orden y estimación

T0 → T1 → T2 (H1) → T3 → T4 (H2) → T5 ∥ T6 (H3): **4 ciclos** (realista con `openssl ts`).

## Riesgos / supuestos

- **TSA gratuito caído/rate-limit** → alternos + reintento diario; el sello mejora, la cadena local nunca bloquea (fail-open SOLO en el sello, explícito).
- **Honestidad de la TSA = supuesto** (declarado arriba); mitigación: reputación + custodia git+push.
- **Deuda preexistente anotada:** `registrarEvento` sin `BEGIN IMMEDIATE` (pollers concurrentes podrían bifurcar la cadena) — fuera de alcance F4a; el checkpoint ancla el estado real y `verificar` delataría la bifurcación. Ticket futuro si se da.
- **Claves:** sin rotación ni nuevas claves.
- **Sobre-alcance (plan v2 §12 riesgo 1):** nada de F4b (presupuesto de modelos no aprobado).

## Insumos requeridos del Mediador

1. **Custodia git de checkpoints (bloqueante para T4):** autorizar el auto-commit/push diario de SOLO `datos/checkpoints/` por la vigilancia (o elegir handoff manual).
2. Ninguno otro bloqueante (TSA gratuito, clave existente, openssl del sistema).
