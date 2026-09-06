# escrubery

**Servicio de inteligencia sobre modelos y CLIs de IA** — qué es cierto hoy sobre cada modelo y cada CLI de agente, desde cuándo, con qué fuente, y con procedencia verificable.

Responde, con datos normalizados y fuente citada:

- **Modelos** (Anthropic, xAI, Google, Moonshot, Zhipu): capacidades, ventana de contexto, precios, funciones soportadas.
- **CLIs de agente** (Claude Code, Codex CLI, OpenCode, Qwen Code, Kimi Code, Cline, Grok CLI, Grok Build, Antigravity CLI): comandos, *flags*, configuración, cambios por versión.
- **Cambios**: *changelogs* clasificados por severidad, alertas de seguridad, divergencias entre lo documentado y lo observado.
- **Procedencia**: cada hecho registrado lleva fuente, fecha, hash y —por fases— firma Ed25519, agregación Merkle y sellado de tiempo.

## Estado del proyecto

**Operación continua** — Ficha v0 funcional; releases **v0.3.0 · v0.4.0 · v0.5.0** publicadas; backend **Evidentia** (NestJS + PostgreSQL) con API de consulta, pollers de changelog, alertas clasificadas y checkpoint firmado diario; **vigilancia diaria** con introspección sandbox de CLIs. El registro canónico del trabajo día a día es [`bitacora_ciclos.md`](bitacora_ciclos.md). La documentación de diseño está en [`docs/investigacion/`](docs/investigacion/):

