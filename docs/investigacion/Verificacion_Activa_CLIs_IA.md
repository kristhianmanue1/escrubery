# Verificación activa de CLIs de IA: pruebas, introspección de ayuda y comportamiento real del agente monitor

**Continuación de:** *Sistema de monitoreo de modelos y CLIs de IA* (documento previo)
**Objetivo de este documento:** especificar qué puede y debe *hacer* el agente además de leer changelogs — es decir, la capa de **verificación activa**: ejecutar los CLIs, consultar su ayuda interactiva, correrles baterías de prueba controladas, y observar su comportamiento real (incluido el de red), en lugar de confiar solo en lo que el proveedor declara por escrito.

---

## 1. Por qué el monitoreo pasivo no basta (y qué añade la verificación activa)

El documento anterior diseñó un sistema que **lee** lo que los proveedores publican. Pero el propio caso de Grok Build, citado ahí como ejemplo central, es la prueba de que **lo que un proveedor publica y lo que su binario realmente hace pueden no coincidir**, y que la brecha no siempre se cierra por un aviso oficial. Verificación activa significa que el agente deja de ser solo un lector y pasa a ser un **auditor empírico**: instala o invoca el CLI real, en un entorno controlado, y registra lo que observa directamente.

Esto añade una tercera fuente de evidencia, con un nivel de confianza distinto a las dos ya contempladas:

| Nivel de confianza | Origen del dato | Ejemplo |
|---|---|---|
| Más bajo | Prensa/rumor de terceros | "Se reporta que K3 tiene ~2.8T parámetros" |
| Medio | Documentación oficial / changelog | "El changelog dice que se añadió soporte de MCP en la v2.1.220" |
| **Más alto — lo que aporta este documento** | **Observación directa y repetible por el propio sistema** | "Ejecutamos `claude mcp list` en la v2.1.220 y confirmamos que el subcomando existe y responde" |

La verificación activa no sustituye al monitoreo pasivo: lo **corrobora o lo refuta**, y produce el estado `confirmado_por_prueba_propia` que ya se dejó reservado en el esquema del documento anterior como el nivel más alto de `verificacion.estado`.

---

## 2. Cinco categorías de acciones que el agente puede ejecutar

### 2.1 Introspección de versión y ayuda (la más barata y de mayor valor inmediato)

Cada CLI expone su propia superficie de comandos vía ayuda nativa, que suele adelantarse al changelog oficial y a la documentación pública. El agente puede, de forma no invasiva y sin consumir tokens de modelo:

- Ejecutar `--version` / `--help` de cada binario y **diffear el árbol de subcomandos y flags contra la corrida anterior**. Un flag nuevo en `--help` que no aparece todavía en ningún changelog es una señal de alto valor (funcionalidad en *rollout* silencioso, como ya se documentó para Claude Code con el *PowerShell tool* en distribución progresiva).
- Dentro de la sesión interactiva, invocar los comandos de ayuda propios de cada agente (p. ej. `/config`, `/settings`, `/permissions`, `/mcp`, `/agents`, `/skills`, `/statusline` en Antigravity CLI; `/plugin`, `/model`, `/doctor`, `claude agents --json` en Claude Code) y capturar la salida completa como inventario vivo de capacidades.
- Consultar catálogos que los propios CLIs exponen (p. ej. el selector de modelos de Claude Code lee del *endpoint* `/v1/models` del *gateway* configurado) para construir automáticamente la lista de modelos que un CLI reconoce en un momento dado, sin depender de que el proveedor lo documente aparte.

Este tipo de introspección es determinística, barata, no requiere gasto de tokens de modelo (son comandos del propio programa, no *prompts*), y debería correr con la mayor frecuencia de todas las categorías.

### 2.2 Batería de pruebas de humo / regresión funcional

Un conjunto fijo y versionado de tareas idénticas, ejecutadas contra cada CLI en cada ciclo de verificación, para detectar **cambios de comportamiento no anunciados** (no solo funciones nuevas). Ejemplos de casos mínimos:

| Caso de prueba | Qué verifica |
|---|---|
| Edición de un archivo con instrucción ambigua | Si el CLI pide confirmación (modo *permission*) o actúa directamente — cambios aquí son sensibles para gobernanza |
| Ejecución de un comando de shell simple | Si sigue pidiendo aprobación explícita, y si el *sandboxing* declarado realmente aísla la ejecución |
| Llamada a una herramienta vía MCP contra un servidor MCP de prueba controlado por el propio sistema | Si el soporte de MCP declarado funciona en la práctica y qué formato de configuración exige |
| Tarea que fuerza acercarse al límite de contexto documentado | Si el comportamiento al saturarse coincide con lo declarado (truncamiento, error, resumen automático) |
| Solicitud que debería activar *tool use*/*function calling* | Si el CLI expone razonamiento/*thinking* como campo separado, y si se ve reflejado en la salida |
| Tarea repetida en dos versiones consecutivas del mismo CLI | Detecta *drift* silencioso de comportamiento entre versiones aunque el changelog no lo mencione |

Estas pruebas deben ser **deterministas en el *prompt* de entrada** (mismo texto exacto cada vez) para que las diferencias observadas sean atribuibles a la versión del CLI/modelo y no a variación aleatoria del *prompt*.

### 2.3 Pruebas de capacidad dirigidas (verificación puntual de una afirmación)

A diferencia de la batería de regresión (que corre siempre igual), estas pruebas se **disparan automáticamente cuando el sistema de monitoreo pasivo detecta una afirmación nueva** en un changelog o en la matriz de convergencia de funciones (documento anterior), para corroborarla antes de marcarla como confirmada. Ejemplos:

- Changelog dice "se agregó *prompt caching* con lectura a 10% del costo de entrada" → el agente ejecuta la misma consulta dos veces seguidas y compara el campo de `usage` (tokens de caché) entre la primera y la segunda llamada.
- Changelog dice "ventana de contexto ampliada a 1M tokens" → el agente construye una entrada sintética cercana a ese tamaño y observa si el CLI la acepta o la rechaza.
- Changelog dice "nuevo soporte de subagentes" → el agente lanza una tarea diseñada para requerir paralelismo y observa si aparecen procesos/hilos de subagente en la salida o en los registros del propio CLI.

Este tipo de prueba es la que convierte una afirmación de "confirmado por documentación" en "confirmado por prueba propia" dentro del esquema de datos.

### 2.4 Pruebas de comportamiento de red y seguridad (prioridad alta, justificada por el caso Grok Build)

Esta es la categoría más directamente motivada por el hallazgo del documento anterior, y debe tratarse como una función de cumplimiento/seguridad, no solo de *feature tracking*:

- Ejecutar cada CLI dentro de un contenedor efímero, aislado, con **una lista de destinos de red permitidos explícita** (los dominios documentados del proveedor) y **registro completo de todo tráfico saliente**.
- Sembrar el entorno de prueba con **tokens señuelo (*canary tokens*)** — credenciales falsas con formato realista, identificables de forma única — en archivos típicos (`.env`, `.git/config`, `~/.ssh/`) para detectar si un CLI transmite contenido que no debería necesitar para la tarea solicitada. Es exactamente la técnica que permitió detectar el problema de Grok Build en julio de 2026 (un archivo `.env` señuelo con la cadena `API_KEY=CANARY...` apareció en el cuerpo de las peticiones salientes).
- Comparar el volumen de datos transmitido contra el tamaño razonable de la tarea solicitada (la métrica que expuso el caso Grok Build fue una relación de ~27,800× entre lo que el modelo necesitaba y lo que realmente se transmitió).
- Registrar el destino exacto (dominio/IP/proveedor de nube) de cada conexión saliente, no solo si hubo o no conexión.

Cualquier hallazgo de esta categoría debe generar una alerta de máxima prioridad, independiente del ciclo normal de reporte, y no debe esperar a la clasificación por LLM de la Capa 3 del documento anterior — debe dispararse por regla determinística (ej. "conexión a un dominio fuera de la lista blanca" = alerta inmediata).

### 2.5 Consulta activa de documentación/ayuda oficial más allá del *scraping* pasivo

Complementa la Capa 1 del documento anterior (que hacía *scraping*/API pull de páginas y repos) con **consultas dirigidas por el propio agente usando el modelo subyacente para navegar y sintetizar documentación**, útil quando la documentación no está en un formato fácil de *parsear* (páginas altamente dinámicas, PDFs, foros de comunidad, *release notes* en video o *streams*). Aquí el agente no ejecuta el CLI, sino que usa capacidades de búsqueda/navegación web para "preguntar" a la documentación oficial y a canales de soporte (foros, Discord/Slack públicos, *issues* de GitHub etiquetados como pregunta) y resumir con citación de fuente. Esto es más caro (consume tokens de modelo) y debe reservarse para los casos donde la introspección directa (2.1–2.3) no puede responder la pregunta.

