# Plan: Deuda de verificación propia y operación continua (inter-fase, pre-F3)

**Contexto:** el análisis crítico de 2026-08-10 detectó que el servicio verifica hechos de terceros pero no se verifica a sí mismo (tests ≈ 0, sin CI, sin scheduler, datos que envejecen en silencio, contrato congelado con operaciones no implementadas). Este plan cierra esa deuda **antes de abrir F3**. **Fecha:** 2026-08-10. **Estado:** **decretado por el Mediador (2026-08-10)** tras adversarial `proceed` (ronda 2); licencia decidida: **Apache 2.0**. **Fase del plan v2:** transversal (refuerza F1/F2; prerequisito de confianza para F3). **Fuente:** iniciativa del Mediador.

## Objetivo y criterio de cierre

- **Objetivo:** que la verificación del propio sistema sea automatizada y repetible (tests + CI + JCS conforme RFC), que la operación prometida exista en continuo (scheduler de pollers/alertas, caducidad de datos), y que el contrato y las métricas digan la verdad.
- **Cierre global:** adversarial `proceed` por hito + decreto del Mediador; `npm test` verde en CI; vigilancia diaria instalada con evidencia de una corrida real; contrato coherente con la implementación.

## Hallazgo del adversarial-1 que condiciona todo el plan

La **implementación ya diverge del contrato congelado §3.1/§3.2**, independientemente de las operaciones §3.4/§3.5: `consultar_modelo` omite `pesos_abiertos`, `precios.cache_lectura_por_millon` y `precios.tarifa_vigente_desde`, y añade `vigente_hasta` no declarado (`backend/src/consultas/modulo.ts:82-106`); `consultar_comando_cli` añade `nombre_display` (`modulo.ts:155`). Por eso **T4a (errata) es prerequisito de T1b (golden)**: primero se alinea contrato ↔ implementación, después se fosiliza el shape corregido. Sin ese orden, los tests golden fijarían como "correcto" lo que contradice el contrato.

## Hitos (cada uno dispara ronda adversarial, §6)

- **H1 — Verificación propia automatizada:** `npm test` verde con specs de Evidentia (cadena/firma/verificar/clasificador), golden del shape post-errata y JCS validado contra test vectors RFC 8785. [cerrado por decreto del Mediador 2026-08-17; adversarial proceed r6]
- **H2 — Operación continua:** pipeline CI definido y verde, vigilancia diaria (pollers + alertas) instalada con log de corrida real, y caducidad `vigente_hasta` corregida y activa con degradación visible. [adversarial-ok 2026-08-17 con MEDs aplicados; primera corrida del CI requiere push; instalación launchd es acción del Mediador; cierre sujeto a decreto]
- **H3 — Contrato y métricas honestas:** contrato v0 coherente con lo implementado (errata completa), métrica F1 publicada desde `consultas_log`, LICENSE presente. [pendiente]

## Tareas y contratos

### Contrato T4a — Errata completa del contrato v0 (PREREQUISITO de T1b)

**Presupuesto de contexto:** cabe holgado.
**Entradas:** `docs/CONTRATO_API_v0.md`, `backend/src/consultas/modulo.ts`, `docs/CONSUMO_INTERNO.md`, `backend/src/mcp/server.ts`.
**Salidas:** contrato actualizado (cambios aclaratorios/aditivos; nada implementado se retira).

DoD:
- [ ] **§3.4/§3.5 → §5:** `resolver_identidad_modelo` y `politica_datos_proveedor` figuran solo en §5 "Operaciones previstas fuera de v0", con nota de errata fechada 2026-08-10 que declara que se publicaron sin implementación.
- [ ] **§3.1/§3.2 alineados con la implementación:** los campos extra (`vigente_hasta` en §3.1, `nombre_display` en §3.2) se documentan como aditivos; los omitidos (`pesos_abiertos`, `precios.cache_lectura_por_millon`, `precios.tarifa_vigente_desde`) se documentan como no disponibles en v0 (`null`/ausentes) con la misma nota de errata. Si el Mediador prefiere *implementar* los omitidos en vez de documentarlos, se abre ticket aparte y la errata lo referencia.
- [ ] `docs/CONSUMO_INTERNO.md` y las tools MCP verificados: ninguna superficie promete operaciones no implementadas.
- [ ] Ticket de seguimiento registrado (T4b, abajo).

