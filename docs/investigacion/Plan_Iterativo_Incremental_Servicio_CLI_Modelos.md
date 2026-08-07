# Plan iterativo e incremental: servicio de inteligencia sobre modelos y CLIs de IA

**Continuación de los cuatro documentos anteriores** (trazabilidad, arquitectura de monitoreo, verificación activa, panorama existente).
**Objetivo de este documento:** convertir todo lo anterior en un plan de entrega — qué se construye primero, en qué orden, con qué criterio de "terminado", y cómo se ejecuta ese plan usando agentes de IA como fuerza de desarrollo (no solo como objeto de estudio del propio sistema).

---

## 1. Principios que rigen el plan

1. **Esqueleto ambulante (*walking skeleton*) antes que profundidad.** La primera entrega debe atravesar las cuatro capas (fuente → normalización → almacenamiento → consulta) de punta a punta con el alcance más pequeño posible, en vez de construir una capa completa antes de tocar la siguiente. Esto es lo que permite tener "algo útil rápido", como se pidió.
2. **Cachear-al-consultar, no vigilar-todo-el-tiempo.** Ninguna fase antes de la 3 debe correr un proceso que "peine" fuentes de forma continua sin que haya una consulta o un ciclo programado de bajo costo que lo dispare. El patrón por defecto es: *¿tengo el dato en base de datos y sigue vigente? → sirvo de ahí. ¿No lo tengo o caducó? → lo obtengo una vez, lo normalizo, lo guardo con fecha, lo sirvo.* Esto reduce gasto de tokens y llamadas a terceros, y es exactamente lo que se pidió al señalar que la herramienta no debe "estar constantemente peinando o utilizando agente" si la fuente ya da la información en el momento de la consulta.
3. **No reconstruir lo que ya existe (Sección 6 del documento anterior).** Fase 1 se apoya en LiteLLM para precios/funciones/contexto y en las APIs de GitHub para *changelogs*, no en *scraping* propio ni en un modelo de IA generando esa información de memoria.
4. **Todo dato que la herramienta entregue debe tener procedencia rastreable desde el día uno**, aunque el mecanismo de firma criptográfica completo (CAGF) se vaya sofisticando por fases. Esto significa: desde la Fase 1, cada registro en base de datos lleva `fuente_url`, `fecha_obtencion` y `hash_del_contenido_original` — no hace falta esperar a Ed25519/Merkle/RFC 3161 para empezar a ser trazable.
5. **El plan se ejecuta con desarrollo agente-nativo, no *sprints* humanos tradicionales.** Se usa el propio marco ADRC (Architect/Controller LLM + Developer/Executor LLM con CLI + Mediador humano) ya validado en CVOED 3.0, con ciclos de entrega cortos (días, no semanas) — ver Sección 10.
6. **Diseñar para consumo por agentes desde la Fase 1, aunque se exponga hasta la Fase 5.** Esto no significa construir el servidor MCP ya en la Fase 1, sino **no tomar decisiones de esquema de datos o de API que haya que deshacer después** para exponerlo como herramienta MCP. Concretamente: la API interna de consulta se diseña desde el inicio con contratos JSON estables y documentados (aunque el transporte inicial sea REST/CLI interno), de modo que envolverla como *tool* MCP en la Fase 5 sea un adaptador, no una reescritura.

---

## 2. Panorama de fases

| Fase | Nombre | Qué entrega | Duración estimada (ciclos agente-nativos) | Depende de |
|---|---|---|---|---|
| **0** | Cimientos | Esquema de datos mínimo, elección de fuentes, entorno base | 1–2 ciclos | — |
| **1** | MVP de consulta rápida | Consultar comandos/*flags* de los 6 CLIs y capacidades/precio de los 5 proveedores de modelo, servido desde base de datos, con caché-al-consultar | 3–5 ciclos | Fase 0 |
| **2** | Changelog clasificado + alertas + CAGF ligero | Seguimiento de *releases*/*changelogs* con clasificación de severidad, notificaciones, y primera capa de hash+firma sobre cada hecho guardado | 4–6 ciclos | Fase 1 |
| **3** | Introspección activa automatizada | `--help`/`--version` diffing automático por versión, inventario vivo de comandos (sin pruebas de comportamiento todavía) | 3–4 ciclos | Fase 2 |
| **4** | Pruebas activas + seguridad + CAGF completo | Batería de regresión en sandbox (apoyada en Harbor/Terminal-Bench), pruebas de red/seguridad con *canary tokens*, cadena Ed25519+Merkle+RFC 3161+NOM-151 completa | 6–10 ciclos | Fase 3 |
| **5** | Exposición como servicio / MCP / niveles premium | Servidor MCP propio, *Agent Card* firmado, niveles de acceso (gratuito/premium), diseño para consumidores que son a su vez agentes de IA | 4–6 ciclos | Fase 4 (parcialmente paralelizable con la 3–4 si hay capacidad) |

