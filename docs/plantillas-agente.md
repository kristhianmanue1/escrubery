# Plantillas para agentes — escrubery

Plantillas canónicas para trabajar bajo `docs/politica-agentes.md`. Copiar y
rellenar. Mantener **pequeñas** (ver §3 de la política).

---

## Plan

```markdown
# Plan: <objetivo corto>

**Contexto:** <1-2 frases>. **Fecha:** AAAA-MM-DD. **Estado:** borrador|en-curso|hitado.
**Fase del plan v2:** <F0–F5>. **Fuente:** <iniciativa del Mediador | ticket del Arquitecto>.

## Objetivo y criterio de cierre
- Objetivo: <qué se logra>.
- Cierre: <condición verificable global, p. ej. "check_sizes verde + consultar responde X">.

## Hitos (cada uno dispara ronda adversarial, §6)
- H1 — <nombre>: <criterio>. [pendiente|hecho|adversarial-ok]
- H2 — <nombre>: <criterio>.

## Tareas (1 tarea = 1 contrato + 1 salida pequeña)
- [ ] T1 — <id>: <descripción>. → ver Contrato T1.
- [ ] T2 — <id>: <descripción>.

## Riesgos / supuestos
- <riesgo> → <mitigación>.

## Enlaces
- Política: `docs/politica-agentes.md` · Plan v2: `docs/investigacion/Plan_Iterativo_Incremental_Servicio_CLI_Modelos_v2.md`
- Memoria AN-KLA (próximamente): `retrieve --query "<tema>" --budget 6000`
```

---

## Contrato de tarea

```markdown
## Contrato T1 — <id>: <título>

**Presupuesto de contexto:** cabe holgado | requiere división (T1a, T1b...).
**Entradas:** <archivos/refs a leer>.
**Salidas:** <archivos pequeños a producir, con tamaño esperado>.

### Definition of Done (checks ejecutables)
- [ ] `python3 scripts/check_sizes.py` verde
- [ ] `./scripts/consultar <op>` responde <X> con exit 0
- [ ] archivo `X` existe y mide < N líneas (columna "Duro" de §3)
- [ ] <otro check verificable>

### Procedencia (§7, si el ticket toca datos)
- [ ] todo dato nuevo lleva bloque `procedencia` (fuente_url + fecha + hash)
- [ ] fichas de `datos/fichas/proveedores/` NO editadas a mano (van al script generador)

### Git propuesto (aplica el Mediador)
- Rama: `feat/<id>`
- Commit sugerido: `feat(<área>): <descripción>`
- Notas para el Mediador: <diff pequeño, qué revisar>
```

> Regla: si no puedes escribir ≥1 check ejecutable, la tarea no está lista.

---

## Checkpoint (reanudación por presupuesto)

```markdown
# Checkpoint T1 — <id> — <AAAA-MM-DD HH:MM>

**Objetivo:** <1 frase>.
**Hecho:** <lista corta de concretos verificables>.
**Siguiente:** <la próxima acción concreta, 1 línea>.
**Bloqueos:** <siempre que falte algo; "ninguno" si no hay>.
**Archivos tocados:** <lista>.
**Contrato restante:** <qué checks del DoD faltan>.
**Reanudar con:** leer `AGENTS.md` + este checkpoint + los docs señalados en Entradas.
```

---

## Ronda adversarial (gate de hito)

```markdown
# Adversarial — Hito <Hn> — <AAAA-MM-DD>

**Revisor:** contexto fresco (subagente, idealmente otro proveedor/modelo — decorrelación).
**Entrada:** plan + artefactos + contrato del hito.
**Alcance:** solo corrección y requisitos (no estilo).

## Hallazgos
- [BLOCKER] <problema> — <evidencia/archivo:línea> — <fix prescrito>
- [HIGH]    <...>
- [MED]     <...>
- [LOW]     <...>

## Verificaciones específicas del proyecto (§6)
- [ ] procedencia completa en datos nuevos
- [ ] distinción oficial/comunitario respetada (grok-cli-community ≠ grok-build)
- [ ] compatibilidad con CONTRATO_API_v0.md (o ruptura explícita justificada, permitida hasta Fase 2)
- [ ] fichas generadas no editadas a mano

## Decisión
- [ ] proceed      → el Mediador puede aplicar Git
- [ ] fix-and-retry → corregir y repetir ronda
- [ ] escalate     → decide el Mediador (bloqueo fuera de alcance)

## Notas
- <residuals, defer a fases posteriores, etc.>
```

> Sin `proceed` no hay cierre de hito ni merge. El adversarial es **gate**, no decorado.

---

## Reporte de fin de ronda (al Mediador)

```markdown
# Reporte — <tarea|hito>

> **Estado general:** OK | PARCIAL | BLOQ
> **Modelo/Versión:** <proveedor/modelo, p. ej. kimi/k3> · **Agente:** <id>
> **Plan/Fase:** F<n> · **Fecha:** AAAA-MM-DD HH:MM
> **Hito:** <H<n> — criterio> · **Duración/tokens:** <opcional>

**Resumen (2-3 líneas):** <qué se hizo y outcome>.

**Lógica y subagentes:** supuesto clave: <...>. Subagentes: <usó|no|recomienda>
— *por qué*: <complejidad / aislamiento de contexto / verificación independiente / paralelismo>.
(Adversarial = subagente obligatorio §6; los demás opcionales.)

**Contrato (DoD) + verificación:**
- [x] <check> — evidencia compacta: `<cmd>` → <1 línea resultado; si largo, puntero al log>
- [ ] <check> — pendiente
Estado DoD: OK (n/n) | PARCIAL (incompleto) | BLOQ

**Verificación adicional (fuera del DoD):** `<cmd>` → <resultado>. *(omitir si no hubo)*

**Adversarial (si hito):** decisión <proceed|fix-and-retry|escalate|NA>; hallazgos clave: <...>.

**Tabla de estado** (todo `PARCIAL` lleva etiqueta `(espera-admin)` o `(incompleto)`):
| Aspecto | Estado | Detalle |
|---|---|---|
| Secretos (§7) | OK/BLOQ | diff sin claves/tokens; o BLOQ+acción |
| Procedencia (§7) | OK/BLOQ | datos nuevos con fuente+fecha+hash; generados intactos |
| Contrato DoD | OK/PARCIAL/BLOQ | n/n checks |
| Adversarial | OK/PARCIAL/BLOQ/NA | proceed / fix-and-retry / escalate / NA |
| Git commit | PARCIAL/BLOQ/NA | PARCIAL(espera-admin) por defecto |
| Tamaño §3 | OK/PARCIAL/BLOQ | `check_sizes.py` verde / duro excedido |
| Archivos cambiados | n | lista corta, o "→ ver diff" |
| Continuidad | OK/NA | checkpoint path / bitácora actualizada / NA |

**Próximos pasos:** 1) <acción concreta>; 2) <...>

**Plan:** fase F<n>. **Próximo hito:** <H<n> — criterio>. **Bloqueos:** <ninguno / ...>.

**Decisión/acción solicitada al Mediador:** <aplicar commit | escalar | reasignar | continuar | ninguna>.
```
