# Trazabilidad y auto-reporte de agentes de IA: análisis crítico y matriz de referencia

**Preparado para:** diseño de subsistema de trazabilidad / procedencia (AN-KLA Memory · CAGF)
**Fecha:** agosto 2026
**Alcance:** Claude (Anthropic), Grok (xAI), Gemini (Google), Kimi (Moonshot AI), GLM (Zhipu AI/Z.ai) — capa API, capa CLI/agente, capa de protocolo de interoperabilidad, capa de procedencia de contenido, capa legal/cumplimiento.

---

## 1. Tesis central del análisis

La investigación previa concluye correctamente que "no existe un estándar único obligatorio". Pero esa conclusión, tomada sola, es engañosa para el diseño de un sistema de trazabilidad, porque **da a entender que el problema es la ausencia de normas**, cuando el problema real es más grave: **existen varios estándares parciales, no coordinados entre sí, que cubren capas distintas del problema y que en ningún punto se tocan con una cadena de custodia verificable end-to-end.** Esto es una distinción crítica para AN-KLA/CAGF, porque cambia el diseño: no se trata de "esperar a que surja un estándar" ni de "elegir uno", sino de **construir la capa de integración que los estándares existentes no proveen**, tratando cada uno como una fuente de evidencia parcial y no como una fuente de verdad.

Cinco fallas estructurales que cualquier sistema de trazabilidad debe asumir como axiomas de diseño:

1. **El auto-reporte de un LLM no es una fuente confiable de identidad.** Un modelo puede alucinar su propio nombre, versión, proveedor o capacidades si se le pregunta directamente ("¿qué modelo eres?"). Esto no es una rareza: es consecuencia directa de que el *system prompt*, los datos de entrenamiento y el *fine-tuning* pueden no coincidir, y de que muchos proveedores exponen el mismo *endpoint* bajo *aliases* de modelo que cambian con el tiempo (p. ej. un alias "más reciente" que apunta a versiones distintas según la fecha de la consulta). **Conclusión de diseño: nunca usar el texto autogenerado por el modelo como campo de identidad. La identidad debe venir siempre del metadato de la capa de transporte (el campo `model` devuelto por la API, headers HTTP, o el Agent Card firmado), nunca del contenido conversacional.**

2. **La capa que más metadatos objetivos expone (la API) es también la que menos se usa en la práctica**, porque la mayoría del trabajo real ocurre a través de CLIs, IDEs y *wrappers* (Claude Code, Kimi Code, Gemini CLI, Grok Build, Cursor, Aider, OpenCode) que consumen la API mediante SDKs y **no necesariamente exponen, registran o persisten todos esos metadatos al usuario final**. El *harness* (la herramienta CLI) se convierte en un intermediario de confianza no verificado: si el CLI no registra `usage`, `id` de petición o `model` exacto, esa información se pierde aunque la API la haya devuelto.

3. **Los campos "de facto" (`model`, `usage`, `id`, `stop_reason`) resuelven trazabilidad técnica de una sola llamada, pero no resuelven procedencia (¿quién autorizó esto?), no-repudio (¿se puede probar que este texto salió de este modelo en este momento sin que nadie lo alterara después?), ni custodia (¿dónde vive el diálogo y bajo qué política?).** Son capas distintas del problema que exigen mecanismos distintos:
   - **Trazabilidad técnica** → `usage`/`model`/`id` (ya cubierto por las APIs).
   - **Procedencia de contenido** → C2PA / Content Credentials, marcas de agua (SynthID, KGW).
   - **No-repudio / integridad temporal** → firmas Ed25519/RSA + *hashing* + sellado de tiempo (RFC 3161) + agregación Merkle — exactamente el enfoque que ya persigue CAGF, y no por casualidad: es la única combinación que cierra el hueco que ni las APIs ni C2PA cubren completamente para *texto* conversacional (C2PA nació para imagen/video/audio; su soporte para manifiestos de texto no estructurado es reciente y desigual).
   - **Identidad y descubrimiento de agentes** → A2A Agent Card, MCP, DIDs.
   - **Cumplimiento legal / retención** → políticas del proveedor + marcos nacionales (EU AI Act Art. 50, NOM-151-SCFI-2016 en México).

