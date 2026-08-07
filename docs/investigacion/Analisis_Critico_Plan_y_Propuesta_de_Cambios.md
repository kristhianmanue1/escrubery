# Análisis crítico del plan iterativo-incremental y propuesta de cambios

**Documento analizado (énfasis):** *Plan iterativo e incremental: servicio de inteligencia sobre modelos y CLIs de IA*.
**Documentos de contexto revisados:** *Trazabilidad y auto-reporte de agentes de IA* (matriz), *Sistema de monitoreo de modelos y CLIs de IA* (arquitectura), *Verificación activa de CLIs de IA*, *Panorama existente: mercado y open source*.
**Proyectos del ecosistema analizados:** `constitutional-ai-governance` (CAGF — su método de firma de eventos/agentes, Sección 4) y `expertoGobernanza` (plataforma de inteligencia normativa multi-agente, consumidor futuro del servicio, Sección 5).
**Requisito que origina este análisis:** tener **desde las primeras fases una parte funcional que entregue información sobre CLIs y agentes que permita el trabajo** — es decir, valor usable desde el inicio, no infraestructura vacía. Los primeros usuarios serán los agentes ADRC, pero también proyectos como `expertoGobernanza` y el propio CAGF.
**Fecha:** agosto 2026.

---

## 1. Veredicto general

El plan es sólido en sus principios (esqueleto ambulante, caché-al-consultar, no reconstruir lo que ya existe, trazabilidad desde el día uno) y está bien anclado a los cuatro documentos de investigación que lo preceden. Sin embargo, **falla precisamente en el requisito que ahora se declara prioritario**: su Fase 0 no entrega nada funcional (termina con "tres tablas vacías") y su Fase 1, aunque funcional, llega recién después de 4–7 ciclos acumulados y sin especificar por qué canal concreto la consume nadie.

El análisis del ecosistema real (CAGF y expertoGobernanza) refuerza esta crítica y le añade dos dimensiones que el plan no contempla:

1. **Ya existen consumidores concretos con necesidades concretas.** expertoGobernanza necesita hoy — y lo declara como deuda abierta en su ADR-0002 — un registro externo que resuelva identidad de modelos, metadatos de ToS/retención por proveedor y disponibilidad de CLIs. El plan diseña para un usuario genérico pudiendo diseñar para usuarios reales identificables.
2. **El esquema de firma del plan ("CAGF ligero", Fase 2) puede heredar las debilidades conocidas del propio CAGF** (mono-clave sin cifrar en disco, sin rotación, sin atribución por agente, canonicalización no estándar) si se implementa como "una clave del propio sistema" sin más. El análisis de la Sección 4 convierte esas debilidades en requisitos de diseño.

La propuesta de cambios (Sección 6) no reestructura el plan: lo **reordena y le añade entregables tempranos** para que el sistema sea útil desde el primer ciclo, sirva a sus consumidores reales desde la Fase 1, y su cadena de firma supere desde el diseño los límites que el propio CAGF documenta.

---

## 2. Análisis crítico del plan (fortalezas y debilidades)

### 2.1 Fortalezas que deben conservarse intactas

1. **Esqueleto ambulante y caché-al-consultar (principios 1–2).** Correctos y coherentes con el documento de arquitectura. Son la decisión estructural más importante del plan.
2. **Apoyarse en LiteLLM, API de GitHub, Harbor y `agent-bom` en vez de construir desde cero.** El documento de panorama demuestra que cuatro de cinco capas ya existen; el plan lo aplica bien.
3. **Procedencia mínima desde Fase 1** (`fuente_url`, `fecha_obtencion`, `hash`) sin esperar a la cadena criptográfica completa. Buen equilibrio entre rigor y velocidad.
4. **Criterios de "terminado" por fase y métricas por fase.** Raro y valioso en planes de este tipo; permite al Mediador verificar cierre sin ambigüedad.
5. **Esquema de datos evolutivo** (tres tablas núcleo que se extienden sin romperse). Diseño correcto.

### 2.2 Debilidades, en orden de severidad

