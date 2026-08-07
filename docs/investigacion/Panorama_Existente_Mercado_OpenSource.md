# Panorama existente: ¿ya hay algo parecido? Mapeo de mercado y open source frente al sistema propuesto

**Continuación de los tres documentos anteriores** (trazabilidad, arquitectura de monitoreo, verificación activa).
**Pregunta que responde este documento:** de las cinco capas ya diseñadas (fuentes/registro de modelos, observabilidad, pruebas activas, seguridad activa, procedencia criptográfica con valor legal), ¿cuáles ya tienen soluciones maduras en el mercado u open source que se puedan adoptar directamente, y cuál es el hueco real que justifica construir algo propio?

**Conclusión adelantada:** existe un ecosistema disperso que cubre bien cuatro de las cinco capas por separado. **Ninguno de los proyectos encontrados integra las cinco en una sola cadena de custodia con valor probatorio institucional** (firma + sellado de tiempo + marco legal mexicano). Ese sigue siendo el hueco genuino — pero construirlo desde cero sin apoyarse en lo que ya existe sería reinventar trabajo maduro innecesariamente.

---

## 1. Capa de registro de modelos, precios y convergencia de funciones — **ya existe, y es sólida**

Esta es la capa mejor cubierta del mercado. Lo que se propuso como "matriz de convergencia de funciones de API" en el documento anterior ya existe, en distintos grados de apertura y actualización:

