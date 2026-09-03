# Tarea: gate-fuente-primaria-versiones (ABIERTA 2026-09-03)

**Estado:** IMPLEMENTADA — adversarial independiente `proceed` (2026-09-03; DoD
1–7 por ejecución; hallazgos H1/H2 declarados en Fuera de alcance, H3 aplicado).
Commit autorizado por el Mediador ("adelante con comit").
**Origen:** hallazgo al revisar el estado post-Docker-caído — `cli_productos.
version_actual` de cline = `4.1.17` en BD, cuando el paquete npm `cline` real va
por `3.0.61` (`npm view cline version`, 2026-09-03). El `4.1.17` proviene del
tag `v4.1.17` del repo `cline/cline` (línea extensión/desktop; el propio poller
lo clasificó `cambio_precio` — ni siquiera es una release del CLI). Segundo caso
de la misma clase detectado el mismo día: grok-cli-community BD=1.1.7 vs npm
`grok-cli`=1.0.5.
**Tamaño estimado:** 0.5–0.75 ciclos.

## Objetivo (único)

Eliminar la clase de defecto residual R1/R2 de la tarjeta fix-version-poller-cline:
**una versión que no existe en la fuente de instalación del CLI no puede
alcanzar `version_actual` ni disparar un rebuild**. El gate semver del 08-28
bloquea la contaminación *hacia abajo*; un artefacto hermano con número *mayor*
lo atraviesa (manifestación exacta del residual declarado R1 "artefacto hermano
con número mayor").

**Cadena del defecto (verificada por ejecución 2026-09-03):**
1. `cline/cline` publica tags `v4.x` (extensión/desktop) en la misma ventana de
   releases que el poller lee (única fuente que el poller consulta).
2. El gate semver de `poller.ts:90-100` escribe la MÁXIMA parseable si es
   semver-Mayor → `4.1.17 > 3.0.60` → escribe. El gate cumple su contrato; el
   contrato era incompleto: no contrasta contra la fuente de instalación.
3. El `v_SANDBOX` sigue en 3.0.60 → el lunes 2026-09-07 la condición de rebuild
   (`vigilancia_diaria.sh:173`) vería `publicada (4.1.17) > sandbox (3.0.60)` →
   `docker build --build-arg VERSION=4.1.17` → `npm install cline@4.1.17` falla
   (la versión no existe en npm) → exit 2 recurrente: recaída del incidente del
   08-25 por la vía R1.
4. Aunque el build no fallara, la introspección escribiría 3.0.61 (npm latest)
   y el poller re-escribiría 4.1.17 → flip-flop semanal poller↔introspección.

**Evidencia de ejecución (2026-09-03):**
- `npm view cline version` → 3.0.61; `npm view cline versions` → `4.1.17` NO
  está, `3.0.61` sí.
- `registry.npmjs.org/cline/4.1.17` → HTTP 404; `/cline/3.0.61` → HTTP 200;
  `/​@openai/codex/0.154.0-alpha.1` → HTTP 200 (los prereleases de codex SÍ se
  publican en npm: el gate no debe romperlos).
- Mapeo paquete↔CLI extraído de los Dockerfiles (`docker/sandbox/Dockerfile.*`),
  que es cómo el sandbox instala de verdad:
  claude-code→`@anthropic-ai/claude-code`, cline→`cline`, codex-cli→`@openai/codex`
  (Dockerfile.codex), opencode→`opencode-ai`, qwen-code→`@qwen-code/qwen-code`,
  kimi-code→`@moonshot-ai/kimi-code`, grok-cli-community→`grok-cli`.
  grok-build instala por `curl https://x.ai/build/install` (fuente no-npm, sin
  mapeo — conserva solo el gate semver).

## Alcance permitido

1. **`backend/src/evidentia/poller.ts`:** constante `PAQUETE_NPM` con el mapeo
   CLI→paquete (con comentario de procedencia: extraído de los Dockerfiles,
   fecha). Antes de escribir `version_actual`, si el CLI tiene paquete mapeado,
   verificar que la versión candidata existe: `GET registry.npmjs.org/<pkg>/<ver>`
   → 200 escribe; 404 no escribe (razón registrada); otro status/fallo de red →
   fail-closed NO escribe (con timeout acotado). El registro de eventos del
   changelog NO se toca (los tags siguen alimentando Evidentia; solo se protege
   `version_actual`).
2. **`ResultadoPoller`:** campo opcional `nota_version` `{candidata, razon}`
   para observabilidad en el log de vigilancia (la decisión de NO escribir debe
   ser visible, no silenciosa).
3. **Specs (`poller_version.spec.ts`):** mock del fetch de registry: (a) candidata
   ausente en npm → no escribe + nota; (b) candidata presente → escribe; (c)
   registry caído (500) → no escribe (fail-closed); (d) CLI sin mapeo
   (grok-build) → comportamiento actual intacto; (e) caso cline real como
   fixture: ventana con `v4.1.17` + baseline `3.0.60` → intacta.
4. **Reparación por fuente primaria (sin UPDATE manual):** re-introspección de
   cline (receta de vigilancia) → `version_actual` = lo que el sandbox real
   reporta (3.0.61 si el rebuild llega a tiempo; la corrida del lunes
   auto-corrige con el gate nuevo). El valor falso `4.1.17` muere cuando la
   fuente primaria lo sobrescriba.

## Fuera de alcance

- Cambiar la fuente del poller para cline (seguirá leyendo releases de GitHub
  para el changelog/Evidentia — su función propia).
- Denylist de prefijos (imposible para este caso: `v4.1.17` no tiene prefijo
  distintivo; el filtro por existencia es la forma general).
- Deduplicar el flip-flop en `sandbox_introspeccion.ts` (con el gate, la
  introspección siempre escribe versiones npm-existentes; el poller ya no las
  contradice).
- Touch de `versiones.ts` (el comparador semver no cambia).
- **Reparación inmediata de grok-cli-community (aplazada, hallazgo H1 del
  adversarial):** su BD sigue con `1.1.7` (npm 404). No se repara hoy porque su
  sandbox no existe y está excluido de la introspección F3 hasta resolver
  D1/ToS (no está en `F3_SEMANALES`) — no hay fuente primaria disponible; el
  valor no dispara rebuilds (no hay imagen que comparar ni introspección
  pautada) y el gate nuevo impide su re-contaminación. Queda pendiente de
  D1/ToS para grok.
- **Residual declarado (hallazgo H2 del adversarial, dirección segura):** la
  regex del poller trunca sufijos de plataforma (`rust-v0.154.0-alpha.1-darwin-x64`
  → `0.154.0-alpha.1`) y existen 8 versiones npm de codex cuya "umbrella" no
  existe; si un tag con sufijo apareciera, el gate rechazaría una versión
  instalable (falso positivo, falla en NO-escribir). Mitigado: `git ls-remote
  --tags openai/codex` → 0 tags con sufijo de plataforma a 2026-09-03.

## Criterio falsable (DoD)

| # | Criterio | Falsación |
|---|---|---|
| DoD-1 | `poller_version.spec.ts` incluye el caso "ventana con v4.1.17, baseline 3.0.60, npm sin 4.1.17 → `version_actual` queda 3.0.60 + nota_version" y pasa | si el spec pasa con el código VIEJO (sin gate), el spec es tautológico → inválido |
| DoD-2 | fail-closed: registry 500 / timeout → NO escribe y la corrida no se rompe (spec + ejecución) | una escritura con npm caído refuta el criterio |
| DoD-3 | codex prerelease (0.154.0-alpha.1) sigue escribiéndose (existe en npm) — el gate no rompe rebuilds legítimos de prerelease | si un prerelease npm-existente es rechazado, el gate está sobre-restrictivo |
| DoD-4 | CLI sin mapeo (grok-build) conserva el comportamiento semver-only | un CLI sin paquete npm dejara de escribir versiones → sobre-alcance |
| DoD-5 | `npm run build` + `eslint` + `check_sizes` + suite completa verdes | cualquier rojo en gates existentes |
| DoD-6 | BD: tras la re-introspección (o la corrida del lunes), `cline.version_actual` vuelve a ser una versión existente en npm (verificable con `registry.npmjs.org/cline/<v>` → 200) | un valor de BD con 404 en npm tras la reparación |
| DoD-7 | la corrida de vigilancia de recuperación (hoy, Docker arriba) termina sin rebuild contaminado: las versiones que reconstruya existen en su paquete npm | un rebuild @<versión-404-en-npm> en el log de hoy |

## Adversarial

Ronda independiente posterior a la implementación (antes de commit): verificar
DoD 1–5 por ejecución, intentar encontrar una versión npm-existente que el gate
rechace (falso positivo), y un tag de artefacto hermano que el gate deje pasar
(falso negativo — p. ej. paquete npm del hermano con la misma versión).