---

## 3. Entorno de ejecución seguro (requisito no negociable)

Ninguna de las categorías 2.2–2.4 debe ejecutarse contra el entorno de trabajo real de CAGF/IMSS. Requisitos mínimos del entorno de pruebas:

1. **Contenedores/VMs efímeros**, destruidos al final de cada ciclo de prueba — nunca reutilizar el mismo sistema de archivos entre corridas de distintos CLIs.
2. **Sin credenciales reales**: cada CLI se autentica con claves de API de prueba, con límite de gasto estricto y alcance mínimo (proyecto/*workspace* dedicado solo a pruebas, nunca el de producción de CVOED/CEPI/SAVER).
3. **Repositorio de prueba sintético** con estructura realista pero contenido ficticio, más los tokens señuelo descritos en 2.4.
4. **Lista blanca de red explícita y registrada** por CLI, generada a partir de la documentación oficial de cada proveedor; cualquier desviación se trata como hallazgo de seguridad, no como *bug* menor.
5. **Presupuesto de gasto por ciclo de prueba**, calculado y limitado igual que se recomendó para el costo en el documento de trazabilidad — nunca dejar que la batería de pruebas tenga gasto de tokens sin techo.
6. **Revisión de Términos de Servicio de cada CLI antes de automatizar pruebas contra él.** Varios de estos productos (especialmente los que dependen de una suscripción de consumo, como Claude Code, Grok Build o Kimi Code) tienen políticas de uso que pueden restringir automatización a gran escala, *benchmarking* competitivo o extracción sistemática del *system prompt*. La batería debe diseñarse para quedar dentro de un uso de verificación de buena fe (volumen bajo, propósito de aseguramiento de calidad interno), y no como *scraping* competitivo o replicación de *prompts* propietarios con fines distintos a la trazabilidad institucional.

---

## 4. Disparadores y cadencia

| Tipo de prueba | Disparador | Cadencia base |
|---|---|---|
| Introspección de ayuda/versión (2.1) | Cambio de versión detectado por el monitoreo pasivo (documento anterior) | Cada actualización de versión detectada, automático |
| Batería de regresión (2.2) | Calendario fijo, independiente de si hubo changelog o no | Semanal para Claude Code/Kimi Code/Cline; quincenal para el resto (alineado con la cadencia de verificación ya recomendada en el documento anterior) |
| Prueba de capacidad dirigida (2.3) | Nueva afirmación clasificada como `funcion_nueva` o `cambio_limite` por la Capa 3 del sistema pasivo | Inmediato tras la clasificación, antes de marcar el hecho como "confirmado" |
| Prueba de red/seguridad (2.4) | Calendario fijo **más** cualquier cambio de versión de un CLI con historial de riesgo (Grok CLI/Grok Build en primer lugar) | Diaria para Grok Build/Grok CLI; semanal para el resto |
| Consulta activa de documentación (2.5) | Solo cuando 2.1–2.3 no pueden resolver la pregunta | Bajo demanda |

---

## 5. Extensión del esquema de datos (evento de prueba activa)

Se añade como complemento al esquema canónico del documento anterior, usando el mismo bloque `verificacion` pero con detalle adicional propio de una prueba ejecutada (no solo observada):

```json
{
  "prueba_id": "uuid",
  "evento_relacionado_id": "uuid | null (si corrobora un hallazgo del monitoreo pasivo)",
  "entidad": {
    "producto": "claude-code | kimi-code | codex-cli | grok-cli-community | grok-build | antigravity-cli | cline",
    "version_probada": "string"
  },
  "tipo_prueba": "introspeccion_ayuda | regresion_funcional | capacidad_dirigida | seguridad_red | consulta_documentacion",
  "entorno": {
    "contenedor_id": "efímero, destruido al finalizar",
    "lista_blanca_red": ["dominio1", "dominio2"],
    "tokens_señuelo_incluidos": true
  },
  "resultado": {
    "exito": true,
    "diff_respecto_corrida_anterior": "descripción o null",
    "conexiones_fuera_de_lista_blanca": [],
    "volumen_datos_transmitido_bytes": 0,
    "volumen_esperado_estimado_bytes": 0,
    "anomalia_detectada": false
  },
  "verificacion": {
    "estado": "confirmado_por_prueba_propia",
    "hash_sha256_log_completo": "...",
    "firma_ed25519": "...",
    "timestamp_rfc3161": "..."
  }
}
```

El campo `volumen_esperado_estimado_bytes` frente a `volumen_datos_transmitido_bytes` es deliberado: es la métrica que habría detectado el caso Grok Build de forma automática y determinística, sin depender de que un investigador externo lo descubriera por curiosidad.

---

## 6. Priorización por CLI (qué tan agresiva debe ser la verificación activa)

| CLI | Prioridad de pruebas activas | Justificación |
|---|---|---|
| **Claude Code** | Alta, pero orientada a regresión/capacidad (no tanto seguridad) | Es el CLI en uso productivo real dentro de CAGF/ADRC; el riesgo no es exfiltración sino *drift* de comportamiento que rompa flujos existentes |
| **Grok Build (oficial)** | **Máxima, con énfasis en 2.4 (seguridad/red)** | Único caso con incidente documentado de exfiltración de datos y corrección silenciosa sin aviso formal |
| **Grok CLI (comunitario)** | Media-alta en seguridad, dado que ya no está en desarrollo activo (última actualización observada en noviembre de 2025) | Un proyecto sin mantenimiento activo puede no recibir parches de seguridad; verificar que siga funcionando como se documenta, no que mejore |
| **Kimi Code CLI** | Media-alta en regresión (cadencia de *releases* muy alta) | El ritmo de publicación casi semanal hace más probable *drift* silencioso entre versiones que en CLIs de cadencia más lenta |
| **Antigravity CLI (agy)** | Media, con foco en introspección de ayuda (2.1) | Producto en transición activa (sucesor reciente de Gemini CLI); su superficie de comandos aún se está estabilizando, y la introspección directa es más confiable que su documentación pública todavía madurando |
| **Cline** | Media, útil también como fuente de corroboración cruzada | Al ser agnóstico de modelo, sirve para verificar de forma independiente cuándo un modelo nuevo (Claude, Kimi, GLM) queda realmente soportado en un cliente de terceros |

---

## 7. Conclusión

La verificación activa convierte al sistema de monitoreo de "archivo que resume lo que otros dicen" en un **auditor con evidencia propia y repetible**, que es precisamente el estándar de prueba más alto dentro del marco de procedencia que ya rige CAGF. El valor no está solo en detectar funciones nuevas más rápido que la competencia — está en que, frente a casos como Grok Build, **la única defensa institucional realista es no depender de que el proveedor avise**, sino observar directamente, en un entorno controlado y con instrumentación diseñada para detectar justo el tipo de comportamiento que un aviso oficial podría no reportar.
