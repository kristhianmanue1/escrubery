# Plan iterativo e incremental v2: servicio de inteligencia sobre modelos y CLIs de IA

**Estado:** propuesta v2. Incorpora los diez cambios del documento *Análisis crítico del plan y propuesta de cambios* sobre el plan v1 (`Plan_Iterativo_Incremental_Servicio_CLI_Modelos.md`), que se conserva como historia.
**Cambios estructurales respecto a v1:** la Fase 0 entrega un artefacto funcional (Ficha v0); la Fase 1 tiene canal de consulta decidido y consumidores reales declarados; la Fase 2 firma con los patrones corregidos del análisis de CAGF; se añade una pista paralela de decisiones no técnicas; la Fase 3 gana criterios de entrada; la Fase 5 queda condicional a una decisión de alcance.

---

## 1. Principios que rigen el plan

1. **Esqueleto ambulante (*walking skeleton*) antes que profundidad**, con valor funcional desde la Fase 0. La primera entrega útil no espera a la base de datos: la Ficha v0 (Sección 3) es consultable desde el primer ciclo.
2. **Cachear-al-consultar, no vigilar-todo-el-tiempo.** El patrón por defecto es: *¿tengo el dato en base de datos y sigue vigente? → sirvo de ahí. ¿No lo tengo o caducó? → lo obtengo una vez, lo normalizo, lo guardo con fecha, lo sirvo.* Nunca *polling* continuo ni un agente de IA "investigando" en cada consulta.
3. **No reconstruir lo que ya existe.** LiteLLM para precios/funciones/contexto, APIs de GitHub para *changelogs*, Harbor para pruebas activas, `agent-bom` para seguridad.
4. **Todo dato que la herramienta entregue lleva procedencia rastreable desde el día uno**: `fuente_url`, `fecha_obtencion` y `hash_del_contenido_original` desde la Fase 0 — incluidos los datos capturados manualmente, que entran por *script* de ingesta, nunca por pegado libre.
5. **Desarrollo agente-nativo (ADRC)**: ciclos cortos y verificables, con Mediador humano cerrando cada fase contra su criterio escrito (Sección 10).
6. **Diseñar para consumo por agentes desde la Fase 1**, con contratos JSON estables y versionados (documento `CONTRATO_API_v0.md`), de modo que la Fase 5 sea un adaptador MCP, no una reescritura.
7. **Diseñar para consumidores reales, no genéricos** (nuevo en v2): los agentes ADRC, expertoGobernanza y CAGF son usuarios declarados desde la Fase 1, con necesidades documentadas que informan el contrato (Sección 4.4).

---

## 2. Panorama de fases

| Fase | Nombre | Qué entrega | Duración estimada (ciclos) | Depende de |
|---|---|---|---|---|
| **0** | Cimientos + Ficha v0 | Esquema de datos, fuentes, entorno base, **y un snapshot consultable de los 6 CLIs y 5 proveedores (JSON por entidad + comando `consultar`), sin base de datos** | 2–3 ciclos | — |
| **1** | MVP de consulta | CLI `consultar` + endpoint HTTP JSON sobre PostgreSQL, inventario de comandos y modelos servido con caché-al-consultar, consumido por ADRC y expertoGobernanza | 3–5 ciclos | Fase 0 |
| **2** | Changelog clasificado + alertas + firma por evento | *Poller* de GitHub, clasificación por severidad, notificaciones, firma Ed25519 por evento con `prev_hash` y checkpoint firmado, fuente Vulnerable MCP, validación cruzada de LiteLLM, alerta de divergencia pasiva | 4–6 ciclos | Fase 1 |
| **3** | Introspección activa automatizada | `--help`/`--version` diffing por versión en contenedor efímero, inventario vivo de comandos | 3–4 ciclos | Fase 2 **+ criterios de entrada (Sección 6.1)** |
| **4** | Pruebas activas + seguridad + CAGF completo | Batería de regresión (Harbor), pruebas de red con *canary tokens*, Merkle + RFC 3161 (+ anclaje NOM-151 si aplica) | 6–10 ciclos | Fase 3 |
| **5** | Exposición como servicio / MCP | Servidor MCP, Agent Card firmado, niveles de acceso | 4–6 ciclos | Fase 4 **+ decisión de alcance del servicio (Sección 3.3)** |

