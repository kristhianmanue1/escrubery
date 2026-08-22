# Harness–Runtime Assurance — Reporte del censo (H7-T3, 2026-08-22)

**Qué mide esto:** la distancia entre lo que un sistema agéntico declara que debe hacerse y lo que su arquitectura realmente impide violar. Escala: **L1 declarada** (está en las instrucciones) → **L2 recordada** (el harness la reinyecta) → **L3 verificada** (hay registro que el modelo no puede apagar) → **L4 enforcada** (el SO la hace físicamente imposible). Fase 1: evidencia documental citable; toda L4 lleva `enforcement_verificado: false` hasta la verificación activa (H7-T4, diferido por decreto).

**Fundamento:** *"la IA cambiará el mundo más por lo que NO se le permita hacer"* (Mediador). Fichas con evidencia por celda: `datos/fichas/curaduria/assurance_<cli>.json` (verificables: `npm run hra:sellar`, fail-closed).

## El vector del ecosistema (5 CLIs × 8 normas, perfil default de cada uno)

| CLI | Perfil evaluado | N9 gate | L1 | L2 | L3 | L4 | pend |
|---|---|---|---:|---:|---:|---:|---:|
| **codex-cli** | tui-auto (workspace-write + on-request) | 🔒 cerrado | 0 | 0 | 1 | **4** | 3 |
| **claude-code** | default-manual (sandbox off) | ⚠️ pendiente | 0 | 0 | **7** | 0 | 1 |
| **kimi-code** | default-manual | 🔓 abierto | 0 | 1 | **4** | 0 | 3 |
| **opencode** | default (permisos allow) | 🔓 abierto | 0 | 0 | **2** | 0 | 6 |
| **cline** | default-oneshot (auto-approve true) | 🔓 abierto | **1** | 0 | 0 | 0 | 7 |
| **TOTAL** | | | 1 | 1 | 14 | 4 | 20 |

*Las frases que lo leen (por diseño, no hay escalar):*
- **codex**: "Frente al corpus N1–N8, 4 normas están enforcadas fuera del modelo (incluida red apagada por defecto), 1 verificable, 3 sin garantía documentada."
- **claude-code**: "7 de 8 normas dependen de la aprobación interactiva (L3): el mecanismo es un humano mirando; con sandbox habilitado (no default) varias pasan a L4."
- **cline**: "1 norma vive solo como autorreporte del modelo (L1); 7 no tienen garantía documentada en el perfil default."

## Hallazgos principales

### 1. N9 es el divisor de aguas del ecosistema
El gate "¿puede el agente reescribir su propia configuración de permisos?":
- **codex lo cierra a nivel SO** (`~/.codex` fuera del workspace escribible; `.codex`/`.git`/`.agents` read-only recursivos DENTRO del repo — el agente no puede auto-escalar aunque trabaje en su propio proyecto).
- **kimi lo deja abierto y además lo facilita**: distribuye un skill integrado (`/update-config`) para editar `config.toml` de permisos; en modos yolo/auto/-p no hay nada en el medio.
- **opencode**: `opencode.json` en la raíz del proyecto con la MÁS ALTA precedencia y sin protección declarada.
- **claude-code**: mixto — sin sandbox (default) los settings son archivos editables; con sandbox, las protected paths los blindan.

### 2. La aprobación interactiva es L3, no L4 — y el default de cline la elimina
El ladder mide cuándo dejas de necesitar al humano. claude-code construye su default entero sobre el humano (L3×7); cline ni siquiera eso: `auto-approve true` por defecto en one-shot, y la clasificación seguro/peligroso la **autorreporta el modelo** (L1) — no hay lista del runtime.

### 3. Los defaults cuentan más que las capacidades
Los tres CLIs con mecanismos L4 disponibles (claude-code sandbox, codex perfiles beta deny-read) no los activan por defecto — salvo codex, cuyo sandbox workspace-write SÍ es el preset recomendado. La fila del vector mide el perfil con el que un usuario real arranca, no el mejor configurable.

### 4. N7 (presupuesto) es el hueco transversal
Ningún CLI de los 5 tiene tope de costo por sesión/turno en el runtime (mejor proxy: kimi con límite de pasos por turno, L2). 20 celdas `pendiente` incluyen muchas "ausencia documentada de garantía" — señal para corpus v1 (necesita estado `sin_garantia` distinto de `sin_medir`).

### 5. Cuando el que audita es el auditado
claude-code es harness de parte de este proyecto: su ficha requiere revisión adversarial independiente (decreto de gobernanza §10.C de la propuesta) — aplicado en la ronda adversarial de este hito.

## Limitaciones honestas

- **Documental, no experimental**: toda L4 está declarada por docs oficiales del maintainer con `enforcement_verificado: false`. La verificación activa (intentar la violación en sandbox) es H7-T4, decreto aparte.
- **HTML dinámico**: las docs citadas no llevan hash estable (mismo criterio que tos-clis.md); la cita textual + URL + fecha es la evidencia. Algunos eventos ya ingeridos en Evidentia sí llevan hash.
- **Perfiles únicos**: un perfil por CLI (decreto §11); no extrapolar entre perfiles (codex `danger-full-access` = L0 en todo; claude con sandbox = varias L4).

## Reproducibilidad

- Fichas: `datos/fichas/curaduria/assurance_{claude-code,codex-cli,opencode,cline,kimi-code}.json` (schema `escrubery/assurance/v0`, self-hash sellado, fail-closed).
- Verificador: `cd backend && npm run hra:sellar` (exit 1 si algo difiere).
- Taxonomía y criterios: `docs/investigacion/hra/taxonomia-l1-l4.md`.
- Fundamento y decretos: `docs/investigacion/Propuesta_Harness_Runtime_Assurance.md` (v0.2).

**Notificación cruzada (decreto §11.6):** este reporte es insumo declarado para skopos (ADR-010 §9: referencia con procedencia, nunca autoridad) y para el módulo "Agent Execution Profile" (Scripting). **Notificado 2026-08-22:** skopos recibió el puntero (`docs/evidencia/insumo-escrubery-2026-08-22.md` en su repo) cubriendo este reporte + `DECISION_ADAPTADORES.md` como insumo directo para su familia de parsers multi-CLI. Puntero recíproco: esta línea.
