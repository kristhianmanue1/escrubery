# Bitácora de ciclos — escrubery

Registro de trabajo por fase/ticket según el plan v2 (§10) y la política de agentes (§9). Hogar canónico del detalle de avance; `AGENTS.md` solo lleva el resumen.

**Convención (T7, desde 2026-08-17):** 1 ciclo = lo que un Ejecutor completa y deja verificable en una sesión. **Desviación** = ciclos reales − estimados, y registra el re-trabajo (p. ej. fix-and-retry de adversarial) como fracción de ciclo. Una desviación 0 sistemática se trata como señal de estimación inválida, no como logro. Primer ejemplo: T1a +0.5 (pelea Jest/ESM).

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

---

## FASE 2: CERRADA (2026-08-07)

Decreto del Mediador tras ronda adversarial `proceed`. Cumple los criterios del plan v2 §5: alerta de alta severidad <24h (`evidentia:alertas`) + hechos verificables criptográficamente por tercero con keyring público (`evidentia:verificar`, read-only, fail-closed). **Total F2: 5 ciclos estimados / 5 reales / desviación 0.** Tag `v0.2.0-alpha`. Evidentia operativa (10 eventos reales de `cline` firmados con la clave del Mediador).

**Siguiente: Fase 3 — Introspección activa automatizada** (`--help`/`--version` diffing en contenedor efímero, inventario vivo). **Criterios de entrada (plan v2 §6.1):** entorno sandbox probado, **D1 (revisión ToS) resuelta** al menos para los CLIs de verificación diaria, presupuesto por ciclo aprobado.

---

## Fase 2.5 — MCP local (adelanto de F5, D4=interno)

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-07 | F2.5 | MCP local stdio — servidor que expone las tools del contrato + Evidentia | 2 | 1 | -1 | `npm run mcp:probar`: 6 tools; `consultar_modelo` OK; `verificar_evidencia` ok (11 eventos, 10 firmados) |

**Notas F2.5:** adelanto de F5 justificado por D4=interno (consumidores = agentes → MCP es su consumo nativo) y F3 bloqueada por D1. Reusa `consultas/modulo.ts` (F1) y `evidentia/verificar.ts` (F2). F5 queda como formalización (Agent Card firmado cuando F4 dé robustez). Configuración cliente (`.mcp.json`) en `docs/CONSUMO_INTERNO.md`.

---

## Fase 3 — preparación (criterios de entrada §6.1)

| Fecha | Criterio | Estado | Evidencia |
|---|---|---|---|
| 2026-08-07 | (b) ToS diarios resuelta | ✅ | `docs/investigacion/tos-clis.md`: opencode + claude-code + codex-cli curados (PERMITIDO introspección) |
| 2026-08-07 | (a) Sandbox probado | ✅ | `docker/sandbox/Dockerfile.opencode`; `docker run --rm escrubery-sandbox-opencode --version` → 1.18.15; `--help` captura 19 comandos (la ficha tenía 6 — **señal estrella de F3**: divergencia detectada) |
| 2026-08-07 | (c) Presupuesto | ⏳ | con `--help` no se llaman modelos → costo ~0 (pendiente aprobación Mediador) |

**8º CLI añadido:** opencode (`anomalyco/opencode`, MIT) — controlador principal del Mediador (corre GLM-5.2). Inventario: 8 CLIs, 18 comandos catalogados, 139 modelos.

**Alcance de introspección diaria F3 (T8, 2026-08-17):** opencode/claude-code/codex-cli (ToS curados, `docs/investigacion/tos-clis.md`); grok-build/kimi-code/antigravity/cline/grok-cli-community **excluidos** de la ejecución activa hasta resolver D1 (ToS) para ellos — solo vigilancia pasiva (pollers de releases).

---

## Plan de deuda — H1: Verificación propia automatizada (CERRADO)

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-17 | deuda | T4a — Errata completa del contrato v0 | 0.5 | 0.5 | 0 | `docs/CONTRATO_API_v0.md` §0 (9 puntos): §3.4/§3.5 → §5 + T4b; §3.1/§3.2/§3.3 shapes implementados; listar/oficialidad documentadas (§3.7/§3.8); `python3 scripts/check_sizes.py` → OK |
| 2026-08-17 | deuda | T1a — Specs Jest de Evidentia | 1 | 1.5 | +0.5 | `cd backend && npm test` → 54/54 (cadena OK/rota, firma ok/alterada, fail-closed sin keyring, kid fuera de keyring, firma sin prefijo, firmado-sin-firmas, 7 categorías); `ESCRUBERY_SKIP_DB_SPECS=1 npm test` → 41 passed + 13 skipped |
| 2026-08-17 | deuda | T2 — JCS conforme a RFC 8785 | 0.5 | 0.5 | 0 | Vectores RFC (números shortest-round-trip, strings/escapes, orden claves UTF-16 con surrogate pair, U+2028/29 crudos) **pasan con la implementación casera** — no se adoptó `canonicalize`; round-trip firma→re-canonicalización verificado; `npm test` verde |
| 2026-08-17 | deuda | T4c — Endurecimiento validación/UX (fusionado con T1b según adversarial T4a) | 0.5 | 0.5 | 0 | CLI: tipo inválido → exit 2, id ausente → exit 2, BD caída → exit 3 + JSON `fuente_no_disponible` (verificado e2e); MCP ya no degrada id a `'desconocido'`; HTTP 400; contrato §1/§3.6/§4 actualizados |
| 2026-08-17 | deuda | T1b — Golden del shape implementado post-errata (consultas) | 1 | 1 | 0 | `consultas.spec.ts`: goldens `listar`/`modelo`/`comando`/`ficha`/`oficialidad`/`feedback` (nuevo+duplicado) con fixtures semilla deterministas; 75/75 tests, 6 suites |