La numeración es de prioridad, no estrictamente de calendario: la Fase 2 (changelog + CAGF ligero) puede empezar antes de que la Fase 1 esté 100% completa si el equipo tiene capacidad paralela, porque son verticales distintas (consulta de capacidades vs. seguimiento de cambios). Lo que **no** debe adelantarse es la Fase 4 (pruebas activas/seguridad) antes de tener el inventario de la Fase 1–3, porque probar sin saber qué se está probando desperdicia ciclos.

---

## 3. Fase 0 — Cimientos (1–2 ciclos)

**Objetivo:** dejar listo lo mínimo para que la Fase 1 sea pura construcción, no decisiones.

**Entregables:**
- Repositorio base con el *stack* ya estándar en el resto de tus proyectos (NestJS + PostgreSQL), consistente con CEPI-Médica/SAVER/DPM — reduce fricción de mantenimiento futuro.
- Esquema de base de datos mínimo (ver Sección 9) para tres entidades: `modelos`, `cli_productos`, `cli_comandos`. Todo lo demás (eventos de *changelog*, pruebas, firmas) se añade en fases posteriores sin romper este núcleo.
- Lista cerrada de fuentes de la Fase 1: el JSON de LiteLLM (modelos) y los seis repos de CLI ya identificados (Claude Code, Kimi Code CLI, Codex CLI, Grok CLI/Grok Build — distinguidos explícitamente —, Antigravity CLI, Cline).
- Decisión explícita de **no** usar todavía ningún servicio de pago ni ejecutar los CLIs de verdad — la Fase 0–1 es 100% lectura de fuentes públicas gratuitas (JSON de LiteLLM, API pública de GitHub, documentación oficial).

**Criterio de "terminado":** se puede correr `SELECT` sobre las tres tablas vacías y el *pipeline* de ingesta tiene un punto de entrada definido (aunque no tenga datos todavía).

---

## 4. Fase 1 — MVP de consulta rápida (3–5 ciclos)

Esta es la fase que responde directamente a lo pedido: "que ayude rápido dando información sobre comandos y modificadores, descripciones de modelos y funciones".

### 4.1 Alcance funcional

