# Referencia — Traza criptográfica (F2): modelo CAGF, debilidades y modelo objetivo escrubery

**Propósito:** referencia on-demand para implementar la traza criptográfica de F2. Documenta el modelo `EventLog` de CAGF (base de inspiración), sus debilidades **verificadas en el código**, y el **modelo de confianza multi-capa objetivo** de escrubery (multi-firma, cadena de confianza, custodia tiered, anclaje externo) con el **roadmap de cómo el desarrollo lo contempla por fases**.
**Fase:** insumo para F2. **Origen:** investigación de `constitutional-ai-governance` (2026-08-07) + decisión D2 ampliada. **Nombre de feature (decretado 2026-08-07):** *Evidentia* — prevista para uso por contrato de pago en el futuro (condiciona D4: inclina hacia "producto con niveles").

---

## 1. Por qué una traza criptográfica

Sin firma+cadena+anclaje, escrubery (o quien comprometa su BD) podría **alterar silenciosamente un evento viejo** y los consumidores (CAGF, expertoGobernanza) habrían decidido sobre datos mutados retroactivamente. La traza hace esa manipulación **detectable**; el anclaje externo la hace **criptográficamente robusta**. Escrubery atestigua **procedencia + integridad** (de dónde viene y que no se alteró), **no** verdad ontológica (si la fuente miente, escrubery propaga con la fuente citada).

---

## 2. Modelo CAGF (base de referencia)

Fuente: `constitutional-ai-governance/scripts/trace/`. Citas `archivo:línea` en el repo CAGF.

### 2.1 EventRecord — campos (`event_log.py:65-84`)
`agent_id, agent_role, action_type, axiom_refs, causal_parents, record_id (uuid), session_id, timestamp (seg, UTC), schema_version="1.0", canonicalization_alg="sha256/json-sorted-keys", artifact_refs, commit_sha, key_id, amendment_id, event_subtype, prev_hash, signature`. Validación en `__post_init__` (`:86-90`).

### 2.2 Encadenamiento `prev_hash` (`event_log.py:122-123, 159-177`)
- Hash **SHA-256** hex lowercase sobre `json.dumps(canonical_dict(include_signature=True), sort_keys=True, ensure_ascii=False)`.
- `prev_hash` del primer registro = `"0"*64` (log vacío).
- `append()` asigna `prev_hash = last_digest()` o rechaza con `ValueError("prev_hash mismatch")`.
- SQLite: tabla `events(seq PK AUTOINCREMENT, record_id UNIQUE, record_json, digest)`.

### 2.3 Firma Ed25519 (`event_log.py:101-120`)
- **Bytes firmados:** `json.dumps(canonical_dict(include_signature=False), sort_keys=True, ensure_ascii=False).encode()` — el registro canónico **sin** `signature` (incluye `prev_hash`, `key_id`).
- **Formato salida:** `"ed25519:" + base64(sig_bytes)` (base64 standard, 64 bytes → 88 chars).
- **Lib:** `cryptography` Ed25519. HMAC-SHA256 legacy (deprecated, sin no-repudiación).

### 2.4 Canonicalización (NO es JCS)
`json.dumps(d, sort_keys=True, ensure_ascii=False)` — casero. **No** normaliza Unicode (NFC/NFD), **no** define número/separadores más allá del default Python. Un verificador en Rust/Go/JS con JCS verdadero **no** interoperaría sin replicar el algoritmo Python exacto.

### 2.5 Keyring `cagf-keyring/0.1` (`keymgmt.py:25-75`)
- `KEYRING_PATH = .cagf/trace/keyring.json` (commiteable, público). `PRIVATE_DIR = .cagf/trace/.keys/` (gitignored).
- Schema: `{"schema":"cagf-keyring/0.1","keys":{<kid>:{"type":"ed25519-public","key_b64":<DER SubjectPublicKeyInfo base64>,"role":"operator","note":"..."}}}`.
- **Privada:** PEM PKCS8 **sin cifrar**, `chmod 0600`, `password=None` al cargar. **No** keyring OS, passphrase, HSM ni air-gap.
- **Sin rotación/revocación:** sin campos `validity_window`, `status`, `successor_kid`. Rotar rompe todas las firmas previas.

