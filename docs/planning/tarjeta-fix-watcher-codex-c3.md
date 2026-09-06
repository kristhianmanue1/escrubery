# Tarea: fix-watcher-codex-c3 (CERRADA 2026-09-05, decreto de reactivación del Mediador)

**Estado:** CERRADA — decreto del Mediador 2026-09-05: "reactivar watcher" +
"commitear". DoD 1–5 por ejecución (ver bitácora). Servicio re-cargado y
verificado en marcha (`dedup=identity(max=4096)`, 672 rollouts anclados a EOF).
**Origen:** issue #4 del repo — incidente
2026-09-02/03 del watcher `codex_turn_watcher` (sonido en bucle ante rollouts
reescritos en sitio; clase de defecto C3 de H9). **Tamaño estimado:** 0.5
ciclos. **Reales:** 0.4.

## Objetivo (único)

Eliminar la clase: **la posición de archivo no puede ser el ancla de
deduplicación de eventos reescritos en sitio**. El watcher rastreaba por
`st_size`; ante truncado reiniciaba el offset a 0 y re-replicaba todo el
historial → mismo `task_complete` detectado decenas de veces → `afplay` en
bucle. El patrón correcto ya existe en Epistates (`signal_receipts`): consumo
único por **identidad de evento**, no por posición.

Hallazgo empírico que fija el diseño (log del incidente + rollouts reales de
`~/.codex/sessions`): la línea `task_complete` se **reescribe con timestamp
nuevo** en cada reescritura in situ (mismo turno, `event_time` variando por
ms), por tanto el hash de línea NO basta como identidad. Los rollouts actuales
traen **`turn_id`** (UUID estable por turno) en `payload` — esa es la clave
primaria; el hash de línea queda como fallback para rollouts sin `turn_id`.

## Alcance permitido

1. **`scripts/codex_turn_watcher.py` (nuevo, copia canónica en el repo):**
   reescritura del watcher con (a) clave de evento estable
   `turn_id`→fallback hash de línea, (b) deduplicación acotada (LRU con cota),
   (c) detección de reescritura real (size + `mtime_ns` + `inode`; ante
   encogimiento o inode nuevo, re-lectura desde 0 — segura porque la
   deduplicación NUNCA re-replica claves vistas), (d) lógica separada de los
   efectos (`afplay`, log) para que el arnés la ejecute sin sonido.
2. **`scripts/tests/test_codex_turn_watcher.py` (arnés en el repo):** fixture
   de rollout reescrito en sitio N veces; criterio falsable del issue:
   exactamente 1 sonido por `task_complete` único y 0 ante las N-1 réplicas;
   réplica embebida de la lógica VIEJA (offset-reset) demostrando el bucle
   (≥2) — si el fixture deja de hacer fallar a la lógica vieja, el fixture dejó
   de reproducir C3.
3. **Despliegue inerte:** copia del watcher corregido a
   `~/.local/share/escrubery/codex_turn_watcher.py` (el servicio sigue
   `disabled` en launchd por el 09-03; copiarlo NO lo reactiva).

## Fuera de alcance

- **Reactivar el servicio** (`launchctl enable`/`bootstart`) — decreto
  explícito del Mediador, DoD 5 del issue #4.
- El colector H9 `conversation-event` (aparcado por decreto 2026-08-22); este
  ticket sólo aporta evidencia empírica adicional para sus precondiciones.
- La línea `notify` de `~/.codex/config.toml` (pieza separada, residual ya
  declarado en bitácora 09-03).
- Commits/push (autorización aparte, por ruta explícita).

## DoD (todo por ejecución, con salida citada)

1. Arnés verde: `python3 scripts/tests/test_codex_turn_watcher.py` — 8 casos,
   incluye el criterio falsable (N reescrituras → 1 sonido por turno único).
2. No-tautología probada: la réplica de la lógica vieja FALLA el mismo fixture
   (reproduce el bucle ≥2 sonidos por el mismo evento).
3. `python3 scripts/check_sizes.py` verde (política §3).
4. Despliegue inerte verificado: diff entre copia del repo y
   `~/.local/share/escrubery/`; servicio sigue disabled en
   `launchctl print-disabled`.
5. Bitácora actualizada y decisión del Mediador registrada: reactivar el
   servicio o dejarlo descargado.

## Residuales declarados

- **R1:** rollouts antiguos sin `turn_id` caen al fallback hash-de-línea; si
  codex reescribiera esas líneas con timestamp nuevo (caso del log 09-02 con
  formato viejo), el fallback podría re-sonar. Mitigación natural: los
  rollouts actuales traen `turn_id`; observado en todos los muestreados.
- **R2:** `notify` en `~/.codex/config.toml` puede reaparecer si codex
  reescribe su config (residual ya declarado el 09-03, fuera de alcance aquí).
- **R3:** si codex cambia el esquema (`event_msg`/`task_complete`/`turn_id`),
  el watcher deja de clasificar (fail-silent de clasificación, igual que el
  código viejo); sin alerta de ruptura de esquema en este ticket.

## Criterio de aceptación

DoD 1–4 verificados por ejecución; bitácora al día; DoD 5 requiere decreto del
Mediador. Commit sólo por ruta explícita y con autorización.
