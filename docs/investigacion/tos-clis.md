# Revisión de Términos de Servicio de los CLIs — escrubery (D1)

**Estado:** en curaduría (`pendiente_de_verificar`). **Bloquea:** Fase 3 (criterio de entrada plan v2 §6.1). **Decisión:** D1. **Responsable:** Ejecutor (curaduría) · Mediador (veredicto).

## Objetivo
Determinar, por CLI, qué permite su ToS respecto a la **Fase 3** (introspección activa: ejecutar el CLI en contenedor efímero sin credenciales, capturar `--help`/`--version`) y a usos futuros (benchmarking). Sin esto, F3 no inicia (riesgo operativo/legal).

## Tres dimensiones por CLI
1. **Automatización** — ¿permiten uso programático/automatizado del CLI (no interactivo, en contenedor)?
2. **Benchmarking** — ¿permiten evaluar o comparar rendimiento?
3. **Extracción/retención** — ¿qué dicen sobre extraer o retener salidas del CLI?

**Veredicto por dimensión:** `permitido | restringido | prohibido | no_declara`, con **cita textual** de la cláusula y **procedencia** (`fuente_url` + `fecha_obtencion` + `hash_sha256`).

## Estado de curaduría (7 productos — grok se distingue por gobernanza)

| CLI | Proveedor | Fuente ToS (a confirmar) | Automatización | Benchmarking | Extracción | Estado |
|---|---|---|:-:|:-:|:-:|---|
| claude-code | anthropic | Anthropics Commercial Terms / AUP | ? | ? | ? | pendiente |
| codex-cli | openai | OpenAI Terms of Use | ? | ? | ? | pendiente |
| grok-build | xai | xAI Terms of Service | ? | ? | ? | pendiente |
| antigravity-cli | google | Google Terms / Additional Terms | ? | ? | ? | pendiente |
| kimi-code | moonshot | Moonshot Terms | ? | ? | ? | pendiente |
| grok-cli-community | superagent-ai | Repo LICENSE / ToS del proyecto | ? | ? | ? | pendiente |
| cline | cline-bot | Repo LICENSE / ToS | ? | ? | ? | pendiente |

> `grok-build` (oficial xAI) y `grok-cli-community` (comunitario superagent-ai) tienen ToS **distintos** — nunca se mezclan.

## Método (a decidir por el Mediador)
La curaduría con **procedencia real** (fuente+fecha+hash) exige leer cada ToS oficial. El Ejecutor no debe adivinar URLs. Opciones:

- **A) Webfetch autorizado:** el Mediador confirma las URLs oficiales (o autoriza al Ejecutor a buscarlas) → el Ejecutor lee cada ToS, extrae la cláusula, cita con `fuente_url`+`fecha`+`hash`, propone veredicto.
- **B) Curaduría humana:** el Mediador curad cada ToS (es decisión legal) y el Ejecutor sólo formatea con procedencia.
- **C) Diferir:** marcar todo `no_declara / pendiente_de_verificar` y mantener F3 bloqueada.

## Entregable (al cerrar D1)
- Esta tabla completa con veredicto + cita + procedencia por celda.
- Veredicto agregado: ¿qué CLIs pueden ir a la verificación diaria de F3? (criterio de entrada §6.1: "revisión ToS resuelta al menos para los CLIs de verificación diaria").

## Notas
- El veredicto es **lectura informada, no asesoría legal**; el Mediador aprueba.
- Para CLIs comunitarios (grok-cli-community, cline), la "fuente" puede ser la LICENSE del repo + cualquier ToS del proyecto open source.
