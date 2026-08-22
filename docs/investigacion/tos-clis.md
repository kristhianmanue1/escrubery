# Revisión de Términos de Servicio de los CLIs — escrubery (D1)

**Estado:** 7/9 curados (kimi-code añadido como 7º, 2026-08-22 — MIT); diarios redefinidos = **opencode + claude-code + codex-cli** (controladores reales del Mediador); pendientes: grok-build (xAI inaccesible), antigravity. **Bloquea:** Fase 3 (criterio de entrada plan v2 §6.1). **Decisión:** D1. **Responsable:** Ejecutor (curaduría) · Mediador (veredicto). **Actualizado:** 2026-08-22.

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
| codex-cli | openai | ✅ permitido (introspección) | ✅ permitido | no_declara | **curado** (Business Terms) |
| grok-build | xai | ? | ? | ? | **pendiente** (ToS inaccesible, x.ai 403) |
| antigravity-cli | google | ? | ? | ? | pendiente |
| kimi-code | moonshot | ✅ permitido | ✅ permitido | no_declara (licencia) | **curado** (MIT, 2026-08-22) |
| opencode | comunidad/Anomaly (MIT) | ✅ permitido | ✅ permitido | no_declara (licencia) | **curado** (controlador principal) |
| qwen-code | qwenlm/Alibaba (Apache-2.0) | ✅ permitido | ✅ permitido | no_declara (licencia) | **curado** (9º CLI, 2026-08-17) |

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

### codex-cli — OpenAI ✅ (curado, Consumer + Business Terms)
- **ToS aplicable:** Terms of Use (Consumer) + **Business Terms** (gobiernan la API; codex-cli usa la API). Effective Jan 1, 2026.
- **Fuente:** `https://openai.com/policies/terms-of-use` (webfetch). **Hash crudo:** pendiente (sitio SPA, curl vacío).
- **Cita (Consumer, "What you cannot do"):** "Attempt to or assist anyone to **reverse engineer**, decompile or discover the source code…"; "**Automatically or programmatically extract data or Output**"; "Use Output to develop models that **compete** with OpenAI". Y: "Our **Business Terms** govern use of ChatGPT Enterprise, our APIs…".
- **Veredicto:** automatización **restringido** en Consumer (prohíbe extract automatizado), pero codex-cli se rige por **Business Terms** (API) → uso programático permitido. F3 diffing `--help`/`--version`: no extrae Output, no compite, no RE → **PERMITIDO**. Verificación práctica `codex --help` sin auth: pendiente (no instalado en el host).
- **estado_verificacion:** `confirmado_por_docs_oficial` (cita); pendiente hash crudo + verificación práctica.

### opencode — Anomaly (MIT) ✅ (curado — controlador principal del Mediador)
- **Rol:** CLI donde el Mediador corre **GLM-5.2** (zhipu); herramienta con la que se desarrolla el propio escrubery (dogfooding). 8º CLI del inventario.
- **Fuente:** `https://raw.githubusercontent.com/anomalyco/opencode/master/LICENSE` · **fecha:** 2026-08-07 · **hash_sha256:** `625f0f619133f89bbbb2abe37369613dfa1885eba1e50d02170deb62bb42cb6b`
- **Cita (MIT):** "Permission is hereby granted, free of charge, to any person obtaining a copy of this software… to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies…" Copyright (c) 2025 opencode.
- **Veredicto:** automatización **permitido** (MIT); benchmarking **permitido**. Extracción: la licencia no restringe retener salidas (el modelo subyacente, p. ej. GLM-5.2, se rige por el ToS de su proveedor).
- **Comandos introspectables** (catalogados en `datos/fichas/clis/opencode.json`): `opencode run`, `opencode serve`, `opencode auth`, `opencode mcp`, `opencode models`, `opencode agent`.

