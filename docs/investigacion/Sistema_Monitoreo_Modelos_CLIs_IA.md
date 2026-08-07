# Sistema de monitoreo de modelos y CLIs de IA: arquitectura, matriz de convergencia de funciones API y matriz de vigilancia de CLIs

**Continuación de:** *Análisis de Trazabilidad y Auto-reporte de Agentes de IA* (documento previo)
**Objetivo de este documento:** diseñar el subsistema que mantiene actualizado — de forma automática y verificable — el conocimiento que AN-KLA/CAGF tiene sobre (a) capacidades y cambios de las APIs de modelos, y (b) evolución de los CLIs de codificación que los consumen, para poder servir esa información como un servicio interno confiable.

---

## 1. Por qué esto es un problema distinto al de trazabilidad de conversaciones

El documento anterior resolvió "¿qué pasó en esta llamada/conversación?". Este resuelve un problema temporalmente anterior: **"¿qué es cierto hoy sobre este modelo/CLI, y desde cuándo?"** Es un problema de *vigilancia de estado del mundo* (feature tracking / competitive-intelligence técnica), no de auditoría de eventos propios. La diferencia importa para el diseño:

- La fuente de verdad **no es tuya** — vive en repos, changelogs y páginas de documentación de terceros que cambian de formato sin aviso.
- El dato tiene **fecha de caducidad implícita**: una capacidad documentada hoy puede quedar obsoleta en semanas (el propio panorama de precios y modelos que investigamos para el documento anterior cambió varias veces solo durante 2026: Sonnet 5 sustituyendo a Sonnet 4.6 como modelo por defecto, Fable 5/Mythos 5 lanzándose y luego bajo restricción de exportación, Gemini CLI siendo reemplazado por Antigravity CLI el 18 de junio de 2026, etc.).
- El riesgo de **falsos positivos y ruido** es alto: un repo de un CLI genera decenas de commits/día; solo una fracción son "función nueva relevante para el usuario".
- Existe un **riesgo de seguridad real y ya documentado** en monitorear mal esta capa: el incidente de julio de 2026 con Grok Build (el CLI de codificación de xAI), donde se descubrió que el binario subía repositorios completos —incluyendo secretos y archivos `.env`— a un bucket de Google Cloud (`grok-code-session-traces`) sin relación clara con lo que el modelo necesitaba para responder, y xAI aplicó una mitigación silenciosa sin aviso de seguridad ni entrada de changelog. Esto no es un caso aislado: es la prueba de que **el monitoreo de "nuevas funciones" debe incluir, con la misma prioridad, el monitoreo de avisos de seguridad y comportamiento de red de los CLIs**, porque los proveedores no siempre lo anuncian por el canal esperado (changelog) sino por escrutinio de terceros (investigadores, prensa técnica).

---

## 2. Arquitectura recomendada (capas)