La numeración es de prioridad, no de calendario estricto: la Fase 2 puede empezar antes de cerrar la Fase 1 si hay capacidad paralela. Lo que **no** debe adelantarse es la Fase 4 antes del inventario de las Fases 1–3.

---

## 3. Fase 0 — Cimientos + Ficha v0 (2–3 ciclos)

**Objetivo:** dejar listos los cimientos **y** entregar el primer artefacto funcional consultable.

### 3.1 Cimientos (como en v1)

- Repositorio base con el *stack* estándar del ecosistema (NestJS + PostgreSQL).
- Esquema de base de datos mínimo (Sección 9): `modelos`, `cli_productos`, `cli_comandos`, más `consultas_log` (nuevo en v2).
- Lista cerrada de fuentes de la Fase 1: JSON de LiteLLM y los seis repos de CLI ya identificados (Claude Code, Kimi Code CLI, Codex CLI, Grok CLI/Grok Build — distinguidos explícitamente —, Antigravity CLI, Cline).
- Decisión explícita de no usar servicios de pago ni ejecutar los CLIs: Fases 0–1 son 100% lectura de fuentes públicas gratuitas.

### 3.2 Ficha v0 — entregable funcional (nuevo en v2)

- Directorio `datos/fichas/` con un archivo JSON por CLI (6) y por proveedor de modelo (5), normalizados al esquema canónico, cada uno con `fuente_url`, `fecha_obtencion` y `hash_sha256`.
- Las fichas de modelo se generan por *script* desde el JSON de LiteLLM; las fichas de CLI se **curadurizan** desde las matrices de los documentos de investigación (no se scrapea en esta fase).
- Comando `consultar` (script sobre archivos, sin base de datos) que responde: "¿qué flags tiene `claude mcp`?", "¿precio y contexto de `kimi-k3`?", "¿qué CLIs son oficiales vs. comunitarios?".
- **Criterio de terminado de la Ficha v0:** un agente o una persona obtiene con un comando la ficha de cualquiera de los 6 CLIs y 5 proveedores, con fuente y fecha citadas.

### 3.3 Pista paralela de decisiones no técnicas (nuevo en v2)

Arranca en la Fase 0 y corre en paralelo a todas las fases. No consume ciclos de desarrollo; consume calendario, que es su costo real.

| Decisión | Necesaria para | Contenido mínimo |
|---|---|---|
| Revisión de Términos de Servicio de los 6 CLIs (automatización, *benchmarking*, extracción) | Fase 3 (criterio de entrada) | Documento de revisión por CLI |
| Esquema de llaves Ed25519 | Fase 2 | **Clave por servicio/agente firmante** (no mono-clave), rotación y revocación documentadas, privada fuera del worktree (nunca PEM sin cifrar en disco), keyring público commiteado en formato compatible con `cagf-keyring/0.1` |
| Canonicalización de payloads firmados | Fase 2 | JCS/RFC 8785 (no `sort_keys` casero), para que terceros verifiquen firmas sin replicar una implementación específica |
| Naturaleza del servicio (herramienta interna del ecosistema vs. producto con niveles de acceso) | Fase 5 (condición de activación) | Decisión del Mediador |

### 3.4 Decisiones de interfaz (nuevo en v2)

- El canal de consulta se decide **ahora**: (a) CLI propio `consultar` y (b) endpoint HTTP JSON con el mismo contrato. El contrato v0 vive en `docs/CONTRATO_API_v0.md` y se permite ruptura explícita hasta la Fase 2.
- `AGENTS.md` del repo: contrato operativo para los agentes que desarrollan (roles ADRC, convenciones, criterios de cierre, bitácora de ciclos).