### Contrato T1a — Specs Jest de Evidentia

**Presupuesto de contexto:** cabe holgado.
**Entradas:** `backend/src/evidentia/{event_log,jcs,clasificador,verificar,firmar,probar_cadena,probar_firma}.ts`.
**Salidas:** `backend/src/evidentia/*.spec.ts` (fixtures inline o bajo `backend/src/evidentia/fixtures/`, exentos si generados).

DoD:
- [ ] `cd backend && npm test` exit 0, incluyendo specs que cubren: cadena OK y cadena rota (`prev_hash` alterado → falla), firma verifica y firma falla con payload alterado, verificador fail-closed sin keyring, clasificador asigna las 7 categorías (6 reglas + default `ruido_irrelevante`) con casos representativos.
- [ ] CI siempre levanta PostgreSQL (ver T3): los specs de BD **no** se excluyen en CI. Para desarrollo local sin BD se documenta el mecanismo de exclusión (p. ej. `describe` condicional a env var) en el encabezado del spec.
- [ ] Los scripts `probar_*` se conservan como demos manuales o se retiran (decisión registrada en el ticket); ningún comportamiento de producción cambia.
- [ ] `python3 scripts/check_sizes.py` verde (desde la raíz del repo).

### Contrato T1b — Golden del shape implementado post-errata (consultas)

**Presupuesto de contexto:** cabe holgado. **Depende de T4a.**
**Entradas:** `backend/src/consultas/modulo.ts`, `backend/src/feedback/modulo.ts`, `docs/CONTRATO_API_v0.md` (ya con errata T4a), migraciones `backend/db/`.
**Salidas:** `backend/src/consultas/*.spec.ts` + fixtures semilla (BD de test).

DoD:
- [ ] Golden JSON por operación implementada (`listar`, `ficha`, `modelo`, `comando`, `oficialidad`, `reportar_feedback`): un cambio de shape rompe el test. **Nota de alcance:** los golden protegen el congelamiento del shape *vigente tras la errata T4a*; la conformidad contrato ↔ implementación la garantiza T4a, no este ticket.
- [ ] Cada golden incluye el bloque `procedencia` completo y `cli_producto.tipo` en respuestas de CLI (regla de gobernanza).
- [ ] `cd backend && npm test` exit 0.

### Contrato T2 — JCS conforme a RFC 8785

**Presupuesto de contexto:** cabe holgado.
**Entradas:** `backend/src/evidentia/jcs.ts`, test vectors oficiales (anexos de RFC 8785 / suite de `canonicalize`).
**Salidas:** `backend/src/evidentia/jcs.spec.ts` con los test vectors; si alguno falla, sustituir por el paquete `canonicalize` (decisión y diff en el mismo ticket).

DoD:
- [ ] Test vectors oficiales pasan, incluidos: serialización de números con exponente (`1e21`, `1e-7`, `0.1`), `-0` → `0`, strings con unicode/escapes, ordenamiento de claves por code unit UTF-16 (par surrogate incluido). *(El adversarial-1 estima probable que la implementación actual pase — V8 sigue `Number::toString` y los umbrales coinciden con la RFC; el ticket valida, no presupone fallo.)*
- [ ] Si se adopta `canonicalize`: `docs/CONTRATO_API_v0.md` §2.3 actualizado en el mismo ticket (regla dura 7).
- [ ] Test de ida y vuelta: payload firmado en TS verifica tras re-canonicalizar (guarda contra regresión del round-trip por BD ya conocido).

### Contrato T3 — CI mínimo (GitHub Actions)

**Presupuesto de contexto:** cabe holgado.
**Entradas:** `backend/package.json`, `scripts/check_sizes.py`, `docker-compose.yml`.
**Salidas:** `.github/workflows/ci.yml` (< 100 líneas).