4. **El costo (`gasto`) es sistemáticamente el dato menos estandarizado de todos**, porque depende de tarifas dinámicas por proveedor, descuentos por *caching*/*batch*, y de si el consumo ocurre vía suscripción (tarifa plana, sin metadato de costo por mensaje) o vía API (medido por token). Un sistema de trazabilidad que dependa de que el proveedor reporte el costo en tiempo real fallará: **el costo debe calcularse localmente** (`tokens × tarifa vigente`, con tabla de tarifas versionada y actualizada por el propio sistema, no confiando en que la API lo entregue).

5. **La IP, la ubicación de inferencia y el lugar exacto de almacenamiento de los diálogos son, por diseño de los proveedores, datos que no se exponen al cliente.** Ningún estándar de los revisados (MCP, A2A, OTel GenAI, C2PA) obliga a un proveedor a declarar esto. Es información de infraestructura interna que solo aparece, si acaso, en reportes de cumplimiento empresarial (SOC 2, DPA, adéndums de residencia de datos) — es decir, es un dato **contractual/legal, no técnico-verificable por API**.

---

## 2. Las cinco capas del problema (marco para el diseño)

Conviene modelar el problema no como una lista plana de "campos que un agente podría reportar", sino como capas independientes, cada una con su propio grado de madurez y su propio mecanismo de verificación:

| Capa | Pregunta que responde | Mecanismo actual | Madurez | Verificable por un tercero sin confiar en el proveedor |
|---|---|---|---|---|
| **1. Identidad de invocación** | ¿Qué modelo/versión respondió esta llamada específica? | Campo `model` en la respuesta API, `system_fingerprint` (parcial) | Alta pero no uniforme entre proveedores | No — depende de que el proveedor no mienta |
| **2. Medición de consumo** | ¿Cuántos tokens, de qué tipo, a qué costo? | `usage` / `usage_metadata` | Alta, con vocabulario distinto por proveedor | No — autoreportado, sin auditoría externa |
| **3. Identidad y capacidades del agente (no del modelo crudo)** | ¿Qué agente/servicio es este, quién lo opera, qué puede hacer? | Agent Card (A2A), *server manifest* (MCP) | Media, en consolidación durante 2026 | Parcialmente — si el Agent Card está firmado (Signed Agent Cards, A2A v1.0) |
| **4. Procedencia e integridad del contenido producido** | ¿Este texto/imagen fue generado por IA, por cuál, con qué inputs, y no fue alterado después? | C2PA / Content Credentials, marcas de agua, o construcción propia (hash + firma + timestamp) | Madura para imagen/video/audio; incipiente para texto plano de chat | Sí, si hay firma criptográfica verificable independientemente (esto es lo que CAGF ya persigue) |
| **5. Observabilidad operacional / auditoría de sistema** | ¿Qué llamadas, herramientas y sub-agentes se ejecutaron, en qué orden, con qué latencia y costo agregado? | OpenTelemetry GenAI semantic conventions (`gen_ai.*`) | Pre-1.0, en desarrollo activo (SIG formado 2024, especificación aún cambiante en 2026) | Sí, dentro de tu propio *stack* de observabilidad — pero requiere que tú lo instrumentes; el proveedor no te lo entrega ya instrumentado |

**Implicación directa para AN-KLA/CAGF:** ninguna de las cinco capas, por sí sola, produce una prueba de autoría con valor jurídico (tipo "grado de patente" que se menciona como objetivo). La capa 1 y 2 dan trazabilidad técnica pero autoreportada; la capa 4, bien implementada con Ed25519 + Merkle + RFC 3161, es la única que puede producir evidencia con valor de no-repudio — precisamente porque no depende de que el proveedor coopere: el propio sistema firma y sella lo que observa, independientemente de lo que el proveedor declare.

---

## 3. Matriz completa por proveedor (capa API / capa de facto)

Notas de lectura de la matriz: "Reportado" = aparece en la respuesta estructurada de la API (no en el texto conversacional). "Consultable" = existe pero en un endpoint/documento distinto, no en la respuesta de la llamada. "No expuesto" = no hay mecanismo de cliente para obtenerlo del proveedor; solo por vía contractual/legal.

| Dato | Claude (Anthropic) | Grok (xAI) | Gemini (Google) | Kimi (Moonshot AI) | GLM (Zhipu AI / Z.ai) |
|---|---|---|---|---|---|
| **Modelo/versión exacta** | Reportado — campo `model` (p. ej. `claude-sonnet-5`, `claude-opus-4-8`) | Reportado — campo `model`, estilo compatible OpenAI | Reportado — campo `model` en respuesta; catálogo en endpoint `/models` | Reportado — campo `model` (p. ej. `kimi-k3`), API compatible OpenAI en `api.moonshot.ai/v1` | Reportado — campo `model` (p. ej. `glm-5.2`), interfaz compatible OpenAI |
| **Proveedor/organización** | Implícito por endpoint/clave, no como campo explícito de cada respuesta | Igual — implícito por endpoint | Igual — implícito por endpoint | Igual — implícito por endpoint | Igual — implícito por endpoint |
| **Tokens de entrada/salida** | Reportado — `usage.input_tokens` / `output_tokens`, con desglose de `cache_creation`/`cache_read` | Reportado — `usage` estilo OpenAI, incluye *cached tokens* en variantes recientes | Reportado — `usage_metadata`: `prompt_token_count`, `candidates_token_count`, `total_token_count`, `thoughts_token_count` (razonamiento) | Reportado — `usage`: `prompt_tokens`, `completion_tokens`, `total_tokens`, con *cache-hit* facturado a tarifa distinta | Reportado — `usage`, con `prompt_tokens_details.cached_tokens` |
| **Ventana de contexto** | Consultable — no en la respuesta; documentado por modelo (hasta 1M en variantes recientes de Sonnet/Opus, con *pricing* escalonado sobre cierto umbral) | Consultable — variantes documentadas de ~500K hasta 1–2M según *tier* de precio | Consultable — endpoint de listado de modelos expone `inputTokenLimit`/`outputTokenLimit` | Consultable — documentado, no en la respuesta; K3 = 1,048,576 tokens nativos | Consultable — documentado; GLM-5.2 ofrece variante `[1m]` explícita de 1M tokens, activada por *flag* en el identificador del modelo |
| **Costo por llamada** | No reportado en la respuesta *raw*; sí disponible vía **Admin/Usage API** agregada (por *workspace*, modelo, *service tier*) | No reportado en la respuesta; se calcula por tarifa publicada | No reportado en la respuesta; se calcula por tarifa publicada | No reportado en la respuesta; se calcula por tarifa publicada (incluye tarifa reducida para *cache-hit*) | No reportado en la respuesta; se calcula por tarifa publicada |
| **ID de la respuesta/petición** | Reportado — campo `id` | Reportado — campo `id` (estilo OpenAI) | Reportado, aunque con nomenclatura propia según SDK | Reportado — campo `id` (estilo OpenAI) | Reportado — campo `id` (estilo OpenAI) |
| **Razón de finalización** | Reportado — `stop_reason` (`end_turn`, `max_tokens`, `tool_use`, etc.) | Reportado — `finish_reason` estilo OpenAI | Reportado — `finishReason` | Reportado — `finish_reason` | Reportado — `finish_reason` |
| **Fingerprint/hash de configuración del sistema** | No expuesto como campo estándar | Variable según implementación; no garantizado | No expuesto como campo estándar | No expuesto como campo estándar | No expuesto como campo estándar |
| **IP de inferencia / región de cómputo** | No expuesto al cliente vía API; solo por adéndum contractual empresarial (residencia de datos) | No expuesto | No expuesto | No expuesto | No expuesto |
| **Firma criptográfica de la respuesta** | No nativa en la API estándar de *chat* | No nativa | No nativa | No nativa | No nativa |
| **Dónde se almacenan los diálogos** | Política de privacidad + configuración de retención (empresa puede fijar retención personalizada); no es un campo de la respuesta | Política de privacidad del proveedor; no es un campo de respuesta | Política de privacidad de Google; historial vinculado a cuenta Google | Política de Moonshot AI; menor documentación pública sobre retención empresarial | Política de Zhipu/Z.ai; menor documentación pública, relevante por jurisdicción (China) |
| **Exportación nativa de conversaciones** | Sí — exportación de cuenta completa (Configuración → Privacidad → Exportar datos), ZIP con JSON vía enlace por correo, sin exportación nativa por conversación individual | Variable/no estandarizado en el flujo de consumidor | Sí, vía Google Takeout ("Gemini Apps"), formato HTML/JSON; exportación de una sola respuesta a Docs/Gmail/Colab, no de la conversación completa desde la interfaz nativa | No hay flujo nativo de exportación documentado de forma comparable | No hay flujo nativo de exportación documentado de forma comparable |
| **Interfaz CLI/agente de referencia** | Claude Code (soporta MCP, sub-agentes, contexto hasta 1M) | Grok Build | Gemini CLI / Antigravity | Kimi Code / Kimi Work (agente de escritorio, *swarm* de agentes) | *Se apoya en CLIs de terceros* (Aider, OpenCode, ZCode) más que en un CLI propio ampliamente adoptado |
| **Soporte de protocolo MCP** | Sí — origen del protocolo (Anthropic) | Soporte vía ecosistema/terceros | Sí, integrado en el ecosistema Google Cloud junto con A2A | Soporte vía compatibilidad OpenAI + terceros | Soporte vía compatibilidad OpenAI + terceros |
| **Soporte de protocolo A2A** | Vía ecosistema/terceros | Vía ecosistema/terceros | Sí — Google es originador; arquitectura de referencia combina A2A (orquestación) + MCP (ejecución de herramientas) | No es originador; adopción vía terceros | No es originador; adopción vía terceros |

**Lectura crítica de la matriz:** la columna que más se repite como "No expuesto" es precisamente la que un sistema de trazabilidad institucional necesita más (IP, fingerprint, firma, ubicación de almacenamiento). Esto no es una laguna accidental — es una decisión deliberada de los proveedores por razones de seguridad operativa y de simplicidad de superficie de API. **Ningún rediseño de prompt o parámetro de API va a producir esos datos.** Solo se obtienen por: (a) capa contractual empresarial (DPA, *audit logs* de Enterprise/Team con SSO y *compliance API*, como ofrece Anthropic Enterprise), o (b) instrumentación propia en la capa 5 (OpenTelemetry) que mide lo que tu propio sistema observa, no lo que el proveedor declara.

---

## 4. Matriz de protocolos y estándares de interoperabilidad/identidad

| Protocolo/estándar | Gobernanza | Qué resuelve | Qué NO resuelve | Estado de madurez (ago. 2026) | Relevancia directa para AN-KLA/CAGF |
|---|---|---|---|---|---|
| **MCP (Model Context Protocol)** | Anthropic (origen); adopción amplia como *de facto* para conexión agente↔herramienta | Cómo un agente descubre y usa herramientas/recursos externos; identidad de *servidores* MCP vía OAuth | No estandariza el auto-reporte del LLM en sí; no cubre firma de contenido | Alta adopción práctica, especialmente en *coding agents* | Capa de integración de herramientas — no es la capa de procedencia que CAGF necesita, pero sí es relevante si AN-KLA se expone como servidor MCP |
| **A2A (Agent2Agent)** | Google (origen) → Linux Foundation (gobernanza neutral desde jun. 2025); v1.0 estable en 2026, +150 organizaciones adherentes | Descubrimiento de agentes vía **Agent Card** (JSON: nombre, descripción, proveedor, versión, *skills*, endpoints, autenticación); en v1.0 soporta **Signed Agent Cards** | Estado interno del agente permanece opaco por diseño (no expone memoria/lógica interna); el *state machine* de tareas está descrito en prosa, no formalmente, lo que deja ambigüedades (p. ej. si una tarea cancelada puede reanudarse) | v1.0 estable; extensiones oficiales incluyen **Traceability**, **Timestamp** y **Secure Passport** — construidas exactamente para el problema de procedencia, pero como extensiones opcionales, no obligatorias | **Alta** — el Agent Card firmado es lo más cercano a un "carnet de identidad" estándar de agente; la extensión de *Traceability* es candidata directa a integrarse con el esquema de AN-KLA |
| **ACP (Agent Communication Protocol)** | IBM Research; fusionado bajo gobernanza de A2A/Linux Foundation (LF AI & Data) desde ago. 2025 | Semántica de negociación multi-turno entre agentes (herencia FIPA-ACL): proponer, aceptar, rechazar, contraofertar | No es un estándar de identidad ni de procedencia | En consolidación, absorbido dentro del paraguas A2A | Media — relevante solo si AN-KLA participa en negociación multi-agente, no para trazabilidad per se |
| **OpenTelemetry GenAI semantic conventions** | CNCF (OpenTelemetry se graduó como proyecto CNCF, mayo 2026); SIG GenAI formado abril 2024 | Vocabulario común (`gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.response.finish_reasons`, `gen_ai.agent.id`, `gen_ai.system_instructions`) para instrumentar *spans* de llamadas a LLM y ejecución de agentes/herramientas | Es una convención de **observabilidad interna**, no un estándar de identidad expuesto por el proveedor al público; los nombres de atributos aún no están congelados (pre-1.0/v1.37+, con cambios recientes como *reasoning tokens*) | Activa pero explícitamente inestable — cualquier integración debe aislar los nombres de atributo detrás de una capa propia de mapeo, no asumirlos fijos | **Alta para la capa 5 (auditoría operacional)** — es el estándar correcto para instrumentar el propio *pipeline* de AN-KLA/CAGF, pero no sustituye la firma criptográfica de contenido |
| **C2PA / Content Credentials** | Coalition for Content Provenance and Authenticity (Adobe, Microsoft, BBC, Intel, Sony, Google, Meta, OpenAI, +6,000 miembros); v2.3 (ene. 2026), en camino a norma ISO/IEC 22144 | Manifiesto firmado criptográficamente que declara qué modelo/dispositivo produjo o editó un activo, con qué *inputs* (assertion `inputTo`: *prompts*, *seeds*, parámetros), y la cadena completa de ediciones (`c2pa.created`, `c2pa.opened`, `c2pa.edited`) | Nació y madura sobre todo para **imagen/video/audio**; el soporte para manifiestos de **texto no estructurado** (que es el caso de una conversación de chat) es reciente (v2.3, dic. 2025) y con adopción práctica todavía baja comparado con imagen. Además, las plataformas suelen **eliminar metadatos al subir contenido**, rompiendo la cadena si no se preserva el archivo original | Madura y con respaldo regulatorio fuerte (EU AI Act Art. 50 exige divulgación legible por máquina desde ago. 2026; California SB 942) | **Alta como referencia arquitectónica** — el patrón de manifiesto firmado + cadena de ediciones es exactamente lo que CAGF debería emular para texto, dado que C2PA-para-texto aún no está consolidado en la práctica |
| **RFC 3161 (Time-Stamp Protocol)** | IETF | Sellado de tiempo criptográfico e independiente (vía TSA — *Timestamp Authority*) que prueba que un *hash* existía en un momento dado, sin depender de la hora del sistema local | No prueba autoría ni identidad del modelo — solo prueba "este *hash* existía en este instante" | Estándar maduro, ampliamente usado en firma electrónica legal | **Ya en uso en CAGF** — pieza correcta para no-repudio temporal; combinarlo con Merkle da agregación eficiente de múltiples eventos bajo un solo sello |
| **NOM-151-SCFI-2016** | Gobierno de México (Secretaría de Economía) | Conservación de mensajes de datos y digitalización de documentos con valor probatorio en México — constancia de conservación con sello de tiempo | Es un marco **nacional**, no reconocido automáticamente fuera de México; no cubre por sí solo la identidad del modelo que generó el contenido | Vigente, exigido para valor probatorio de documentos digitales en México | **Directamente relevante para CAGF** dado el contexto institucional mexicano (IMSS); es el ancla legal local que le da valor probatorio dentro de México a lo que RFC 3161 + Ed25519 + Merkle producen técnicamente |
| **DIDs / Agent Identity (W3C AI Agent Protocol CG, Auth0 AI Agent, Microsoft Entra Agent ID, AgentFacts, ADP, OASF)** | Fragmentado — múltiples iniciativas paralelas, ninguna dominante | Identidad verificable de "quién actuó" (agente vs. humano delegante), *claims* `ai_agent` en tokens OAuth, cadenas de delegación | Ecosistema inmaduro y fragmentado en 2026; riesgo real de que ninguna gane adopción dominante y el diseño de AN-KLA quede atado a una que se abandone | Temprana/experimental | **Baja-media a corto plazo** — vigilar pero no apostar la arquitectura central a un solo esquema de identidad de agente todavía |
| **SLSA + Sigstore** | OpenSSF / Linux Foundation | Atestación de cadena de suministro de software aplicada a artefactos de IA (procedencia del *pipeline* de entrenamiento/*fine-tuning*/despliegue) | Es procedencia del **modelo como artefacto**, no de cada respuesta individual que produce | Madura en software tradicional, aplicación a IA aún emergente | Media — relevante si AN-KLA necesita declarar procedencia del propio *pipeline*, no solo de las conversaciones |