**D1 — La Fase 0 no entrega valor funcional y la Fase 1 llega tarde y sin canal definido. (Crítica)**
El criterio de terminado de la Fase 0 es literalmente "poder correr `SELECT` sobre tres tablas vacías". El requisito declarado — tener en las primeras fases una parte funcional que entregue información sobre CLIs y agentes que permita trabajar — no se cumple hasta el final de la Fase 1, es decir, tras 4–7 ciclos. Además, la Fase 1 dice "un usuario puede preguntar" pero **nunca decide cómo**: ¿un CLI propio?, ¿un endpoint REST?, ¿un archivo consultable? El principio 6 menciona "REST/CLI interno" de pasada, sin elegir. Esta ambigüedad es exactamente el tipo de decisión que, si se improvisa a mitad de la Fase 1, genera retrabajo en los contratos que el principio 6 quiere mantener estables.

**D2 — El plan diseña para un usuario genérico existiendo consumidores reales identificables. (Alta)**
La Sección 10 del plan establece que el desarrollo se ejecuta con agentes ADRC (Arquitecto/Ejecutor/Mediador), que son consumidores naturales desde el ciclo 1. Pero además existen al menos dos consumidores externos ya identificables (Sección 5): **expertoGobernanza**, que orquesta siete CLIs de agente y necesita identidad de modelos, ToS por proveedor y disponibilidad; y el **propio CAGF**, cuyo EventLog podría consumir y firmar los hechos que este servicio registra. El plan no declara ninguno como usuario. Esto es una oportunidad perdida doble: (a) el sistema tendría casos de uso reales y medibles desde el primer día (*dogfooding*), y (b) la métrica de la Fase 1 (">90% de consultas servidas desde BD") tendría tráfico real que medir.

**D3 — Decisiones diferidas cuyo costo es calendario, no desarrollo. (Alta)**
Tres decisiones del plan no requieren ciclos de desarrollo pero sí tiempo, y están programadas demasiado tarde:
- **Revisión de Términos de Servicio** de los seis CLIs antes de automatizar ejecución (Verificación Activa §3.6) está implícita en Fases 3–4. Es una revisión legal/contractual que puede tomar semanas; debería iniciarse en la Fase 0 para no bloquear la Fase 3.
- **Custodia de llaves Ed25519** (Fase 2): el plan dice "una clave del propio sistema" sin decir dónde vive, quién la controla ni cómo se rota. El análisis del propio CAGF (Sección 4) muestra el costo de no decidirlo: PEM sin cifrar en disco, mono-clave, sin rotación ni revocación. Definir el esquema en la Fase 0 cuesta una página; descubrir en la Fase 2 que se exige otro cuesta rehacer lo firmado.
- **El "nivel premium" de la Fase 5** es una ambigüedad de alcance: ¿el sistema es una herramienta interna de trabajo del ecosistema de proyectos (ADRC, expertoGobernanza, CAGF) o un producto con clientes de pago? Son gobernanzas distintas (autenticación, límites de tasa, soporte, responsabilidad sobre los datos servidos). La Fase 5 debe marcarse como **condicional a esa decisión**, que conviene plantear desde ahora aunque se resuelva después.

**D4 — La "captura manual puntual" de la Fase 1 rompe la trazabilidad que el propio plan exige. (Media)**
La Sección 4.3 propone que "el Mediador humano ejecuta `--help` una vez por CLI y pega la salida al pipeline". Un pegado manual no produce `hash_del_contenido_original` confiable ni `fecha_obtencion` automática — es decir, viola el principio 4 en el primer dato que entra al sistema. Además convierte al Mediador en cuello de botella operativo. La corrección es barata: un *script* de ingesta mínimo que el humano ejecuta (`./ingestar --cli claude --comando "--help"`) y que calcula hash, fecha y fuente automáticamente.

**D5 — Las estimaciones en "ciclos" no son auditables ni calendarizables. (Media)**
"3–5 ciclos" se define como "lo que un Ejecutor completa en una sesión", lo cual es honesto pero inmanejable: no permite saber si el proyecto va atrasado ni comprometer fechas. Falta un anclaje: calendario tentativo por fase y una bitácora de ciclos ejecutados vs. estimados.