### 2.6 Checkpoint externo (`trace_verify.py:267-331`)
- Ancla el **tip** (`last_digest` + `record_count`) fuera del `.db`. Payload `{"tip_digest","record_count","cycle_id","commit_sha"}` firmado Ed25519.
- Archivo `.cagf/trace/checkpoint.json` (commiteado en el **mismo** git que el `.db`). **No es RFC 3161 ni servicio externo.** Re-publicación **manual** del orquestador; `emit_event` no lo re-firma.
- Verifica: `CHECKPOINT_MISSING/PARSE_ERROR/SIG_INVALID/TIP_MISMATCH/COUNT_MISMATCH`.

### 2.7 Génesis (`genesis.py`)
`TRACE_GENESIS_RECORD`: `action_type=LEGACY_EVIDENCE_ANCHORED`, ancla SHA-256 acumulativo de los `.md` de `.cagf/governance/`+`docs/`. **No firmado.** Aborta si el log no está vacío. `amendment_id="INTERIM-EXCEPTION-TRACE-v0.1"`. Límite: no prueba que los `.md` fueran el estado real en `commit_sha`.

### 2.8 action_types (`event_log.py:22-62`)
31 totales; **23 firmables** (`SIGNED_ACTION_TYPES`): `CYCLE_OPENED/CLOSED, ROLE_ASSIGNED, CONFLICT_DECLARED, ABSTENTION_RECORDED, SEAT_SUBSTITUTED, ARTIFACT_SUPERSEDED, CORRECTION_APPLIED, VERDICT_DEPOSITED, PROPOSAL_SUBMITTED/REVISED, OBJECTION_RESOLVED, AUTHORIZATION_GRANTED/DENIED, SCOPE_CHANGED, GATE_CHANGED, KEY_REGISTERED, SIGNATURE_DELEGATED, BOARD_UPDATED, RATIFICATION_RECORDED, SCHEMA_MIGRATED, INTEGRITY_INCIDENT_RECORDED`. **No firmables:** `ARTIFACT_READ, HASH_REGISTERED, SIGNATURE_VERIFIED, TOOL_RUN, LEGACY_EVIDENCE_ANCHORED, CHECKPOINT_PUBLISHED, OBJECTION_RAISED, OTHER_GOVERNANCE_EVENT`.

### 2.9 Verificación (`trace_verify.py`)
Checks: `verify_stored_digests` (V1-A, reescritura SQLite), `verify_chain` (`HASH_MISMATCH`/`REPLAY`), `verify_causal_parents/verify_circular_parents` (DAG), `verify_action_types` (`MISSING_SUBTYPE`/`ENUM_MIGRATION_REQUIRED`), `verify_board_updates` (6 reglas H-BOARD), `verify_signatures` (H-SIG; `require_ed25519` rechaza HMAC en modo ratify), `verify_checkpoint`, `verify_manifest_signature`, `verify_expected_events` (H-OMIT). Exit 0 verde / 1 rojo. Política fail-closed (`POLICY_PARSE_ERROR` no degrada a defaults).

---

## 3. Debilidades verificadas de CAGF (lo que escrubery corrige)