| Documento | Contenido |
|---|---|
| [Analisis_Trazabilidad_Agentes_IA_Matriz.md](docs/investigacion/Analisis_Trazabilidad_Agentes_IA_Matriz.md) | Marco de 5 capas de trazabilidad; por qué ningún estándar existente resuelve solo el problema |
| [Sistema_Monitoreo_Modelos_CLIs_IA.md](docs/investigacion/Sistema_Monitoreo_Modelos_CLIs_IA.md) | Arquitectura de 5 capas, matrices de fuentes por proveedor y por CLI, esquema canónico de evento |
| [Verificacion_Activa_CLIs_IA.md](docs/investigacion/Verificacion_Activa_CLIs_IA.md) | Verificación activa: introspección `--help`, baterías de regresión, pruebas de red con *canary tokens* |
| [Panorama_Existente_Mercado_OpenSource.md](docs/investigacion/Panorama_Existente_Mercado_OpenSource.md) | Qué adoptar (LiteLLM, Langfuse, Harbor, `agent-bom`) vs. qué construir (procedencia con valor legal) |
| [Plan_Iterativo_Incremental_Servicio_CLI_Modelos.md](docs/investigacion/Plan_Iterativo_Incremental_Servicio_CLI_Modelos.md) | Plan v1 (histórico) |
| [Analisis_Critico_Plan_y_Propuesta_de_Cambios.md](docs/investigacion/Analisis_Critico_Plan_y_Propuesta_de_Cambios.md) | Análisis crítico del plan y 10 cambios propuestos (incluye análisis del esquema de firma de CAGF y consumidores reales) |
| [Plan_Iterativo_Incremental_Servicio_CLI_Modelos_v2.md](docs/investigacion/Plan_Iterativo_Incremental_Servicio_CLI_Modelos_v2.md) | **Plan vigente (v2)**: incorpora los 10 cambios — Ficha v0 en Fase 0, consumidores reales, firma corregida |
| [CONTRATO_API_v0.md](docs/CONTRATO_API_v0.md) | Contrato JSON v0 de la API de consulta (ruptura permitida hasta el cierre de la Fase 2) |
| [GUIA_OPENCODE.md](docs/GUIA_OPENCODE.md) | Guía canónica de uso de OpenCode: superficie vigente, capas de estabilidad, límites de seguridad y gate de divergencia ficha↔captura (issue #3) |

## Uso rápido (Ficha v0)

Sin base de datos ni dependencias (solo Python 3 stdlib):

```bash
./scripts/consultar listar                       # entidades disponibles
./scripts/consultar ficha cli grok-build         # ficha de un CLI
./scripts/consultar modelo moonshot kimi-k2-0905-preview
./scripts/consultar comando claude-code mcp      # comandos con filtro
./scripts/consultar oficialidad                  # oficial vs. comunitario
python3 scripts/generar_fichas_modelos.py        # regenerar fichas desde LiteLLM
bash scripts/ci_local.sh                         # CI local: build + lint + 254 tests + gates (docs/CI.md)
bash scripts/vigilancia_diaria.sh                # pollers + alertas + checkpoint firmado (docs/VIGILANCIA.md)
python3 scripts/verificar_divergencia_opencode.py  # gate ficha↔captura sandbox (issue #3)
```

Toda respuesta incluye su bloque de `procedencia` (fuente, fecha, hash). Las fichas de proveedores (**188 modelos de 6 proveedores**) se generan desde el JSON de LiteLLM; las de CLIs (9 productos) están curadurizadas desde la investigación y la introspección sandbox.

## Principios de diseño

1. **Esqueleto ambulante**: cada fase atraviesa todas las capas de punta a punta con el alcance mínimo; valor usable desde el primer ciclo (Ficha v0, ver análisis crítico).
2. **Cachear-al-consultar, no vigilar-todo-el-tiempo**: el dato se obtiene de la fuente una vez, se normaliza y se sirve desde base de datos mientras esté vigente. Nada de *polling* continuo ni de invocar un modelo de IA por consulta.
3. **No reconstruir lo que ya existe**: LiteLLM para precios/capacidades, API de GitHub para *changelogs*, Harbor para pruebas activas, `agent-bom` para seguridad.
4. **Procedencia rastreable desde el día uno**: `fuente_url` + `fecha_obtencion` + `hash` en cada registro desde la Fase 0; firma Ed25519 (con `prev_hash` en el payload y checkpoint firmado del tip) desde la Fase 2.
5. **Diseñado para consumo por agentes**: contratos JSON estables desde la Fase 1; exposición como servidor MCP en la Fase 5 como adaptador, no reescritura.

## Ecosistema

El proyecto pertenece a un ecosistema de herramientas de gobernanza de IA y es desarrollado y consumido por agentes:

- **ADRC** (marco Arquitecto/Controlador LLM + Desarrollador/Ejecutor LLM + Mediador humano): metodología de desarrollo del propio proyecto y primer consumidor del servicio.
- **[CAGF](https://github.com/kristhianmanue1/constitutional-ai-governance)** (Constitutional AI Governance Framework): fuente de los patrones de firma y cadena de custodia que el servicio adopta corregidos (clave por servicio, canonicalización JCS/RFC 8785, checkpoint firmado del tip).
- **[expertoGobernanza](https://github.com/kristhianmanue1/expertoGobernanza)**: consumidor externo confirmado (resolución de identidad de modelos, metadatos ToS por proveedor, disponibilidad de CLIs).

## Stack previsto

- **Backend**: NestJS + PostgreSQL (consistente con el resto del ecosistema).
- **Fuentes**: JSON de LiteLLM, API pública de GitHub, documentación oficial — Fases 0–1 son 100% lectura de fuentes públicas gratuitas.
- **Firma**: Ed25519, formato de artefacto alineado con CAGF (`ed25519:` + base64, keyring JSON commiteado).

## Prácticas de desarrollo agente-nativo

Este proyecto se desarrolla con agentes de IA como fuerza de trabajo, bajo estas reglas:

- **`AGENTS.md`** como contrato operativo: convenciones, comandos, límites y criterios que cualquier agente debe leer antes de trabajar (ya creado en la raíz).
- **Tickets pequeños y verificables**: el Arquitecto descompone cada fase en tickets con criterios de aceptación explícitos; el Ejecutor implementa de forma aislada; el Mediador humano aprueba cada cierre.
- **Criterio de "terminado" verificable por fase**: ninguna fase se cierra por declaración del agente — el Mediador verifica contra el criterio escrito en el plan.
- **Bitácora de ciclos**: estimado vs. real por ticket, para detectar atraso (ciclos, no semanas).
- **Trazabilidad de decisiones**: decisiones de arquitectura como documentos versionados en `docs/`, no como conversación perdida.
- **Toda salida de agente es evidencia a corroborar, no autoridad**: los datos servidos citan fuente primaria; las afirmaciones "confirmadas" requieren prueba propia repetible (Fase 4).

## Roadmap

| Fase | Entrega | Estado |
|---|---|---|
| 0 | Cimientos + **Ficha v0** consultable (JSON por CLI/proveedor, sin base de datos) | **Entregada** |
| 1 | MVP de consulta: CLI propio + API JSON sobre PostgreSQL, consumido por agentes ADRC y expertoGobernanza | **Operativa** — backend Evidentia (API + PostgreSQL) |
| 2 | Changelog clasificado, alertas, firma Ed25519 por evento con checkpoint | **Operativa** — pollers + alertas + checkpoint firmado diario |
| 3 | Introspección activa automatizada (`--help` diffing por versión) | **Operativa** — F3 en sandbox (migración a servidor externo en curso) |
| 4 | Pruebas activas en sandbox, seguridad de red, CAGF completo (Merkle + RFC 3161) | **Parcial** — censo HRA L1–L4 y contrastes de verificación activa; Merkle/RFC 3161 pendientes |
| 5 | Servidor MCP, Agent Card firmado, niveles de acceso | Condicional a decisión de alcance |

Las duraciones se estiman en ciclos agente-nativos (lo que un Ejecutor completa y deja verificable en una sesión), no en semanas. Ver el [plan](docs/investigacion/Plan_Iterativo_Incremental_Servicio_CLI_Modelos_v2.md) (vigente), su [análisis crítico](docs/investigacion/Analisis_Critico_Plan_y_Propuesta_de_Cambios.md), la [vigilancia](docs/VIGILANCIA.md) y la [CI local](docs/CI.md); el detalle por ticket, en la [bitácora](bitacora_ciclos.md).

## Licencia

**Apache 2.0** (decisión del Mediador, 2026-08-10; ver `LICENSE`). Justificación resumida: §3 (cesión de patentes) protege el esquema Evidentia y a quien lo adopte; §5 fija términos de contribución explícitos ante contribuciones de agentes operados por terceros; §6 protege la marca si el servicio termina siendo producto.