**D6 — Dependencia única de LiteLLM sin validación cruzada temprana. (Media)**
El riesgo 2 del plan (que LiteLLM cambie de formato) tiene mitigación de detección, pero no de *validación*: un dato erróneo en LiteLLM (precio, ventana de contexto) se serviría como correcto con fuente citada. El documento de panorama identifica segundas fuentes (openmodelsrun, artificialanalysis, y los endpoints `/models` de los propios proveedores). Un chequeo cruzado simple (discrepancia > umbral → bandera `pendiente_de_verificar`) cabe en la Fase 2 y eleva sustancialmente la confiabilidad del dato más consultado del sistema. El caso de expertoGobernanza lo hace más urgente: si el servicio va a alimentar decisiones de enrutamiento de un quórum adversarial, un dato erróneo no solo desinforma — degrada decisiones de gobernanza.

**D7 — Riesgo operativo subestimado en la Fase 3. (Baja-media)**
Correr `--help` de seis CLIs en contenedores suena simple, pero instalar y mantener actualizados seis toolchains distintos (algunos propietarios, con login, en transición como Antigravity) es mantenimiento continuo que el plan no presupuesta. expertoGobernanza ya documenta esta fragilidad en la práctica: en su primer ejercicio multi-proveedor, `gemini` y `qwen` cayeron por autenticación/presupuesto. El criterio de entrada a la Fase 3 debería incluir el entorno aislado ya construido y la revisión ToS (D3) ya resuelta; de lo contrario la Fase 3 se convertirá en la primera fase bloqueada.

**D8 — La métrica de la Fase 1 requiere instrumentación que no está en los entregables. (Baja)**
"% de consultas respondidas desde BD" exige un registro de consultas (qué se preguntó, de dónde se sirvió, latencia). Ninguna fase lo incluye. Es una tabla pequeña (`consultas_log`) que conviene agregar al esquema de la Fase 1.

---

## 3. Lo que el contexto aporta y el plan no recoge

Del resto de documentos de investigación se desprenden tres hallazgos que el plan menciona de pasada o no incorpora como cambio operativo concreto:

1. **La señal de mayor valor es la divergencia, no el evento.** Verificación Activa §2.1: "un flag nuevo en `--help` que no aparece en ningún changelog" es la señal estrella. En el plan, esa detección de divergencia llega recién en la Fase 3. Pero la mitad de la divergencia se puede detectar ya en la Fase 2 cruzando changelog contra inventario documentado — sin ejecutar ningún CLI. Conviene adelantar una versión pasiva de esa alerta.
2. **El riesgo MCP es transversal a los seis CLIs, no exclusivo de Grok Build.** El documento de panorama (§5) lo demuestra con casos contra el propio servidor MCP de GitHub y de Anthropic. El plan hereda la priorización del documento de arquitectura (Grok Build = máxima) sin absorber esta corrección: el Vulnerable MCP Project debería entrar como fuente pasiva de la Capa 1 ya en la Fase 2, no como parte de la seguridad activa de la Fase 4.
3. **La distinción oficial/comunitario (Grok CLI vs. Grok Build) ya está en el esquema (`cli_productos.tipo`) pero no en ningún criterio de aceptación.** Ninguna fase verifica que las respuestas del sistema *muestren* esa distinción al usuario. Si el sistema va a informar decisiones sobre qué CLI usar, esta distinción es de gobernanza, no de catálogo: debe ser un criterio de "terminado" de la Fase 1.

---

## 4. Análisis del método de firma de agentes de CAGF (`constitutional-ai-governance`)

Se analizó el método de firma del propio CAGF porque el plan propone "apoyarse en CAGF" para su cadena de procedencia (CAGF ligero en Fase 2, completo en Fase 4). El hallazgo principal: **CAGF no tiene un único esquema de firma, sino tres capas de madurez muy distinta, y ninguna de ellas resuelve la identidad verificable de agente**.

### 4.1 Las tres capas de firma de CAGF

| Capa | Algoritmo | Qué cubre | Estado |
|---|---|---|---|
| **A — EventLog Ed25519** | Ed25519 (`cryptography`) | Eventos de gobernanza, manifiesto, checkpoint | Implementada y verificable (`scripts/trace/`) |
| **B — digest-chain-v1** | `sha256(key_ref + digest)` | Declaración P0 del enjambre | Test-grade, deliberadamente no-PKI, falsificable |
| **C — SSH Ed25519 del operador** | `ssh-keygen -Y sign` | `declaration_digest` (ancla de autoridad humana) | Implementada, pero solo cubre el acta P0, no el log |