| # | Debilidad | Evidencia CAGF | Corrección escrubery |
|---|---|---|---|
| 1 | **Mono-clave** (`operator-ed25519` firma todo) | `emit_event.py:52`, `ratify_setup.py:34` | **Multi-clave por servicio/agente** desde el diseño (D2) |
| 2 | **PEM sin cifrar**, sólo `chmod 0600` | `keymgmt.py:57-62` | **Custodia tiered**: KMS/keyring OS/passphrase; nunca PEM plano en worktree (política §7) |
| 3 | **`sort_keys` casero**, no JCS | `event_log.py:99,102-106,122` | **JCS/RFC 8785** desde el inicio (D3) |
| 4 | **Sin rotación/revocación** | `keymgmt.py:68-75` | Keyring con `validity_window`, `status`, `successor_kid` |
| 5 | **Checkpoint no anclado externamente** (mismo git que el `.db`) | `trace_verify.py:284-291` | **Anclaje externo** RFC 3161 / transparencia (F4) |
| 6 | **Génesis sin firmar** | `genesis.py:65-77` | Génesis firmado por la raíz |
| 7 | `canonicalization_alg` **decorativo** (no se lee) | `event_log.py:77` | Hacerlo efectivo (rechazar si difiere) |
| 8 | **Sin lock/concurrencia** (race en `prev_hash`) | `emit_event.py:236-249` | `BEGIN IMMEDIATE` atómico read→insert |
| 9 | HMAC aún aceptado en modo no-estricto | `trace_verify.py:211-216` | **Sin HMAC** (solo Ed25519) |
| 10 | **Sin multi-firma** (deferred en CAGF) | `IMPLEMENTATION-REPORT.md:177-187` | **M-of-N** desde el schema |
| 11 | Timestamp a segundo, sin monotónica | `event_log.py:75` | ISO-8601 con ms + fuente monotónica |
| 12 | Omisión irreducible (acto nunca emitido) | `IMPLEMENTATION-REPORT.md:154-158` | Manifiesto de esperados firmado por parte **independiente** |

---

## 4. Modelo de confianza OBJETIVO de escrubery (multi-capa)

Para pasar de "herramienta interna" a **servicio público verificable**, la confianza no puede reposar en una sola clave. Modelo por capas (defense in depth):

### 4.1 Multi-firma (M-of-N) por evento
Un evento puede llevar **lista de firmas** (no una sola). Eventos críticos (`fix_seguridad`, `breaking_change`) exigen **quórum**: p. ej. firma del servicio escrubery **+** un notario independiente. Resistencia a compromiso de una sola clave. El schema del EventRecord contempla `signatures: [{key_id, sig, key_cert_ref}]`.

### 4.2 Cadena de confianza (keyring jerárquico tipo certificado)
- **Clave raíz (root)**: offline, custodia soberana (HSM/air-gap, multi-sig humana 2-of-3). Firma **certificados** de claves operativas.
- **Claves operativas**: una por servicio/agente firmante; cada una con `validity_window` y certificado firmado por la raíz.
- El keyring público commiteado incluye la **raíz + los certificados** de las operativas. Rotar/revocar una operativa **no** toca la raíz ni rompe firmas previas.
- Es PKI ligera sobre Ed25519 (no X.509 pesado, pero mismo principio: delegación firmada con ventana de validez).

### 4.3 Custodia tiered
- **Raíz**: offline (HSM / air-gap / multi-sig humana). **Nunca** en el worktree ni en KMS cloud.
- **Operativas**: KMS (AWS/GCP) o keyring OS, cifradas en reposo.
- Política硬 (§7): privada fuera del worktree, jamás PEM plano commiteado.

### 4.4 Anclaje externo (checkpoint públicamente verificable)
El checkpoint de F2 (ancla el tip "fuera de la BD") es **débil** si vive en el mismo git que la BD. Robustez real:
- **RFC 3161** (timestamp authority) sobre el checkpoint — sellado de tiempo de una tercero.
- **Transparencia tipo log público** (árbol de Merkle publicable, estilo Certificate Transparency) para que cualquier tercero audite que no se omitieron eventos.
- (Opcional, público) anclaje a blockchain.
- Esto convierte "checkpoint local" en "checkpoint anclado al mundo".

### 4.5 Revocación observable
Log público de claves revocadas (CRL ligero o estilo OCSP-stapling) que los verificadores consultan antes de aceptar una firma. Permite revocar una clave comprometida sin reescribir historia (los eventos previos firmados por ella siguen válidos si estaban dentro de su `validity_window`).