**Criterio de "terminado" de la Fase 0:** la Ficha v0 cumple su criterio (3.2), las cuatro decisiones de 3.3 están iniciadas (documentadas como abiertas con responsable), el contrato v0 está anexado, y se puede correr `SELECT` sobre las tablas del núcleo.

---

## 4. Fase 1 — MVP de consulta (3–5 ciclos)

### 4.1 Alcance funcional (como en v1)

- **Consulta de modelos:** capacidades, ventana de contexto, funciones y precio de los 5 proveedores, 100% desde datos normalizados de LiteLLM, sin llamar a ningún modelo de IA para responder.
- **Consulta de comandos de CLI:** comandos/*flags* de los 6 CLIs, capturados una sola vez por versión, no en cada consulta.
- **Ayuda de configuración asistida:** plantillas de configuración mínima por CLI (estructura de `mcp_config.json`, variables de entorno, primer login), guardadas como plantilla versionada, no generadas por inferencia en cada respuesta.

### 4.2 Patrón de caché-al-consultar (sin cambios)

```
Consulta del usuario
      │
      ▼
¿Existe el dato y su fecha_obtencion está dentro
 de la ventana de vigencia para ese tipo de dato
 (ej. 24h precios, 7 días inventario de comandos)?
      │
   ┌──┴───┐
  Sí       No
   │        │
   ▼        ▼
Servir    Ir a la fuente externa UNA vez,
de BD     normalizar, guardar con
          fuente_url + hash + fecha,
          y luego servir
```

### 4.3 Ingesta del inventario de comandos (corregida en v2)

En la Fase 1 el inventario **no** se obtiene ejecutando CLIs (eso es Fase 3). Se obtiene de la documentación oficial, de `CHANGELOG.md`/`README.md` de los repos públicos, y de captura manual puntual — pero la captura manual entra por **script de ingesta asistida**, nunca por pegado libre: el Mediador ejecuta `ingestar --cli claude --comando "--help"`, y el script captura la salida, calcula `hash_sha256`, registra `fecha_obtencion` y `fuente_url` (aunque la fuente sea "ejecución local supervisada") e inserta. El mismo script es la base del automatismo de la Fase 3.

### 4.4 Consumidores declarados (nuevo en v2)

El sistema se consume desde el ciclo 1 por:

- **Agentes ADRC** (Arquitecto/Ejecutor) durante el propio desarrollo: consultas de comandos, flags, capacidades y configuración MCP.
- **expertoGobernanza**: resolución de identidad canónica de modelo para su `configuration_fingerprint`, verificación de decorrelación de arquitecturas de su quórum adversarial, metadatos de política de datos por proveedor para su router, y disponibilidad/precios por proveedor.
- **CAGF** (integración gradual): verificación de hechos firmados a partir de la Fase 2.

Esto añade al contrato dos operaciones que LiteLLM no cubre y que los consumidores reales necesitan: `resolver_identidad_modelo` (issuer → proveedor/modelo canónico) y `politica_datos_proveedor` (retención/entrenamiento/transferencia, curaduría propia). Ver `CONTRATO_API_v0.md`.

### 4.5 Instrumentación (nuevo en v2)

Toda consulta se registra en `consultas_log` (consulta, fuente de respuesta — BD/fuente externa/sin datos —, latencia, fecha). Esto habilita la métrica de la Fase 1 y detecta demanda de datos faltantes.

**Criterios de "terminado" de la Fase 1:**
1. Un usuario pregunta por un modelo o comando de cualquiera de los 6 CLIs/5 proveedores y recibe respuesta correcta con fuente citada, en milisegundos desde BD, sin llamar a un modelo de IA ni a fuente externa (salvo primera consulta de un dato nuevo).
2. **Toda respuesta sobre un CLI muestra explícitamente si el producto es oficial o comunitario** (`cli_productos.tipo`); el sistema nunca mezcla Grok CLI con Grok Build sin distinguirlos.
3. Al menos un consumidor real (ADRC o expertoGobernanza) resolvió una consulta real a través del CLI o el endpoint.

---

## 5. Fase 2 — Changelog clasificado, alertas y firma por evento (4–6 ciclos)

### 5.1 Alcance funcional

- *Poller* de la API de GitHub sobre los seis repos (releases + *commits* sobre `CHANGELOG.md` + *Security Advisories*), con cadencia diferenciada (diaria: Claude Code y Grok Build; semanal: el resto).
- **Nueva fuente pasiva (v2):** Vulnerable MCP Project, categoría `fix_seguridad` con notificación inmediata — el riesgo MCP es transversal a los seis CLIs, no exclusivo de Grok Build.
- Clasificación automática de cada entrada nueva, una sola vez por entrada: `funcion_nueva | breaking_change | fix_seguridad | deprecacion | cambio_precio | cambio_limite | ruido_irrelevante`.
- Notificación inmediata para `fix_seguridad` y `breaking_change`; agregación semanal para el resto.
- **Validación cruzada de LiteLLM (nuevo en v2):** chequeo contra una segunda fuente (openmodelsrun o endpoint `/models` del proveedor); discrepancia sobre umbral → el dato queda `pendiente_de_verificar`, nunca se sirve como confirmado.
- **Alerta de divergencia pasiva (nuevo en v2):** entrada de changelog que menciona un comando/flag ausente del inventario documentado, o viceversa. Es la mitad barata de la señal estrella de la Fase 3, sin ejecutar CLIs.

### 5.2 Firma por evento (reescrita en v2 — antes "CAGF ligero")

La Fase 2 firma cada hecho con los patrones validados del análisis de CAGF, corregidos:

- **Por evento:** `hash_evento_anterior` del mismo producto **dentro** del payload firmado — cadena y firma se refuerzan mutuamente (patrón `event_log.py` de CAGF).
- **Checkpoint firmado del tip** por lote/día, persistido **fuera** de la base de datos (patrón `trace_verify.py` de CAGF): defensa contra reescritura total, sin esperar a Merkle.
- **Formato alineado con CAGF:** firma `"ed25519:" + base64`, clave pública DER/base64 en keyring JSON commiteado — los hechos son verificables por CAGF y expertoGobernanza sin adaptadores ad hoc.
- **Canonicalización JCS/RFC 8785** y **clave dedicada del servicio** con custodia, rotación y revocación según lo decidido en 3.3 — las dos correcciones sobre las debilidades documentadas de CAGF (mono-clave, PEM sin cifrar, `sort_keys` casero).
- **Verificador read-only** (`verificar` como comando independiente que nunca muta la base de datos), con política fail-closed.

Sigue siendo "ligero": sin Merkle ni RFC 3161 todavía (eso es Fase 4), pero correcto e integrable desde el inicio.

**Criterio de "terminado":** un evento de alta severidad genera notificación en <24 h desde su publicación; cualquier hecho guardado puede verificarse criptográficamente como no alterado (firma + cadena + checkpoint), y la verificación la puede ejecutar un tercero con el keyring público, sin credenciales del sistema.

---

## 6. Fase 3 — Introspección activa automatizada (3–4 ciclos)

### 6.1 Criterios de entrada (nuevo en v2)

La fase no inicia hasta tener: (a) entorno de contenedores efímeros construido y probado con un solo CLI; (b) revisión ToS (3.3) resuelta al menos para los CLIs de verificación diaria; (c) presupuesto de gasto por ciclo de prueba aprobado. La experiencia del ecosistema (proveedores caídos por autenticación/presupuesto en expertoGobernanza) evidencia que este riesgo es operativo, no teórico.

### 6.2 Alcance funcional (como en v1)

- Ejecución programada de `--version`/`--help`/ayuda interna de cada CLI en contenedor efímero sin credenciales reales, con *diff* contra la corrida anterior.
- Actualización automática del inventario de la Fase 1 al detectar cambio de versión (disparado por la Fase 2).
- Alertas de "comando/flag nuevo en `--help` ausente de todo changelog" — la señal de mayor valor, ahora activa.

**Criterio de "terminado":** el inventario se actualiza sin intervención manual dentro de las 24 h siguientes a una nueva versión detectada.

---

## 7. Fase 4 — Pruebas activas, seguridad y CAGF completo (6–10 ciclos)

Sin cambios de alcance respecto a v1: Harbor/Terminal-Bench para la batería de regresión con tareas propias relevantes al caso de uso; pruebas de capacidad dirigidas antes de marcar `confirmado_por_prueba_propia`; capa de seguridad activa (lista blanca de red, *canary tokens*, comparación de volumen transmitido vs. esperado, evaluando `agent-bom` como motor); y CAGF completo (agregación Merkle, sellado RFC 3161, anclaje NOM-151 si aplica) **sobre la base de firma ya correcta de la Fase 2** — se añade agregación y sellado externo, no se rehace la firma.

**Criterio de "terminado":** toda afirmación marcada "confirmada" tiene detrás una prueba propia repetible, firmada y sellada en el tiempo.

---

## 8. Fase 5 — Exposición como servicio / MCP (4–6 ciclos, condicional)

**Condición de activación (nuevo en v2):** la decisión de 3.3 sobre la naturaleza del servicio (herramienta interna del ecosistema vs. producto con niveles) debe estar tomada. Si la decisión es "interna", la Fase 5 se reduce a exponer el servidor MCP y el Agent Card firmado para los consumidores del ecosistema, sin niveles de acceso.

Alcance (como en v1): servidor MCP con herramientas `consultar_modelo`, `consultar_comando_cli`, `resolver_identidad_modelo`, `obtener_eventos_changelog`, `obtener_estado_verificacion`; Agent Card firmado; respuestas siempre en JSON estructurado; límites de tasa pensados para consumo automatizado; autenticación por clave de API compatible con el patrón de los CLIs del ecosistema.

**Criterio de "terminado":** un agente externo (o un CLI configurado como cliente MCP) se conecta, lista herramientas y obtiene una respuesta verificable sin intervención humana.

---

## 9. Esquema de datos mínimo (evolutivo)

```sql
-- Fase 0/1
modelos (
  id, proveedor, modelo_id, nombre_display,
  ventana_contexto_max, soporta_vision, soporta_tool_use,
  soporta_caching, soporta_batch, soporta_computer_use,
  precio_input_por_millon, precio_output_por_millon,
  fuente_url, fuente_hash, fecha_obtencion, vigente_hasta
)

cli_productos (
  id, nombre, proveedor, tipo, -- 'oficial' | 'comunitario'
  repo_url, version_actual, fecha_ultima_version
)

cli_comandos (
  id, cli_producto_id, comando, flags_json, descripcion,
  version_detectada_desde, fuente_url, fuente_hash, fecha_obtencion
)

consultas_log (              -- nuevo en v2
  id, consulta, servido_desde, -- 'bd' | 'fuente_externa' | 'sin_datos'
  latencia_ms, fecha
)

-- Fase 2 (se agrega, no reemplaza lo anterior)
eventos_changelog (
  id, cli_producto_id, categoria, resumen, confianza_clasificador,
  hash_sha256, hash_evento_anterior,     -- v2: encadenamiento en payload firmado
  firma_ed25519, checkpoint_id,          -- v2: checkpoint firmado del tip
  fuente_url, fecha_publicacion, fecha_deteccion
)

-- Fase 4 (se agrega)
pruebas_activas (
  id, cli_producto_id, tipo_prueba, resultado_json,
  hash_log_completo, firma_ed25519, timestamp_rfc3161, estado_verificacion
)
```

---

## 10. Cadencia de ejecución agente-nativa (ADRC) + anclaje de calendario

| Rol | Función en este proyecto |
|---|---|
| **Arquitecto/Controlador (LLM)** | Descompone cada fase en tickets pequeños y verificables con criterios de aceptación explícitos |
| **Desarrollador/Ejecutor (LLM con CLI)** | Implementa cada ticket de forma aislada, corre pruebas, reporta resultado |
| **Mediador (humano)** | Aprueba el paso de ticket a "terminado", resuelve ambigüedades, decide el orden real entre fases y las decisiones de la pista paralela (3.3) |

**Duración de ciclo:** 1 ciclo = lo que un Ejecutor completa y deja verificable en una sesión de trabajo.

**Anclaje de calendario y bitácora (nuevo en v2):** se mantiene un calendario tentativo por fase (revisable cada dos fases) y una bitácora en el repo (`bitacora_ciclos.md`: fase, ticket, ciclos estimados, ciclos reales, desviación). Las estimaciones en ciclos sin bitácora no permiten detectar atraso; con bitácora, sí.

**Regla de cierre de fase:** ninguna fase se declara cerrada sin que el Mediador verifique el criterio de "terminado" escrito en su sección. El Arquitecto puede proponer el cierre, no decretarlo.

---

## 11. Métricas de éxito por fase

| Fase | Métrica |
|---|---|
| 0 | Ficha v0: 11 fichas (6 CLIs + 5 proveedores) consultables con fuente y fecha; las 4 decisiones de la pista paralela iniciadas |
| 1 | % de consultas respondidas desde BD sin llamar a fuente externa ni a un modelo de IA (objetivo: >90% tras la primera semana de uso), **medido sobre `consultas_log` con tráfico de consumidores reales** |
| 2 | Tiempo medio publicación → notificación de evento de alta severidad (<24 h); verificación externa de firma+cadena+checkpoint ejecutable por un tercero |
| 3 | % de versiones nuevas cuyo inventario se actualiza sin intervención manual (objetivo: 100%) |
| 4 | % de afirmaciones "confirmadas" con prueba propia repetible (objetivo: 100% para los 6 CLIs en alcance) |
| 5 | Latencia y tasa de éxito de consultas MCP desde un cliente externo (a definir según demanda real) |

---

## 12. Riesgos del plan y mitigación

1. **Sobre-alcance en la Fase 1.** Mitigación: el plan fija qué queda fuera de cada fase; el Arquitecto rechaza tickets adelantados salvo aprobación del Mediador.
2. **LiteLLM u otra fuente cambia de formato o entrega un dato erróneo.** Mitigación doble: `fuente_hash`/`fuente_url` detectan el cambio de formato, y la validación cruzada de la Fase 2 marca discrepancias de contenido como `pendiente_de_verificar`.
3. **Costo de tokens creciente en Fases 2 y 4.** Mitigación: clasificar una sola vez por evento; presupuestar la batería de pruebas antes de activarla.
4. **La Ficha v0 queda huérfana si la Fase 1 se retrasa.** Mitigación: el script de ingesta la regenera con un comando; cada ficha lleva su `fecha_obtencion` impresa.
5. **El contrato v0 congela decisiones con poca información.** Mitigación: versionado explícito (`v0`, ruptura permitida hasta la Fase 2) y consumidores reales que informan el contrato con necesidades documentadas.
6. **Sesgo del diseño hacia los consumidores conocidos.** Mitigación: los campos específicos (p. ej. política de datos por proveedor) van como extensión del esquema, no como núcleo.
7. **Acoplamiento de formato con CAGF.** Mitigación: es acoplamiento de *formato* (prefijo `ed25519:`, keyring JSON), no de código ni de disponibilidad; el servicio mantiene clave y cadena propias.
8. **Bloqueo de la Fase 3 por entorno o ToS.** Mitigación: criterios de entrada explícitos (6.1) y revisión ToS iniciada en la Fase 0.

---

## 13. Conclusión

La v2 mantiene intacta la arquitectura del plan original y corrige su secuencia de valor: la Fase 0 entrega un artefacto funcional consultable (Ficha v0), la Fase 1 tiene canal decidido y consumidores reales declarados (ADRC, expertoGobernanza, CAGF), la Fase 2 firma con patrones probados y corregidos (cadena en payload, checkpoint del tip, JCS, clave dedicada) en vez de una "firma simple" que heredaría debilidades conocidas, y las decisiones cuyo costo es calendario (ToS, llaves, alcance del servicio) arrancan en paralelo desde el primer día. El resultado es un plan que entrega información útil sobre CLIs y agentes desde el primer ciclo y llega a la Fase 5 sin reescrituras.