---

## 5. Matriz de exportación / portabilidad de conversaciones (evidencia primaria para trazabilidad)

Esta capa es crítica para el diseño porque **la exportación nativa es, hoy, la única vía oficial de obtener el diálogo completo con metadatos** fuera de la propia sesión de API. Su fragmentación es en sí misma un hallazgo relevante para el diseño de AN-KLA.

| Proveedor | Mecanismo nativo | Formato | Alcance | Metadatos incluidos | Limitación crítica |
|---|---|---|---|---|---|
| **Claude (Anthropic)** | Configuración → Privacidad → Exportar datos; entrega por correo, enlace de descarga con expiración de 24 h | ZIP → JSON | Cuenta completa (todas las conversaciones), no una sola conversación desde la UI nativa | Estructura JSON con contenido y metadatos de conversación | No hay botón de exportación por conversación individual en la interfaz nativa; para eso se depende de herramientas de terceros (extensiones de navegador) |
| **Gemini (Google)** | Google Takeout → seleccionar "Gemini Apps" | HTML o JSON | Vinculado a la actividad de la cuenta Google (MyActivity) | Historial de actividad, no siempre con la misma granularidad de `usage`/tokens | Exportación de una sola respuesta a Docs/Gmail es distinta y más limitada que la exportación completa vía Takeout; el paquete de Takeout mezcla otros productos de Google si no se filtra |
| **Grok (xAI)** | No hay flujo de exportación de consumidor ampliamente documentado y estandarizado | — | — | — | Mayor opacidad relativa comparado con Claude/Gemini en este punto |
| **Kimi (Moonshot AI)** | No hay flujo nativo de exportación de conversación de consumidor comparable documentado | — | — | — | La vía práctica es la API (donde el propio sistema cliente conserva el historial que envía/recibe) |
| **GLM (Zhipu AI / Z.ai)** | No hay flujo nativo de exportación de conversación de consumidor comparable documentado | — | — | — | Igual que Kimi: la trazabilidad depende de que el cliente (harness/CLI) conserve lo que la API devuelve |