DoD:
- [ ] Workflow: build + lint + `npm test` + `python3 scripts/check_sizes.py`, **con servicio PostgreSQL siempre activo** para los specs de BD (no hay exclusión de specs de BD en CI).
- [ ] Verificación local previa (gate sin CI, política §5), desde la raíz del repo: `cd backend && npm run build && npx eslint "{src,apps,libs,test}/**/*.ts" && npm test` exit 0, luego `cd .. && python3 scripts/check_sizes.py` exit 0. **Ojo:** `npm run lint` lleva `--fix` y muta archivos; el gate usa `npx eslint` sin `--fix` para no enmascarar problemas ni ensuciar el working tree.
- [ ] **Residual del adversarial H1 (2026-08-17):** `backend/src/evidentia/fixtures/test_db.ts` hardcodea el nombre `escrubery_test` en `asegurarBdCreada` aunque `ESCRUBERY_TEST_DATABASE_URL` sea configurable — al definir la URL de CI (T3), alinear el nombre de la BD a crear/migrar con la URL (derivarlo de ella).
- [ ] Nota al Mediador: la activación real requiere push (acción del Mediador); si el repo no usa GitHub, adaptar a CI equivalente o dejar el gate local documentado en `AGENTS.md`.

### Contrato T5 — Vigilancia diaria (pollers + alertas)

**Presupuesto de contexto:** cabe holgado.
**Entradas:** `backend/src/evidentia/{poller_github,poller_vulnerable_mcp,alertas}.ts`, `docs/investigacion/tos-clis.md`.
**Salidas:** `scripts/vigilancia_diaria.sh` + archivo de estado (timestamp de última corrida, fuera de git o gitignored) + instrucciones de instalación launchd en doc corta.

DoD:
- [ ] El script corre pollers con la cadencia del plan v2 §5.1 (diario: opencode, claude-code, codex-cli; semanal: resto) + `evidentia:alertas`, y deja log fechado.
- [ ] **Exit codes diferenciados:** `0` OK sin alertas; `10` hay alerta `fix_seguridad`/`breaking_change` en la ventana de 24 h (señal operativa); `2` BD inalcanzable u otro fallo de infraestructura (precheck `pg_isready`/`docker compose`, con mensaje claro). Nunca se mezcla "alerta real" con "infra caída".
- [ ] El log marca qué alertas son **nuevas desde la última corrida** (comparando contra el archivo de estado); el exit 10 se dispara por cualquier alerta en ventana (no solo nuevas) para no silenciar alertas no atendidas.
- [ ] Corrida de prueba real ejecutada y log presente como evidencia, incluido el caso BD caída → exit 2 (logs exentos de tamaño, §3).
- [ ] Instalación launchd documentada con comando concreto; la instalación efectiva es acción del Mediador.
- [ ] Sin token de GitHub: cadencia conservadora (60 req/h) respetada; si se requiere token, va como insumo del Mediador.

### Contrato T6 — Caducidad de datos: corregir `vigente_hasta` + refresco LiteLLM

**Presupuesto de contexto:** cabe holgado.
**Entradas:** `backend/src/db/ingestar.ts` (⚠️ ya puebla `vigente_hasta` con `fecha_deprecacion` en las líneas ~159 y ~177 — **bug semántico pre-existente**: deprecación ≠ TTL de vigencia; este ticket lo **corrige**, no lo introduce), `backend/src/db/schema.ts`, `backend/db/migrations/001_nucleo_fase0.sql` (`modelos.vigente_hasta` **ya existe** desde la migración 001), `backend/src/consultas/modulo.ts`, `scripts/generar_fichas_modelos.py`.
**Salidas:** corrección en ingesta, **migración nueva que añade `vigente_hasta` a `cli_comandos`** (esa tabla no la tiene), cambios en consulta, script de refresco + spec, y actualización del contrato (mismo ticket, regla dura 7).

DoD:
- [ ] Ingesta puebla `vigente_hasta = fecha_obtencion + ventana` según plan v2 §4.2 (24 h precios/modelos, 7 días comandos CLI), sustituyendo el uso de `fecha_deprecacion` (columna propia o descarte: **decisión del Mediador en el ticket, registrada antes del cierre de T6**).
- [ ] Migración aditiva añade `vigente_hasta` a `cli_comandos` y la ingesta de comandos la puebla con la ventana de 7 días.
- [ ] Consulta sobre dato expirado devuelve el dato con `estado_verificacion: pendiente_de_verificar` + campo de advertencia (nunca lo sirve como confirmado; `null` antes que inferir sigue intacto).
- [ ] **`docs/CONTRATO_API_v0.md` actualizado en el mismo ticket:** el campo de advertencia (aditivo) queda documentado en §3.1/§3.2 y en §2.1 si aplica (regla dura 7).
- [ ] Refresco LiteLLM idempotente: descarga → hash → regenera fichas → re-ingesta; re-ejecutarlo sin cambios no altera hashes.
- [ ] Spec que siembra un dato con `fecha_obtencion` vieja y verifica la degradación; `npm test` verde.

