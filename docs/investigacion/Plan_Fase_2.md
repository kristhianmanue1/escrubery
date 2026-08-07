# Plan: Fase 2 — Changelog clasificado, alertas y firma por evento (Evidentia)

**Contexto:** detectar cambios en los 7 CLIs, clasificarlos por severidad, alertar lo urgente y que **todo hecho guardado sea verificable criptográficamente** (Evidentia). **Fecha:** 2026-08-07. **Estado:** borrador (previo a ejecución). **Fase del plan v2:** F2 (§5). **Fuente:** ticket del Arquitecto; D2/D3 cerradas con modelo multi-capa.

## Objetivo y criterio de cierre (plan v2 §5)

- **Objetivo:** evento de alta severidad → notificación <24 h desde su publicación; cualquier hecho guardado verificable criptográficamente (firma + cadena + checkpoint) por un tercero con el keyring público, sin credenciales del sistema.
- **Cierre:** adversarial `proceed` + decreto del Mediador; congela contrato v0 (solo cambios aditivos después).

## Decisiones cerradas que habilitan F2

- **D2 (Evidentia):** Ed25519 multi-capa (multi-firma, cadena root→operativas, custodia tiered, anclaje externo F4, revocación). F2 = base con **schema extensible**. Ver `docs/investigacion/Referencia_Traza_Firma.md`.
- **D3:** JCS/RFC 8785 (no `sort_keys`). Implementación Node se elige en T0.

## Hitos (§6)

- H-F2 — Cierre F2: criterio §5 cumplido + contrato v0 congelado (shapes §3.1/3.2/3.6 alineados).

## Tareas

- [ ] **T0 — Modelo Evidentia + JCS.** Elegir lib JCS de Node; definir `EventRecord` (extensible: `signatures[]`, `key_id`, `key_cert_ref`), `keyring cagf-keyring/0.2` (validity/status/successor). *Sin firma aún.*
- [ ] **T1 — `eventos_changelog` + EventRecord.** Migración + tabla del §9 (`categoria, resumen, confianza_clasificador, hash_sha256, hash_evento_anterior, firma_ed25519, checkpoint_id, fuente_url, fecha_publicacion, fecha_deteccion`).
- [ ] **T2 — Poller GitHub.** Releases + commits sobre `CHANGELOG.md` + Security Advisories; cadencia diferenciada (diaria claude-code/grok-build; semanal resto).
- [ ] **T3 — Clasificador por severidad.** `funcion_nueva | breaking_change | fix_seguridad | deprecacion | cambio_precio | cambio_limite | ruido_irrelevante`.
- [ ] **T4 — Validación cruzada LiteLLM + divergencia pasiva.** 2ª fuente; discrepancia > umbral → `pendiente_de_verificar`.
- [ ] **T5 — Vulnerable MCP** (fuente pasiva, `fix_seguridad` inmediata).
- [ ] **T6 — Firma Evidentia.** Ed25519 + `prev_hash` + checkpoint local + keyring `0.2` + **verificador read-only** (`verificar`, fail-closed). **Requiere clave del Mediador.**
- [ ] **T7 — Congelar contrato v0.** Alinear shapes §3.1/3.2/3.6 + declarar JCS impl. en §2.3 + operaciones Evidentia (`registrar_evidencia`, `verificar_evidencia`).

## Insumos requeridos del Mediador (bloqueantes para T2 y T6)

1. **Clave Ed25519 del servicio (T6):** la privada vive fuera del worktree (política §7). Opciones: (a) el Mediador la genera offline y fija la env/path; (b) el Ejecutor propone el flujo de generación + keyring público y el Mediador ejecuta la generación. **Recomendación: (b)** — el Ejecutor deja `scripts/keys/` listo, el Mediador corre la generación offline y trae el keyring público.
2. **Token de GitHub (T2):** repos públicos, pero sin token = 60 req/h (justo para 7 repos diarios/semanales). **Recomendación: token de mínimo privilegio** (solo `public_repo` read) para holgura; si no, sin token y cadencia conservadora.

## Orden recomendado (mi propuesta)

Ejecutar primero lo que **no** requiere insumos del Mediador: **T0 → T1 → T3 → T4 → T2 (sin token) → T5**, y dejar **T6 (firma)** para cuando el Mediador provea la clave; **T7 (congelar contrato)** al cierre, tras adversarial. Así F2 avanza y la firma se activa al final sin bloquear.

## Riesgos / supuestos

- **Robustez criptográfica real = F4** (RFC 3161/Merkle); F2 entrega integridad + cadena + checkpoint local (detección, no "imposibilidad"). Honestidad estructural.
- **Sobre-alcance (§12.1):** el clasificador y la validación cruzada pueden escalar; el Arquitecta rechaza tickets que excedan §5.
- **No ejecución de CLIs** en F2 (eso es F3 con sandbox); el poller lee fuentes públicas.

## Enlaces

- Política: `docs/politica-agentes.md` · Plan v2 §5: `docs/investigacion/Plan_Iterativo_Incremental_Servicio_CLI_Modelos_v2.md`
- Referencia traza criptográfica: `docs/investigacion/Referencia_Traza_Firma.md` · Decisiones D2/D3: `docs/decisiones-pista-paralela.md`