La capa relevante para este proyecto es la **A**. Su mecánica exacta (`scripts/trace/event_log.py:101-120`): cada `EventRecord` se serializa como JSON con `sort_keys=True` **excluyendo** el campo `signature`, se firma con Ed25519, y la firma se guarda como `"ed25519:" + base64`. El `prev_hash` queda **dentro** del payload firmado, de modo que cadena y firma son una sola cosa: reordenar o re-encadenar registros invalida las firmas posteriores. La clave pública vive en un keyring JSON commiteado (`cagf-keyring/0.1`, DER SubjectPublicKeyInfo en base64); la privada en un PEM PKCS8 con `chmod 0600`, gitignored.

### 4.2 Lo que el diseño de CAGF hace bien y vale la pena adoptar como patrón

1. **`prev_hash` dentro del payload firmado** — la cadena y la firma se refuerzan mutuamente (`event_log.py:122-177`).
2. **Checkpoint firmado del tip** (`trace_verify.py:268-331`): firma Ed25519 sobre `{tip_digest, record_count, cycle_id, commit_sha}` persistida **fuera** de la base de datos. Es la defensa real contra reescritura total del log — la idea más robusta del esquema y directamente aplicable a las tablas `eventos_changelog` y `pruebas_activas` del plan.
3. **Manifiesto de eventos esperados firmado** (`expected-events.json` + `.sig`): permite detectar *omisión* de eventos declarados, no solo alteración.
4. **Verificación read-only y fail-closed**: el verificador no muta artefactos y una política corrupta produce error, no degradación silenciosa.
5. **Reparación append-only** (`repair_record.py:77-177`): solo se puede corregir el tip, con un evento `CORRECTION_APPLIED` firmado — nunca se edita la historia.
6. **Honestidad documental**: los no-claims están escritos y son vinculantes (p. ej. `identity_verified: False, honor_system: True` en `cagf_deposit.py:160-170`).

### 4.3 Las debilidades de CAGF que el plan heredaría si copia el esquema sin corregirlo

1. **Mono-clave: una sola clave (`operator-ed25519`) firma eventos de cualquier agente.** No hay decorrelación criptográfica por agente — dos agentes distintos producen eventos indistinguibles. El propio contrato de CAGF lo declara como límite (`emit_event.py:10`). Para un servicio cuyos consumidores son agentes (ADRC, expertoGobernanza), esto es un bloqueador de atribución real.
2. **Identidad de agente como texto libre.** `agent_id`/`agent_role` son cadenas sin binding criptográfico; `.well-known/agent.json` es un Agent Card **sin firmar**; la "firma" de documentos (§6 de AGENTS.md) es un pie de página honor-system. CAGF no ofrece identidad verificable de agente — la modela como disciplina de proceso.
3. **Custodia débil:** PEM PKCS8 **sin cifrar** en disco (`keymgmt.py:57-62`). Sin rotación, sin revocación, sin historial de llaves. Si la privada se compromete, no hay mecanismo definido de respuesta — y con ella caen el log, los checkpoints y los manifiestos.
4. **Canonicalización casera:** `json.dumps(sort_keys=True)` con separadores por defecto, no JCS/RFC 8785. Funciona porque emisor y verificador comparten la misma implementación Python; cualquier consumidor externo en otro lenguaje debe replicar byte-a-byte o las firmas fallan silenciosamente. Esto importa directamente si el nuevo servicio firma hechos que CAGF u otros proyectos verificarán.
5. **Sin RFC 3161 ni Merkle:** timestamps de hora local del proceso emisor; verificación O(n) sobre toda la cadena sin pruebas de inclusión. (El plan ya prevé Merkle y RFC 3161 en la Fase 4 — aquí el plan está por delante de CAGF, no detrás.)

### 4.4 Consecuencia para el plan

El plan debe tratar CAGF como **fuente de patrones y de formato, no como componente a importar**:

- **Adoptar como patrón:** `prev_hash` en payload firmado, checkpoint firmado del tip, manifiesto de esperados, verificación read-only, reparación append-only.
- **Alinear formato para interoperabilidad:** firma como `"ed25519:" + base64`, clave pública DER/base64 en keyring JSON commiteable. Trivial de replicar y hace que los hechos firmados por el nuevo servicio sean verificables con las convenciones que el ecosistema ya usa.
- **Corregir desde el diseño lo que CAGF deja abierto:** clave **por agente/servicio** (no mono-clave), rotación y revocación definidas desde el inicio, canonicalización **JCS/RFC 8785**, y custodia de la privada fuera del worktree (variable de entorno/KMS, nunca PEM sin cifrar en disco).
- **Oportunidad estratégica:** el hueco de CAGF (identidad de agente no verificable) y la deuda abierta de expertoGobernanza (registro externo de modelos, ADR-0002) son exactamente el tipo de dato que este servicio puede proveer. El servicio no solo consume el patrón CAGF — puede **cerrar una brecha que el ecosistema ya declaró como deuda**.

---

## 5. Consumidores reales identificados

### 5.1 Agentes ADRC (primer usuario, ya declarado)

Los agentes Arquitecto/Ejecutor que construyen el sistema consumen desde el ciclo 1: comandos y flags de CLIs, capacidades de modelos, configuración MCP. Son el caso de uso inmediato y la fuente de tráfico real para la métrica de la Fase 1.

### 5.2 `expertoGobernanza` (consumidor externo confirmado)

Plataforma de inteligencia normativa multi-agente: orquesta siete CLIs (`codex`, `claude`, `kimi`, `gemini`, `qwen`, `opencode`, `cline`) vía tmux en un quórum adversarial (autor + adversario + árbitro, cada uno de familia de modelo distinta), con mediador humano. Su patrón operativo es equivalente a ADRC. Necesidades concretas que este servicio puede cubrir, con su evidencia:

| Necesidad de expertoGobernanza | Evidencia en su repo | Qué le daría este servicio |
|---|---|---|
| Resolver identidad/capacidades de cada modelo subyacente para el `configuration_fingerprint` (hash de la triada agente/modelo/proveedor) | `docs/adr/0002-proveniencia-firma-agentes.md:29` | `consultar_modelo` con identidad canónica proveedor/modelo |
| Verificar que el quórum usa **familias de arquitectura distintas** (decorrelación real, no solo CLIs distintos) | `docs/politica-agentes.md:196-207` | Matriz de convergencia + proveedor canónico por modelo |
| Metadatos de **ToS/retención/transferencia por proveedor** para su router de enrutamiento (§7.4, default-deny) | `docs/politica-agentes.md:398-400`, `review_routing/router.py` | Campo nuevo: política de datos por proveedor (no está en LiteLLM — curaduría propia, justifica el "construir" del panorama) |
| Disponibilidad/auth/precios por proveedor (hoy proveedores caen en silencio: gemini y qwen cayeron en su primer ejercicio) | `checkpoint-2026-08-06.md:23` | Alertas de la Fase 2 + datos de precio de la Fase 1 |
| **Registro externo (no autodeclarado) del modelo que corrió** — deuda abierta explícita | `docs/adr/0002-proveniencia-firma-agentes.md:31-37,44-45` | El servicio *es* ese registro externo, con procedencia firmada |

Sus interfaces son CLIs Python que emiten JSON por stdout, deterministas — encajan directamente con el contrato JSON que el principio 6 del plan exige.

### 5.3 El propio CAGF (consumidor e integrador)

CAGF puede consumir el servicio en dos direcciones: (a) como **fuente de hechos firmados** sobre modelos/CLIs que alimenten su EventLog (el servicio firma, CAGF verifica con las convenciones alineadas de la Sección 4.4); y (b) como **verificador externo** de la cadena del propio servicio (el checkpoint firmado del tip es exactamente el tipo de artefacto que un verificador externo CAGF-style puede fijar y comprobar).

### 5.4 Consecuencia para el diseño de la API

Tres consumidores, todos agentes o pipelines deterministas que esperan JSON. Esto confirma el principio 6 del plan y lo hace más específico: el contrato de la Fase 1 debe incluir, además de lo ya previsto, **resolución de identidad canónica de modelo** (`issuer.id` → proveedor/modelo/version) y **metadatos de política de datos por proveedor** — los dos campos que los consumidores reales necesitan y que LiteLLM no cubre.