### Contrato T7 — Métrica F1 real + convención de desviación honesta

**Presupuesto de contexto:** cabe holgado.
**Entradas:** tabla `consultas_log`, `bitacora_ciclos.md`, `docs/plantillas-agente.md`.
**Salidas:** tarea npm `metricas:f1` (script nuevo, query sobre `consultas_log`), entrada en bitácora, nota de convención.

DoD:
- [ ] `cd backend && npm run metricas:f1` imprime % por `servido_desde` con conteos reales; salida pegada en bitácora como primera medición. **Nota de honestidad:** `fuente_externa` saldrá 0 % — la implementación actual solo registra `bd`/`sin_datos`; el patrón caché-al-consultar del plan v2 §4.2 aún no está implementado y la métrica debe decirlo.
- [ ] `sin_datos` reportado aparte como señal de demanda (plan v2 §4.5).
- [ ] Convención añadida al encabezado de `bitacora_ciclos.md`: la desviación registra re-trabajo (p. ej. fix-and-retry de adversarial) como fracción de ciclo; desviación 0 sistemática se trata como señal de estimación inválida.
- [ ] Nota en la bitácora reconociendo que este plan es proceso puro (0 entregable de producto nuevo) y que F3 puede iniciar su preparación restante en paralelo a H2/H3 si el Mediador lo decide — el ratio proceso/producto queda como decisión registrada, no como deriva.

### Contrato T8 — LICENSE + desviaciones conocidas documentadas

**Presupuesto de contexto:** cabe holgado.
**Entradas:** `README.md`, `docs/CONSUMO_INTERNO.md`, `bitacora_ciclos.md`.
**Salidas:** `LICENSE` (**Apache 2.0 — decidida por el Mediador 2026-08-10**; justificación: §3 cesión de patentes protege el esquema Evidentia y a quien lo adopte, §5 términos de contribución explícitos ante contribuciones de agentes operados por terceros, §6 protección de marca si D4 termina en producto; antes de cerrar el ticket, verificar coherencia con las licencias del ecosistema CAGF/expertoGobernanza), README actualizado, notas de desviación.

DoD:
- [ ] `LICENSE` presente y `README.md` ya no dice "Por definir".
- [ ] Nota en `docs/CONSUMO_INTERNO.md`: HTTP sin auth ni rate-limit en alpha interna (desviación conocida frente al `429` del contrato); se resuelve en F5 o antes si se expone fuera de localhost.
- [ ] Nota en `bitacora_ciclos.md` (sección F3 preparación): alcance de introspección diaria = opencode/claude-code/codex-cli (ToS curados); grok-build/kimi-code/antigravity/cline/grok-cli-community excluidos hasta resolver D1 para ellos.

## Tareas diferidas (fuera de este plan)

- **T4b — Implementar `resolver_identidad_modelo` (y `politica_datos_proveedor`):** funcionalidad nueva, no deuda. Requiere plan propio con los requisitos de expertoGobernanza (ADR-0002) y entra como versión aditiva del contrato. Se agenda tras H3 o en paralelo a F3, a decisión del Mediador.
- **T4c — Endurecimiento de validación y UX del CLI (registrado 2026-08-17 en el adversarial de T4a):** (a) validar enum `tipo` y `agente_reportante.id` obligatorio real en HTTP/CLI (hoy el MCP degrada id ausente a `'desconocido'`, server.ts:189); (b) distinguir exit de fallo fatal de infraestructura del exit 1 `sin_datos` en el CLI; (c) alinear el usage `listar [clis|proveedores]` con el comportamiento. Mini-ticket, ~0.5 cic; puede fusionarse con T1b si el Mediador lo aprueba.
- **Numeración:** T4 se descompone en T4a (errata, este plan), T4b (implementación §3.4/§3.5) y T4c (validación/UX, adversarial T4a); no existe T4 "a secas".

## Orden recomendado

**T4a primero** (desbloquea T1b y es la corrección más barata y visible para consumidores) → T1a → T1b → T2 (cierran H1) → T3 (abre H2) → T5 ∥ T6 (cierran H2) → T7 ∥ T8 (H3).

