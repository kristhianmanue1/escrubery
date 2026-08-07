# Revisión de Términos de Servicio de los CLIs — escrubery (D1)

**Estado:** en curaduría (3/7 curados, 4 pendientes). **Bloquea:** Fase 3 (criterio de entrada plan v2 §6.1). **Decisión:** D1. **Responsable:** Ejecutor (curaduría) · Mediador (veredicto). **Actualizado:** 2026-08-07.

## Objetivo
Determinar, por CLI, qué permite su ToS respecto a la **Fase 3** (introspección activa: ejecutar el CLI en contenedor efímero, capturar `--help`/`--version`) y usos futuros (benchmarking). Sin esto, F3 no inicia (riesgo operativo/legal).

## Tres dimensiones por CLI
1. **Automatización** — ¿permiten uso programático/no interactivo del CLI?
2. **Benchmarking** — ¿permiten evaluar o comparar rendimiento?
3. **Extracción/retención** — ¿qué dicen sobre extraer o retener salidas?

**Veredicto:** `permitido | restringido | prohibido | no_declara`, con cita + procedencia.

## Tabla resumen

| CLI | Proveedor | Automatización | Benchmarking | Extracción | Estado |
|---|---|:-:|:-:|:-:|---|
| cline | comunidad (Apache 2.0) | ✅ permitido | ✅ permitido | no_declara (licencia) | **curado** |
| grok-cli-community | superagent-ai (MIT) | ✅ permitido | ✅ permitido | no_declara (licencia) | **curado** |
| claude-code | anthropic | ✅ permitido (introspección) | ✅ permitido | no_declara | **curado** (Commercial Terms) |
| codex-cli | openai | ? | ? | ? | pendiente |
| grok-build | xai | ? | ? | ? | pendiente |
| antigravity-cli | google | ? | ? | ? | pendiente |
| kimi-code | moonshot | ? | ? | ? | pendiente |

---

## Curados

### cline — Apache License 2.0 ✅
- **Fuente:** `https://raw.githubusercontent.com/cline/cline/main/LICENSE` · **fecha:** 2026-08-07 · **hash_sha256:** `f704446a5f1271608805598b557e4288cf8580477ea038c9c3d8b361f693f6b8`
- **Cita:** "Subject to the terms and conditions of this License, each Contributor hereby grants… a perpetual, worldwide, non-exclusive, no-charge, royalty-free… license… to use, reproduce, prepare Derivative Works… and to **run** the Work and Derivative Works." (Apache 2.0 §2)
- **Veredicto:** automatización **permitido** (la licencia OSS autoriza ejecución/uso programático); benchmarking **permitido** (no restringido). Extracción: la **licencia del CLI** no restringe retener salidas; el modelo subyacente que use cline (vía API del usuario) se rige por el ToS de ese proveedor.

### grok-cli-community — MIT ✅
- **Fuente:** `https://raw.githubusercontent.com/superagent-ai/grok-cli/main/LICENSE` · **fecha:** 2026-08-07 · **hash_sha256:** `5615244f5e54d6c1c611f4558097c29681d4cb23701236b987691129510799dc`
- **Cita:** "Permission is hereby granted, free of charge, to any person obtaining a copy of this software… to **use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies** of the Software…" (MIT). Copyright © 2024 Superagent Technologies Inc.
- **Veredicto:** automatización **permitido**; benchmarking **permitido**. Extracción: la licencia MIT no restringe retención de salidas del CLI. (El modelo Grok subyacente es xAI → sujeto a ToS xAI, pero el CLI comunitario en sí es MIT.)

### claude-code — Anthropic ✅ (curado, Commercial Terms)
- **ToS aplicable:** **Commercial Terms of Service** (Claude Code se usa con API/suscripción, no Consumer). Effective June 17, 2025.
- **Fuente:** `https://www.anthropic.com/legal/commercial-terms` · **fecha:** 2026-08-07 · **hash_sha256 (HTML crudo):** `48af56a110b0651c83ff0b13cca03df31da32dd58af6e53330f40da838cc5c1a`
- **Citas:**
  - **A.1 (permiso):** "Anthropic gives Customer permission to use the Services, including to power products and services Customer makes available to its own customers and end users."
  - **D.4 (restrictiones — lo que NO se puede hacer):** no "access the Services to build a competing product or service, including to **train competing AI models**", no "**reverse engineer or duplicate** the Services", no "resell". *(La introspección `--help`/`--version` no incurre en ninguna: no compite, no entrena, no hace reverse-engineering del servicio, no reventa.)*
  - **B:** "Anthropic **may not train models on Customer Content**"; el Cliente posee sus Outputs.
- **Verificación práctica (2026-08-07):** `claude --version` → `2.1.220 (Claude Code)`; `claude --help` → muestra uso completo. Ambos **exit 0 sin autenticación y sin llamadas al modelo** (no consumen tokens). Son introspección local del binario, no "access the Services".
- **Veredicto:** automatización **PERMITIDO** para introspección (`--help`/`--version`): el ToS (Commercial) no lo prohíbe y no consume Services. Benchmarking: **permitido** (no restringido por D.4). Extracción: `no_declara` (el ToS no restringe retener Outputs — el Cliente los posee por §B).
- **Implicación F3:** el "ejecutar sin credenciales reales" del plan v2 §6.2 **es viable** para claude-code en lo que respecta a difear `--help`/`--version` (no requieren auth ni tokens). La API Key del Mediador solo sería necesaria si F3 generara Outputs del modelo (no es el caso del diffing).

---

## Pendientes (4 oficiales)

`codex-cli` (OpenAI Terms), `grok-build` (xAI Terms), `antigravity-cli` (Google Terms), `kimi-code` (Moonshot Terms). Pendiente de webfetch a los ToS oficiales de cada proveedor (mismo método: curl/webfetch + cita + hash + veredicto).
## Método
- **Comunitarios:** LICENSE cruda del repo GitHub (curl raw) → hash exacto + cita + veredicto (licencia OSS).
- **Oficiales:** ToS del proveedor (webfetch para lectura + curl para hash del crudo) → cita de la cláusula + veredicto + `estado_verificacion`.

## Notas
- El veredicto es **lectura informada, no asesoría legal**; el Mediador aprueba.
- Distinguir grok-build (xAI, oficial) de grok-cli-community (superagent-ai, comunitario) — ToS distintos.
- **Procedencia:** las fuentes LICENSE tienen hash exacto del archivo crudo; los ToS web tienen hash del HTML crudo (puede variar entre descargas por contenido dinámico — re-verificar al cerrar D1).