### grok-build — xAI ⏳ (PENDIENTE, ToS inaccesible)
- **Intentos (2026-08-07):** `x.ai/legal/terms-conditions`, `x.ai/legal/terms-of-service`, `x.ai/terms` → **403** (bloqueo); `grok.com/legal/terms` → hash `c80c25f931ff747ff9fa8d79fd9907a12ad00e9f006089b38b905779f82891b8` pero contenido **SPA no leíble** vía webfetch (devuelve "Grok").
- **Veredicto:** **PENDIENTE** — no accesible vía automatizada. Requiere **curaduría humana** (el Mediador lee el ToS de Grok Build / xAI) o una URL/contenido accesible.
- **⚠️ Bloquea el criterio F3:** grok-build es uno de los **2 CLIs de verificación diaria** (plan §5.1). Mientras su ToS no se resuelva, el criterio de entrada de F3 ("ToS resuelta al menos para los diarios") **no se cumple del todo** (claude-code ✓, grok-build ✗). El Mediador debe: (a) proveer el ToS de Grok Build, (b) iniciar F3 sólo con claude-code, o (c) diferir.

---

### kimi-code — Moonshot AI ✅ (curado, MIT, 2026-08-22)
- **Fuente:** `https://raw.githubusercontent.com/MoonshotAI/kimi-code/main/LICENSE` · **fecha:** 2026-08-22 · **hash_sha256:** `23cc68e17992e0b512ae2e80afc5787d7d8e0fbfbdb4fff54ec0245508fa400e` (crudo archivado en `datos/fuentes/tos/kimi-code/LICENSE-2026-08-22.txt`)
- **Cita:** "Permission is hereby granted, free of charge, to any person obtaining a copy of this software… to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software…" (MIT). Copyright (c) 2026 Moonshot AI.
- **Veredicto:** automatización **permitido** (la licencia OSS del CLI autoriza ejecución/uso programático, incl. `--help`/`--version` en contenedor efímero); benchmarking **permitido** (no restringido). Extracción: la licencia del CLI no restringe retener salidas; el modelo subyacente (Moonshot API) se rige por el ToS de Moonshot — fuera de alcance de esta curaduría del CLI.
- **Nota:** re-elevado de "baja prioridad" a curado por decreto del Mediador (2026-08-22): kimi es uno de los 5 CLIs principales (probe H6 ejecutado) y candidato a introspección sandbox.

## Pendientes (2)

- **grok-build (xAI)** — DIARIO, **bloqueante** para el criterio F3 (ver arriba). ToS inaccesible vía automatizada.
- **antigravity-cli (Google)** — `policies.google.com/terms` accesible (hash `41cff720296facf44f14f7f709b3f02f20123c9d883c6ec58fc4bc7c25a215d1`) pero antigravity puede tener **términos adicionales** específicos; pendiente profundizar. Semanal (no bloquea F3).
## Método
- **Comunitarios:** LICENSE cruda del repo GitHub (curl raw) → hash exacto + cita + veredicto (licencia OSS).
- **Oficiales:** ToS del proveedor (webfetch para lectura + curl para hash del crudo) → cita de la cláusula + veredicto + `estado_verificacion`.

## Notas
- El veredicto es **lectura informada, no asesoría legal**; el Mediador aprueba.
- Distinguir grok-build (xAI, oficial) de grok-cli-community (superagent-ai, comunitario) — ToS distintos.
- **Procedencia:** las fuentes LICENSE tienen hash exacto del archivo crudo; los ToS web tienen hash del HTML crudo (puede variar entre descargas por contenido dinámico — re-verificar al cerrar D1).

### qwen-code — Apache License 2.0 ✅ (9º CLI, 2026-08-17)
- **Fuente:** `https://raw.githubusercontent.com/QwenLM/qwen-code/main/LICENSE` · **fecha:** 2026-08-17 · **hash_sha256:** `55367b61ccd2a016a0159ad886bd66a3ee6cb5e873d0c75c803c897dd245b075`
- **Cita:** "Subject to the terms and conditions of this License, each Contributor hereby grants… a perpetual, worldwide, non-exclusive, no-charge, royalty-free… license… to use, reproduce, prepare Derivative Works… and to **run** the Work and Derivative Works." (Apache 2.0 §2; texto canónico idéntico al de cline).
- **Veredicto:** automatización **permitido** (licencia OSS autoriza ejecución; fork oficial de gemini-cli por el equipo Qwen); benchmarking **permitido**. Extracción: la licencia del CLI no restringe retener salidas; los modelos Qwen subyacentes (DashScope) se rigen por su propio ToS de servicio.