**Gate adversarial de T4a:** aunque pertenece conceptualmente a H3, se verifica adversarialmente en el gate de **H1** (junto con T1a/T1b/T2, que dependen de ella); H3 hereda la errata ya verificada y no la re-abre.

## Estimación (ciclos)

| Tarea | Est. |
|---|---|
| T4a | 0.5 |
| T1a | 1 |
| T1b | 1 |
| T2 | 0.5 |
| T3 | 0.5 |
| T5 | 1 |
| T6 | 1 |
| T7 | 0.5 |
| T8 | 0.5 |
| **Total** | **6.5** |

La bitácora registrará reales vs. estimados con la convención nueva de T7 (primera prueba de esa convención: si todo vuelve a salir desviación 0, la métrica se declara inválida).

## Riesgos / supuestos

- **JCS casero puede no ser conforme** en casos borde de números → T2 lo decide con test vectors; adoptar `canonicalize` es barato y se asume si hace falta.
- **Scheduler depende de la máquina del Mediador** (BD local en docker-compose) → T5 incluye precheck y exit codes que distinguen infra caída de alerta real; la métrica <24 h solo se declara operativa tras la primera corrida instalada.
- **Congelamiento del contrato:** las erratas T4a/T6 son aclaratorias o aditivas (nada implementado se retira); si el Mediador prefiere implementar lo faltante en vez de documentarlo, T4b absorbe el trabajo y T4a se reduce a §3.4/§3.5.
- **Sobre-alcance (§12.1 del plan v2):** ningún ticket toca F3; la introspección activa sigue bloqueada por sus propios criterios de entrada.
- **Este plan es proceso puro** (riesgo "proceso se convierte en producto"): mitigado con la nota de T7 y la opción explícita de paralelizar F3 tras H1.

## Insumos requeridos del Mediador

1. ~~**Decisión de licencia** (T8)~~ ✅ **Decidida: Apache 2.0** (2026-08-10, justificación registrada en T8).
2. **Decisión T4a:** documentar campos omitidos como no disponibles (recomendado) vs. implementarlos (crece el plan).
3. **Instalación de la vigilancia** (T5): correr el instalador launchd en su máquina.
4. **Push para activar CI** (T3).
5. **Token GitHub de mínimo privilegio** (opcional, T5).

## Registro adversarial

