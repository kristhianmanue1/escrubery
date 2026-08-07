# Bitácora de ciclos — escrubery

Registro de trabajo por fase/ticket según el plan v2 (§10) y la política de agentes (§9). Hogar canónico del detalle de avance; `AGENTS.md` solo lleva el resumen.

**Convención:** 1 ciclo = lo que un Ejecutor completa y deja verificable en una sesión. Desviación = ciclos reales − estimados.

| Fecha | Fase | Ticket / trabajo | Ciclos est. | Ciclos reales | Desviación | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-07 | F0 | Fichas de proveedores desde LiteLLM (script generador + 5 fichas, 139 modelos) | 1 | 1 | 0 | `scripts/generar_fichas_modelos.py`; salida verificada |
| 2026-08-07 | F0 | Fichas curadurizadas de CLIs (7 fichas, oficial/comunitario distinguido) | 1 | 1 | 0 | `datos/fichas/clis/`; `./scripts/consultar oficialidad` |
| 2026-08-07 | F0 | Comando `consultar` (listar/ficha/modelo/comando/oficialidad, exit codes 0/1/2) | 1 | 1 | 0 | `./scripts/consultar modelo moonshot kimi-k2-0905-preview` → exit 0; `sin_datos` → exit 1 |
| 2026-08-07 | F0 | Marco de trabajo con agentes: política v1.0 + plantillas + gate de tamaños + AGENTS.md | 1 | 1 | 0 | `docs/politica-agentes.md`, `docs/plantillas-agente.md`, `python3 scripts/check_sizes.py` → OK |
| 2026-08-07 | F0 | Integración AN-KLA: memoria inicializada con 2 facts (mapa de decisiones, próximos pasos) + 1 evento; guía operativa propia | 1 | 1 | 0 | `an_kla status` → revisión 4, `verify` ok; retrieve encuentra ambos facts; `docs/an-kla-guia.md` |
| 2026-08-07 | F0 | Scaffold NestJS + PostgreSQL: 4 tablas núcleo (modelos, cli_productos, cli_comandos, consultas_log) + runner de migraciones + verificador SELECT vacío | 1 | 1 | 0 | `npm run db:migrate` aplica `001_nucleo_fase0.sql` + `002_proveedor_check.sql`; `npm run db:verificar` → `modelos=0 cli_productos=0 cli_comandos=0 consultas_log=0` OK (exit 0); `npm run build` exit 0; ronda adversarial fix-and-retry cerrada |
| 2026-08-07 | F0 | Pista paralela de decisiones §3.3: 4 decisiones iniciadas (D1 ToS, D2 Ed25519, D3 JCS, D4 naturaleza servicio) con estado/responsable/fase/entregable | 1 | 1 | 0 | `docs/decisiones-pista-paralela.md` (80 líneas); `python3 scripts/check_sizes.py` OK |

**Pendiente de la Fase 0 (según plan v2 §3):**
- [x] Scaffold NestJS + PostgreSQL: tablas núcleo (`modelos`, `cli_productos`, `cli_comandos`, `consultas_log`) con `SELECT` vacío verificable. *(implementado, verificado y commiteado 2026-08-07, commit `8c12891`)*
- [x] Pista paralela de decisiones (§3.3) documentada como abierta: ToS de los 6 CLIs, esquema de llaves Ed25519, canonicalización JCS, naturaleza del servicio. *(iniciada 2026-08-07 en `docs/decisiones-pista-paralela.md`; las decisiones mismas siguen abiertas)*
- [x] Cierre formal de la Ficha v0 contra su criterio (Mediador): 12 fichas consultables con fuente y fecha citadas. *(verificado 2026-08-07: 12/12 con procedencia completa, 5/5 hashes de proveedor = `sha256` real del JSON LiteLLM; ronda adversarial de cierre `proceed`)*

---

## FASE 0: CERRADA (2026-08-07)

Decreto del Mediador tras ronda adversarial `proceed`. Cumple los 4 criterios del plan v2 §3: Ficha v0 (12 fichas consultables con fuente+fecha), decisiones §3.3 iniciadas, contrato v0 anexado, `SELECT` sobre tablas núcleo. **Total F0: 7 ciclos estimados / 7 reales / desviación 0.**

**Siguiente: Fase 1 — MVP de consulta sobre PostgreSQL** (CLI `consultar` + endpoint HTTP JSON, caché-al-consultar, `consultas_log`, primer consumo real por ADRC/expertoGobernanza). Decisión técnica pendiente heredada de F0: elección de ORM/acceso a datos.

---

