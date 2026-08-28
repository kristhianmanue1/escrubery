# Tarea: fix-version-poller-cline (EJECUTADA 2026-08-28; adversarial `proceed`; pendiente de decreto de cierre)

**Estado:** EJECUTADA — DoD 1–5 por ejecución; ronda adversarial independiente
`proceed` (2026-08-28, verificaciones A–J con evidencia ejecutada; hallazgos
MED-1/LOW-1/2/3 aplicados en esta revisión). **Fecha:** 2026-08-28.
**Origen:** incidente detectado al triar las capturas sandbox pendientes — la
introspección semanal de cline falla desde el 2026-08-25 (exit 2 ese día) y
`cli_productos.version_actual` de cline está contaminada en BD.
**Tamaño estimado:** 0.5–0.75 ciclos.

## Objetivo (único)

Eliminar la clase de defecto: **un tag de otro artefacto no puede alimentar
`version_actual` ni disparar un rebuild del sandbox**. El incidente no fue un
dato malo puntual: fue la primitiva. El poller escribe `version_actual` cuando
la versión parseada de `releases[0]` **difiere** de la conocida, y vigilancia
reconstruye cuando **difiere** de la del sandbox — "difiere" en ambas puntas
admite contaminación hacia abajo.

**Cadena del incidente (verificada en log y código):**
1. cline/cline publicó `desktop-v0.0.17` (Cline Desktop: otro artefacto; el CLI
   real va por 3.0.56 y el sandbox instala `cline@VERSION` desde npm).
2. El regex del poller (`backend/src/evidentia/poller.ts`) extrajo `0.0.17` del
   tag y lo escribió en `version_actual` (condición: `!==`).
3. Vigilancia detectó divergencia (sandbox 3.0.56 ≠ BD 0.0.17) → rebuild con
   `cline@0.0.17` → `npm install` falla (esa versión no existe en npm) →
   `FALLOS+1`, corrida del 25/08 exit 2.
4. Consecuencias: cline sin introspección desde el 22/08 (vigencias congeladas),
   dato contaminado servido por la API, fallo recurrente cada lunes.

Es un caso patológico nuevo: la validación de F3-T3 cubrió 9 tags
reales/patológicos (`rust-v0.148.0-alpha.20`, tag sin versión…), no un tag con
prefijo de otro producto cuyo número es MENOR que la versión real.

## Alcance permitido

1. **`backend/src/evidentia/versiones.ts` (nuevo):** comparador semver mínimo
   casero (sin dependencia nueva — mismo criterio que JCS en H1-T2): parseo,
   comparación de núcleo numérico y prerelease (semver §11: prerelease < release;
   identificadores numéricos < alfanuméricos), `versionMayor()` fail-closed
   (indecidible → `false`). Specs propias sin BD.
2. **`backend/src/evidentia/poller.ts`:** el eslabón `version_actual` pasa de
   "escribe si difiere de `releases[0]`" a "escribe la versión MÁXIMA parseable
   de la ventana de releases, solo si es semver-Mayor que la conocida (o la
   conocida es null)". El resto del poller (eventos, clasificación) intacto.
3. **`scripts/vigilancia_diaria.sh`:** la condición de rebuild pasa de
   `!=` a "publicada semver-Mayor que sandbox", usando el mismo comparador vía
   `node --import tsx` (patrón de `consultar_version`). Divergencia hacia abajo
   (BD contaminada) ya no reconstruye: se auto-repara cuando la introspección
   escribe la versión real del sandbox (fuente primaria, T3c).
4. **Specs:** casos nuevos en `poller_version.spec.ts` (tag desktop no
   contamina; release verdadera nueva en la ventana sí escribe; baseline null)
   y corrección del caso `rust-v0.148.0-alpha.20` (ahora con baseline menor,
   para seguir probando la extracción bajo el gate nuevo).
5. **Reparación por ejecución:** re-introspectar cline (imagen intacta 3.0.56)
   → captura nueva con procedencia + `version_actual` reparada + vigencias
   refrescadas.

## Fuera de alcance

- Push a origin (autorización aparte del Mediador).
- Evolución del esquema de eventos Evidentia o del regex de extracción.
- Denylist de tags por CLI (ver residual R1; se adopta solo si el caso ocurre).
- Re-introspección de otros CLIs (sus corridas están al día).

## DoD (todo por ejecución, con salida citada)

1. `versiones.spec.ts` verde: orden del incidente (`0.0.17 < 3.0.56`),
   prerelease < release, igualdad `1.0 == 1.0.0`, fail-closed con no parseables.
2. `poller_version.spec.ts` verde: `desktop-v0.0.17` con baseline 3.0.56 →
   intacta; ventana con release verdadera mayor → escribe; baseline null → escribe.
3. CI local verde: `bash scripts/ci_local.sh` (build + eslint sin `--fix` +
   tests + `check_sizes`).
4. Re-introspección cline: captura nueva en `datos/fuentes/sandbox/cline/`,
   `version_actual` reparada por la fuente primaria (quedó en **3.0.60**, no
   3.0.56: `cline@latest` avanzó entre el incidente y la ejecución — enmienda
   LOW-2 del adversarial), vigencias refrescadas.
5. Ronda adversarial (subagente independiente) sobre el cierre.

## Residuales declarados

- **R1:** un artefacto hermano cuyo número SUPERE al del CLI (hipotético
  `desktop-v9.0.0`) volvería a contaminar; mitigación si ocurre: denylist de
  prefijos por CLI o filtrar releases por asset/nombre.
- **R2:** si la ventana de 10 releases queda copada por releases del otro
  artefacto, la actualización verdadera del CLI no se vería (el poller solo ve
  la ventana); misma mitigación que R1.
- **R3 (MED-1 del adversarial):** reset LEGÍTIMO de numeración hacia abajo
  (maintainer que pasa de 4.5.2 a 1.0.0, o rama longeva con número mayor): la
  ventana sigue conteniendo la versión vieja mayor y el gate la re-escribiría
  sobre el dato real (y el rebuild sería a una versión que sí existe en npm —
  downgrade real, no fallo). El código viejo no tenía esta clase (solo miraba
  `releases[0]`); es más estrecha que la eliminada. Misma mitigación que R1.
- **INFO:** si la máxima de la ventana es un prerelease, puede escribirse un
  `version_actual` prerelease y disparar rebuild @prerelease — comportamiento
  preexistente (el código viejo hacía igual con `releases[0]`), no regresión.

## Criterio de aceptación

DoD 1–5 verificados por ejecución; bitácora actualizada; commits por ruta
explícita (regla AGENTS.md §Git). El ticket no afirma enforcement que no tenga:
la reparación de la BD la produce la fuente primaria (sandbox), no un UPDATE manual.