| Ronda | Revisor | Decisión | Hallazgos | Resultado |
|---|---|---|---|---|
| 1 (2026-08-10) | Subagente fresco, modelo glm-5.2 (decorrelación vs. autor kimi) | `fix-and-retry` | 2 BLOCKER (T1b fosilizaría shape divergente del contrato; T6 añade campo sin actualizar contrato), 4 HIGH (`vigente_hasta` ya existe y se puebla con `fecha_deprecacion`; `cli_comandos` sin columna; T5 sin distinción BD caída vs. alerta; T3↔T1a contradictorios sobre BD en CI), 3 MED, 2 LOW | Correcciones aplicadas: T4a ampliada a errata completa y puesta como prerequisito de T1b; T6 corregida (bug semántico, migración `cli_comandos`, contrato en el mismo ticket); T5 con exit codes 0/10/2 y estado de corrida; T3/T1a unificados (CI siempre con Postgres; gate lint sin `--fix`); notas de numeración T4 y proceso-puro; gate de comandos corregido (raíz, `npx eslint`). |
| 2 (2026-08-10) | Mismo revisor (resume; verifica correcciones) | **`proceed`** | Los 11 hallazgos de r1 verificados como resueltos con evidencia línea por línea; sin BLOCKER/HIGH nuevos. 3 residuales aplicados en esta versión: gate adversarial de T4a asignado a H1 (MED), decisión `fecha_deprecacion` asignada al Mediador con cierre explícito (LOW), path de migraciones corregido (LOW). Verificaciones del proyecto: procedencia OK, oficial/comunitario OK, contrato v0 OK (resuelto vía T4a/T6), generados intactos OK. | **Plan aprobado para ejecutar.** El Mediador puede aplicar Git y abrir T4a. |
| 3 (2026-08-17) | Subagente fresco, glm-5.2 (decorrelación vs. autor) — T4a r1 | `fix-and-retry` | 1 HIGH (§3.2 documentaba `flags` como array; la implementación sirve captura cruda `null \| {salida}` — lo fosilizaría como correcto en T1b), 5 MED (enum §2.2 sin acotar a `modelos.proveedor`; `version_servicio` null en CLI sin declarar; deferral enum sin dueño; CONSUMO_INTERNO sobreprometía procedencia; "ficha completa" residual en MCP+doc), 3 LOW. | Correcciones aplicadas: shape `flags` crudo documentado; enum acotado; nulabilidad declarada; **T4c** registrado (validación/UX, ~0.5 cic); CONSUMO_INTERNO y tool MCP alineados; mapeo `listar_entidades` documentado; desviación exit fatal del CLI documentada. Gates: check_sizes/build/eslint OK (+ fix de formato prettier preexistente en `sandbox_introspeccion.ts`). |
| 4 (2026-08-17) | Mismo revisor (resume; verifica correcciones) — T4a r2 | **`proceed`** | 9/9 hallazgos de r3 resueltos o diferidos con dueño explícito (T4c), verificados línea por línea contra código; 2 LOW cosméticos (typo "Numerología", fila de registro) aplicados tras el veredicto. `datos/` intacto. | **T4a cerrado.** Gate formal de H1 sigue siendo al completar T1a/T1b/T2; T4a queda verificado. |
| 5 (2026-08-17) | Subagente fresco, glm-5.2 (decorrelación) — **gate H1** (T4a+T1a+T2+T4c+T1b) | `fix-and-retry` | 1 HIGH: `feedbackInputValido` no total — input `null` lanzaba TypeError → CLI exit 3 (clasificaba error de usuario como infra) y HTTP 500 (regresión vs null-safe previo); 2 LOW (test_db hardcodea `escrubery_test` pese a URL configurable; jcs.spec sin 4 vectores de la tabla B.2 del RFC). Gates ejecutados por el revisor: 64/64, skip-DB verificado empíricamente, e2e CLI 0/1/2/3. | Fix del guard null-safe + 7 specs de totalidad (corren siempre, fuera del skip) + 4 vectores B.2 añadidos; e2e `feedback 'null'` → exit 2. LOW test_db diferido a T3 (registrado en su DoD). |
| 6 (2026-08-17) | Mismo revisor (resume) — gate H1 r2 | **`proceed`** | HIGH resuelto con evidencia e2e (exit 2, HTTP 400 por lectura); specs de totalidad verificadas fuera del skip (52 passed en modo skip-DB); B.2 completo; 1 LOW cosmético (bitácora 64→75) aplicado tras el veredicto. 75/75, 6 suites; build/eslint/check_sizes OK; `datos/` intacto. | **H1 verificado por adversarial.** Cierre del hito sujeto a decreto del Mediador. |
| 7 (2026-08-17) | Subagente fresco, glm-5.2 (decorrelación) — **gate H2** (T3+T5+T6) | **`proceed`** (condicionado a 2 MED) | Sin BLOCKER/HIGH. 2 MED: (a) 55/73 filas de `cli_comandos` pre-T6 con fecha_obtencion pero `vigente_hasta` NULL → envejecían en silencio (la promesa central de H2); (b) rama `vigente_hasta NULL → no degrada` sin spec (75% de comandos reales). 5 LOW (heredoc semanal sin check, pg_isready no derivaba de DATABASE_URL, logs exit-2 sin código final, toEqual/undefined, ficha sin spec expirada). Procedencia verificada con shasum: fichas regeneradas = hash del JSON commiteado; refresco idempotente; exit codes a prueba de balas en lo auditado; corridas reales 10/2/2. | MEDs aplicados tras el veredicto: mig `009_backfill_caducidad.sql` (0 filas quedan sin ventana en BD real) + spec de rama null (79/79). LOWs aplicados: trap EXIT en log, `pg_isready -d $DATABASE_URL`, check de HACER_SEMANAL vacío → exit 2. **H2 verificado; cierre sujeto a decreto del Mediador.** |

## Enlaces

- Política: `docs/politica-agentes.md` · Plantillas: `docs/plantillas-agente.md`
- Plan v2: `docs/investigacion/Plan_Iterativo_Incremental_Servicio_CLI_Modelos_v2.md` (§4.2 ventanas, §5.1 cadencias, §11 métricas)
- Análisis crítico origen de este plan: conversación del Mediador 2026-08-10.