- **Consulta de modelos:** "¿qué modelos de Anthropic/xAI/Google/Moonshot/Zhipu existen hoy, con qué ventana de contexto, qué funciones soportan (visión, *tool use*, *caching*, etc.) y a qué precio?" — respondido 100% desde datos ya normalizados de LiteLLM, sin llamar a ningún modelo de IA para responder.
- **Consulta de comandos de CLI:** "¿qué *flags* tiene `claude mcp`?", "¿cómo configuro un servidor MCP en Kimi Code CLI?", "¿qué comando de Antigravity CLI equivale a `/plugin` de Claude Code?" — respondido desde un inventario de comandos/*flags* capturado **una sola vez por versión**, no en cada consulta.
- **Ayuda de configuración asistida:** dado que el objetivo explícito incluye "ayudar rápidamente a configurar agentes y CLIs y sistemas", la Fase 1 entrega plantillas de configuración mínima por CLI (ej. estructura de `mcp_config.json`, variables de entorno relevantes, comando de primer login) derivadas de la documentación oficial ya normalizada — no generadas por inferencia del modelo en cada respuesta, sino guardadas como plantilla versionada.

### 4.2 Patrón de caché-al-consultar (mecanismo central de esta fase)

```
Consulta del usuario
      │
      ▼
¿Existe el dato en la tabla correspondiente
 y su "fecha_obtencion" está dentro de la
 ventana de vigencia definida para ese tipo
 de dato (ej. 24h para precios, 7 días para
 inventario de comandos)?
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

Este único patrón es lo que evita "estar constantemente peinando" fuentes: la actualización ocurre por demanda (primera consulta después de vencer la vigencia) o por un job programado de bajo costo (una vez al día para el JSON de LiteLLM, que es un solo archivo descargable), nunca por *polling* continuo ni por invocar un agente de IA para "investigar" en cada pregunta.

### 4.3 Cómo se llena el inventario de comandos de CLI en esta fase (sin pruebas activas todavía)

En la Fase 1, el inventario de comandos/*flags* **no** se obtiene ejecutando los CLIs (eso es Fase 3). Se obtiene de:
- El texto de `--help` publicado en la documentación oficial de cada CLI (páginas ya identificadas en el documento de arquitectura).
- Los propios `CHANGELOG.md`/`README.md` de los repos públicos (Claude Code, Kimi Code CLI, Cline, `grok-cli` comunitario), que documentan comandos nuevos en lenguaje natural.
- Captura manual puntual (el Mediador humano ejecuta `--help` una vez por CLI durante la Fase 1 y pega la salida al *pipeline* de ingesta) donde no haya documentación pública suficiente — esto es aceptable como *bootstrap* inicial; se automatiza en la Fase 3.

**Criterio de "terminado" de la Fase 1:** un usuario puede preguntar por un modelo o un comando de cualquiera de los 6 CLIs/5 proveedores y recibir una respuesta correcta y con fuente citada, servida en milisegundos desde base de datos, sin que la consulta dispare una llamada a un modelo de IA ni a una fuente externa (salvo la primera vez que se pregunta por algo nuevo).

---

## 5. Fase 2 — Changelog clasificado, alertas y CAGF ligero (4–6 ciclos)

### 5.1 Alcance funcional
- Activar el *poller* de la API de GitHub sobre los seis repos de CLI (releases + *commits* sobre `CHANGELOG.md` + *Security Advisories*), con cadencia diferenciada por prioridad ya definida en el documento de arquitectura (diaria para Claude Code y Grok Build, semanal para el resto).
- Clasificación automática de cada entrada nueva detectada, usando un modelo de IA **una sola vez por entrada** (no en cada consulta del usuario) en las categorías ya definidas: `funcion_nueva | breaking_change | fix_seguridad | deprecacion | cambio_precio | cambio_limite | ruido_irrelevante`.
- Notificación (correo, y opcionalmente Slack/Teams si ya está disponible en el entorno) para eventos `fix_seguridad` y `breaking_change`, inmediata; agregación semanal para el resto.

### 5.2 CAGF ligero (introducido desde esta fase, no esperado a la Fase 4)
Se pidió explícitamente poder "investigar desde un principio o mejorar" la técnica de CAGF. La recomendación es introducir una **versión mínima viable** ya en esta fase, en vez de esperar a la Fase 4:
- Cada evento de *changelog* clasificado se guarda con `hash_sha256` del contenido original y una **firma Ed25519 simple** generada por una clave del propio sistema (sin todavía Merkle ni RFC 3161).
- Esto ya produce no-repudio interno básico ("este hecho no fue modificado después de guardarse") y deja el terreno preparado para añadir en la Fase 4, sin cambiar el esquema, la agregación Merkle y el sellado de tiempo externo con valor legal completo.

**Criterio de "terminado":** un evento de *changelog* de alta severidad genera una notificación en menos de 24 horas desde su publicación, y cualquier hecho guardado en base de datos puede verificarse criptográficamente como no alterado desde su captura.

---

## 6. Fase 3 — Introspección activa automatizada (3–4 ciclos)

Reemplaza la captura manual de la Fase 1 por el mecanismo descrito en el documento de verificación activa (Sección 2.1): ejecución programada de `--version`/`--help`/comandos de ayuda interna de cada CLI en un entorno controlado, con *diff* automático contra la corrida anterior.

**Alcance funcional:**
- Entorno de ejecución aislado mínimo (contenedor efímero, sin credenciales reales) para correr los seis CLIs con `--help` y comandos de ayuda interna.
- Actualización automática del inventario de comandos/*flags* de la Fase 1 cada vez que se detecta un cambio de versión (disparado por la Fase 2), sustituyendo la dependencia de documentación de terceros.
- Primeras alertas de "comando/flag nuevo detectado en `--help` que aún no aparece en ningún *changelog*" — la señal de mayor valor identificada en el documento de verificación activa.

**Criterio de "terminado":** el inventario de comandos se actualiza solo, sin intervención manual, dentro de las 24 horas siguientes a una nueva versión detectada.

---

## 7. Fase 4 — Pruebas activas, seguridad, y CAGF completo (6–10 ciclos)

Esta es la fase de mayor esfuerzo, y corresponde a lo que ya se pidió dejar para "etapas posteriores": "se pruebe, verifique por agente funciones sustanciales y comandos y modificadores" y la investigación/prueba "más amplia".

**Alcance funcional (retomando el documento de verificación activa, ahora con motor concreto):**
- Adopción de Harbor (motor de Terminal-Bench, ya identificado como el candidato correcto) para la batería de regresión funcional, con un conjunto de tareas propio relevante al caso de uso institucional, no solo las tareas genéricas del *benchmark* público.
- Pruebas de capacidad dirigidas: verificación puntual de afirmaciones de *changelogs* de la Fase 2 antes de marcarlas como `confirmado_por_prueba_propia`.
- Capa de seguridad activa: entorno con lista blanca de red, tokens señuelo, y comparación de volumen transmitido vs. esperado — evaluando primero `agent-bom` como motor (por su modelo de evidencia auditable) antes de construir desde cero.
- CAGF completo: agregación Merkle de lotes de eventos, sellado de tiempo RFC 3161, y anclaje bajo NOM-151-SCFI-2016 para que los hechos registrados adquieran valor probatorio formal dentro de México.

**Criterio de "terminado":** cualquier afirmación de capacidad marcada como "confirmada" en el sistema tiene detrás una prueba propia repetible, firmada y sellada en el tiempo — no solo una cita a documentación de terceros.

---

## 8. Fase 5 — Exposición como servicio, MCP y niveles premium (4–6 ciclos, parcialmente paralelizable)

### 8.1 Alcance funcional
- Envolver la API de consulta ya estable (diseñada así desde la Fase 1, principio 6) como **servidor MCP propio**, exponiendo herramientas del tipo `consultar_modelo`, `consultar_comando_cli`, `obtener_eventos_changelog`, `obtener_estado_verificacion`.
- Publicar un **Agent Card firmado** (siguiendo la extensión de *Traceability*/*Timestamp* de A2A ya identificada en el documento de trazabilidad como la más cercana a un estándar real) para que otros agentes puedan descubrir el servicio de forma verificable.
- Definir niveles de acceso: un nivel gratuito (consultas básicas de modelos/comandos, datos con vigencia de días) y un nivel premium (datos verificados por prueba activa, alertas en tiempo real, acceso a la cadena de procedencia firmada completa).
- **Diseño explícito para consumidores que son agentes de IA, no solo personas.** Esto implica: respuestas siempre en JSON estructurado además de texto legible, límites de tasa pensados para consumo automatizado recurrente (no solo picos humanos), y autenticación por clave de API compatible con el patrón que ya usan CLIs como Claude Code o Kimi Code para conectarse a *gateways* externos.