**Consecuencia de diseño:** para los cinco proveedores, **la fuente de verdad más confiable y uniforme no es la exportación nativa (fragmentada, inconsistente, a veces inexistente), sino capturar y firmar en el momento de la llamada API**, del lado del cliente (esto es exactamente lo que un CLI/agente propio, o el propio AN-KLA como *middleware*, puede y debe hacer). Depender de que el usuario exporte manualmente después introduce una ventana de alterabilidad que rompe cualquier pretensión de no-repudio.

---

## 6. Riesgos y huecos críticos para un sistema de trazabilidad institucional

1. **Riesgo de suplantación de identidad de modelo ("model spoofing").** Como el campo `model` es autoreportado por el proveedor y no está firmado criptográficamente en la respuesta estándar de chat, un *proxy* intermedio (o un *harness* mal configurado, o un *endpoint* compatible-OpenAI de terceros que enruta a un modelo distinto del anunciado) puede declarar un modelo que no es el que realmente generó la respuesta. Esto ya es un vector de disputa comercial documentado en el ecosistema (acusaciones cruzadas de *distillation*/enrutamiento oculto entre laboratorios). **Mitigación de diseño:** anclar la identidad del modelo al *endpoint*/clave de API verificado por el propio sistema (no solo al campo `model` de la respuesta), y tratar el campo `model` como una declaración a corroborar, no como un hecho.

