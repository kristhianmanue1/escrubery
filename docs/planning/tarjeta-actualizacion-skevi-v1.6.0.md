# Tarea: actualizacion-skevi-v1.6.0 (CERRADA 2026-10-29, decreto del Mediador «Addendum completo»)

**Estado:** CERRADA — análisis solo-lectura del 2026-10-29 (ambos árboles
limpios, nada mutado en skevi) + decreto de adopción «Addendum completo»
(17:53Z) y decreto ampliatorio «adopta tambien cilco autonomo» (sic, 17:57Z);
ejecución en la misma sesión. **Fecha:** 2026-10-29 · **Clase:** Architectural (crea un contrato
nuevo de proceso — la ADR-0002; tarea única que no crea ni extiende plan
multi-tarea: la tarjeta es dueña del DoD y el gate E1–E6 no se dispara).

## Objetivo

Activar la cláusula de vigencia de ADR-0001: revisar skevi v1.0.0 → v1.6.0
(corpus/v8, gate/v13, plantillas/v18) y decidir actualización/adopción.

## DoD

1. Verificación de no-rotura de lo adoptado por ADR-0001 (`01` §2, fuente
   única de DoD, fronteras de confianza) — hecha: taxonomía intacta y
   refinada (tests no escalan, «producción» por cerradura, ADR-013 skevi).
2. Medición de cumplimiento interno: 5/5 tarjetas post-ADR-0001 declaran
   `Clase`; las tarjetas sin `Clase` son pre-ADR (registro histórico).
3. ADR-0002 con adoptados/no-adoptados explícitos y con causa.
4. `AGENTS.md` §Convenciones y `project-manifest.yaml` actualizados.
5. Fila en `bitacora_ciclos.md`.

## Resultado

- **Adoptado:** árboles congelados (skevi ADR-033 — `proveedores/` y
  `fuentes/` ya lo practicaban), catálogo de clases de defecto para rondas
  adversariales (skevi ADR-035), disposición de rondas en su registro (skevi
  ADR-037, ya practicado).
- **Adoptado por decreto ampliatorio:** familia de ciclo autónomo skevi
  ADR-043 (continuación autónoma dentro de la TAREA: investigar,
  descomponer, implementar, diagnosticar, corregir y verificar antes de
  consultar; escalar diseño/objetivo/autoridad/superficie/riesgo), ADR-044
  (push/merge propuestos por dossier con folio — ejecución solo con
  aceptación del Mediador registrada contra el folio; el Mediador es el
  gate; la restricción local de commit/higiene-staging prevalece; el
  Ejecutor no puede auto-otorgarse autoridad), ADR-045/046 (convención
  `Lote:` en TAREAs cuyo `Permitido:` nombre push/merge). Fijada a
  corpus/v8 con revisión obligatoria al siguiente cambio del upstream.
- **No adoptado:** gate estructural E1–E6 (gatillo sin disparar desde el
  aparcado de la migración, 2026-10-27; E6 rige como convención textual) y
  vía (b) de autoridad por configuración (no instalada; prohibido el
  auto-otorgamiento).

## Evidencia

- skevi @ `v1.6.0` (HEAD `74a4714`); `docs/MANIFEST.json` corpus/v8 con
  history v1→v8; ADR-033/035/037/043–046 y `01` §2 leídas del árbol local.
- Cumplimiento: grep `Clase` en `docs/planning/` → typesafe (10-14),
  puerto-plugin-ankla-v2 (10-14), integracion-meta-muse (10-13),
  feedback-adrc-mini (10-27), migracion-docker-servidor (10-27, aparcada);
  las sin-`Clase` fechadas son de 08-21 a 09-06 (pre-ADR).
- `git status` limpio en ambos repos antes y después del análisis.
- Decretos del Mediador capturados: (1) 2026-10-29T17:53Z, opción «Addendum
  completo»; (2) 2026-10-29T17:57Z, «adopta tambien cilco autonomo» (sic,
  cita literal — prevalece sobre la recomendación de aplazar la familia por
  churn, que queda registrada en ADR-0002 §Contexto).

## Lote propuesto (skevi ADR-044 — primer dossier bajo el ciclo adoptado)

- **Folio:** `ESC-LOTE-20261029-01`
- **Destino:** `origin/main` (escrubery), push ordinario; commit con staging
  por ruta explícita.
- **Rutas (5):** `AGENTS.md`, `project-manifest.yaml`, `bitacora_ciclos.md`
  (modificadas); `docs/architecture/0002-actualizacion-adopcion-skevi-v1.6.0.md`,
  `docs/planning/tarjeta-actualizacion-skevi-v1.6.0.md` (nuevas).
- **Mensaje propuesto:** «docs: ADR-0002 — adopción skevi v1.6.0 + ciclo
  autónomo (AGENTS.md, project-manifest.yaml, bitacora_ciclos.md,
  docs/architecture/0002-actualizacion-adopcion-skevi-v1.6.0.md,
  docs/planning/tarjeta-actualizacion-skevi-v1.6.0.md)».
- **Evidencia:** `check_sizes` OK (exit 0); skevi @ v1.6.0 leído sin mutación
  (`git status` limpio en ambos); cumplimiento 5/5 tarjetas post-ADR con
  `Clase`; ADR-0002 verificada por lectura completa tras la enmienda.
- **Riesgos:** la familia de ciclo autónomo es la zona de mayor churn del
  upstream — mitigado: fijada a corpus/v8 con revisión obligatoria al
  siguiente cambio; sin vía (b) instalada (auto-otorgamiento imposible);
  gate E1–E6 sigue aplazado sin gatillo.
- **Estado:** ACEPTADO — decreto del Mediador: «adelante el primer dossier
  aceptado» (2026-10-29T18:06:02Z), registrado contra el folio
  `ESC-LOTE-20261029-01`; ejecución: commit con staging por ruta explícita +
  push ordinario a `origin/main` (sin force). El folio nombra; la aceptación
  la acredita esta línea (skevi ADR-044/045).
