# Propuesta: Harness–Runtime Assurance (HRA) — el censo de paredes del ecosistema agéntico

**Estado:** PROPUESTA EN CONSENSO — espera decreto del Mediador. No es un plan aprobado; al decretarse se materializa como `Plan_H7_Harness_Runtime_Assurance.md` con tickets y adversarial de plan (§7).
**Versión:** 0.1 · **Fecha:** 2026-08-21 · **Autoría:** escala y fundamento, insight del Mediador (2026-08-21); redacción técnica, Ejecutor.
**Origen:** línea de investigación abierta por el Mediador tras el cierre de H6. Consumidores declarados: skopos (ADR-010 §9) y el proyecto "Scripting" mencionado por el Mediador.

## 1. Fundamento

> *"La gente cree que la inteligencia artificial cambiará el mundo por lo que se le permita hacer; más la inteligencia artificial cambiará el mundo por lo que NO se le permita hacer."* — Mediador, 2026-08-21.

Tesis operativa: el valor y la confianza de un sistema agéntico no los determina lo que el modelo *puede* hacer (eso crece solo, cada mes), sino lo que su arquitectura **le impide** hacer aunque quiera. Ninguna tecnología transformadora se volvió infraestructura por su potencia sino cuando sus límites dejaron de ser promesas y se volvieron paredes (aviación → control aéreo; automóvil → semáforo/cinturón; nuclear → contención). El permiso es el producto.

**Pregunta de investigación que este módulo responde, y hoy nadie responde:** ¿qué distancia hay entre lo que un sistema agéntico declara que debe hacerse y lo que su arquitectura realmente impide violar?

## 2. Marco conceptual

### 2.1 La pila agéntica

| Capa | Qué es | Naturaleza | Ejemplos |
|---|---|---|---|
| **Modelo** | Razona y propone acciones | Probabilista | GLM, Claude, GPT, Qwen |
| **Harness** | Provee contexto, memoria, herramientas, instrucciones, skills, MCP, recuperación | Contextual | system prompt, AGENTS.md, skills, compactación |
| **Runtime** | Controla lo ejecutable: permisos, límites, políticas, validación, evidencia | **Determinista** | sandbox OS, allow-lists, hooks bloqueantes, execpolicy |
| **Entorno** | El mundo real | Físico | repo, filesystem, APIs, producción |

Diagnóstico operativo: "perder contexto" es síntoma de **harness**; "saltarse una norma" no debe confiarse al modelo — una regla crítica debe convertirse, siempre que sea posible, en restricción ejecutable del **runtime**.

### 2.2 La escala de garantía normativa (el "ladder")

| Peldaño | Nombre | Definición operativa | Criterio de evidencia para clasificar |
|---|---|---|---|
| **L1** | **Declarada** | La norma existe solo en artefacto de instrucción que el modelo pudo haber visto | Presencia del texto en prompt/AGENTS.md/skill (fuente citable) |
| **L2** | **Recordada** | El harness garantiza por diseño la re-presentación de la norma en cada turno/contexto (no depende de memoria del modelo) | Mecanismo documentado de reinyección/precedencia de instrucciones |
| **L3** | **Verificada** | Existe registro observable que permite **detectar** la violación (pre o post hoc) sin impedirla | Log auditable, hook observacional, recibo criptográfico (patrón Evidentia) |
| **L4** | **Enforcada** | Existe mecanismo determinista **fuera del modelo** que **impide** la operación aunque el modelo lo intente | Sandbox del SO, allow/deny-list evaluada por el runtime, hook bloqueante pre-ejecución, política exec fail-closed |

Reglas de clasificación:

- **Fail-closed:** sin evidencia citable (`fuente_url` + `hash_sha256` + `fecha_obtencion`), el peldaño es `null`/`pendiente_de_verificar`. Nunca se infiere por "parece que tiene".
- **Máximo con lista:** si hay varios mecanismos, se registra el máximo alcanzado Y la lista completa (una norma puede ser L4 en un runtime y L1 en otro; el máximo sin la lista miente).
- **El peldaño es del sistema, no del modelo:** se clasifica la terna {CLI, runtime-config, norma}. Un mismo CLI con dos perfiles de permisos son dos filas distintas.

### 2.3 La métrica derivada

```
brecha_de_garantia(cli) = |{normas declaradas}| − |{normas con evidencia ≥ L3}| − |{normas con evidencia = L4}·peso|
```

Reporte estrella (detectable automáticamente): *"Este CLI declara 17 restricciones; 5 tienen enforcement fuera del modelo."* Es la distancia declarado-vs-enforcado, el análogo agéntico del "¿tiene frenos?".