```
┌─────────────────────────────────────────────────────────────────────┐
│  CAPA 1 · FUENTES (pull + push)                                     │
│  GitHub Releases API/Atom · CHANGELOG.md (diff por commit)          │
│  npm registry (versión + fecha) · páginas de docs oficiales         │
│  GitHub Security Advisories API · endpoints /models de cada API     │
│  status pages / RSS de blogs oficiales · X/redes de cuentas oficiales│
└─────────────────────────────────────────────────────────────────────┘
                              │  (polling programado + webhooks donde existan)
┌─────────────────────────────────────────────────────────────────────┐
│  CAPA 2 · NORMALIZACIÓN                                             │
│  Mapeo de cada fuente heterogénea a un esquema canónico único       │
│  (ver Sección 6) · deduplicación por hash de contenido              │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│  CAPA 3 · CLASIFICACIÓN (agente IA)                                 │
│  Un LLM clasifica cada entrada nueva en categorías controladas:     │
│  función_nueva | breaking_change | fix_seguridad | deprecación |    │
│  cambio_precio | cambio_límite | ruido_irrelevante                  │
│  + extrae campos estructurados (modelo afectado, versión, fecha)    │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│  CAPA 4 · VERIFICACIÓN Y FIRMA (reutiliza el esquema de CAGF)        │
│  hash SHA-256 de la fuente original + firma Ed25519 + sello RFC 3161│
│  → cada hecho registrado por el sistema es, en sí mismo, un evento   │
│    con procedencia verificable, no una nota efímera                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│  CAPA 5 · SERVICIO / CONSULTA                                       │
│  API interna (NestJS + PostgreSQL, consistente con el stack ya en   │
│  uso en CEPI-Médica/SAVER/DPM) que responde: "¿qué modelos existen  │
│  hoy?", "¿qué cambió esta semana?", "¿qué CLI soporta X función?"   │
│  + notificaciones (correo/Slack/Teams) para eventos de alta          │
│    severidad (breaking_change, fix_seguridad)                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Decisión de diseño clave:** la Capa 3 (clasificación con IA) no debe ser el único filtro de confianza. Un LLM clasificando *changelogs de LLMs* es exactamente el tipo de tarea donde conviene aplicar el mismo principio del documento anterior: **el agente clasificador es una fuente de evidencia a corroborar, no una autoridad**. Por eso la Capa 4 conserva siempre el material fuente original (el commit, el HTML de la página, el aviso), de modo que una clasificación incorrecta sea corregible sin perder la trazabilidad del hecho subyacente.

---

## 3. Matriz de fuentes de monitoreo por modelo/API

| Proveedor | Changelog/release notes oficial | Repo público relevante | Endpoint de catálogo de modelos | Avisos de seguridad | Cadencia observada |
|---|---|---|---|---|---|
| **Anthropic (Claude)** | Página de changelog de la API/consola (docs.claude.com) | — (API cerrada; Claude Code sí es público, ver Sección 5) | Endpoint de listado de modelos vía API | Página de seguridad/confianza de Anthropic | Alta — varios lanzamientos de modelo y ajustes de política en 2026 (Sonnet 5, Fable 5/Mythos 5, restricción y restauración de exportación en junio 2026) |
| **xAI (Grok)** | Documentación de la API de xAI; sin changelog estructurado tipo Keep-a-Changelog públicamente consistente | `xai-org/grok-1`, `xai-org/grok-prompts`; `xai-org/grok-build` (recién abierto como open source) | Documentación de modelos de la API de xAI | Sin canal formal de avisos de seguridad observado — el incidente de Grok Build se conoció por investigación de terceros, no por aviso oficial | Media, con eventos reactivos (el caso de exfiltración de datos obligó una corrección silenciosa) |
| **Google (Gemini)** | Release notes de Google AI/Vertex AI; blog de Google Developers | Repos del SDK de Gemini y de Antigravity | Endpoint `/models` documentado | Google Cloud Security Bulletins | Alta — ciclo de lanzamientos frecuente, incluida la transición completa de Gemini CLI a Antigravity CLI (mayo–junio 2026) |
| **Moonshot AI (Kimi)** | `changelog.md` dentro de los propios repos de CLI (ver Sección 5); documentación de la plataforma abierta (`platform.kimi.ai`/`kimi.com`) | `MoonshotAI/kimi-code`, `MoonshotAI/kimi-cli` (en fase de retiro) | Documentación de modelos por API compatible OpenAI | `SECURITY.md` en el propio repo del CLI | Muy alta — lanzamientos casi semanales de versiones menores del CLI y del modelo (K2.6 → K3 en julio 2026) |
| **Zhipu AI / Z.ai (GLM)** | Documentación de la plataforma BigModel/Z.ai | Pesos y model card en Hugging Face/ModelScope (MIT) | Documentación de modelos por API compatible OpenAI | Sin canal formal ampliamente documentado en español/inglés | Media |

**Recomendación práctica:** para Anthropic, Google y proveedores con documentación cerrada (no repo público de la API en sí), el monitoreo debe hacerse por *web scraping estructurado y programado* de la página de changelog (con detección de diffs) más que por API/webhook, ya que no exponen *feed* estructurado dedicado. Para Moonshot y proyectos con repo abierto (`kimi-code`, `kimi-cli`), usar directamente la API de GitHub (endpoint de *releases*, *commits* sobre `CHANGELOG.md`, y *Security Advisories*) — es más barato, más confiable y no depende de que el HTML de una página no cambie de estructura.

---

## 4. Matriz de convergencia de funciones de API (para detectar brechas y paridad)

Esta matriz responde a la necesidad explícita de una "matriz de convergencia adicional de funciones de sus API": qué capacidades técnicas ofrece cada proveedor hoy, para poder detectar automáticamente cuándo uno lanza una función que otro no tiene (señal de alto valor para el servicio de información).

| Función | Claude (Anthropic) | Grok (xAI) | Gemini (Google) | Kimi (Moonshot) | GLM (Zhipu) |
|---|---|---|---|---|---|
| **Uso de herramientas / *function calling*** | Sí | Sí (estilo OpenAI) | Sí | Sí (estilo OpenAI) | Sí (estilo OpenAI) |
| **Salida estructurada / modo JSON forzado** | Sí | Sí | Sí | Sí | Sí |
| **Entrada de imágenes (visión)** | Sí | Sí | Sí | Sí (K3 nativo) | Variable por modelo |
| **Entrada/salida de audio nativo** | No nativo en API estándar de chat | Parcial (voz vía herramientas específicas del CLI) | Sí (multimodal nativo) | Parcial | No |
| **Razonamiento extendido / *thinking* expuesto como campo separado** | Sí (*extended thinking*) | Sí (*reasoning_effort*) | Sí (`thoughts_token_count`) | Sí (*reasoning_effort*, modo *always-on max reasoning* en K3) | Variable |
| **Caché de prompt (*prompt caching*)** | Sí, con escritura de 5 min/1 h y lectura a tarifa reducida | Variable | Sí | Sí (*cache-hit* a tarifa reducida) | Sí (`prompt_tokens_details.cached_tokens`) |
| **Procesamiento por lotes (*Batch API*)** | Sí (descuento ~50%) | No confirmado de forma estándar | Sí | No confirmado de forma estándar | No confirmado de forma estándar |
| **Ejecución de código en sandbox (*code execution*)** | Sí (herramienta nativa) | Vía CLI/herramientas, no API base | Sí | Vía CLI | Vía CLI |
| **Uso de computadora (*computer use*)** | Sí (herramienta nativa) | No | Vía Antigravity/agente | No nativo en API base | No nativo en API base |
| **Ventana de contexto máxima (clase)** | Hasta 1M (Sonnet/Opus recientes) | ~500K–2M según variante/tarifa | 1M+ en variantes actuales | 1,048,576 (K3 nativo) | 1M vía variante `[1m]` explícita (GLM-5.2) |
| **Soporte nativo de MCP** | Sí — origen del protocolo | Vía CLI de terceros | Sí | Sí | Sí (vía compatibilidad) |
| **Soporte nativo de A2A** | Vía ecosistema | Vía ecosistema | Sí — Google es originador | Vía ecosistema | Vía ecosistema |
| **API de administración de uso/costo agregado** | Sí (Admin/Usage API) | No documentado de forma equivalente | Parcial (consola de Google Cloud/AI Studio) | No documentado de forma equivalente | No documentado de forma equivalente |
| **Pesos abiertos / autoalojable** | No | No (Grok-1/Grok-2 sí liberados como excepción histórica) | No | Sí (K3, licencia MIT modificada) | Sí (MIT, sin restricción regional declarada) |

**Uso de esta matriz en el sistema:** cada celda debe modelarse como un registro con `fuente`, `fecha_verificación` y `estado` (`confirmado_por_docs_oficial` / `inferido_de_comportamiento` / `pendiente_de_verificar`), no como un booleano estático — precisamente porque, como muestra la Sección 3, el ritmo de cambio en 2026 es alto y una matriz congelada se vuelve engañosa en semanas.

---

## 5. Matriz de monitoreo de CLIs de codificación

| CLI | Proveedor/mantenedor | Repo público | Mecanismo de changelog | Licencia | Notas de gobernanza/riesgo |
|---|---|---|---|---|---|
| **Claude Code** | Anthropic | `anthropics/claude-code` | `CHANGELOG.md` versionado en el repo, espejado en `code.claude.com/docs/en/changelog`; cadencia casi diaria (versión `2.1.223` observada el 6 de agosto de 2026) | Propietario (binario), repo con licencia de uso | Canal oficial más consistente y auditable de los seis; buen candidato para *webhook* directo sobre el repo |
| **Kimi Code CLI** (sucesor de `kimi-cli`) | Moonshot AI | `MoonshotAI/kimi-code` (y `MoonshotAI/kimi-cli`, en retiro gradual) | `changelog.md` en el repo + página de *release notes* dedicada (`kimi.com/code/docs`) | MIT | Migración activa de `kimi-cli` → `kimi-code`; el sistema de monitoreo debe seguir ambos repos durante la transición para no perder eventos |
| **Codex CLI** | OpenAI | Repo público de Codex (agente de codificación de OpenAI) | *Release notes* del repo | Código abierto (el CLI; no el modelo) | Evolucionó de un CLI ligero (modelo `o4-mini` por defecto en versión temprana) a incluir "Codex Security" (marzo 2026) — ejemplo de que el *scope* de un CLI puede ampliarse a funciones de seguridad que ameritan seguimiento propio |
| **Grok CLI / Grok Build** | Existen **dos productos distintos que no deben confundirse en el sistema**: (1) `superagent-ai/grok-cli` — proyecto **comunitario no oficial**, MIT, ~2.4k estrellas, con `CHANGELOG.md` propio y publicación de atestaciones Sigstore desde una versión reciente; (2) **Grok Build** — el CLI **oficial** de xAI, recién liberado como código abierto (`xai-org/grok-build`) tras el incidente de exfiltración de datos de julio 2026 | Ambos en GitHub, repos distintos | El comunitario: `CHANGELOG.md` estilo Keep-a-Changelog. El oficial (Grok Build): historial de commits desde su apertura reciente, sin trayectoria larga de changelog público | El comunitario: MIT. Grok Build: recién abierto, verificar términos exactos | **Máxima prioridad de monitoreo de seguridad de todo este grupo** — es el único caso con un incidente documentado de exfiltración masiva de datos (repos completos + secretos subidos a un bucket de Google Cloud sin relación con la consulta al modelo) y sin aviso de seguridad formal de xAI. El sistema debe distinguir explícitamente cuál de los dos productos se está monitoreando en cada evento |
| **Antigravity CLI (`agy`)** | Google | Parte del ecosistema Antigravity (sucesor oficial de Gemini CLI, anunciado en Google I/O, 19 de mayo de 2026) | Documentación oficial (`antigravity.google/docs/cli`); sin `CHANGELOG.md` público confirmado de forma equivalente a los anteriores | Propietario | **Evento de alto impacto para cualquier flujo que dependa de Gemini CLI**: acceso gratuito/consumidor a Gemini CLI se retiró el 18 de junio de 2026, migrando a `agy`. El sistema debe alertar proactivamente sobre este tipo de discontinuación, no solo sobre "funciones nuevas" |
| **Cline** | Comunidad/Cline Bot Inc. (extensión VS Code + CLI + SDK) | `cline/cline` | `CHANGELOG.md` en el repo (raíz y por subpaquete, p. ej. `apps/cli/CHANGELOG.md`) + *GitHub Releases* con notas legibles | Código abierto | Es agnóstico de modelo (soporta Claude, Codex, Kimi, GLM, DeepSeek, etc. como *backends*) — su changelog es en sí mismo una fuente secundaria útil para detectar cuándo un modelo nuevo (p. ej. "Claude Fable 5", "Kimi K3") queda soportado en un cliente de terceros, lo cual sirve como *corroboración cruzada* de lanzamientos |

**Hallazgo transversal importante:** de los seis, **Claude Code, Kimi Code CLI y Cline tienen el mecanismo de changelog más apto para automatización confiable** (archivo versionado en el propio repo, formato consistente, alta cadencia). **Codex CLI y Grok Build son más opacos** en historial de changelog estructurado. **Antigravity CLI está en transición activa** y su documentación pública de *release notes* aún no iguala en madurez a la de Claude Code. El diseño del *scraper*/*poller* debe asignar más peso de confianza (y menor intervalo de verificación humana) a las fuentes del primer grupo, y tratar las del segundo y tercer grupo como fuentes que requieren verificación cruzada adicional antes de clasificarse como "confirmado".

---

## 6. Esquema canónico de evento (Capa 2 de la arquitectura)

```json
{
  "evento_id": "uuid",
  "fecha_deteccion": "ISO 8601",
  "fecha_publicacion_original": "ISO 8601 o null si no declarada por la fuente",
  "entidad": {
    "tipo": "modelo_api | cli_agente | protocolo",
    "proveedor": "anthropic | xai | google | moonshot | zhipu | otro",
    "producto": "claude-code | kimi-code | codex-cli | grok-cli-community | grok-build | antigravity-cli | cline | api-<modelo>",
    "version_afectada": "string o rango"
  },
  "fuente": {
    "url": "...",
    "tipo": "changelog_repo | github_release | security_advisory | docs_oficial | blog | prensa_tecnica_terceros",
    "hash_sha256_contenido_original": "..."
  },
  "clasificacion": {
    "categoria": "funcion_nueva | breaking_change | fix_seguridad | deprecacion | cambio_precio | cambio_limite | ruido_irrelevante",
    "confianza_clasificador": 0.0,
    "resumen_es": "una a dos frases, generadas por el agente clasificador",
    "requiere_revision_humana": true
  },
  "verificacion": {
    "firma_ed25519": "...",
    "timestamp_rfc3161": "...",
    "estado": "confirmado_por_docs_oficial | inferido_de_comportamiento | pendiente_de_verificar | corroborado_cruzado"
  }
}
```

---

## 7. Consideraciones operativas y riesgos del propio sistema de monitoreo

1. **El scraping de páginas HTML de changelog (Anthropic, Google, Grok en su documentación de API) es frágil.** Cualquier rediseño de la página rompe el *parser*. Mitigación: usar un LLM con instrucción de extracción tolerante a cambio de estructura como capa de respaldo cuando el *parser* determinístico falla, marcando esos casos con confianza reducida.

2. **Confiar más en fuentes con repo público que en fuentes que solo publican HTML** reduce drásticamente el costo de mantenimiento del sistema: la API de GitHub (releases, commits, *security advisories*) es estable, versionada y no requiere renderizado de JavaScript.

3. **Distinguir explícitamente CLIs oficiales de CLIs comunitarios no oficiales es un requisito de gobernanza, no un detalle técnico.** El caso Grok CLI (comunitario) vs. Grok Build (oficial de xAI) es el ejemplo perfecto: son proyectos distintos, con perfiles de riesgo y de soporte completamente distintos, y un sistema institucional (IMSS) que recomiende uno u otro sin esa distinción explícita en el esquema de datos genera un riesgo de gobernanza real.

4. **El monitoreo de avisos de seguridad debe ser un flujo separado y de mayor prioridad que el de "funciones nuevas"**, con notificación inmediata (no agregada semanalmente), precisamente porque — como muestra el caso Grok Build — el propio proveedor puede no emitir un aviso formal, y la única señal disponible es la cobertura de terceros (investigadores de seguridad, prensa técnica especializada). Esto justifica incluir fuentes de prensa técnica curada como entrada de la Capa 1, no solo canales oficiales.

5. **Costo de mantenimiento vs. valor**: no todos los seis CLIs necesitan la misma cadencia de verificación. Recomendación de prioridad de monitoreo, según el volumen de uso real dentro de tu propio flujo (Claude Code, ya en uso vía CVOED/ADRC/CAGF) y el perfil de riesgo (Grok Build):
   - **Verificación diaria:** Claude Code (uso activo propio), Grok Build/Grok CLI (por el precedente de seguridad).
   - **Verificación semanal:** Kimi Code CLI, Cline, Antigravity CLI.
   - **Verificación quincenal:** Codex CLI, GLM (si no está en uso activo del stack propio).

---

## 8. Conclusión

El sistema propuesto no es un simple "lector de changelogs": es una extensión natural del mismo principio que ya rige CAGF — **no confiar en la declaración de un tercero sin capturar, firmar y sellar en el momento la evidencia que la respalda**, y tratar cada capa de fuente (changelog oficial, repo público, prensa técnica, aviso de seguridad) según su nivel real de confiabilidad, no según su nivel de conveniencia técnica de acceso. El caso Grok Build es el recordatorio más claro dentro de esta investigación de que la fuente más fácil de automatizar (el changelog oficial) no es necesariamente la fuente que primero revela lo que más importa saber.