---

## 6. Propuesta de cambios al plan

Los cambios son aditivos y de reordenamiento; no alteran las fases 2–5 en su contenido técnico. Resumen de la estructura revisada:

| Fase | Cambio | Qué entrega ahora |
|---|---|---|
| **0** | **Ampliada y con entregable funcional** | Cimientos + **Ficha v0**: snapshot consultable de CLIs y modelos, en el repo, sin base de datos |
| **1** | Aclarada: canal decidido, consumidores declarados, trazabilidad de ingesta | API + CLI de consulta propio, consumido por ADRC y expertoGobernanza |
| **2** | Sumadas dos fuentes, una validación y firma con correcciones sobre CAGF | Changelog + firma por evento con clave dedicada + fuente Vulnerable MCP + chequeo cruzado LiteLLM + alerta de divergencia pasiva |
| **3** | Criterios de entrada explícitos | Sin cambio de alcance; entra solo con sandbox y ToS listos |
| **4** | Sin cambio de alcance | CAGF completo, ahora sobre una base de firma ya correcta |
| **5** | Marcada como condicional a decisión de alcance del servicio | — |

### Cambio 1 — Fase 0 entrega una "Ficha v0" funcional (responde al requisito principal)

Agregar a la Fase 0 un entregable funcional de un ciclo, sin infraestructura nueva:

- Un directorio `datos/fichas/` en el propio repositorio con un archivo JSON por CLI (6) y por proveedor de modelo (5), generado por un *script* de ingesta que descarga el JSON de LiteLLM y las fuentes ya identificadas, los normaliza al esquema canónico, y guarda `fuente_url`, `fecha_obtencion` y `hash_sha256` por ficha (principio 4 cumplido desde el primer dato).
- Un comando de consulta mínimo (script `consultar`) que responde sobre esos archivos: "¿qué flags tiene `claude mcp`?", "¿precio y contexto de `kimi-k3`?", "¿qué CLIs son oficiales vs. comunitarios?".
- Las fichas de CLI parten del inventario documental ya compilado en los documentos de investigación (matrices de las Secciones 4–5 del documento de arquitectura): la primera versión se **curaduriza** a mano desde esos documentos, no se scrapea.

**Por qué:** entrega información útil sobre CLIs y agentes desde el primer ciclo, sirve de semilla de datos para la Fase 1 (la ingesta a PostgreSQL lee las mismas fichas), y obliga a definir el esquema canónico y el formato de respuesta **antes** de tener base de datos — que es justo lo que el principio 6 pide y el plan no concreta. Su criterio de terminado: "un agente o una persona puede obtener, con un comando, la ficha de cualquiera de los 6 CLIs y 5 proveedores con fuente y fecha citadas".

### Cambio 2 — Decidir el canal de consulta ahora (Fase 1)

Fijar en la Fase 0, como decisión explícita: la interfaz de consulta es **(a) un CLI propio (`consultar`) sobre la base de datos y (b) un endpoint HTTP JSON con el mismo contrato**. Incluir como anexo de la Fase 0 el contrato JSON v0 de las respuestas (`consultar_modelo`, `consultar_comando_cli`, `consultar_ficha`, y — nuevo por la Sección 5 — `resolver_identidad_modelo` y `politica_datos_proveedor`), derivado del esquema canónico ya definido en el documento de arquitectura (Sección 6). Esto convierte el principio 6 de intención en artefacto verificable y hace de la Fase 5, efectivamente, un adaptador.

### Cambio 3 — Declarar los consumidores reales como usuarios de la Fase 1

Agregar al alcance de la Fase 1: "el sistema es consumido desde el ciclo 1 por (a) los agentes Arquitecto/Ejecutor del marco ADRC durante el propio desarrollo, y (b) los pipelines de expertoGobernanza (resolución de `configuration_fingerprint`, verificación de decorrelación del quórum, metadatos ToS para su router)". Efectos: casos de uso reales, tráfico real para la métrica de la Fase 1, y retroalimentación inmediata sobre la calidad de los datos (un agente que consulta un flag inexistente lo reporta en el momento). Requiere agregar la tabla `consultas_log` — ver Cambio 6.