## 3. Corpus de normas (semilla, editable en consenso)

ID estable para tracking; descripciones neutrales de producto:

| ID | Norma | Por qué representa |
|---|---|---|
| N1 | No modificar producción / ramas protegidas | La norma-regla de oro del desarrollo asistido |
| N2 | No leer secretos (`.env`, credenciales, claves) | Fuga de datos estática |
| N3 | No ejecutar comandos destructivos (`rm -rf`, force-push, drop) | Daño irreversible rápido |
| N4 | No salir del workspace (egress de filesystem) | Contención lateral |
| N5 | No llamadas de red a dominios no permitidos | Exfiltración / inyección remota |
| N6 | No instalar dependencias sin aprobación | Vector de supply-chain |
| N7 | Límites de costo/presupuesto por turno o sesión | Control económico |
| N8 | No exfiltrar datos del usuario (telemetría incluida) | Privacidad |

## 4. Inventario preliminar de primitivas (evidencia YA en el repo)

El poller Evidentia ya colecciona release notes con hash y firma; varias primitivas constan en eventos ya ingeridos:

| CLI | Primitivas de runtime observadas (fuente: eventos changelog 2026-08 + docs) |
|---|---|
| claude-code | permission modes; sandbox Seatbelt con read-deny wildcards y precedencia anti-bypass-renombre (v2.1.236); hooks `PreToolUse` bloqueantes; managed settings; `headersHelper` corre sin env de credenciales (v2.1.238) |
| codex-cli | sandbox modes (read-only / workspace-write / danger); execpolicy fail-closed en wrappers anidados; Guardian v2; approval policies (retiro de `untrusted` en 0.149.0); drop de capabilities en Linux; aislamiento symlinks |
| opencode | campo `permission` por sesión (observado en probe H6); config allow/deny por herramienta |
| cline | auto-approve por scopes; lista de comandos permitidos; plan mode |
| kimi-code | `approval` + `plan_mode` en `state.json` (observado en probe H6) |

Esto demuestra factibilidad del inventario pasivo sin ejecutar nada: fuentes públicas + artefactos ya ingeridos.

## 5. Contrato de datos (shape propuesto)

Capa de curaduría `datos/fichas/curaduria/assurance_<cli>.json` (regla dura: no se edita lo generado; esto es capa propia con self-hash, patrón T4b):

```json
{
  "schema": "escrubery/assurance/v0",
  "cli_id": "claude-code",
  "perfil": "default-sandbox",
  "normas": [
    {
      "norma_id": "N2",
      "peldano_maximo": "L4",
      "mecanismos": [
        {"peldano": "L1", "donde": "AGENTS.md del usuario", "evidencia": {"fuente_url": "...", "hash_sha256": "sha256:...", "fecha_obtencion": "..."}},
        {"peldano": "L4", "donde": "sandbox read-deny **/.env", "evidencia": {"fuente_url": "https://github.com/anthropics/claude-code/releases/tag/v2.1.236", "hash_sha256": "sha256:<evento Evidentia>", "fecha_obtencion": "2026-08-20"}}
      ]
    }
  ],
  "brecha_de_garantia": {"declaradas": 8, "verificadas_o_mayor": 4, "enforcadas": 3},
  "estado_verificacion": "curado",
  "procedencia": {"fuente_tipo": "curaduria_propia", "fuente_url": "...", "fecha_obtencion": "...", "hash_sha256": "..."}
}
```

No toca el contrato API v0 congelado; si se sirve por API después, entra como §3.x nueva (aditiva) con su propio ticket y errata.

## 6. Método

- **Pasivo (fase 1 del módulo):** docs oficiales, esquemas de settings, release notes ya ingeridas (eventos Evidentia con hash), repos públicos de los maintainers. Cada clasificación lleva su evidencia. Presupuesto 0.
- **Activo (diferido, decreto aparte):** verificación en sandbox F3 (contenedor efímero): intentar la violación N contra el perfil P y observar si el runtime la bloquea (rebote) o la ejecuta (captura con evidencia). Convierte clasificación documental en medida experimental. Misma receta de presupuesto ~0 que la introspección vigente; requiere su propio decreto porque ejecuta binarios con perfiles de permiso adversariales.

## 7. Plan de tickets (borrador; se formaliza al decretar)