2. **Inconsistencia de vocabulario entre proveedores** (`input_tokens` vs. `prompt_tokens` vs. `prompt_token_count`; `stop_reason` vs. `finish_reason` vs. `finishReason`) obliga a una capa de normalización propia antes de cualquier análisis agregado. Esto es exactamente el tipo de problema que OpenTelemetry GenAI intenta resolver, pero su propia inestabilidad de nombres (pre-1.0) significa que **AN-KLA debería definir su propio esquema canónico interno** y usar `gen_ai.*` como una de varias fuentes que se mapean hacia ese esquema, no como el esquema final.

3. **El costo no es un hecho objetivo transmitido por el proveedor sino un cálculo derivado**, sensible a: tarifas introductorias con fecha de expiración, descuentos por *caching* (hasta 90% de reducción en *input* cacheado), descuentos por *batch* (~50%), y el hecho de que el consumo por suscripción (plan fijo) no tiene costo marginal por mensaje. Un campo "costo" en la base de datos de AN-KLA debe llevar siempre versión de tarifa y fecha de vigencia asociada, no solo el número.

4. **Ubicación de almacenamiento y jurisdicción de datos es un dato contractual, no técnico.** Para proveedores chinos (Kimi, GLM) esto tiene, además, una dimensión geopolítica activa en 2026 (tensiones de exportación de cómputo, escrutinio regulatorio), lo cual es relevante si el sistema de CAGF necesita declarar cadena de custodia con implicaciones de soberanía de datos para un organismo público mexicano como IMSS.