## Fase 1 — MVP de consulta (cierre sujeto a adversarial)

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-07 | F1 | T1 — Capa Kysely + ingesta de fichas a BD | 1 | 1 | 0 | `npm run db:ingestar` → 7 cli_productos, 12 cli_comandos, 139 modelos; 0 filas sin procedencia; idempotente; build+lint OK |
| 2026-08-07 | F1 | T2 — CLI consultar sobre BD (módulo Kysely + wrapper node) | 1 | 1 | 0 | `./scripts/consultar modelo moonshot kimi-k2-0905-preview` → JSON con procedencia desde BD; exit 1 sin_datos |
| 2026-08-07 | F1 | T3 — Endpoint HTTP /v0 (POST /v0/<op>) | 1 | 1 | 0 | `curl POST /v0/consultar_modelo` → JSON = CLI; 404 sin_datos; 400 params |
| 2026-08-07 | F1 | T4 — consultas_log + instrumentación (integrado en módulo) | 0.5 | 0.5 | 0 | cada consulta registra `servido_desde` + `latencia_ms` |
| 2026-08-07 | F1 | T5 — Ingesta asistida --help (captura→hash→insert) | 1 | 1 | 0 | `db:ingestar-help --cli claude-code --comando --help --desde <f>` → fila con fuente ejecucion_local_supervisada; idempotente |
| 2026-08-07 | F1 | T6 — Primer consumo real (ADRC vía HTTP) | 0.5 | 0.5 | 0 | `POST /v0/consultar_modelo` anthropic/claude-sonnet-4-5 (ctx 200000); fila en consultas_log |
| 2026-08-07 | F1 | T7 — reportar_feedback (tabla + dedup + CLI/HTTP) | 1 | 1 | 0 | 1º feedback → `nuevo`; 2º idéntico → `duplicado` (hash_dedup UNIQUE) |

---

## FASE 1: CERRADA (2026-08-07)

Decreto del Mediador tras ronda adversarial `proceed`. Cumple los 3 criterios del plan v2 §4: consulta desde BD con procedencia sin llamar IA/fuente externa; `tipo` oficial/comunitario en toda respuesta de CLI; consumo real registrado en `consultas_log`. **Total F1: 6 ciclos estimados / 6 reales / desviación 0.** Tag `v0.1.0-alpha` (alpha interna, repo privado).

**Siguiente: Fase 2 — Changelog clasificado, alertas y firma por evento** (poller GitHub, clasificación por severidad, firma Ed25519 con `prev_hash` y checkpoint, validación cruzada LiteLLM, alineación de los shapes §3.1/§3.2/§3.6 al contrato v0 antes de su congelamiento).

**Notas:**
- T1 incluyó migraciones 003 (`nombre_display` en cli_productos) y 004 (DROP `cli_productos_proveedor_check`: el enum de proveedor aplica a `modelos`, no a maintainers de CLIs como openai/comunidad).
- Las fichas de CLI son 7 y no 6 porque Grok CLI (comunitario) y Grok Build (oficial) se distinguen explícitamente, como exige la regla de gobernanza.

---

## Fase 2 — Changelog clasificado + Evidentia (cierre sujeto a adversarial)

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-07 | F2 | T0+T1 — Modelo Evidentia (JCS+EventRecord) + `eventos_changelog` (mig 006) | 1 | 1 | 0 | `evidentia:probar-cadena`: B.prev_hash=A.hash, `verificarCadena` OK |
| 2026-08-07 | F2 | T3 — Clasificador de severidad (heurístico 7 categorías, sin IA) | 0.5 | 0.5 | 0 | fix_seguridad/breaking/deprecacion/funcion_nueva/… correctos |
| 2026-08-07 | F2 | T4 — Divergencia pasiva + validación cruzada (interfaz) | 0.5 | 0.5 | 0 | detecta `--newflag`/`--verbose` ausentes; cruzado `pendiente_de_verificar` (sin 2ª fuente pública) |
| 2026-08-07 | F2 | T2 — Poller GitHub (releases, sin token) | 1 | 1 | 0 | `cline`: 10 releases reales → 10 eventos, `verificarCadena` OK |
| 2026-08-07 | F2 | T5 — Vulnerable MCP (fuente pasiva, fix_seguridad transversal) | 0.5 | 0.5 | 0 | fixture 1 advisory → 2 eventos; `verificarCadena` OK |
| 2026-08-07 | F2 | T6 — Firma Ed25519 + verificador read-only (clave real del Mediador) | 1 | 1 | 0 | `evidentia:firmar` → 10 firmados; `evidentia:verificar` → OK (cadena+Ed25519 con keyring público); privada fuera del worktree |
| 2026-08-07 | F2 | T7 — Congelar contrato v0 + alertas alta severidad (<24h) | 0.5 | 0.5 | 0 | contrato §0 congelado, §2.3 JCS declarado; `evidentia:alertas` lista fix_seguridad/breaking 24h |

**Cierre F2 (criterio plan v2 §5):** evento de alta severidad → alerta <24h (`evidentia:alertas`); hechos verificables criptográficamente por tercero con keyring público (`evidentia:verificar`, read-only, fail-closed). **Total F2: 5 ciclos estimados / 5 reales / desviación 0.**

**Notas F2:**
- D2/D3 cerradas (modelo multi-capa + JCS); D4 inclinada a "producto" (Evidentia de pago). Referencia: `docs/investigacion/Referencia_Traza_Firma.md`.
- `eventos_changelog.firmas_json` es `Signature[]` (M-of-N extensible). `hash_evento` excluye `confianza_clasificador` (metadata) y normaliza fechas (ISO) para que la cadena verifique tras round-trip por la BD.
- **Robustez criptográfica real = F4** (RFC 3161/Merkle): F2 entrega integridad + cadena + checkpoint local (detección, no "imposibilidad"). El `external_anchor` (null en F2) se activa en F4 sin reescritura.
- Clave real `escrubery-evidentia-001` generada offline por el Mediador; privada en `~/.escrubery/keys/` (no commiteada); keyring público en `datos/keys/evidentia-keyring.json`.