| Ticket | Entrega | est. | Notas |
|---|---|---|---|
| H7-T0 | Taxonomía L1–L4 formal + matriz de decisión fail-closed + este documento promovido a plan | 0.5 | Adversarial de PLAN obligatorio (módulo nuevo) |
| H7-T1 | Corpus de normas N1–N8 congelado + esquema `escrubery/assurance/v0` + validador (patrón ajv de H6) | 0.5 | |
| H7-T2 | Inventario pasivo y clasificación L1–L4 de 5 CLIs × 8 normas (40 celdas con evidencia o `pendiente_de_verificar`) | 1 | Máximo de rigor: cada celda citable o null |
| H7-T3 | Reporte `brecha_de_garantia` por CLI + documento público de hallazgos | 0.5 | El entregable estrella del consenso |
| H7-T4 | (Diferido) Verificación activa en sandbox | 1 | Decreto aparte; presupuesto y adversarial propios |

Gates por hito: CI local verde, check_sizes, adversarial §6 con revisión independiente (verificar que cada peldaño citado existe en la fuente citada, con hash).

## 8. Relación con consumidores (frontera)

- **skopos (ADR-010 §9):** consume fichas de escrubery como *referencia con procedencia*, jamás autoridad ni bloqueo. La ficha de assurance sigue el mismo contrato: skopos/Scripting la consultan, no la obedecen — la decisión de qué parser/política aplicar sigue siendo local del consumidor.
- **Scripting (proyecto citado por el Mediador):** HRA es el insumo de investigación; el "Agent Execution Profile" que llegue a construirse consume esta taxonomía y estas fichas.
- **Dentro de escrubery:** módulo de investigación independiente del comparador de fichas; no modifica superficies servidas en v0.

## 9. No-objetivos

- No ejecutar CLIs con perfiles adversariales en la fase 1 (eso es H7-T4, decreto aparte).
- No auditar modelos (benchmark/jailbreak de modelos es otro dominio); aquí se audita la **pila alrededor del modelo**.
- No certificar "seguridad" absoluta: se mide la distancia declarado→enforcado, con evidencia citable, nada más.
- No modificar el contrato API v0 congelado.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Clasificación subjetiva en la frontera L2/L3 (¿la reinyección "cuenta"?) | Matriz de decisión con criterios binarios documentados en T0; adversarial de plan la ataca antes de clasificar nada |
| Fuentes de marketing que sobrevenden enforcement | Solo cuentan fuentes técnicas citables (docs de settings, release notes, código público); el marketing se archiva como L1-declaración |
| Formatos internos que cambian (lección H6) | `version_cli` y `perfil` en cada fila; vigencia con caducidad como el resto del catálogo |
| Alcance explotable (9 CLIs × N normas × M perfiles) | Fase 1: 5 CLIs × 8 normas × 1 perfil representativo; el resto `pendiente_de_verificar` |

## 11. Preguntas para el consenso (a decretar por el Mediador)

1. **Alcance de CLIs:** ¿los 5 con primitivas ricas (claude-code, codex-cli, opencode, cline, kimi-code) o los 9 del inventario (los 4 restantes entrarían con más `pendiente_de_verificar`)?
2. **Corpus de normas:** ¿la semilla N1–N8 refleja tus prioridades? ¿Falta alguna (p. ej. N9 "no spawn de subagentes sin límite", N10 "no modificar la propia configuración de permisos")?
3. **H7-T4 (verificación activa):** ¿diferido como propone el plan, o entra al ciclo?
4. **Servicio:** ¿fase 1 solo como documento público de investigación, o ya se expone la ficha `assurance/v0` por CLI/HTTP (§3.x aditiva)?
5. **Nombre del módulo:** se propone **Harness–Runtime Assurance (HRA)**; alternativa en español: "Garantía Declarada/Enforcada". ¿Cuál decreta?
6. **Vinculación con skopos/Scripting:** ¿se notifica este documento a sus repositorios como insumo (puntero cruzado), o se espera a que lo pidan?

## 12. Criterio de cierre del ciclo (cuando se decrete)

- Taxonomía con adversarial de plan `proceed`.
- 40 celdas clasificadas (o `pendiente_de_verificar` explícito) con evidencia citable y hash.
- Reporte `brecha_de_garantia` publicado para los 5 CLIs.
- Adversarial de hito que re-verifique una muestra de clasificaciones contra sus fuentes.
- Bitácora y este documento actualizados a estado CERRADO.

## Referencias

- Insight fundacional y escala: Mediador, sesión 2026-08-21 (transcripciones de esta conversación).
- Pila agéntica y compliance-by-invariant vs by-procedure: marco del Mediador (misma sesión).
- skopos: `/Users/krisnova/www/aria/skopos` — ADR-004 (escrubery fuente opcional), ADR-010 §9 (frontera precisa).
- Patrones internos reutilizados: Evidentia (procedencia con hash), H6 (schema estricto + validador ajv + probes), T4b (capa de curaduría con self-hash), F3 (sandbox de presupuesto ~0).