**Notas T4a (2026-08-17):**
- Decisión del Mediador (insumo #2 del plan): **documentar** los campos omitidos como no disponibles en v0; su implementación queda en T4b (diferido).
- La errata resultó más amplia que el hallazgo original (§3.1/§3.2): también §1 (CLI posicional, sin 429), §2.1 (`firma_ed25519` siempre null en consultas; listar/oficialidad sin bloque procedencia), §3.3 (shape de ficha), §3.6 (`estado_datos_hash` no disponible; enum `tipo` solo exigido en MCP), §4 (`detalles` ausente; códigos previstos no emitidos), §2.3 (`verificar_evidencia` en MCP desde F2.5).
- `docs/CONSUMO_INTERNO.md` corregido (7→8 CLIs; procedencia e "índices" y "ficha resumida" alineados con la errata); descripción de la tool MCP `consultar_ficha` alineada ("resumida").
- Ronda adversarial de T4a (2026-08-17): r1 `fix-and-retry` (1 HIGH: `flags` documentado como array cuando la implementación sirve captura cruda `null|{salida}`; 5 MED) → correcciones aplicadas → r2 `proceed` (ver registro adversarial del plan de deuda).

**Notas T1a/T2 (2026-08-17):**
- BD de test aislada `escrubery_test` (helper `fixtures/test_db.ts`): se crea/migra idempotentemente (advisory lock), nunca toca la BD real. `npm test` corre `--runInBand` (specs de BD comparten la BD de test; el paralelismo contaminaba la cadena).
- `kysely` es ESM-only → `jest.config.js` nuevo con babel-jest solo para `kysely/dist` (devDeps: `@babel/preset-env` + `@babel/core`); el resto ts-jest CJS.
- **Decisión registrar (DoD T1a):** los scripts `probar_*` (`evidentia:probar-cadena`, `probar-firma`) se **conservan** como demos manuales post-despliegue (referenciados en la bitácora F2); los specs son el gate automatizado. Ningún comportamiento de producción cambió.
- Exclusión local sin BD documentada en el encabezado de cada spec de BD: `ESCRUBERY_SKIP_DB_SPECS=1`; CI (T3) correrá siempre con PostgreSQL y sin la variable.
- Desviación +0.5 en T1a: pelea con el runtime Jest/ESM de `kysely` (3 intentos: ts-jest ESM mode → babel-jest → runInBand por contaminación de workers). Primera desviación ≠ 0 desde F2 — prueba de la convención honesta de T7.

### HITO H1: CERRADO (decreto del Mediador 2026-08-17)

Adversarial de gate: r1 `fix-and-retry` (HIGH: `feedbackInputValido` no total — `null` → TypeError/exit 3/HTTP 500; LOW: `test_db` hardcodeaba nombre de BD, 4 vectores B.2 ausentes) → fix (guard null-safe + 7 specs de totalidad + vectores) → r2 `proceed`. **Total H1: 3.5 ciclos estimados / 4 reales / desviación +0.5** (T4a 0.5/0.5, T1a 1/1.5, T1b 1/1, T2 0.5/0.5, T4c 0.5/0.5). Criterio cumplido: `npm test` 75/75 (specs Evidentia + golden post-errata + JCS RFC 8785). Registro: filas 5-6 del plan de deuda.

---

## Plan de deuda — H2: Operación continua (VERIFICADO por adversarial 2026-08-17)

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-17 | deuda | T3 — CI mínimo (GitHub Actions) | 0.5 | 0.5 | 0 | `.github/workflows/ci.yml` (47 líneas < 100): postgres:16 service siempre activo + build + eslint (sin `--fix`) + `npm test` (specs de BD incluidas, sin `ESCRUBERY_SKIP_DB_SPECS`) + check_sizes; residual H1 resuelto: `test_db.ts` deriva nombre de BD y admin URL de `ESCRUBERY_TEST_DATABASE_URL` (validado 75/75 vía URL TCP local); YAML parse OK |
| 2026-08-17 | deuda | T5 — Vigilancia diaria (pollers + alertas) | 1 | 1 | 0 | `scripts/vigilancia_diaria.sh` + `docs/VIGILANCIA.md` (launchd); **exit 10 real** (2 breaking_change de claude-code en ventana, marcadas NUEVAS), **exit 2 real** (precheck `pg_isready` con socket inexistente), exit 0 verificado por código (ventana con alertas activas); logs fechados en `var/vigilancia/logs/` (gitignored); semanal por estado (≥7 d); vmcp condicional a fuente existente (feed real pendiente de insumo) |
| 2026-08-17 | deuda | T6 — Caducidad `vigente_hasta` + refresco LiteLLM | 1 | 1 | 0 | Mig `008_caducidad.sql` (`modelos.fecha_deprecacion` **columna propia** —decisión Mediador: conservar dato fuente— y `cli_comandos.vigente_hasta`); ingesta 24 h/7 d en 4 puntos; consulta degrada expirado (`pendiente_de_verificar` + `advertencia_caducidad`) — e2e BD real: modelo fresco confirmado, comando viejo degradado; refresco idempotente (`scripts/refrescar_litellm.sh` ×2 → 147 modelos, hash de contenido estable); spec de degradación; 78/78 |

| 2026-08-17 | deuda | T3bis — CI local (Actions sin presupuesto mensual) | — | 0.25 | — | `scripts/ci_local.sh` → **CI LOCAL: VERDE (21 s)** (npm ci + build + eslint sin --fix + 79/79 + check_sizes); workflow `ci` a `workflow_dispatch` (sin auto-trigger hasta renovación de billing); `docs/CI.md` (reglas para agentes: gate = CI local, `gh` con scope admin, re-activación mensual); AGENTS.md lista los scripts |

**Notas T3/T3bis (2026-08-17):**
- **CI vigente = local** (decisión del Mediador): GitHub Actions agotó el billing (se renueva cada mes); el workflow queda manual (`workflow_dispatch`) y `docs/CI.md` documenta la re-activación (`gh workflow run ci` con scope admin). No reclamar "CI verde en la nube" mientras tanto.
- La activación real requiere push (acción del Mediador); hasta entonces el gate local (política §5) es el vigente: `cd backend && npm run build && npx eslint "{src,apps,libs,test}/**/*.ts" && npm test`, luego `python3 scripts/check_sizes.py` desde la raíz.
- El CI usa la misma receta que el gate local; Node 24 (igual que el host) y `npm ci` (reproducible desde lockfile).

**Notas T5/T6 (2026-08-17):**
- Adversarial de gate H2: `proceed` con 2 MED condicionantes, aplicados tras el veredicto: mig `009_backfill_caducidad.sql` (filas pre-T6 sin ventana → 0 filas sin ventana en BD real) y spec de rama `vigente_hasta NULL → no degrada` (79/79). LOWs aplicados: trap EXIT (logs registran exit final), `pg_isready -d $DATABASE_URL`, check HACER_SEMANAL vacío → exit 2. Registro: fila 7 del plan de deuda.
- T6 decisión del Mediador (autorizada): `fecha_deprecacion` se conserva como **columna propia** (`modelos.fecha_deprecacion`, mig 008) — es dato real de la fuente (44 modelos la llevan); el TTL vive solo en `vigente_hasta`.
- Efecto visible honesto: los comandos ingeridos de fichas del 2026-08-07 (ventana 7 d) sirven **degradados** (`pendiente_de_verificar` + `advertencia_caducidad`) hasta que la introspección diaria F3 los refresque — es el comportamiento prometido, no una regresión.
- Feed vmcp: sin fuente local ni `VULNERABLE_MCP_URL`, el paso se omite con nota (feed real pendiente de insumo del Mediador).

**Notas T7/T8 (2026-08-17):**
- **Nota de proceso puro:** este plan de deuda es 100% proceso (0 entregable de producto nuevo: tests, CI, vigilancia, caducidad, licencia — nada que un consumidor nuevo del servicio pueda consultar distinto). El ratio proceso/producto fue decisión registrada del Mediador (2026-08-10) y F3 puede iniciar su preparación restante en paralelo — de hecho F3-T0/T1 ya avanzaron antes del plan.
- **CI bloqueado por facturación (2026-08-17):** la primera corrida del workflow (`run 32050842683`) no arrancó: "recent account payments have failed or your spending limit needs to be increased" (GitHub Actions billing, ajuste pendiente del Mediador). El pipeline está definido y su receta validada localmente (75/75 vía URL TCP); el gate local queda vigente hasta que el CI corra verde.
- **Vigilancia instalada (2026-08-17):** `launchctl load com.escrubery.vigilancia` + corrida vía launchd verificada (exit 10 con alertas "ya conocida (no atendida)"; fix del PATH de launchd aplicado y documentado en `docs/VIGILANCIA.md`).

**Siguiente en H2:** T5 — Vigilancia diaria (pollers + alertas) ∥ T6 — Caducidad `vigente_hasta` + refresco LiteLLM.

---

## Plan de deuda — H3: Contrato y métricas honestas (VERIFICADO 2026-08-17)

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-17 | deuda | T7 — Métrica F1 real + convención de desviación honesta | 0.5 | 0.5 | 0 | `npm run metricas:f1` → 53 consultas: bd 41 (77.4%), sin_datos 12 (22.6%); `fuente_externa` 0 (caché-al-consultar no implementado — honesto); convención en el encabezado de esta bitácora |
| 2026-08-17 | deuda | T8 — LICENSE + desviaciones conocidas documentadas | 0.5 | 0.5 | 0 | `LICENSE` Apache 2.0 (texto canónico, sha256 oficial verificado por adversarial) + README sin "Por definir"; CONSUMO_INTERNO: HTTP sin auth/rate-limit (→ F5); nota alcance F3 diarios en sección F3 |

**Estado del plan (2026-08-17, tras adversarial H3 `proceed`, fila 8 del registro):** los 3 hitos verificados por adversarial. **Totales: 6.5 ciclos estimados / 7 reales / desviación +0.5** (única desviación: T1a). Pendientes del Mediador para el decreto final: (a) billing de GitHub Actions (CI definido y receta validada localmente, pero sin corrida verde en la nube); (b) verificación de coherencia de licencia con ecosistema CAGF/expertoGobernanza (insumo #6); (c) token GitHub opcional (T5). Vigilancia operativa (launchd, diaria 09:00).

---

## PLAN DE DEUDA: CERRADO (decreto del Mediador 2026-08-17)

Los 3 hitos verificados por adversarial (registro filas 3-8) y decretados. **Totales: 6.75 ciclos estimados / 7.25 reales / desviación +0.5** (T1a +0.5, T3bis +0.25). CI = local (`scripts/ci_local.sh`, verde) mientras GitHub Actions esté sin presupuesto mensual (docs/CI.md documenta la re-activación). Vigilancia launchd operativa (diaria 09:00).

## FASE 3: ABIERTA (decreto del Mediador 2026-08-17)

Criterios §6.1 completos: (a) sandbox probado ✅, (b) ToS diarios curados ✅, **(c) presupuesto APROBADO por el Mediador (2026-08-17): solo `--help`/`--version` en contenedor efímero — sin llamadas a modelos, costo ~0**.

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-17 | F3 | T0 — 9º CLI qwen-code + proveedor qwen (DashScope) + ToS curado | 0.5 | 0.5 | 0 | Ficha `qwen-code.json` (Apache-2.0, hash de LICENSE real, oficial/qwenlm); ToS curado (6/9); mig `010` (CHECK +qwen); generador +`qwen:dashscope` → ficha 41 modelos (25 con precio); `./scripts/consultar oficialidad` → 9 CLIs; `consultar modelo qwen qwen3-coder-plus` → ventana 997952; `refrescar_litellm.sh` corrido; Dockerfile.qwen-code (build pendiente de Docker); vigilancia semanal +qwen-code |
| 2026-08-17 | F3 | T1 — qwen-code introspeccionado (sandbox real) + parser multi-formato | 0.5 | 0.5 | 0 | Docker UP: `docker run --rm escrubery-sandbox-qwen-code --version` → 0.15.10; parser nuevo `RE_QWEN` (formato gemini-cli: `qwen <sub>` + placeholders `<...>`); 6 comandos ingeridos con procedencia + vigencia 7 d; evento Evidentia; diarios re-build y re-introspectados (13/12/24 detectados, 0 nuevos — inventario al día) |
| 2026-08-17 | F3 | T2 — Introspección activa integrada a la vigilancia diaria | 0.5 | 0.25 | -0.25 | `vigilancia_diaria.sh`: paso F3 tras pollers (auto-build de imagen si ausente, Docker caído → omite con nota, fallo de build → exit 2); corrida real: 3 diarios introspectados + exit 10 (alertas conocidas); 79/79; check_sizes OK |
| 2026-08-17 | F3 | T3 — Eliminados + version_actual + qwen semanal | 0.5 | 1 | +0.5 | T3a/b/c + fixes adversarial r1 (ver notas); verificado en r2 |

**Inventario (2026-08-17):** 9 CLIs, 79 comandos catalogados (63 vigentes por sandbox), 188 modelos (anthropic, google, moonshot, xai, zhipu, **qwen**).

**Adversarial de cierre F3 (2026-08-17):** r1 `fix-and-retry` (2 BLOCKER, 3 HIGH, 4 MED, 3 LOW — hallazgos clave: build roto por tipo Date; cadena Evidentia rota y **recursiva** por onConflict que mutaba campos hasheados; refresco de vigencia estructuralmente inalcanzable; parser RE_OPEN perdía 38% de comandos de opencode; sin guard ante parser vacío → deprecación masiva en falso). **Honestidad de la bitácora r1 (corregida aquí):** la corrida previa reportó "0 nuevos — inventario al día" cuando en realidad el 100% de los comandos estaba vencido sin camino de refresco, `evidentia:verificar` FALLABA (hash mismatch en 2 eventos mutados — la cadena NO era append-only como se declaró), y el evento `ev-f3-claude-code-removed-*` se re-dispararía a diario. Limpiezas realizadas y registradas: 2 eventos mutados eliminados + cadena rehecha (verificar OK, 80 eventos); fila artefacto `--help` de F1 eliminada; evento `ev-f3-qwen-code-1786989602611` ("1 anadidos: qwen" — parse erróneo temprano) corregido en r1 (su fila se eliminó entonces; queda anotado aquí). Fixes r1: build (toISOString); `registrarEvento` onConflict → doNothing (inmutabilidad de campos hasheados); refresco de vigencia para todos los presentes con confirmación en columnas propias (mig 011) sin tocar procedencia ajena; RE_OPEN con placeholders (opencode 13→21 comandos, 6 recuperados) + **specs del parser** (85/85); guards de fallo docker/status≠0/parser vacío (exit 3 sin tocar inventario ni escribir fuentes); vigilancia continúa con otros CLIs y acumula exit 2 final; salida --version persistida con hash en la cabecera del diario sandbox.

---

## Adversarial de cierre F3 — r2 y r3 (2026-08-17)

- **r2:** 8/8 fixes de r1 verificados RESUELTOS contra código y BD (sin inflado); hallazgo nuevo **[HIGH] imagen sandbox congelada**: Docker cachea el `npm install` y nada disparaba rebuild → "inventario vivo" era "congelado con vigencia renovada" (criterio §6.2 inalcanzable). Residual MED: fallo de build abortaba la vigilancia completa. → fix-and-retry.
- **r3 (fixes aplicados, commit siguiente):** rebuild por divergencia de versión (sandbox `--version` vs `cli_productos.version_actual` en BD; build `--pull` solo cuando difieren o imagen ausente — presupuesto sigue ~0); fallo de build de un CLI → `FALLOS+1` y `continue` (los demás corren; alertas incluidas; exit 2 solo al final). LOWs documentados en contrato §2.3 (formato del diario sandbox: hash = help sin cabecera) y §3.2 (semántica intencional de filas no-confirmables por --help: docs degradan con procedencia intacta). Vigilancia completa re-verificada: exit 10 (alertas conocidas), 3 diarios introspectados, sin rebuild innecesario (versiones coinciden), 85/85.

**r3 (verificación del subagente):** fixes r2 MED/LOW verificados RESUELTOS, pero el HIGH del rebuild fue declarado **NO RESUELTO** con triple evidencia: (1) comparación tautológica (version_actual solo la escribía el propio sandbox, el poller jamás), (2) `--pull` no invalida el cache de la capa RUN (verificado experimentalmente por el revisor: CACHED), (3) opencode pineado a 1.18.15 en el Dockerfile. → fix-and-retry.

**r3-fixes (commit siguiente):** poller escribe `cli_productos.version_actual` desde la última release (tag_name); Dockerfiles con `ARG VERSION` (pin de opencode eliminado); vigilancia reconstruye con `--build-arg VERSION=<publicada>` solo si diverge (cache se invalida naturalmente al cambiar el comando; presupuesto ~0). **Verificación end-to-end real:** poller detectó opencode v1.18.18 → vigilancia "versión sandbox (1.18.15) != publicada (1.18.18): rebuild" → introspección corrió sobre 1.18.18 (0 nuevos/0 elim: sin cambios de comandos entre parches) — criterio §6.2 de punta a punta el mismo día. Cadena OK (82 eventos), 85/85. LOW V_BD fail-open corregido (aviso en log cuando la query no responde).

---

## FASE 3: CERRADA (decreto del Mediador 2026-08-17, tras adversarial `proceed` r4)

**Ronda 4 (2026-08-17):** las 3 fallas del rebuild verificadas RESUELTAS con evidencia e2e del mismo día y sin simulación: 3 releases nuevas reales simultáneas (opencode 1.18.18, claude 2.1.233, codex 0.148.0-alpha.20) → poller escribió versiones → vigilancia detectó divergencia → rebuild `@versión` → introspección nueva → refresco de vigencias (65/87 comandos vigentes) — todo <24 h, sin intervención manual, presupuesto ~0. Regex del poller validada contra 9 tags reales/patológicos. **Totales F3: 2 ciclos est / 3 reales / desviación +1** (T0 0.5/0.5, T1 0.5/0.5, T2 0.5/0.25, T3 0.5/1.5 — T3 absorbió 4 rondas adversariales). Registro completo: bitácora r1-r4 arriba.

**Inventario final F3 (2026-08-17):** 9 CLIs (diarios + qwen semanal), 87 comandos (65 vigentes por sandbox), 188 modelos, cadena Evidentia 82 eventos (verificar OK).

**Residuales LOW (a decidi del Mediador, no bloquean):** spec del eslabón poller→version_actual y flujo compare→build-arg (sugerido para F4/deuda); `fecha_ultima_version` documentada como observación en docs/VIGILANCIA.md; poller escribe version_actual también de CLIs pasivos (inofensivo).

**Siguiente: decisión de rumbo del Mediador — F4 (robustez criptográfica) o F5 (formalización MCP).** El MCP utilitario opera desde F2.5.

---

## Fase 4a — Robustez criptográfica (2026-08-17; plan propio con adversarial de plan r1 fix-and-retry / r2 proceed)

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-17 | F4a | T0 — Mig 012 `checkpoints` | 0.25 | 0.25 | 0 | `UNIQUE(eventos_hasta)`; `checkpoint_id` de eventos deprecado |
| 2026-08-17 | F4a | T1 — Merkle RFC 6962 + checkpoint firmado | 1 | 1 | 0 | Raíces contra **oráculo Python independiente** (1/2/3/7 hojas); **checkpoint #1 real**: 82 eventos, raíz `f8982b5a…`; archivo `datos/checkpoints/` (payload JCS + sig + key_id); skip idempotente verificado; spec prefijo estable (insert N+1 no invalida) |
| 2026-08-17 | F4a | T2 — Prueba de inclusión offline | 0.5 | 0.5 | 0 | `evidentia:prueba-inclusion` lee el ARCHIVO (tercero) + `leaf_index`/direcciones RFC 6962; specs: toda hoja verifica (1-13), path/dirección/hoja alterados fallan; bug de orden hoja→raíz corregido |
| 2026-08-17 | F4a | T3 — Sello RFC 3161 | 1 | 1 | 0 | TSA **DigiCert** (default; su cert encadena a raíces públicas — freetsa usa CA auto-firmada, quedó como alterno por env); `openssl ts` con `-no_nonce` (descartado por diseño); verificación offline: firma CMS + CAfile resuelto portátil (keychain macOS) + EKU + imprint=SHA-256(firmado_json); **sello real verificado**; spec tercero re-canonicaliza JCS del archivo y verifica; payload alterado → no verifica |
| 2026-08-17 | F4a | T4 — Integración + detección de omisión | 0.5 | 0.75 | +0.25 | Vigilancia: checkpoint+sello al final (corre con RC=10/FALLOS>0); `verificar` endurecido: firma/archivo↔BD(JCS)/raíz prefijo vivo/TSR + huérfanos + cola_sin_anclar; **spec de OMISIÓN: borrar evento + rehacer cadena → FALLA; borrar también la fila → archivo huérfano delata**; contrato §2.3 aditivo; 110/110 |
| 2026-08-17 | F4a | T5 — Specs eslabones | 0.5 | 0.5 | 0 | poller→version_actual con fetch mockeado (sin red): 4 casos incl. tags patológicos (rust-v0.148.0-alpha.20) y tag sin versión → intacta |
| 2026-08-17 | F4a | T6 — Cobertura | 0.25 | 0.25 | 0 | `evidentia:verificar --json`: cobertura_anclaje (82/82 anclados por el checkpoint sellado), checkpoints {total/sellados/pendientes/cola} |

**Notas F4a:** custodia git de `datos/checkpoints/` (auto-commit/push por vigilancia vs handoff) queda como **insumo #1 del Mediador** — sin push a remoto, el anclaje TSA es fuerte pero el TSR vive solo en esta máquina (hoy se commitean con el ticket). Desviación +0.25 en T4: pelea de tipos Buffer/string de spawnSync + env ESCRUBERY_CHECKPOINT_DIR para specs.

---

## FASE 4a: CERRADA (decreto del Mediador 2026-08-17)

**Gate F4a (2026-08-17): adversarial `proceed`.** El revisor reprodujo como TERCERO PURO (Python/openssl independientes del repo): prueba de inclusión del evento `ev-cline-cli-v3.0.51`, raíz completa desde los 82 hashes, firma Ed25519, sello RFC 3161 offline (CAfile sistema), negativos (payload alterado → imprint mismatch), oráculo re-derivado, y la réplica del ataque de omisión. Custodia: checkpoint #1 (.json+.tsr) ya en `origin/main`. 9 LOW cosméticos (4 aplicados tras el veredicto; resto registrados). **Totales F4a: 4 est / 4.25 reales / +0.25.** Decreto de cierre y **insumo #1 RESUELTO: autorización dada (2026-08-17)** — la vigilancia hace auto-commit+push diario de SOLO `datos/checkpoints/` (implementado en el mismo commit).

---

## Fase 5 — Formalización MCP (plan v2 §8, D4=interno; en curso 2026-08-17)

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-17 | F5 | T0 — Agent Card firmado | 0.5 | 0.5 | 0 | `datos/agent-card/agent-card.json` (schema escrubery/agent-card/0.1, 8 tools, transportes http+mcp) firmada Ed25519 con la clave Evidentia (keyring público); `agent-card:generar`; verificador `verificarAgentCard` + specs (verifica / alterada falla / key_id inexistente); tool MCP `obtener_agent_card` |
| 2026-08-17 | F5 | T1+T2 — Auth HTTP + rate-limit | 1 | 1 | 0 | `AuthRateLimitGuard` (X-API-Key → SHA-256 vs `ESCRUBERY_API_KEYS`, fail-closed sin claves) + token bucket por clave (60 rpm default, env); 401/429 con formato §4 + `Retry-After`; POST → 200 explícito (antes 201); specs supertest 401×2/200/429 + unit bucket; **e2e real**: 401 sin clave, 200 con clave (9 CLIs) |
| 2026-08-17 | F5 | T3 — Contrato + docs | 0.25 | 0.25 | 0 | Contrato §1 (auth+429+200) y §4 (`no_autorizado` aditivo) actualizados; CONSUMO_INTERNO: cómo generar claves + Agent Card; clave API local generada (hash en `.env`, secreto fuera del repo) |

**Notas F5:** el Agent Card usa la MISMA clave de Evidentia (D4=interno, sin niveles de acceso: una clave por consumidor, sin roles). Rate limit en memoria (single-instance; documentado). El `http.server` ajeno en :3000 del host obligó a probar en :3100 (el puerto real se define en `PORT`).

**Gate F5 (2026-08-17): adversarial `proceed`.** Revisor verificó firma de la card con cripto independiente, fail-closed del auth (sin env → 401 siempre; clave en claro excluida por el check hex), matemática del bucket, cobertura del guard en todo /v0, 401 sin consumir tokens, y docs sin contradicciones. 1 MED (`.env.example` sin las vars nuevas — aplicado en `c53f8ca`) + 5 LOW registrados como deuda (timing-safe compare al exponer externamente, 401 sin bucket por IP, drift potencial de descripciones de tools triplicadas, scope mixto del commit b81c3ad, open handle de Jest). 121/121.

---

## FASE 5: CERRADA (decreto del Mediador 2026-08-17) — PLAN v2 COMPLETO

Criterio §8 cumplido (agente externo se conecta, lista tools, obtiene respuesta verificable — specs + e2e + Agent Card verificada por adversarial con cripto independiente). **Totales F5: 1.75 est / 1.75 reales / 0.**

**HITO MAYOR: el plan v2 (F0–F5) está IMPLEMENTADO COMPLETO** — Ficha v0 → MVP consulta → Evidentia firmada → introspección activa auto-actualizada → robustez criptográfica (Merkle+RFC 3161) → servicio formalizado (auth, rate-limit, Agent Card). Más el plan de deuda (H1–H3) ejecutado entre medias. El roadmap original del servicio, de punta a punta.

**Candidatos siguientes (a decisión del Mediador):** T4b `resolver_identidad_modelo` (necesidad real de expertoGobernanza, ADR-0002; la operación está prometida en contrato §5 desde la errata T4a) · hardening LOWs F5 (timing-safe compare, single-source de descripciones de tools, 401 por IP, open handle Jest) · F4b batería de pruebas activas (bloqueado por presupuesto de modelos).

---

## RELEASE v0.3.0 (2026-08-17)

Tag anotado + [GitHub Release](https://github.com/kristhianmanue1/escrubery/releases/tag/v0.3.0) publicados con notas de versión completas (plan de deuda + F3 + F4a + F5). Gates pre-release: CI local VERDE (139 s), 121/121, árbol limpio en `9ee3c4d`. **Primer release formal del servicio; el plan v2 (F0–F5) queda congelado en esta foto.** Siguientes candidatos sin cambio: T4b, hardening LOWs, F4b (presupuesto).

---

## Post-v0.3.0 — H4: Hardening LOWs F5 (CERRADO, adversarial proceed 2026-08-18)

Plan: `docs/investigacion/Plan_Hardening_F5_y_T4b.md`. Decisiones del Mediador (2026-08-18): alcance T4b = resolver + campos pendientes; orden = hardening primero; casos reales = curaduría sintética.

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-18 | H4 | HF5-T1 — timing-safe compare | 0.25 | 0.25 | 0 | `hashCoincidente` (timingSafeEqual sobre SHA-256 hex de 64 chars, reduce sin early-exit por clave); specs: longitud distinta → false sin excepción, fail-closed con lista vacía; 13/13 |
| 2026-08-18 | H4 | HF5-T2 — single-source de tools | 0.5 | 0.5 | 0 | `src/mcp/tools.ts` catálogo único; lo consumen `server.ts` y `generar_agent_card.ts`; spec anti-drift card↔catálogo (3/3); **la card firmada NO se regeneró** (descripciones canónicas = las de la card; MCP adoptó); CONSUMO_INTERNO corrige la lista vieja de 6→8 tools |
| 2026-08-18 | H4 | HF5-T3 — bucket por IP en 401 | 0.5 | 0.5 | 0 | `ESCRUBERY_AUTH_LIMIT_RPM` (default 20/min) solo consume en fallos de auth; clave válida opera aunque la IP tenga el bucket agotado (verificado por adversarial en el flujo); exceso → 429 `limite_de_tasa` §4 + Retry-After; `.env.example` + CONSUMO_INTERNO (in-memory single-instance documentado) |
| 2026-08-18 | H4 | HF5-T4 — open handle de Jest | 0.25 | 0.25 | 0 | causa raíz: pool Kysely cacheado en `v0.controller.ts` sin destruir (`--detectOpenHandles` no detecta sockets pg — ceguera conocida); `cerrarDbV0()` + afterAll; `npx jest` termina limpio sin warning, script sin `--forceExit` |

**Gate H4:** `bash scripts/ci_local.sh` → VERDE (18 s): build + lint 0 errores (3 warnings preexistentes de `no-unsafe-argument` en líneas previas a H4) + **131/131** (121 de F5 + 10 nuevos: 5 hashCoincidente, 2 bucket IP, 3 catálogo) + check_sizes. Modo SKIP_DB: 95 passed + 36 skipped.

**Adversarial H4 (2026-08-18, subagente independiente):** `proceed`. Verificó DoD por DoD con evidencia ejecutada: timing-safe real (sin camino de texto crudo), orden de comprobaciones del guard (clave válida no toca bucket IP), spec anti-drift no tautológico, card firmada intacta (`git diff` vacío sobre el JSON + firma verifica), contrato congelado sin cambios, sin secretos. **3 LOW residuales (registrados, no bloquean, fix al escalar):** (1) Map de buckets por IP sin poda/TTL — crecimiento sin cota bajo ataque sostenido; (2) detrás de reverse proxy sin `trust proxy` todos los clientes comparten el bucket del proxy — más estricto, nunca bypass; (3) el spec "clave válida no consume bucket IP" corre solo con BD (en el gate corrió y pasó).

**Total H4: 1.5 ciclos est / 1.5 reales / desviación 0** (una sesión; estimación y ejecución del mismo Ejecutor — la desviación 0 se declara honesta por ser el primer caso post-convención T7 con tarea bien acotada).

---

## Post-v0.3.0 — H5: T4b identidad de modelos (CERRADO, adversarial proceed 2026-08-18; push a origin/main)

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-18 | H5 | T4b-T0 — mig 013 + ingesta cache_lectura + curaduría | 0.5 | 0.5 | 0 | Mig 013 (3 columnas + `curaduria_json`); `precio_cache_lectura_por_millon` servido desde la ficha LiteLLM (112 modelos con precio de caché en BD real; qwen3.8-max = 0.250000); capa `datos/fichas/curaduria/identidad_modelos.json` con self-hash reproducible (verificación fail-closed en ingesta) y procedencia propia que NO pisa la de LiteLLM; 13/13 filas curadas |
| 2026-08-18 | H5 | T4b-T1 — mig 014 + módulo resolver + specs | 1 | 1 | 0 | Mig 014 (`identidad_alias` + `identidad_endpoints`, procedencia por fila); `resolverIdentidadModelo` (issuer_id o modelo+endpoint; **nunca adivina**; fail-closed: endpoint conocido + modelo fuera de catálogo → sin_datos); fingerprint `sha256:JCS({proveedor,modelo_id})`; 9/9 specs (fixtures con proveedor 'otro' del enum §2.2); ingesta real: 3 aliases + 6 endpoints |
| 2026-08-18 | H5 | T4b-T2 — superficies + Agent Card + goldens | 1 | 1 | 0 | CLI `consultar resolver` exit 0/1/2 e2e; HTTP e2e 401/200/404/400 (clave válida resuelve `claude-sonnet-5-cowork` → anthropic/claude-sonnet-5 y `qwen3.8-max`+dashscope → qwen/qwen3.8-max familia qwen3); MCP `mcp:probar` con la tool nueva (resuelto + isError en params mezclados); `consultar_modelo` sirve `cache_lectura_por_millon`/`pesos_abiertos`/`familia_arquitectura` (goldens actualizados); Agent Card regenerada y firmada (9 tools); 140/140 |
| 2026-08-18 | H5 | T4b-T3 — contrato §3.9 + docs + bitácora | 0.5 | 0.5 | 0 | Contrato: §3.9 nueva (aditiva; no reutiliza números retirados), §3.1 ejemplo + notas, §1 alias `resolver`, §5 estado actualizado, errata 2 puesta al día; CONSUMO_INTERNO 8→9 tools; bitácora esta sección |

**Adversarial H5 (2026-08-18, subagente independiente, evidencia ejecutada):** `proceed`. Verificó: CI verde 140/140; firma de la Agent Card con cripto independiente (Python ed25519/JCS contra keyring; alterada → falla); self-hash de la curaduría reproducido de forma independiente Y fail-closed probado por ejecución (copia corrupta → la ingesta aborta exit 1 sin escribir); 0 semillas huérfanas (aliases/endpoints/curaduría existen en las fichas y respetan el enum); grep exhaustivo sin lógica de inferencia; procedencia LiteLLM intacta con curaduría anidada; contrato aditivo (diff 145ee90..HEAD); e2e de las 3 superficies + fingerprint reproducido + consultas_log en todos los caminos. **1 LOW registrado (no bloquea, fix al próximo ticket):** el CLI `resolver` tolera 3+ argumentos posicionales y descarta en silencio los extras (debiera exit 2); sin falso positivo posible (fail-closed intacto). **Observaciones (no defectos):** matching de endpoint exacto (trailing slash / http vs https → sin_datos, coherente con "nunca adivina"); asimetría justificada alias (resuelve con null+advertencia) vs endpoint (fail-closed, el modelo lo aporta el usuario).

**Total H5: 3 ciclos est / 3 reales / desviación 0.** Commits: `75e13ed` (H4) + `7bf0d94` (T4b) + `8294356` (docs) — push a `origin/main` autorizado por el Mediador (2026-08-18). Memoria AN-KLA actualizada (revisión 35→36: facts de estado/gotchas + eventos).

**Notas T4b:**
- **Compromiso de commits (autorización del Mediador por presupuesto de tokens):** `75e13ed` (H4) y `7bf0d94` (T4b); el 1º lleva 3 archivos mixtos (tools.ts/server.ts/v0.controller.ts) documentado en su mensaje.
- Decisión de diseño clave: la curaduría de identidad lleva su **propia** procedencia (`curaduria_json`) — la procedencia LiteLLM de las filas de `modelos` queda intacta.
- Semilla sintética (decisión Mediador): los 3 aliases y 13 entradas de modelos son patrones ilustrativos marcados `pendiente_de_verificar`; los casos reales de expertoGobernanza entran vía `reportar_feedback`.
- **El caso de uso que motivó el ticket quedó servido:** qwen3.8-max input $2.0/M vs caché $0.25/M (87.5% de descuento) ya es consultable por API/MCP/CLI.

---

## RELEASE v0.4.0 (2026-08-18)

Tag anotado + [GitHub Release](https://github.com/kristhianmanue1/escrubery/releases/tag/v0.4.0) publicados sobre `7234fd8` (incluye housekeeping `.qwen/`→`.gitignore`, LOW del adversarial). Contenido: resolver_identidad_modelo (contrato §3.9) + cache_lectura_por_millon/pesos_abiertos/familia_arquitectura servidos (errata 2) + hardening H4 + fixes CLI args extra (run orquestado bajo el estándar de orquestación v2.1 del orquestador, evidencia en `docs/planning/`). **Adversarial de release: APTO_PARA_RELEASE** (modalidad C coordinada por el supervisor, 12/12 verificaciones con evidencia ejecutada; firma de card y self-hash de curaduría reproducidos con cripto independiente; 0 BLOCKER/HIGH/MED, 4 LOW registrados). Gates: CI verde 140/140, check_sizes OK. Siguientes candidatos: casos reales del resolver (feedback), args extra en listar/oficialidad/feedback, politica_datos_proveedor, F4b (presupuesto).

---

---

## Post-v0.4.0 — Operación (2026-08-21)

| Fecha | Trabajo | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|
| 2026-08-21 | Triaje de 4 alertas de vigilancia (2 nuevas + 2 conocidas) + recuperación de incidente Docker | 0.25 | 0.25 | 0 | `var/vigilancia/triaje-2026-08-21.md` (local): codex 0.149.0 fix_seguridad CORRECTA (prioridad de actualización); claude 2.1.238 defendible-leve; 2.1.236 sobre-clasificada; opencode 1.18.19 defendible. Docker caído omitió F3 a las 15:00Z → relanzado, vigilancia re-corrida 17:54Z: rebuild opencode 1.18.21 + claude 2.1.238, checkpoint #6 sellado y pusheado |
| 2026-08-21 | ALERTA `introspeccion_omitida` + `estado.f3_introspeccion` cuando Docker falta (seam `ESCRUBERY_DOCKER_BIN`) | 0.25 | 0.25 | 0 | Rama omitida verificada con stub (ALERTA + estado `omitida_docker`); rama ok verificada con corrida real; docs/VIGILANCIA.md actualizado. Observación: build codex @0.150.0-alpha.5 falló porque el tag GitHub precede al paquete npm (npm ≤ alpha.3) — externo y transitorio; el camino resiliente (FALLOS+1, exit 2, reinteto diario) funcionó según diseño |

**Issue #1 cerrado** (2026-08-21) con mapeo hallazgo→resolución: 4 BLOCKER + 5 HIGH resueltos entre F3/F4a/deuda-H1-H3/H4/H5; la sección AN-KLA F8-E se conserva como insumo de diseño enlazado a #2. **Issue #2 decretado** como siguiente ciclo: plan propuesto en `docs/investigacion/Plan_Conversation_Event_v0.md` (contrato `conversation-event/v0` + 4 probes read-only + decisión de adaptadores; espera aprobación del plan por el Mediador). Señal de mejora registrada (sin ticket): clasificador de etiqueta única sobre-clasifica release notes mixtas (caso claude 2.1.236).

---

## Post-v0.4.0 — H6: conversation-event/v0 + probes (CERRADO por decreto del Mediador 2026-08-21; adversarial `proceed`)

Plan: `docs/investigacion/Plan_Conversation_Event_v0.md` (issue #2). Alcance: contrato `conversation-event/v0` + probes read-only (opencode/codex/cline/kimi) + decisión de adaptadores. Sin colectores automáticos ni escritura AN-KLA. **Totales H6: 2.75 est / 2.75 reales / desviación 0.**

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-21 | H6 | CE-T0 — Contrato `conversation-event/v0` | 0.5 | 0.5 | 0 | `datos/schemas/conversation-event-v0.schema.json` (draft 2020-12, `additionalProperties: false`, 7 tipos enum, IDs hasheados, bloque sensibilidad — fusión plan + borrador issue #2); validador `backend/src/probes/conversation_event.ts` (ajv 2020-12 + ajv-formats devDeps; `.npmrc` `legacy-peer-deps` documentado por conflicto peer ts-jest/babel preexistente); 18 specs (7 válidos por tipo + 8 inválidos: prop extra, tipo fuera de enum, required ausente, uuid malo, hash sin patrón, versión vacía, fecha mala, estabilidad fuera de enum) + vector sha256 conocido; contrato §5 anexo no-servido; CI LOCAL VERDE (164/164) |
| 2026-08-21 | H6 | CE-T1 — Probe opencode (read-only sqlite) | 0.5 | 0.5 | 0 | `npm run probe:conversacion -- --cli opencode` sobre BD real (815 sesiones): sesion_iniciada ok (691), prompt_enviado ok (3577, excluye tool-results), turno_finalizado parcial (44597 step-finish = pasos no turnos), compactacion ok (1); turno_fallido/turno_interrumpido/sesion_cerrada no_disponible (fail-closed); 4 muestras validadas contra el schema; **gate privacidad**: grep de cadenas reales de conversación sobre var/probes → 0 matches (solo queries de agregados); evidencia `docs/investigacion/probes/opencode-2026-08-21.md`; CI LOCAL VERDE |
| 2026-08-21 | H6 | CE-T2 — Probe codex-cli (read-only rollouts) | 0.5 | 0.5 | 0 | `--cli codex-cli` sobre 626 rollout-*.jsonl reales (254 sesiones únicas): 5/7 tipos ok (prompts 17135, turnos 15230 con turn_id, interrupciones 604 con reason, compactaciones 2077) — mejor observabilidad de turnos de los 4; turno_fallido/sesion_cerrada no_disponible; 5 muestras validadas; gate privacidad 0 matches (walker solo type/payload.type/session_id); evidencia `docs/investigacion/probes/codex-cli-2026-08-21.md`; CI LOCAL VERDE |
| 2026-08-21 | H6 | CE-T3 — Probe cline (read-only sessions.db + tasks) | 0.5 | 0.5 | 0 | `--cli cline` sobre ~/.cline/data real (174 sesiones, 19 tareas): **único CLI con sesion_cerrada ok** (168 ended_at+exit_code); prompts ok (223 por role); turnos parciales (completion_result 15; failed 8 + 87/174 sesiones failed — señal de gobernanza); compactacion no_disponible; 6 muestras validadas; gate privacidad 0 matches (solo role/type/say/ask proyectados); evidencia `docs/investigacion/probes/cline-2026-08-21.md`; CI LOCAL VERDE |
| 2026-08-21 | H6 | CE-T4 — Probe kimi-code (read-only wire.jsonl) | 0.5 | 0.5 | 0 | `--cli kimi-code` sobre ~/.kimi/sessions real (32 dirs, 30 con mensajes): 5/7 ok — el wire es el más rico por tipo nativo (TurnBegin 1789, TurnEnd 1637, **StepInterrupted 107 y CompactionBegin 61 únicos entre los 4**); turno_fallido/sesion_cerrada no_disponible; 5 muestras validadas; gate privacidad 0 matches (`user_input` en claro jamás proyectado); evidencia `docs/investigacion/probes/kimi-code-2026-08-21.md`; CI LOCAL VERDE |
| 2026-08-21 | H6 | CE-T5 — Decisión de adaptadores | 0.25 | 0.25 | 0 | `docs/investigacion/probes/DECISION_ADAPTADORES.md`: matriz 16 ok / 4 parcial / 8 nd; superficie por CLI (todas `almacen_interno`/`interna`); decisiones: colector solo-artefactos, turno_fallido = hueco transversal (hooks = ToS), sesion_cerrada solo cline, validación schema fail-closed por evento, privacidad como DoD permanente; colector NO implementado (delimitación del issue) |

**Adversarial H6 (2026-08-21, subagente independiente): `proceed`.** Verificó por ejecución: CI verde 164/164 con BD completa; contrato resistente a mutaciones (6/6 muestras maliciosas rechazadas); árbol del repo bit-idéntico tras re-correr los 4 probes (checksum md5); grep creativo con tokens reales de las 4 fuentes sobre reportes y stdouts → 0 fugas; los 8 no_disponible honestos (null + método); matriz exacta vs reportes; sin secretos. 4 LOW: 2 aplicados tras el veredicto (marcas `muestra_sintetica`, números de prosa en kimi), 2 documentados en la decisión (WAL sidecars, `cli_version` prosa → contrato v1). Comentario en issue #2 con el resumen; **issue #2 cerrado por decreto del Mediador (2026-08-21) junto con el cierre del hito. Push a origin/main autorizado.**

---

## RELEASE v0.5.0 (2026-08-21)

Tag anotado + [GitHub Release](https://github.com/kristhianmanue1/escrubery/releases/tag/v0.5.0) publicados sobre `a05463e` (16 commits desde v0.4.0: H6 completo + hardening vigilancia + cierres de issues #1/#2). Contenido: contrato `conversation-event/v0` (**de diseño, no servido** — anexo §5), 4 probes read-only (opencode 815 / codex 254 / cline 174 / kimi 30 sesiones reales, 0 fugas verificadas), `ALERTA introspeccion_omitida` + seam `ESCRUBERY_DOCKER_BIN`. Gates pre-release: CI local VERDE (164/164), árbol limpio, adversarial de hito `proceed`. **API servida sin cambios (surfaces HTTP/MCP/CLI intactas, cero migraciones).** Siguientes candidatos: colector conversation-event (superficie decidida), casos reales del resolver, args extra, `politica_datos_proveedor`, F4b (presupuesto).

---

## Post-v0.5.0 — Habilitación cline/kimi + probe claude-code (decreto "paquete 1+2", 2026-08-22)

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-22 | D1 | ToS kimi-code curado (MIT; cline ya estaba Apache 2.0) | 0.25 | 0.25 | 0 | `docs/investigacion/tos-clis.md` 7/9 curados; LICENSE cruda archivada con hash `23cc68e1…` en `datos/fuentes/tos/kimi-code/` |
| 2026-08-22 | F3 | Sandbox cline + kimi-code habilitados e introspectados | 0.5 | 0.5 | 0 | `Dockerfile.cline` (debian-slim glibc — el binario bun-compiled no corre en alpine/musl, hallazgo documentado) + rebuild kimi 0.38.0; `--version`/`--help` OK; parser RE_GEN sin cambios (15 comandos cline, 10 kimi); `BINARIO` +cline/kimi; vigilancia F3_SEMANALES extendida; primera introspección real: 15+0 nuevos (idempotente), eventos Evidentia |
| 2026-08-22 | H6b | CE-T6 — Probe claude-code (read-only projects/*.jsonl) | 0.5 | 0.5 | 0 | `--cli claude-code` sobre 158 sesiones reales: 4 ok / 1 parcial / 2 nd (turnos por stop_reason 1679, prompts 12687 excluyendo isMeta/isSidechain, api_errors 52, compact_boundary 8); enum schema +claude-code (contrato aditivo, specs a 5 CLIs); gate privacidad 0 matches; evidencia `docs/investigacion/probes/claude-code-2026-08-22.md`; DECISION_ADAPTADORES extendida (21 ok/5 parcial/9 nd, 35 celdas) — **los 5 CLIs principales con ficha viva + diario mapeado** |

**Inventario tras el paquete:** 9 CLIs (7 con ToS curado, 6 introspectables: 3 diarios + 3 semanales), 112 comandos, 188 modelos. Pendientes ToS: grok-build (xAI inaccesible), antigravity.

**Desviación registrada (2026-08-21, sin ticket previo — anotación aditiva).** El commit `466af40` incluye `docs/investigacion/Propuesta_Harness_Runtime_Assurance.md` (168 líneas), archivo **fuera del alcance declarado en su propio mensaje** y **sin decreto del Mediador**: es una propuesta en estado `PROPUESTA EN CONSENSO` cuyas 6 preguntas del §11 siguen abiertas. Causa: el Ejecutor compuso el commit con `git add -A`, que selecciona por ausencia de exclusión en lugar de por intención; la propuesta estaba sin trackear esperando autorización y entró en el lote. El mensaje de `466af40` queda inexacto de forma permanente; esta entrada es su corrección auditable.

**Reparación decidida:** aditiva, no destructiva. Se descarta reescribir la historia (`rebase` + `push --force`) por tres razones: (1) `466af40` ya está en `origin/main`, así que exigiría force-push sobre historia publicada — autoridad distinta de la que se otorgó para el push; (2) la norma **N3** del corpus de la propia propuesta lista `force-push` como arquetipo de daño irreversible; (3) la doctrina del repo para este caso es aditiva y ya está escrita (contrato v0 solo-aditivo tras F2; AN-KLA `refute`/`supersede` conservan el record original). Se verificó además que los checkpoints firmados anclan el `merkle_root` de Evidentia y **no** hashes de commit, por lo que ni la reescritura habría corrompido la cadena criptográfica ni esta anotación la altera. Ticket de higiene derivado: `docs/planning/tarjeta-higiene-staging-git.md`.

| 2026-08-22 | higiene | tarjeta-higiene-staging-git ejecutada (decreto "adelante") | 0.25 | 0.5 | +0.25 | Regla AGENTS.md §Git (staging por ruta explícita, prohibido `add -A`/`.`/`-a`); gate `scripts/hooks/commit-msg` + `scripts/instalar_hooks.sh`. **DoD 6/6 por ejecución** (sin cita → rechaza; citado/edición/allow-list → pasa). Desviación +0.25: hallazgo real — git 2.50 corre `pre-commit` antes de escribir `COMMIT_EDITMSG` (y antes que `prepare-commit-msg`), verificado por ejecución con hooks de debug; el gate vive en `commit-msg` (recibe el mensaje como $1, fail-closed si ilegible). Cuenta como primer dato del censo HRA: L3 verificada, no L4, declarada en la propia tarjeta |

---

## H7 — Harness–Runtime Assurance (DECRETADO 2026-08-22: "adelante con recomendaciones" — las 6 del §11)

Propuesta: `docs/investigacion/Propuesta_Harness_Runtime_Assurance.md` v0.2 (decretos incorporados). Fase 1 pasiva; T4 activo diferido; solo documento; 5 CLIs × 8 normas; N9 como gate global.

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-22 | H7 | T0 — Taxonomía L1–L4 formal + matriz de decisión | 0.5 | 0.5 | 0 | `docs/investigacion/hra/taxonomia-l1-l4.md`: criterios binarios por peldaño (fronteras L1/L2 y L2/L3 explícitas), reglas de asignación (fail-closed, máximo con lista, N9 cap), formato de celda, 5 prohibiciones del clasificador; caso especial aprobación interactiva = L2/L3 nunca L4 |
| 2026-08-22 | H7 | T1 — Corpus congelado + schema `escrubery/assurance/v0` + validador | 0.5 | 0.5 | 0 | `datos/schemas/assurance-v0.schema.json` (draft 2020-12, `additionalProperties:false`, corpus_id congelado, `enforcement_verificado` en mecanismos L4, N9 gate obligatorio); validador `backend/src/hra/assurance.ts` (ajv + self-hash patrón T4b + `calcularDistribucion` con capa N9); 11 specs (enum 5 CLIs, prop extra, 7 normas ≠ 8, corpus alterno, hash reproducible e independiente del orden, capa N9 L4→L3); CI LOCAL VERDE |
| 2026-08-22 | H7 | T2 — Censo: 40 celdas clasificadas (5 CLIs × N1–N8, evidencia citable) | 1 | 1 | 0 | Fichas `datos/fichas/curaduria/assurance_{claude-code,codex-cli,opencode,cline,kimi-code}.json` (schema válido, self-hash sellado, fail-closed vía `npm run hra:sellar`). Vector total: L1:1 L2:1 L3:14 L4:4 pend:20. Evidencia por celda con URL+fecha (docs oficiales + 2 subagentes de investigación + eventos Evidentia); ausencias documentadas marcadas `sin_garantia_documentada` (hallazgo: corpus v1 necesita estado propio ≠ sin_medir) |
| 2026-08-22 | H7 | T3 — Reporte público del censo | 0.5 | 0.5 | 0 | `docs/investigacion/hra/reporte-censo-2026-08-22.md`: vector por CLI con frases legibles (sin escalar, decreto errata 1); hallazgos: N9 divisor de aguas (codex cerrado a nivel SO vs kimi con skill /update-config integrado), aprobación interactiva = L3 y cline la elimina por defecto (auto-approve true + clasificación autorreportada por el modelo = L1), N7 presupuesto hueco transversal; limitaciones honestas (documental no experimental, perfiles únicos) |
| 2026-08-22 | H7 | T3b — Endurecimiento post-adversarial (MED-1/2/3/5 + LOW-1/2) | 0.25 | 0.5 | +0.25 | **Adversarial H7 (subagente independiente): `proceed`** — 8 celdas verificadas contra fuentes (todas defienden, citas literales), conflicto de interés claude-code resuelto ANTI-inflación, coherencia exacta al re-conteo. Fixes: cita codex N1 sustituida por la literal (MED-1); `hra:sellar` compara contra `calcularDistribucion` re-calculada, no solo suma — detecta distribución mentirosa re-sellada (MED-2); schema `const: false` para `enforcement_verificado` + spec que la prueba de verdad (MED-3); casos fronterizos documentados en taxonomía §6 (MED-5); paráfrasis marcada (LOW-1), mecanismo N8 claude endurecido a aprobación de red (LOW-2). Bug propio encontrado y corregido en el camino: exclusión de `procedencia` por tipo (no valor) hacía el self-hash inestable — destructuring real. Desviación +0.25 por ese re-trabajo. MED-4 (hash de evidencias web) PENDIENTE DE DECRETO del Mediador |

**Cierre H7 (decreto del Mediador 2026-08-22):** MED-4 decretado — evidencias web con cita+URL+fecha (excepción documentada a regla dura #1, mismo criterio que tos-clis; eventos Evidentia conservan hash). **Totales H7: 2.75 ciclos est / 3.25 reales / desviación +0.5** (T0 0.5/0.5, T1 0.5/0.5, T2 1/1, T3 0.5/0.5, T3b 0.25/0.75 — T3b absorbió el bug del self-hash inestable). Entregables: taxonomía L1–L4, schema assurance/v0 (11 specs), 5 fichas selladas fail-closed, reporte público del censo (vector L1:1 L2:1 L3:14 L4:4 pend:20). H7-T4 (verificación activa en sandbox) diferido a decreto propio. Pendiente de Mediador: notificación cruzada a skopos/Scripting (decreto §11.6: al existir el reporte, ya aplica).

| 2026-08-22 | vínculo | Notificación cruzada a skopos (decreto §11.6, "propuesta 4") | 0.25 | 0.25 | 0 | skopos: `docs/evidencia/insumo-escrubery-2026-08-22.md` (nota informativa no vinculante: reporte HRA + DECISION_ADAPTADORES como insumo directo de la familia de parsers ADR-010; frontera §9 intacta; permalink 6ce8efa); escrubery: línea de notificación recíproca en el reporte. Sin commit en skopos (su proceso decide) |

---

## H8 — Memoria enforcada: piloto AN-KLA en 3 piezas (decreto 2026-08-22, "propuesta 1 como prueba")

| Fecha | Fase | Ticket | est. | reales | desv. | Evidencia |
|---|---|---|---|---|---|---|
| 2026-08-22 | H8 | T1+T2 — Inyección SessionStart + gate PreToolUse (claude-code) + verificación 4/4 | 0.5 | 0.5 | 0 | `scripts/hooks-spike/ankla_{session_start,pre_tool_use}.sh` + `.claude/settings.json`; DoD por ejecución: E1 inyecta contexto legible (objetivo/fase/next/records, declara "dato no confiable") + sella ok; E2 write con sello → exit 0; E3 sesión nueva sin sello → exit 2 + lazy-inject + reintento pasa; E4 sello degraded → pasa con aviso (fail-open). Hallazgo honesto: checkpoint interno viejo (rev 31, v0.3.0) — la inyección lo declara y apunta a bitácora como canónico |
| 2026-08-22 | H8 | T3 — Plugin opencode `ankla_gate.ts` (gate viable, inyección no documentada) | 0.25 | 0.25 | 0 | `.opencode/plugins/ankla_gate.ts`: `tool.execute.before` con throw (API confirmada en docs oficiales, patrón del ejemplo .env-protection) + `session.created` ejecuta AN-KLA y sella; comparte log/sellos con bash. Limitación declarada: sin vía documentada de inyección al contexto en opencode → pieza 1 parcial (ejecución sin contexto). E2E real: la próxima sesión de opencode en este repo dejará evidencia viva en el log |
| 2026-08-22 | H8 | T4 — Auditor + receta en an-kla-memory | 0.25 | 0.25 | 0 | `scripts/hooks-spike/ankla_auditoria.sh` (reporte: inyecciones arranque vs lazy, bloqueos, degradaciones, % escrituras con memoria previa) — ejecutado OK; receta `docs/integrations/enforcement.md` colocada en an-kla-memory (sin commit — su proceso), con no-claims (L3 no L4; presencia ≠ comprensión; lazy no inyecta contexto) |
| 2026-08-22 | H8 | T5 — e2e vivo en sesión real de claude-code (cierre del pendiente natural) | 0 | 0.25 | +0.25 | `docs/investigacion/ankla-e2e-2026-08-22.md`. Sesión `6df739c3…` abierta por el Mediador: hook `SessionStart` corrió solo → `session_start_inject` (4078 bytes) + sello `ok`; escritura real con `Write` → `gate_pass` en el log (camino de aprobación en condiciones reales; el de bloqueo ya estaba verificado en T1+T2). Auditor: 5 eventos, 3 sesiones, `escribieron_sin_memoria_previa: 0`. **Staleness confirmado en vivo:** el checkpoint inyectado sigue en v0.3.0 con el repo en v0.5.0+H6b/H7/H8 — la advertencia MED-3 funcionó (declaró el desfase y apuntó a la bitácora). Sigue pendiente opencode (`ejecucion_al_crear_opencode: 0`) y MED-1 (escrituras vía Bash fuera del matcher) |
| 2026-08-22 | H8 | T6 — Fix plugin opencode: `session.created` era código muerto + inyección real de contexto | 0.25 | 0.25 | 0 | El estreno vivo (sesión `ses_fd7ecd99…`) dejó **cero `session_created_exec`**: el plugin registraba `"session.created"` como hook directo y la interfaz `Hooks` no tiene esa clave (verificado contra tipos locales `@opencode-ai/plugin` 1.18.21) — los eventos del bus van por el hook genérico `event`. Pieza 2 verificada en vivo (write bloqueado → lazy → reintento pasa). Fix: suscripción vía `event` filtrando `type`; inyección de contexto vía `experimental.chat.system.transform` (la "sin vía documentada" de T3 también cayó) con formato/advertencias en paridad con claude-code, una vez por sesión; sello con `used_bytes`. Evidencia: `T6_RUNTIME_OK` (código real del plugin, node+shim de 3 APIs Bun): session_created_exec 4078 bytes + sello emitido; system_inject una sola vez (sin duplicar); lazy bloquea→pasa; evento ajeno ignorado; test-* saneados con `--limpiar-test`. **Claim corregido en T7:** el sello de `session_created_exec` NO acreditaba a la sesión (cayó en `sin-session-id.seal`); decir "sello ok" fue sobreventa. Pendiente entonces: confirmación viva tras reiniciar opencode; receta enforcement.md de an-kla-memory dice "lazy no inyecta" — actualizarla es acción en aquel repo |
| 2026-08-22 | H8 | T7 — Refresco del checkpoint + binding de session_id + presupuesto escalado | 0.25 | 0.5 | +0.25 | Decreto del Mediador "adelante con tus propuestas" tras preguntar si la inyección de arranque había servido. **Hallazgo 1 (carga podrida):** la tubería inyectaba, pero el checkpoint seguía en rev 31 / v0.3.0 con el repo en v0.5.0+H7+H8 — la métrica `escribieron_sin_memoria_previa: 0` cuenta bytes presentes, no vigencia. Checkpoint reescrito vía `checkpoint plan`→`commit` gobernado (rev 40, `sha256:24f5e919…`, authority `model_derived` con evidencia hasheada de bitácora/AGENTS/log; decision `write`, transaction `6da74e4f…`). **Hallazgo 2 (regresión que el propio refresco destapó):** con el checkpoint nuevo `resume --budget 4096` falla ENTERO (`budget_too_small_for_resume_snapshot`, no trunca) → ambas piezas lo leían como "AN-KLA caído" y no inyectaban nada. Fix: presupuesto escalado 16384→65536 con evento `budget_escalado`, en hook bash y plugin. **Hallazgo 3 (claim falso de T6):** el plugin leía `properties.info.sessionID`, pero el tipo `Session` del SDK expone `id` — el sello caía SIEMPRE en `sin-session-id.seal` y no acreditaba a nadie. Fix: lectura de `info.id`; sin id NO se emite sello (`session_created_sin_sid`) y la remediación queda a la vía lazy, que sí recibe `sessionID`; el fallback anti-bucle sobrevive sólo en el gate, aislado en `sellarGate()` y declarado con `gate_sin_sid`. Verificación por ejecución: hook bash real (sello ok, 13754 bytes) + `T7_RUNTIME_OK` 14/14 (código real del plugin, node+shim — el runtime Bun nativo sigue pendiente). Limitación nueva declarada: `--limpiar-test` filtra por prefijo `test-*` y no alcanza los eventos que se registran bajo `sin-session-id`, así que 3 eventos del arnés T7 quedan en el log de auditoría; se conservan (no se reescribe evidencia) |
| 2026-08-22 | H8 | T7b — Fix falso positivo de inyección: la entrega es por llamada LLM, no una vez por sesión | 0 | 0.25 | +0.25 | Decreto del Mediador sobre la propuesta T7b. **Hallazgo (refuta el "system_inject ok" de T7):** la PRIMERA llamada LLM de una sesión de opencode puede ser la generación del título, no el turno del usuario — el flag "inyectado una vez por sesión" (semántica porteada de SessionStart de claude-code) consumía la inyección allí y el modelo principal nacía SIN memoria mientras el log acreditaba entrega. Detectado en vivo: la sesión de análisis `ses_fd7d6ac…` no recibió el bloque pese al `system_inject` logueado 40 ms tras crear la sesión (tiempo de title-gen, no de turno). **Fix:** inyección en CADA `system.transform` con dedup por contenido (marca `[memoria AN-KLA`); el log registra el modelo consumidor (mini-fix: el tipo `Model` del SDK expone `id`, no `modelID` — salía `zai-coding-plan/?`). Evidencia: `T7B_RUNTIME_OK` 10/10 (node+shim; núcleo: segunda llamada con array nuevo SÍ recibe el bloque — la regresión T7 — y el mismo array no duplica) + **confirmación viva en runtime Bun nativo**: dos probes `opencode run` (sesiones `ses_fd7ce285…` y `ses_fd7cb1d7…`) con `session_created_exec` 13754 bytes y `system_inject` ×2 atribuidos a `zai-coding-plan/glm-5.2` respondieron `SI-INYECTADA`. **Blocker `opencode-vivo` CERRADO.** Nota de costo: los probes consumen dos llamadas reales al modelo. |

**Totales H8: 1.5 ciclos est / 2.25 reales / desviación +0.75** (T5 y T7b sin estimación previa: pendientes naturales destapados por la ejecución, no tickets planificados). El e2e de claude-code quedó **cerrado por ejecución** (T5). El e2e de opencode **ocurrió (T6) y refutó el claim de arranque de T3**; T7 refutó a su vez el claim de sellado de T6 y descubrió que el refresco del checkpoint rompía la inyección por presupuesto; T7b refutó el claim de entrega de T7 (title-gen consumía la inyección) y cerró con la confirmación viva en runtime Bun nativo que faltaba. Sigue abierta la respuesta de ektel a la propuesta de intercambio (relacionada: sus G-gates).

**Adversarial H8 (subagente independiente): `fix-and-retry` → fixes aplicados.** Hallazgos: HIGH-1 plugin opencode filtraba por permiso ('edit') en vez de tool-id — dejaba pasar **write y patch** (la creación de archivos), claim central falso para opencode; HIGH-2 sin mkdir del gate-dir en clon fresco → bloqueo en loop. Fixes: filtro por tool-id {edit,write,patch}; ensureGateDir() en arranque del plugin y sellar(); append atómico del log via spawn (MED-5); sello JSON inválido → fail-closed a lazy, no pass (MED-2, también en script bash); used_bytes sanitizado a entero; advertencia de vigencia/staleness en la inyección (MED-3: el checkpoint rev 31 está desactualizado y ahora la inyección lo grita); --limpiar-test implementado (LOW); receta enforcement.md corregida (el claim falso ahora documenta el hallazgo). Re-verificación 6/6 post-fix por ejecución (incluye ataques del adversarial: sello inválido, Bash sin matcher). MED-1 (escrituras vía Bash fuera del gate) queda como limitación de alcance declarada en la receta — extender el matcher es decisión del Mediador. MED-4 (evidencia E2-E4 no quedó en log original): la verificación post-fix SÍ dejó log, luego --limpiar-test lo saneó.