| Proyecto | Naturaleza | Qué cubre | Licencia/apertura |
|---|---|---|---|
| **LiteLLM (BerriAI)** | Librería/*gateway* open source con un archivo `model_prices_and_context_window.json` mantenido y actualizado por *pull requests* de la comunidad y por *pipeline* automatizado propio | Precio por token, ventana de contexto, soporte de visión/audio/función/etc. para más de 100 proveedores; expone además una API de catálogo consultable | Open source, muy activo (decenas de miles de estrellas en GitHub); es la fuente que citan casi todos los agregadores de la tabla siguiente |
| **openmodelsrun/openmodels** | Registro comunitario en YAML con esquema validado (precio, límites de tasa, regiones, ventana de contexto) | Similar a LiteLLM pero con foco en descubrimiento de proveedores/regiones y con API REST propia | Open source |
| **artificialanalysis.ai, llm-stats.com, whatllm.org, benchlm.ai, model-market-comparison** | Sitios/paneles de comparación (algunos con repo open source) | Beno benchmarks de capacidad, precio, velocidad, ventana de contexto agregados de decenas de proveedores; actualización frecuente (algunos declaran actualización diaria o por hora) | Mixto — algunos con datos abiertos vía API, otros cerrados |

**Hallazgo relevante para el diseño propio:** BenchLM.ai ya ofrece una función llamada *Radar* que envía por correo alertas de "modelo nuevo, cambio de precio, actualización de API o caída de servicio" con la fuente citada — es decir, **la idea central de la Capa 3 (clasificación + notificación) del documento de arquitectura ya está implementada como producto comercial**, aunque orientada al mercado general, no a un caso de uso institucional de salud pública mexicana con requisitos de procedencia legal.

**Recomendación:** no construir esta capa desde cero. Consumir el JSON de LiteLLM (o el registro de openmodelsrun) como fuente primaria de la matriz de convergencia, y reservar el trabajo propio para: (a) los campos que estos registros no cubren bien (IP/ubicación de inferencia, soporte MCP/A2A detallado, distinción CLI oficial vs. comunitario), y (b) la curaduría específica en español para el caso de uso de IMSS.

---

## 2. Capa de changelog/seguimiento de CLIs — **cobertura parcial, fragmentada**

| Proyecto | Qué cubre | Limitación frente a lo diseñado |
|---|---|---|
| **`CHANGELOG.md` propios de cada repo** (Claude Code, Kimi Code CLI, Cline, `grok-cli` comunitario) | Fuente primaria más confiable, ya identificada en el documento anterior | No hay agregador único que los unifique entre sí ni que los clasifique por severidad |
| **`marckrenn/claude-code-changelog`** | Proyecto comunitario no oficial que rastrea específicamente la evolución de *prompts* internos y *feature flags* de Claude Code versión a versión | Cubre solo un CLI, y su propósito (ingeniería inversa de *prompts* del sistema) plantea una zona gris de términos de servicio que conviene no replicar sin revisión legal previa |
| **Terminal Trove — tabla comparativa de agentes de codificación** | Compara ~46 CLIs/agentes de codificación por soporte de MCP, *BYOK*, edición multi-archivo, precio y resultado en Terminal-Bench, en una sola tabla curada manualmente | Es una fotografía puntual mantenida por terceros, no una fuente programática ni con alertas de cambio |

**Hallazgo relevante:** no existe, hasta donde muestra esta investigación, un agregador **programático y multi-CLI** de changelogs con clasificación automática de severidad (función nueva / *breaking change* / *fix* de seguridad) equivalente al diseñado en el documento de arquitectura. Esta sigue siendo una pieza genuina de trabajo propio, aunque de complejidad moderada (es, esencialmente, un *poller* de la API de GitHub sobre un conjunto conocido de repos).

---

## 3. Capa de observabilidad/trazabilidad técnica (Capa 5 del documento de arquitectura) — **ya existe, muy madura**

Esta es, junto con la Capa 1, la mejor resuelta del mercado, y de hecho valida directamente el diseño propuesto en el primer documento (esquema `usage`/tokens/costo, convenciones `gen_ai.*` de OpenTelemetry):

| Proyecto | Naturaleza | Relación con lo diseñado |
|---|---|---|
| **Langfuse** | Plataforma open source (licencia MIT) de trazabilidad, evaluación y gestión de *prompts*, autoalojable, construida sobre convenciones de OpenTelemetry GenAI | Es, en la práctica, una implementación productiva de la Capa 5 ("observabilidad operacional") del documento de arquitectura — instrumenta llamadas, captura tokens/costo/latencia, y soporta *datasets* y evaluación |
| **Helicone** | *Gateway*/proxy — se integra cambiando la URL base de la API | Cubre trazabilidad de bajo esfuerzo pero sin visibilidad de la estructura interna de un agente multi-paso (no ve subagentes ni herramientas intermedias) |
| **Arize Phoenix, OpenLLMetry** | Alternativas open source con enfoque en evaluación y compatibilidad OpenTelemetry | Mismo espacio que Langfuse, con distinto énfasis (Phoenix, evaluación/*embeddings*; OpenLLMetry, instrumentación pura) |

**Recomendación:** Langfuse, autoalojado, es un candidato directo para servir como backend de la Capa 5 del sistema de AN-KLA/CAGF, dado que ya habla el vocabulario `gen_ai.*` que se identificó como el más apto para observabilidad, y que su licencia MIT permite autoalojamiento en infraestructura.
---

## 4. Capa de pruebas activas de CLIs — **ya existe como categoría, con un proyecto de referencia claro**

El documento de verificación activa propuso una "batería de regresión funcional" corrida en contenedores aislados. Esto ya existe como categoría establecida bajo el nombre de *agentic/terminal benchmarking*:

| Proyecto | Qué hace | Relación directa con lo propuesto |
|---|---|---|
| **Terminal-Bench (tbench.ai) + Harbor** | Benchmark abierto que evalúa agentes de codificación (incluidos Claude Code, Codex CLI, Gemini CLI, Grok Build CLI, Kimi Code CLI, Cline, entre ~46 más) ejecutando tareas reales dentro de contenedores Docker aislados, con verificación automática de estado final, y con métricas de costo, tokens y tiempo por prueba | Es, casi literalmente, la infraestructura que la Sección 2.2 del documento de verificación activa describía como necesaria ("batería fija de tareas, contenedores efímeros, verificación de estado") — Harbor incluso soporta tres modos de integración de agente (instalación en contenedor, integración directa, servidor MCP) |
| **Terminal Trove (comparativa)** | Usa los resultados de Terminal-Bench para publicar una tabla de precisión por agente | Corrobora que la práctica de "correr los mismos CLIs contra el mismo conjunto de tareas y comparar" ya es una disciplina establecida en la comunidad, no una idea aislada del diseño propio |

**Lo que Terminal-Bench NO cubre** (y que sigue siendo trabajo propio necesario): pruebas de comportamiento de red/seguridad tipo *canary token* (Sección 2.4 del documento de verificación activa), verificación dirigida de afirmaciones puntuales de un changelog recién detectado, e integración con la cadena de firma/sellado de CAGF. Terminal-Bench mide *si el agente resuelve la tarea*, no *si el agente se comporta de forma segura y transparente mientras la resuelve* — son objetivos distintos y complementarios.

**Recomendación:** adoptar Harbor (el motor de ejecución de Terminal-Bench) como base técnica para la batería de regresión propia, en lugar de construir el orquestador de contenedores desde cero, y añadir sobre él las pruebas de seguridad/red y de verificación dirigida que Terminal-Bench no contempla.

---

## 5. Capa de seguridad activa (comportamiento de red, *canary tokens*, escaneo de MCP) — **existe, y confirma que el riesgo es real y ya catalogado**

Esta búsqueda produjo el hallazgo más importante para la priorización del sistema: **el tipo de incidente usado como caso de estudio en el documento anterior (Grok Build) no es un caso aislado — es parte de una categoría de riesgo ya activamente catalogada y con herramientas de mercado dedicadas.**

| Proyecto/hallazgo | Naturaleza | Relevancia |
|---|---|---|
| **`agent-bom`** | Escáner de seguridad de cadena de suministro para agentes/MCP, de código abierto, autoalojable; construye un inventario tipo "AI-BOM" (agentes, servidores MCP, herramientas, credenciales expuestas) y produce hallazgos con evidencia auditable en formatos SBOM/SARIF | Es el concepto más cercano encontrado al "esquema de auditoría con evidencia propia" propuesto en el documento de verificación activa, aplicado específicamente a inventario y exposición, no solo a *changelogs* |
| **Snyk `agent-scan`** | Escáner comercial (Snyk) de agentes/MCP/*skills* locales, con modo de fondo para monitoreo continuo tipo MDM, orientado a *prompt injection*, envenenamiento de herramientas ("*tool poisoning*") y flujos tóxicos | Confirma que hay demanda comercial establecida por exactamente este tipo de vigilancia continua de agentes de codificación |
| **MCP-Scanner (eSentire Labs, académico/open source)** | Analiza servidores MCP combinando detección de palabras clave, análisis semántico y evaluación por LLM, para detectar envenenamiento de variables/herramientas, inyección de *prompt*, ataques de sustitución ("*rug pull*") y suplantación de servidor | Aporta un enfoque metodológico útil (combinar reglas + LLM) que se puede aplicar a la Capa 3 de clasificación del documento de arquitectura, no solo a MCP |
| **The Vulnerable MCP Project** (mantenido por investigadores de SentinelOne, Snyk, Trail of Bits y CyberArk) | Catálogo de más de 50 vulnerabilidades conocidas de MCP, con más de una decena calificadas como críticas | Es una fuente de monitoreo pasivo adicional que el sistema de AN-KLA debería incorporar directamente a la Capa 1 (fuentes) del documento de arquitectura, junto con las *Security Advisories* de GitHub ya recomendadas |
| **Registro oficial de MCP** (lanzado públicamente en el primer trimestre de 2026, con firma y verificación de proveedor) | Intento de la propia comunidad MCP de resolver el problema de procedencia de servidores | Confirma, desde el propio ecosistema MCP, que la falta de verificación de procedencia ya se identificó como el problema central — exactamente el diagnóstico del primer documento de este proyecto |

**Casos reales adicionales al de Grok Build, encontrados en esta búsqueda, que refuerzan la prioridad de esta capa:**

- Tres vulnerabilidades (recorrido de ruta, inyección de argumentos y omisión del alcance del repositorio) reportadas en enero de 2026 contra el propio servidor oficial de Git MCP de Anthropic.
- Un caso de exfiltración de datos de repositorios privados a través del servidor MCP de GitHub, mediante instrucciones ocultas en un *issue*.
- Un compromiso de la cadena de suministro del sistema de construcción Nx (agosto de 2025) que usó agentes de codificación de IA como vector para robar miles de tokens de GitHub y decenas de miles de archivos.
- Una vulnerabilidad de ejecución remota de código en el inspector de MCPJam, derivada de que el servicio quedaba expuesto por defecto en todas las interfaces de red en lugar de solo en `localhost`.

**Consecuencia directa para el diseño:** la Sección 6 del documento de verificación activa ya asignaba a Grok Build la prioridad máxima de vigilancia de seguridad. Esta investigación muestra que **ese nivel de prioridad debe extenderse a cualquier CLI que exponga o consuma servidores MCP** (es decir, los seis del alcance original), no solo al que ya tuvo un incidente público — porque el patrón de riesgo (inyección de instrucciones ocultas, exposición de red por defecto, sobreprivilegio de credenciales) es transversal a la arquitectura MCP en sí, no específico de un proveedor.

**Recomendación:** no construir el escáner de seguridad desde cero. Evaluar `agent-bom` (por su enfoque de evidencia auditable tipo SBOM/SARIF, más alineado con el requisito de trazabilidad verificable de CAGF que un producto puramente comercial) como motor de la Capa de seguridad activa, complementado con el catálogo del Vulnerable MCP Project como fuente pasiva adicional.

---

## 6. El hueco real: qué no existe en ninguno de los proyectos encontrados

Ningún proyecto de los identificados combina, en una sola cadena, las cinco piezas siguientes:

1. Registro vivo de capacidades/precios (resuelto por LiteLLM y similares).
2. Seguimiento clasificado de *changelogs* de CLIs específicos con alertas por severidad (parcialmente resuelto, fragmentado).
3. Observabilidad de uso propio con vocabulario estándar (resuelto por Langfuse y similares).
4. Verificación activa por ejecución en sandbox (resuelto por Terminal-Bench/Harbor para *funcionalidad*, pero no para *seguridad*).
5. **Firma criptográfica + sellado de tiempo de cada hecho registrado, con valor probatorio bajo un marco legal.**

El punto 5 es, con la evidencia de esta búsqueda, **el elemento genuinamente diferenciador del diseño de CAGF/AN-KLA** frente a todo lo que existe en el mercado y en *open source*. Todos los proyectos de observabilidad y seguridad revisados están diseñados para *ingeniería* (depurar, optimizar costo, prevenir incidentes técnicos) — ninguno está diseñado para producir **evidencia con valor legal ante una eventual auditoría o disputa institucional en México**, que es precisamente el objetivo que ya venía persiguiendo CAGF con Ed25519 + Merkle + RFC 3161 antes de esta investigación.

---

## 7. Recomendación de integración (qué construir vs. qué adoptar)

| Capa | Adoptar de terceros | Construir a medida |
|---|---|---|
| Registro de modelos/precios/funciones | LiteLLM (`model_prices_and_context_window.json`) como fuente primaria | Curaduría de campos no cubiertos (MCP/A2A detallado, IP/ubicación, distinción oficial/comunitario), en español |
| Seguimiento de *changelogs* de CLIs | Ninguno cubre esto de forma programática y multi-CLI hoy | *Poller* propio sobre la API de GitHub (releases, *commits* de `CHANGELOG.md`, *Security Advisories*) — pieza relativamente pequeña |
| Observabilidad de uso propio | Langfuse, autoalojado | Integración con el esquema canónico de evento del documento de trazabilidad |
| Pruebas activas de funcionalidad | Harbor (motor de Terminal-Bench) | Batería de tareas propia relevante al caso de uso de CAGF/IMSS, no solo las tareas genéricas del benchmark público |
| Pruebas de seguridad/red | `agent-bom` y/o Snyk `agent-scan` como motor de escaneo; Vulnerable MCP Project como fuente pasiva | Pruebas de *canary token* específicas y comparación volumen esperado/observado (no encontradas como producto ya empaquetado) |
| **Procedencia con valor legal** | Ninguno | **Todo — es la pieza propia de CAGF, sin equivalente en el mercado** |

---

## 8. Conclusión

La investigación confirma dos cosas a la vez, y ambas son útiles: **sí existe ya bastante de lo que se había diseñado**, especialmente en las capas de registro de modelos y de observabilidad técnica, lo cual significa que gran parte del sistema puede construirse integrando proyectos abiertos maduros (LiteLLM, Langfuse, Harbor) en lugar de reinventarlos — y **el elemento que motivó originalmente este proyecto (procedencia verificable con valor legal institucional) sigue sin tener equivalente**, lo cual confirma que la apuesta arquitectónica de CAGF no es una entre varias opciones ya resueltas por el mercado, sino la pieza que efectivamente falta en el panorama actual.