**Criterio de "terminado":** un agente externo (o un CLI de terceros configurado como cliente MCP) puede conectarse al servicio, listar sus herramientas, y obtener una respuesta verificable sobre un modelo o un CLI sin intervención humana.

---

## 9. Esquema de datos mínimo (evolutivo, no se reescribe entre fases)

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

-- Fase 2 (se agrega, no reemplaza lo anterior)
eventos_changelog (
  id, cli_producto_id, categoria, resumen, confianza_clasificador,
  hash_sha256, firma_ed25519, fuente_url, fecha_publicacion, fecha_deteccion
)

-- Fase 4 (se agrega)
pruebas_activas (
  id, cli_producto_id, tipo_prueba, resultado_json,
  hash_log_completo, firma_ed25519, timestamp_rfc3161, estado_verificacion
)
```

Este orden — tres tablas núcleo en la Fase 0, extendidas sin romper compatibilidad en cada fase siguiente — es lo que permite que la Fase 1 se entregue rápido sin hipotecar el diseño de las fases 2–5 ya documentadas en detalle en los documentos anteriores.

---

## 10. Cadencia de ejecución agente-nativa (aplicando ADRC)

Dado que el desarrollo mismo se hará con agentes de IA, se recomienda aplicar el marco ADRC ya validado en CVOED 3.0, con ciclos cortos en vez de *sprints* de dos semanas:

| Rol | Función en este proyecto |
|---|---|
| **Arquitecto/Controlador (LLM)** | Descompone cada fase de este plan en tickets pequeños y verificables (p. ej. "Fase 1 → ticket: normalizar `model_prices_and_context_window.json` a la tabla `modelos`"), define criterios de aceptación explícitos por ticket |
| **Desarrollador/Ejecutor (LLM con CLI, ej. Claude Code)** | Implementa cada ticket de forma aislada, corre pruebas, reporta resultado |
| **Mediador (humano — Manuel)** | Aprueba el paso de un ticket a "terminado", resuelve ambigüedades que el Arquitecto no pueda resolver solo, y es quien decide el orden real de ejecución entre fases si hay que priorizar por urgencia operativa |

**Duración de ciclo recomendada:** 1 ciclo = lo que un Ejecutor puede completar y dejar verificable en una sesión de trabajo (no un número fijo de días) — consistente con la evidencia ya documentada de reducción de tiempo de desarrollo (70–81%) lograda con este mismo marco en CVOED 3.0. Las estimaciones de "3–5 ciclos" de la Fase 1, por ejemplo, son tickets, no semanas.

**Regla de cierre de fase:** ninguna fase se declara "cerrada" sin que el Mediador humano verifique el criterio de "terminado" definido en cada sección de este documento — el Arquitecto/Controlador puede proponer que una fase está lista, pero no cerrarla unilateralmente, siguiendo el mismo principio de honestidad dimensional y verificación que ya rige en tus otros marcos (ARQHOS, ADRC Universal Constitution).

---

## 11. Métricas de éxito por fase (para saber si de verdad se está avanzando, no solo entregando código)

| Fase | Métrica |
|---|---|
| 1 | % de consultas de modelos/comandos respondidas desde base de datos sin llamar a fuente externa ni a un modelo de IA (objetivo: >90% tras la primera semana de uso) |
| 2 | Tiempo medio entre publicación de un evento de alta severidad y su notificación (objetivo: <24 h) |
| 3 | % de versiones nuevas de CLI detectadas cuyo inventario de comandos se actualiza sin intervención manual (objetivo: 100%) |
| 4 | % de afirmaciones de capacidad marcadas "confirmado" que tienen detrás una prueba propia repetible (objetivo: 100% para los 6 CLIs en alcance) |
| 5 | Latencia y tasa de éxito de consultas MCP desde un cliente externo/agente (objetivo operativo a definir según demanda real) |

---

## 12. Riesgos del propio plan y mitigación

1. **Riesgo de sobre-alcance en la Fase 1.** La tentación natural es empezar a construir pruebas activas o CAGF completo desde el inicio porque "ya se investigó". Mitigación: este documento fija explícitamente qué queda fuera de cada fase; el Arquitecto/Controlador debe rechazar tickets que se adelanten a su fase salvo aprobación explícita del Mediador.
2. **Riesgo de que LiteLLM u otra fuente externa cambie de formato o quede obsoleta.** Mitigación: el `fuente_hash` y `fuente_url` guardados desde la Fase 1 permiten detectar cuándo una fuente deja de responder como se espera, y el diseño modular de "fuentes" (documento de arquitectura) permite sustituir una fuente sin rediseñar el resto del sistema.
3. **Riesgo de costo de tokens creciente en las Fases 2 y 4** (clasificación por LLM, pruebas activas). Mitigación: clasificar una sola vez por evento nuevo (nunca en cada consulta), y presupuestar explícitamente el gasto de la batería de pruebas de la Fase 4 antes de activarla, como ya se recomendó en el documento de verificación activa.
4. **Riesgo de que la Fase 5 (MCP/premium) se diseñe mal por prisa de monetizar antes de tiempo.** Mitigación: el principio 6 de este plan ya obliga a diseñar contratos de API estables desde la Fase 1, precisamente para que la Fase 5 sea un envoltorio y no una reescritura bajo presión.

---

## 13. Conclusión

El plan entrega valor usable desde la Fase 1 (días/ciclos, no meses), apoyándose en las fuentes gratuitas y abiertas ya identificadas (LiteLLM, APIs públicas de GitHub, documentación oficial), sin exigir todavía ejecución activa de los CLIs ni la cadena de firma completa. Cada fase posterior añade una capa sin rehacer la anterior, y dos decisiones tomadas desde el principio — el patrón de caché-al-consultar y el diseño de contratos de API estables — son las que hacen posible que el sistema llegue a la Fase 5 (consumo por agentes externos vía MCP, niveles premium) sin una reescritura mayor.