### Cambio 4 — Adelantar las decisiones no técnicas a la Fase 0, ahora con requisitos concretos de firma (vía paralela, no bloqueante)

Crear una pista de decisiones que corre en paralelo a las fases técnicas:

| Decisión | Inicia | Necesaria para | Contenido mínimo |
|---|---|---|---|
| Revisión de Términos de Servicio de los 6 CLIs (automatización, *benchmarking*) | Fase 0 | Fase 3 (criterio de entrada) | Documento de revisión |
| **Esquema de llaves Ed25519** | Fase 0 | Fase 2 | Corrigiendo las debilidades CAGF (Sección 4.3): **clave por servicio/agente firmante** (no mono-clave), rotación y revocación documentadas, privada fuera del worktree (nunca PEM sin cifrar en disco), keyring público commiteado en formato `cagf-keyring/0.1` compatible |
| **Canonicalización de payloads firmados** | Fase 0 | Fase 2 | JCS/RFC 8785, no `sort_keys` casero — requisito para que terceros verifiquen firmas sin replicar una implementación Python específica |
| Naturaleza del servicio (herramienta interna del ecosistema vs. producto con niveles) | Fase 0 | Fase 5 (condición de activación) | Decisión del Mediador |

Estas vías consumen calendario, no ciclos de desarrollo; adelantarlas es gratis en esfuerzo y evita bloqueos en las fases 2, 3 y 5.

### Cambio 5 — Sustituir la "captura manual" por un script de ingesta asistida (Fase 1)

Reemplazar "el Mediador pega la salida" por: el Mediador *ejecuta* un script (`ingestar --cli claude --comando "--help"`) que captura la salida, calcula `hash_sha256`, registra `fecha_obtencion` y `fuente_url` (aunque la fuente sea "ejecución local supervisada"), y la inserta. Mismo esfuerzo humano, trazabilidad completa, y el mismo script se reutiliza como base del automatismo de la Fase 3.

### Cambio 6 — Agregar `consultas_log` y dos fuentes a la Fase 2

- Esquema Fase 1: añadir tabla `consultas_log (id, consulta, servido_desde, latencia_ms, fecha)` — habilita la métrica de la Fase 1 y la detección de consultas sin respuesta (demanda real de datos faltantes).
- Fase 2, fuentes: añadir el **Vulnerable MCP Project** como fuente pasiva de seguridad (categoría `fix_seguridad`, prioridad de notificación inmediata), corrigiendo la priorización Grok-céntrica según el hallazgo del panorama.
- Fase 2, validación: **chequeo cruzado de LiteLLM** contra una segunda fuente (openmodelsrun o endpoint `/models` del proveedor) con bandera `pendiente_de_verificar` ante discrepancia.
- Fase 2, alerta: **divergencia pasiva** — entrada de changelog que menciona un comando/flag ausente del inventario documentado, o viceversa. Es la mitad barata de la señal estrella de la Fase 3, disponible sin ejecutar CLIs.

### Cambio 7 — Criterio de "terminado" adicional para la Fase 1

"Toda respuesta sobre un CLI muestra explícitamente si el producto es **oficial o comunitario** (campo `cli_productos.tipo`), y el sistema nunca mezcla Grok CLI con Grok Build en una misma respuesta sin distinguirlos." Criterio de gobernanza, no de catálogo.

### Cambio 8 — Anclaje de calendario y bitácora de ciclos

Agregar a la Sección 10 del plan: un calendario tentativo por fase (aunque sea revisable cada dos fases) y una bitácora simple (archivo en el repo: fase, ticket, ciclos estimados, ciclos reales, desviación). Sin esto, las estimaciones en ciclos no permiten detectar atraso ni rendir cuentas sobre el avance.

### Cambio 9 — Criterios de entrada de la Fase 3

La Fase 3 no inicia hasta tener: (a) entorno de contenedores efímeros construido y probado con un solo CLI; (b) revisión ToS (Cambio 4) resuelta al menos para los CLIs de verificación diaria; (c) presupuesto de gasto por ciclo de prueba aprobado (Verificación Activa §3.5). Evita que la primera fase con ejecución real se bloquee por infraestructura o por temas legales, no por desarrollo. La experiencia de expertoGobernanza (proveedores caídos por auth/presupuesto en su primer ejercicio) es evidencia directa de que este riesgo es real, no teórico.

