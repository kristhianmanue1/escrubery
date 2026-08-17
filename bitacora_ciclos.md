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
