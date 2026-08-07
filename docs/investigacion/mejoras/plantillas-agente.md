# Plantillas para agentes

Plantillas canónicas para trabajar bajo `docs/politica-agentes.md`. Copiar y
rellenar. Mantener **pequeñas** (< 150 líneas cada artefacto).

---

## Plan

```markdown
# Plan: <objetivo corto>

**Contexto:** <1-2 frases>. **Fecha:** AAAA-MM-DD. **Estado:** borrador|en-curso|hitado.
**Roadmap:** <fase Rn, si aplica>. **Fuente:** <iniciativa humana | memoria AN-KLA>.

## Objetivo y criterio de cierre
- Objetivo: <qué se logra>.
- Cierre: <condición verificable global, p. ej. "CI verde + dashboard arranca con seed">.

## Hitos (cada uno dispara ronda adversarial)
- H1 — <nombre>: <criterio>. [pendiente|hecho|adversarial-ok]
- H2 — <nombre>: <criterio>.

## Tareas (1 tarea = 1 contrato + 1 salida pequeña)
- [ ] T1 — <id>: <descripción>. → ver Contrato T1.
- [ ] T2 — <id>: <descripción>.

## Riesgos / supuestos
- <riesgo> → <mitigación>.

## Enlaces
- Memoria: `retrieve --query "<tema>" --budget 6000`
- Política: `docs/politica-agentes.md`
```

---

## Contrato de tarea

```markdown
## Contrato T1 — <id>: <título>

**Presupuesto de contexto:** cabe holgado | requiere división (T1a, T1b...).
**Entradas:** <archivos/refs a leer>.
**Salidas:** <archivos pequeños a producir, con tamaño esperado>.

### Definition of Done (checks ejecutables)
- [ ] `pytest <ruta>` verde
- [ ] `ruff check <ruta>` limpio
- [ ] archivo `X` existe y mide < N líneas (N = columna "Duro" de §3 en `politica-agentes.md`)
- [ ] <otro check verificable>

### Git propuesto (aplica admin)
- Rama: `feat/<id>`
- Commit sugerido: `feat(<área>): <descripción>`
- Notas para el admin: <diff pequeño, qué revisar>
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
**Reanudar con:** leer `AGENTS.md` + este checkpoint + `retrieve --query "<t>" --budget 6000`.
```

---

## Ronda adversarial (gate de hito)

```markdown
# Adversarial — Hito <Hn> — <AAAA-MM-DD>

**Revisor:** contexto fresco (subagent). **Entrada:** plan + artefactos + contrato del hito.

## Hallazgos
- [BLOCKER] <problema> — <evidencia/archivo:línea> — <fix prescrito>
- [HIGH]    <...>
- [MED]     <...>
- [LOW]     <...>

## Decisión
- [ ] proceed      → admin puede aplicar Git
- [ ] fix-and-retry → corregir y repetir ronda
- [ ] escalate     → decide el humano (bloqueo fuera de alcance)

## Notas
- <residuals, defer a post-alfa, etc.>
```

> Sin `proceed` no hay merge/release. El adversarial es **gate**, no decorado.

---

## Reporte de fin de ronda (al orquestador)

```markdown
# Reporte — <tarea|hito>

> **Estado general:** OK | PARCIAL | BLOQ
> **Modelo/Versión:** <provider/modelo, p.ej. opencode/glm-5.2> · **Agente:** <id>
> **Plan/Fase:** <plan> · R<n> · **Fecha:** AAAA-MM-DD HH:MM
> **Hito:** <H<n> — criterio> · **Duración/tokens:** <opcional>

**Resumen (2-3 líneas):** <qué se hizo y outcome>.

**Lógica y subagentes:** supuesto clave: <...>. Subagentes: <usó|no|recomienda>
— *por qué*: <complejidad / aislamiento de contexto / verificación independiente / paralelismo>.
(Adversarial = subagente obligatorio §6; los demás opcionales.)

**Contrato (DoD) + verificación:**
- [x] <check> — evidencia compacta: `<cmd>` → <1 línea resultado; si largo, → log CI>
- [ ] <check> — pendiente
Estado DoD: OK (n/n) | PARCIAL (incompleto) | BLOQ

**Verificación adicional (fuera del DoD):** `<cmd>` → <resultado>. *(omitir si no hubo)*

**Adversarial (si hito):** decisión <proceed|fix-and-retry|escalate|NA>; hallazgos clave: <...> (→ PR/diff).

**Tabla de estado** (todo `PARCIAL` lleva etiqueta `(espera-admin)` o `(incompleto)`):
| Aspecto | Estado | Detalle |
|---|---|---|
| PHI/Secretos (§7) | OK/BLOQ | gitleaks+pre-commit limpios y diff sin NSS/tel/email; o BLOQ+acción |
| Git commit | OK/PARCIAL/BLOQ/NA | PARCIAL(espera-admin) por defecto; alfa=PARCIAL(espera-admin, staging virtual) |
| GitHub PR/push | OK/PARCIAL/BLOQ/NA | alfa=NA hasta R2 |
| Continuidad | OK/NA | checkpoint path / fact-id puntero / NA |
| Contrato DoD | OK/PARCIAL/BLOQ | n/n checks |
| Adversarial | OK/PARCIAL/BLOQ/NA | proceed / fix-and-retry / escalate / NA |
| Archivos cambiados | n | lista corta, o "→ ver diff" |
| Tamaño §3 | OK/PARCIAL/BLOQ | duro respetado / deuda congelada / BLOQ=duro excedido |

**Próximos pasos:** 1) <acción concreta>; 2) <...>

**Plan:** <nombre>, fase R<n>. **Próximo hito:** <H<n> — criterio>. **Bloqueos:** <ninguno / ...>.

**Decisión/acción solicitada al orquestador:** <aplicar commit | escalar | reasignar | continuar | ninguna>.
```
