# Tarea: guia-canonica-opencode (CERRADA 2026-09-06 por decreto del Mediador "retoma y termina")

**Estado:** CERRADA — re-verificación completa del DoD 1–7 por ejecución en
sesión del 2026-09-06 (gate exit 0; no-tautología exit 1; check_sizes OK;
ficha JSON válida; 0 rutas rotas en la guía; CI LOCAL VERDE 254 tests con el
paso 6/6 nuevo; diff sin secretos). Commit por rutas explícitas y cierre del
issue #3 con evidencia. **Origen:** issue #3 — "Consolidar una guía canónica y
vigente de uso de OpenCode". La documentación de opencode está fragmentada (ficha, capturas
sandbox, reportes HRA, probes, plugin experimental, handoff histórico) y existe
una divergencia concreta: la ficha curada documenta `opencode auth login`, pero
la captura versionada de OpenCode 1.18.23 (y 1.18.27) muestra
`opencode providers` con alias `auth`.
**Tamaño estimado:** 0.5–0.75 ciclos.
## Objetivo (único)

Un único punto de entrada canónico para saber cómo usar OpenCode dentro de
escrubery — qué es vigente, qué es interno, qué es experimental y qué es
histórico — sin contradicciones con la captura sandbox vigente, con un gate
local que detecte divergencias futuras ficha↔captura.

## Decisiones de alcance

- **Quién ejecuta:** el propio Ejecutor ES opencode corriendo en el host
  (1.18.29, 2026-09-05) — la observación interactiva es evidencia primaria;
  la evidencia canónica sigue siendo la captura versionada del sandbox
  (1.18.27, `datos/fuentes/sandbox/opencode/2026-09-03T21:31:11.181Z.txt`).
- **Corrección de la ficha:** `auth login` → `providers` (alias `auth`),
  citando la captura como fuente (regla dura #1: procedencia por dato).
- **Gate:** `scripts/verificar_divergencia_opencode.py`, Python stdlib, sin
  dependencias nuevas. Compara frases de comando curadas contra primarios y
  alias de la captura más reciente. Se integra a `ci_local.sh` (paso 6/6).
- **La guía es subconjunto curado, no catálogo:** la lista canónica de
  comandos es la captura; la guía marca estabilidad y no repite nada que la
  captura no muestre.

## DoD (checks ejecutables)

| # | Check | Esperado |
|---|---|---|
| 1 | `python3 scripts/verificar_divergencia_opencode.py` | exit 0, "consistente" |
| 2 | No-tautología: mismo gate con `--ficha` apuntando a una ficha temporal que contenga `opencode auth login` | exit 1, divergencia detectada |
| 3 | `python3 scripts/check_sizes.py` | OK (guía < 1500 duro; tarjeta < 800) |
| 4 | `python3 -m json.tool datos/fichas/clis/opencode.json` | exit 0 |
| 5 | Todo enlace relativo de `docs/GUIA_OPENCODE.md` apunta a archivo existente | loop de verificación → 0 rotos |
| 6 | `bash scripts/ci_local.sh` | VERDE, incluye el paso 6/6 nuevo |
| 7 | Sin secretos en el diff; `datos/` generado intocado salvo la ficha curada | revisión del diff |

## Criterios del issue #3 → dónde se cumplen

1. Flujos vigentes (TUI, run, serve, providers, models, agent, session, export) → guía §2.
2. Separación API pública / CLI / SQLite interno / plugins experimentales → guía §3.
3. Handoffs y configs antiguas marcadas históricas → guía §4.
4. Restricciones de seguridad observadas (deny por tool ≠ negar capacidad) → guía §5.
5. Sesión creada / mensaje assistant / HTTP 204 no prueban respuesta terminal → guía §6.
6. Ficha corregida con procedencia → `datos/fichas/clis/opencode.json`.
7. Versión y fecha de observación declaradas, con enlaces → cabecera de la guía.

## Fuera de alcance

- Ejecutar modelos, modificar credenciales ni ampliar permisos (el issue lo
  excluye explícitamente; este ticket sólo consolida documentación y un gate).
- Regenerar capturas sandbox: es de la vigilancia F3 (requiere Docker arriba).
- Extender el gate a otros CLIs: extensión natural posterior vía `--cli`, no
  aquí.
- Tocar cadena Evidentia, contrato v0 ni superficies servidas: cero cambios en
  `backend/`.

## Bitácora

Al cierre: fila en `bitacora_ciclos.md` (post-v0.5.0 — Operación, fecha del
decreto) + cierre del issue #3 con referencia al commit (el Mediador decide).
