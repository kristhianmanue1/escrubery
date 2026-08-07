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

**Notas:**
- Las fichas de CLI son 7 y no 6 porque Grok CLI (comunitario) y Grok Build (oficial) se distinguen explícitamente, como exige la regla de gobernanza.