---

## 5. Roadmap de seguridad por fase (qué se activa y cuándo)

| Mecanismo | F2 (base) | F4 (robustez) | Público (post-D4) |
|---|---|---|---|
| Ed25519 + cadena `prev_hash` | ✅ implementado | — | — |
| Checkpoint del tip | ✅ local (fuera de BD) | ✅ + **RFC 3161** / Merkle público | ✅ |
| Canonicalización | ✅ **JCS/RFC 8785** | — | — |
| Multi-clave por servicio | ✅ (schema multi-firma) | — | ✅ activo |
| Custodia tiered | ⚠️ privada fuera worktree (mínimo) | ⚠️ KMS | ✅ raíz offline multi-sig |
| Rotación/revocación | ✅ campos en keyring | ✅ CRL | ✅ |
| Cadena de confianza (root→operativas) | ⚠️ schema preparado | — | ✅ activa |
| Anclaje externo (RFC 3161/transparencia) | ❌ campo `external_anchor=null` | ✅ | ✅ |
| Multi-firma M-of-N (quórum) | ⚠️ schema `signatures[]` | — | ✅ activa para críticos |

**Leyenda:** ✅ activo · ⚠️ schema preparado / mínimo viable · ❌ no presente.

---

## 6. Cómo F2 lo contempla (hooks de diseño, sin reescritura posterior)

F2 implementa la **base** pero diseña el schema **extensible** para que F4 y "público" sean **activación**, no reescritura:

- **EventRecord**: `signatures: Signature[]` (lista, no `signature: string`); cada `Signature = {key_id, sig, key_cert_ref, alg}`. Un evento con 1 firma hoy = caso particular de M-of-N mañana.
- **Keyring** (formato `cagf-keyring/0.2` extendido): entrada raíz + entradas operativas con `validity_window`, `status: active|revoked`, `successor_kid`, `parent_kid` (certificación). Compatible hacia atrás con `0.1` para lectura.
- **Checkpoint**: campo `external_anchor` (null en F2; en F4 lleva `{type:"rfc3161", tsr_ref, ...}` o `{type:"merkle_root", root, ...}`).
- **Génesis firmado** por la raíz (corrige CAGF §6).
- **`canonicalization_alg` efectivo**: el campo se lee y el verificador rechaza si difiere de JCS/RFC 8785.
- **Lock atómico**: `BEGIN IMMEDIATE` en el read→insert de `prev_hash` (corrige race de CAGF §8).
- **Solo Ed25519**: sin HMAC (corrige CAGF §9).

Así, el paso F2→F4→público es añadir el `external_anchor` y activar rotación/custodia/multi-firma, **sin** cambiar el schema del EventRecord.

---

## 7. Decisión de interoperabilidad con CAGF

escrubery **emite su propia traza** (eventos de changelog de los 7 CLIs); **no** verifica logs CAGF. Por tanto:
- **No** replica byte-exacto el `sort_keys` de Python (que era la debilidad §3) → usa **JCS/RFC 8785**.
- **Sí** reusa el formato de firma `"ed25519:" + base64` y el DER SubjectPublicKeyInfo base64 en el keyring → un verificador CAGF puede cargar el keyring de escrubery con cambios mínimos.
- Keyring en versión `0.2` (extiende `0.1` con multi-clave/validez/revocación); los campos `0.1` se preservan para lectura.

---

## 8. Enlaces

- CAGF (fuente): `/Users/krisnova/www/constitutional-ai-governance/` (`scripts/trace/`, `DEFINITIONS.md` A6, `ratification-pack-v0.1/`).
- Plan v2 §5.2 (firma por evento, patrones corregidos): `docs/investigacion/Plan_Iterativo_Incremental_Servicio_CLI_Modelos_v2.md`.
- Decisiones D2 (Ed25519) y D3 (JCS): `docs/decisiones-pista-paralela.md`.
- Contrato v0 §2.3 (canonicalización): `docs/CONTRATO_API_v0.md`.