5. **C2PA para texto conversacional es la pieza menos madura del ecosistema de procedencia**, precisamente el tipo de contenido que más produce un sistema como CVOED/AN-KLA. Esto refuerza — no debilita — la decisión ya tomada en CAGF de construir un esquema propio (Ed25519 + Merkle + RFC 3161) en lugar de esperar a que C2PA madure para este caso de uso.

6. **Ningún protocolo de los revisados resuelve, por sí solo, el requisito de "grado de patente".** A2A da identidad de agente; C2PA da procedencia de contenido (para medios, no texto maduro); RFC 3161 + NOM-151 dan no-repudio temporal legal en México; OpenTelemetry da observabilidad operacional. **Ninguno da autoría verificable de texto de forma nativa.** Esa síntesis solo la produce la combinación que CAGF ya está diseñando.

---

## 7. Esquema mínimo recomendado de auto-reporte para AN-KLA (síntesis operativa)

Para cada evento de interacción con un modelo, capturado del lado cliente (no confiado al proveedor):

```json
{
  "evento_id": "uuid",
  "timestamp_local": "ISO 8601",
  "timestamp_rfc3161": "token TSA",
  "modelo": {
    "declarado_por_api": "valor exacto del campo model",
    "proveedor": "anthropic | xai | google | moonshot | zhipu",
    "endpoint_verificado": "URL/clave usada, no solo el nombre declarado",
    "version_harness": "versión del CLI/SDK cliente"
  },
  "consumo": {
    "tokens_entrada": 0,
    "tokens_salida": 0,
    "tokens_cache_lectura": 0,
    "tokens_cache_escritura": 0,
    "tokens_razonamiento": 0,
    "costo_calculado": 0.0,
    "tabla_tarifas_version": "id de versión de la tabla interna de precios"
  },
  "contexto": {
    "ventana_maxima_modelo": 0,
    "tokens_usados_porcentaje": 0.0
  },
  "contenido": {
    "hash_sha256_entrada": "...",
    "hash_sha256_salida": "...",
    "firma_ed25519": "...",
    "raiz_merkle_lote": "..."
  },
  "custodia": {
    "sistema_almacenamiento": "AN-KLA / ubicación interna",
    "politica_retencion": "referencia a política CAGF",
    "jurisdiccion_declarada": "MX / otra, según proveedor y contrato"
  },
  "protocolo_origen": {
    "via": "api_directa | mcp | a2a | cli",
    "agent_card_firmado": true
  }
}
```

Este esquema trata cada capa (identidad, consumo, contenido, custodia, protocolo) como un bloque independiente, exactamente como el análisis de la Sección 2 recomienda — y deja explícito qué campos son **declarados por el proveedor** (y por tanto deben tratarse como evidencia a corroborar) frente a los que son **generados y firmados por el propio sistema** (que son los que realmente sostienen no-repudio).

---

## 8. Conclusión

El hallazgo original — "no hay estándar único" — es correcto pero insuficiente como base de diseño. El hallazgo más útil es que **el ecosistema en 2026 se ha fragmentado en capas especializadas y no coordinadas** (identidad de invocación, identidad de agente, procedencia de contenido, observabilidad, cumplimiento legal), cada una con su propio estándar parcial y su propio nivel de madurez, y que **ninguna combinación de estándares de terceros sustituye una capa propia de firma y sellado de tiempo controlada por quien necesita la prueba** — que es exactamente la apuesta arquitectónica que CAGF ya hizo con Merkle + RFC 3161 + NOM-151, y que este análisis confirma como la decisión correcta más que como una entre varias opciones equivalentes.