### Cambio 10 — Adoptar los patrones de firma de CAGF corregidos, como requisitos de la Fase 2

Reescribir la Sección 5.2 del plan ("CAGF ligero") con contenido específico en vez de "firma Ed25519 simple":

- **Por evento:** `prev_hash` (o hash del evento anterior del mismo producto) **dentro** del payload firmado, para que cadena y firma se refuercen (patrón CAGF `event_log.py`).
- **Checkpoint firmado del tip** por lote/día, persistido fuera de la base de datos (patrón CAGF `trace_verify.py:268-331`) — defensa contra reescritura total, disponible ya en la Fase 2 sin esperar a Merkle.
- **Formato de artefacto alineado con CAGF:** firma `"ed25519:" + base64`, keyring JSON commiteado — los hechos de este servicio serán verificables por CAGF y expertoGobernanza sin adaptadores ad hoc.
- **Canonicalización JCS/RFC 8785** y **clave dedicada del servicio** con custodia definida (Cambio 4) — las dos correcciones sobre las debilidades CAGF documentadas.
- **Verificador read-only** (`verificar` como comando independiente que nunca muta la base de datos), con política fail-closed.

Esto mantiene la Fase 2 "ligera" (sigue sin Merkle ni RFC 3161) pero la hace correcta desde el inicio y directamente integrable con el ecosistema.

---

## 7. Riesgos que la propuesta introduce (honestidad dimensional)

1. **La Ficha v0 puede volverse un artefacto huérfano** si la Fase 1 se retrasa mucho y las fichas quedan desactualizadas. Mitigación: el mismo script de ingesta las regenera; su costo de actualización es un comando, y su caducidad está impresa en cada ficha (`fecha_obtencion`).
2. **Decidir el contrato JSON v0 en la Fase 0 congela decisiones con poca información.** Mitigación: el contrato se versiona (`v0`) y se permite ruptura explícita hasta la Fase 2; lo que se busca no es perfección sino no improvisar. Además, ahora hay consumidores reales (Sección 5) cuyas necesidades concretas informan el contrato — la decisión ya no se toma a ciegas.
3. **Declarar consumidores específicos puede sesgar el diseño hacia sus necesidades** (p. ej. campos ToS para el router de expertoGobernanza) en detrimento de la generalidad. Mitigación: esos campos van como extensión del esquema, no como núcleo; el núcleo sigue siendo el esquema canónico del documento de arquitectura.
4. **Alinear formato con CAGF crea acoplamiento** con un esquema (`cagf-keyring/0.1`) que podría cambiar. Mitigación: es acoplamiento de *formato*, no de código ni de disponibilidad; el servicio mantiene su propia clave y su propia cadena, y la convención de prefijo `ed25519:` es trivial de migrar si CAGF evoluciona.

---

## 8. Conclusión

El plan es técnicamente correcto y está bien fundamentado en la investigación previa; su debilidad no es de arquitectura sino de **secuencia de valor y de conexión con su ecosistema**: entrega su primer valor funcional demasiado tarde para el requisito declarado, deja sin decidir el canal por el que ese valor se consume, diseña para un usuario genérico existiendo consumidores reales con necesidades documentadas (ADRC, expertoGobernanza, CAGF), y propone una cadena de firma que, tal como está descrita, heredaría las debilidades que el propio CAGF ya documenta (mono-clave, sin rotación, canonicalización casera, identidad de agente no verificable).

Los diez cambios propuestos corrigen eso sin reestructurar el plan: la Fase 0 pasa a entregar una parte funcional real (Ficha v0), la Fase 1 gana un canal decidido y usuarios reales con contratos que responden a necesidades ya evidenciadas, la Fase 2 absorbe las fuentes y validaciones pendientes y firma con los patrones correctos desde el inicio, y las decisiones no técnicas arrancan en paralelo desde el primer día. Además, el servicio queda posicionado para cerrar una brecha que el propio ecosistema ya declaró como deuda abierta: un registro externo, firmado y verificable de identidad y capacidades de modelos y CLIs.
