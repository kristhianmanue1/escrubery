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
| claude-code | anthropic | ⚠️ restringido | ⚠️ restringido | no_declara (TBD) | **preliminar** (Commercial Terms pendiente) |
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

### claude-code — Anthropic ⚠️ (preliminar)
- **ToS aplicable:** **Commercial Terms + AUP** (Claude Code no se rige por los Consumer Terms; estos últimos declaran expresamente no cubrir API/Console). **Pendiente:** leer los Commercial Terms y cualquier término específico de Claude Code.
- **Evidencia preliminar (Consumer Terms §3, como indicio):** "Except when you are accessing our Services **via an Anthropic API Key** or where we otherwise explicitly permit it, to access the Services through **automated or non-human means**, whether through a bot, script, or otherwise." También prohíbe crawl/scrape y "develop products that compete" / "train AI models".
  - **Fuente preliminar:** `https://www.anthropic.com/legal/terms` · **fecha:** 2026-08-07 · **hash_sha256 (HTML Consumer):** `f3f675e9ed33d2f9a0cca033d4fa807fea4de112306746746474ff4be910512e`
- **Veredicto preliminar:** automatización **restringido** — parece permitida **solo vía API Key / suscripción** (no "sin credenciales"). Extracción: no_declara (TBD en Commercial/AUP).
- **⚠️ Impacto en F3:** el plan v2 §6.2 prevé "ejecutar los CLIs **sin credenciales reales**" en sandbox. Si Anthropic exige API Key para automatización, F3 debe **replantear**: ejecutar **con credenciales controladas** (sandbox con API Key del Mediador, no "sin"), o limitar F3 para claude-code a diffing de `--help` que no requiera auth. Esto es **exactamente el valor de D1** antes de construir F3.

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
