# Adversarial — Plan H9 (Colector `conversation-event/v0`) — r2 — 2026-08-22

**Revisor:** subagente aislado, contexto fresco, **no** el autor del plan ni el de r1 (política §6: revisor independiente).
**Entrada:** `docs/investigacion/Plan_H9_Colector_Conversation_Event.md` (r2, 118 líneas), `AGENTS.md`, `docs/politica-agentes.md`, `docs/investigacion/probes/DECISION_ADAPTADORES.md`, `backend/src/probes/*`, `datos/schemas/conversation-event-v0.schema.json`, `bitacora_ciclos.md`. `adversarial-plan-h9-r1.md` se leyó **al final**, tras formar juicio propio.
**Método:** verificación por ejecución. Cada afirmación numérica del plan se recalculó; cada artefacto que el plan invoca se abrió; las cinco fuentes reales se inspeccionaron en disco (metadatos, nombres de campo y conteos **exclusivamente** — ningún texto de conversación, ningún token, ninguna ruta con nombre de usuario sin sanear; `~` sustituye `$HOME` en todo este documento).
**Regla 5:** no se ejecutó ningún CLI de IA. Sólo lectura de artefactos ya escritos en disco.

---

## Verificaciones ejecutadas

| # | Qué se verificó | Comando | Resultado |
|---|---|---|---|
| W1 | Aritmética de la matriz de CE-T5 (35 celdas) | parser python sobre las 7 filas de la tabla de `DECISION_ADAPTADORES.md` | **20 ok · 5 parcial · 10 nd**, 35 celdas. El plan (§1.1) tiene razón; el documento de H6 (21/5/9) está mal |
| W2 | Origen del error de W1 | `grep -n "16 ok" bitacora_ciclos.md` (línea 348) + suma de la columna claude-code | H6 registró **16/4/8** (correcto para 4 CLIs). La columna claude-code aporta **4 ok · 1 parcial · 2 nd** → 20/5/10. El error nació al extender a 5 CLIs en CE-T6, no en el conteo original |
| W3 | Conteo por CLI de celdas no-`nd` | tally python sobre la misma matriz | opencode 3ok/1parcial · codex 5ok/0 · cline 3ok/3parcial · kimi 5ok/0 · claude-code 4ok/1parcial |
| W4 | Campos del contrato | lectura de `datos/schemas/conversation-event-v0.schema.json` | `evento_id`: `format: uuid`, descripción "UUID v4"; `cli_version`: `minLength: 1` (requerido); `additionalProperties: false` a nivel raíz y en `fuente`/`sensibilidad`; `carga_ref` describe "bajo var/probes/" |
| W5 | "18 specs" del validador | `npx jest src/probes/conversation_event.spec.ts` | **18 passed, 18 total** (el archivo tiene 11 `it(`; 7 más salen de un `it` en bucle sobre los 5 CLIs). **La cifra del plan es correcta** |
| W6 | Almacén gitignored | `git check-ignore -v var/colector/eventos.jsonl var/probes/x.json` | ambos → `.gitignore:27:var/`, exit 0. Cierto |
| W7 | Alcance de `check_sizes.py` sobre `var/` | lectura de `scripts/check_sizes.py` | sólo audita `AGENTS.md`, `docs/**/*.md` (1500) y `scripts/*.py|sin extensión` (800). **`var/` no está exento pero tampoco está cubierto**: ningún gate limita el crecimiento del almacén |
| W8 | ¿Reuso de los lectores de `probes/`? | `grep -n "readFileSync\|split(\|offset\|cursor" backend/src/probes/*.ts` | los 5 leen el **archivo entero** (`readFileSync(f,'utf-8').split('\n')`) o la BD entera; **cero** apariciones de `offset`/`cursor`. Reescritura confirmada (r1 HIGH-4) |
| W9 | Relleno real de `cli_version` en los probes | `grep -rn "cli_version" backend/src/probes/` | prosa en 4 de 5: `'desconocida'` (opencode ×2), `'por sesión (…no proyectada aquí)'` (cline, codex, claude), y en kimi la **versión instalada hoy** (`latest_version.txt`) |
| W10 | ¿Trae codex la versión? | inspección de claves de un `rollout-*.jsonl` (3 primeras líneas, sólo nombres de clave) | `payload` de `session_meta` incluye **`cli_version`** ✓ |
| W11 | ¿Trae opencode la versión? | `pragma table_info(session)` + `select count(distinct version) from session` sobre `~/.local/share/opencode/opencode.db` en `mode=ro` | columna **`version`**; **28** valores distintos; **0** filas con `version IS NULL` ✓ |
| W12 | ¿Trae **claude-code** la versión? | conteo de nombres de clave sobre las primeras 400 líneas de un `~/.claude/projects/**/*.jsonl` | clave **`version`** presente en 146 de 195 registros; **1** valor distinto en el archivo. **SÍ la trae** — el plan §3.5 no la lista |
| W13 | ¿Trae **kimi** la versión? | claves de las primeras 300 líneas de un `~/.kimi/**/wire.jsonl` + `grep -o '"[a-zA-Z_]*[Vv]ersion[a-zA-Z_]*"'` | única clave de versión: **`protocol_version`** (protocolo Wire). **No hay versión de CLI en la fuente** |
| W14 | ¿Trae **cline** la versión? | `pragma table_info(sessions)` + conteo de claves de `metadata_json` (200 filas) + claves de `tasks/*/{api_conversation_history,ui_messages,task_metadata}.json` | sin columna de versión; `metadata_json` → `{title, totalCost, usage, source, provider, model, systemPrompt, prompt, checkpoint, git, …}`; los `tasks/*` sólo traen `modelInfo` (modelo, no versión de CLI). **No hay versión de CLI en ninguna superficie** |
| W15 | Contenido sensible en la fuente opencode | `select name from sqlite_master where type='table'` + `pragma table_info` (sólo nombres) | tablas **`account`** (`access_token`,`refresh_token`), **`control_account`** (ídem), **`credential`** (`value`) conviven en el mismo fichero que se va a colectar |
| W16 | Contenido sensible en la fuente cline | claves de `sessions.metadata_json` y columnas de `sessions` | columna `prompt`; `metadata_json` con `systemPrompt` y `prompt` |
| W17 | Estabilidad del ancla `rowid` (opencode) | `select sql from sqlite_master` + `select rowid from message limit 1` | tablas **con** rowid (no `WITHOUT ROWID`) → `rowid` existe pero es **reasignable**; los PK reales son `id TEXT`. Existen tablas `migration` y `data_migration` → reescrituras de esquema previstas por el propio producto |
| W18 | Mutación en sitio de una fuente (cline) | claves de `tasks/*/ui_messages.json` | array reescrito en sitio con entradas **`partial: true`** y `conversationHistoryIndex`; un mismo índice de array cambia de contenido cuando el mensaje parcial se completa |
| W19 | Volumen real de las 5 fuentes | `du -sh` sobre las 5 raíces | codex **2.2G** · cline **3.2G** · opencode **4.6G** (`opencode.db` = **4 698 304 512 B**) · kimi **482M** · claude-code **167M** → **≈ 10.7 GB** |
| W20 | Archivo individual mayor | `find … -name '*.jsonl' | xargs stat -f %z | sort -rn | head` | **136 963 823 B** (un solo `.jsonl`), seguido de 99 MB y 95 MB. Los lectores actuales lo cargan entero en memoria (W8) |
| W21 | Nº de archivos a recorrer | `find` por fuente | codex **633** `rollout-*.jsonl` · claude-code **268** `.jsonl` · kimi **519** `wire.jsonl` · cline **492** ficheros · opencode 1 BD |
| W22 | Auto-referencia del gate de idempotencia | `find ~/.claude/projects -type f -mmin -2 | wc -l` durante esta misma revisión | **4** ficheros escritos en los últimos 2 minutos. El historial de claude-code crece mientras se trabaja en el repo |
| W23 | Sidecars WAL ya presentes | `ls -l ~/.cline/data/db/` y `ls -l ~/.local/share/opencode/` | `sessions.db-shm`, `sessions.db-wal`, `connectors.db-shm/-wal`, `cron.db-shm/-wal`, `opencode.db-shm` (32 768 B), `opencode.db-wal` (795 192 B). R1 no es hipotético: **ya está materializado** |
| W24 | ¿Existe el "gate de grep de privacidad"? | `grep -rniE "privacidad\|fuga\|leak" --include=*.sh --include=*.py --include=*.ts .` (sin `node_modules`) + lectura de `scripts/ci_local.sh` | **0 coincidencias**. No hay script, no hay spec, no está en los 5 pasos de `ci_local.sh`. La única mención en todo el repo es prosa: `DECISION_ADAPTADORES.md:51` |
| W25 | `probe:conversacion` existe | `python3 -c` sobre `backend/package.json` | `"probe:conversacion": "tsx src/probes/cli.ts"` ✓. **No existe** `colector:conversacion` (P2 lo propone) |
| W26 | Aritmética de los estimados | suma python de la tabla §4 | 0.75+1.0+1.0+0.5+0.25 = **3.5** ✓; y 2.75 + 3×0.25 = **3.5** ✓. La aritmética del plan es correcta |
| W27 | Denominadores de la matriz vs. realidad | `select count(*) from session` (opencode, ro) vs. matriz vs. probe vs. release | matriz **691**, probe/release **815 sesiones**, hoy **865**. Tres cifras, ninguna con su denominador declarado en la matriz |
| W28 | Conteo de sesiones cline | `select count(*), count(ended_at) from sessions` (ro) | **174** sesiones, **168** con `ended_at` → confirma la celda `sesion_cerrada` ok de cline |
| W29 | Vocabulario de veredicto | `docs/politica-agentes.md` §6 | política define `proceed | fix-and-retry | escalate`; el plan §7.5 y el encargo de esta ronda usan `stop` |
| W30 | Gate de tamaño de este informe | `python3 scripts/check_sizes.py` | ver §Cierre |

---

## Hallazgos

### CRÍTICO

#### C1 — El criterio de cierre nº 1 es trivialmente satisfacible por un colector que no emite nada

§7.1 exige: *"Doble corrida sobre los 5 CLIs → **0 eventos nuevos** y almacén de eventos idéntico"*. **No exige que la primera corrida emita nada.** Un colector que persiste 0 eventos satisface el criterio de forma perfecta y determinista, con almacén bit-idéntico garantizado.

Esto no es un caso de laboratorio: es el resultado que el propio §3.5 produce para 2 de los 5 CLIs (ver C2). El gate que el plan presenta como *"el gate que separa H9 de H6"* (§3.1) no distingue idempotencia de inactividad.

**Verificación:** lectura de §7 (6 criterios, ninguno impone un piso de emisión) contrastada con §3.5 y con W13/W14.

**Corrección concreta:** reescribir §7.1 en dos mitades falsables:
> 1a. **Primera corrida:** cada uno de los 5 CLIs emite `N_cli > 0` eventos persistidos y validados; se publica `N_cli` por tipo. Si `N_cli = 0`, el ticket del adaptador está **incompleto**, no cerrado.
> 1b. **Segunda corrida** sobre fuente congelada (copia de P4): `0` eventos nuevos, `sha256` del almacén idéntico entre corridas.

Y añadir un **test negativo** en CO-T0: un almacén vacío debe **fallar** el gate, no pasarlo.

#### C2 — §3.5 se apoya en una premisa fáctica falsa, y su consecuencia es silenciar el 44% de la cobertura declarándolo éxito

§3.5 afirma: *"la versión se toma de la fuente por sesión donde la fuente la trae (codex `session_meta`, opencode). Donde la fuente no la trae, el evento no se emite"*. La lista de dos elementos es **incorrecta por defecto y por exceso de silencio**:

| CLI | ¿La fuente trae versión de CLI? | Verificación | Efecto de la regla §3.5 |
|---|---|---|---|
| codex-cli | **Sí** (`payload.cli_version` en `session_meta`) | W10 | emite ✓ (el plan acierta) |
| opencode | **Sí** (`session.version`, 28 valores distintos, 0 nulls) | W11 | emite ✓ (el plan acierta) |
| **claude-code** | **Sí** — clave `version` por registro en el `.jsonl` | **W12** | **el plan lo omite**; si se aplica su lista literal, se silencia por error una fuente que sí cumple |
| kimi-code | **No** (sólo `protocol_version` del protocolo Wire) | W13 | **0 eventos**: 5 celdas `ok` silenciadas |
| cline | **No** (ni columna, ni `metadata_json`, ni `tasks/*`) | W14 | **0 eventos**: 3 `ok` + 3 `parcial` silenciadas |

Cuentas exactas sobre la matriz corregida (W1/W3): de las **25 celdas no-`nd`** (20 ok + 5 parcial), la regla apaga **11** — 6 de cline y 5 de kimi — es decir **44%**. Entre ellas, **la única celda `ok` de `sesion_cerrada` en toda la matriz** (cline). El plan dedica §3.4 a lamentar que `sesion_cerrada` sea el hueco mayor (4/5 nd) y en §3.5 apaga la quinta.

Lo agravante es la construcción retórica: §3.5 cierra con *"la cobertura real de este ciclo puede quedar por debajo de la matriz de CE-T5, y eso **es un resultado, no un fallo**"*, y §7.2 lo blinda pasando de *coincidir* a *explicar*. El plan **pre-absuelve** el daño antes de medirlo. Un ciclo que entrega 0 eventos de 2 de sus 5 CLIs y lo declara resultado válido no tiene criterio de cierre; tiene una coartada.

**Corrección concreta:**
1. Corregir §3.5: claude-code **sí** trae versión por registro (W12) y entra en el grupo que emite.
2. Sustituir "no emitir" por **procedencia honesta dentro de v0**: `cli_version` se rellena con el **valor observado en la fuente**; donde no existe, `fuente.interfaz` ya identifica la superficie y el evento se emite con `cli_version` marcado explícitamente como no derivable de la fuente — lo cual el contrato v0 **no permite** (`minLength: 1` requerido). Por tanto: **la única salida honesta es que P5 se decrete ANTES de planificar CO-T2**, no como pregunta abierta que se resuelve al final. Si el Mediador no abre v1, el plan debe declarar que cline y kimi quedan **fuera de alcance de H9** por limitación de contrato — explícitamente, en §2 (no-objetivos), no como efecto lateral descubierto en la corrida.
3. Añadir a §7.2 un umbral numérico: la cobertura entregada se compara celda a celda contra 20/5/10 y **cualquier celda perdida se enumera con su causa**; "explicación" sin enumeración no cierra.

#### C3 — El ancla de deduplicación es inestable en 2 de las 5 fuentes, y la clave excluye el hash del contenido → registro longitudinal silenciosamente falso

§3.1 fija la clave del índice como `sha256(cli_id + ruta_relativa_saneada + ancla)`, con `ancla` = *"`turn_id` en codex, `rowid` en SQLite, índice de línea en JSONL"*. Dos de esos tres anclajes no aguantan:

- **`rowid` en SQLite no es un identificador estable.** Es reasignable tras `DELETE`, y `VACUUM` lo reescribe. `opencode.db` tiene tablas `migration` y `data_migration` (W15/W17): el propio producto contempla reescrituras de esquema. Y los PK reales existen y son estables: `message.id`, `part.id`, `session.id`, todos `TEXT` (W17). Elegir `rowid` teniendo `id` disponible es un error de diseño evitable.
- **"índice de línea" no aplica a cline** — cuyas superficies `tasks/*` no son JSONL sino **arrays JSON reescritos en sitio**: `ui_messages.json` contiene entradas `partial: true` que más tarde se sustituyen por la versión completa **en el mismo índice** (W18). El ancla apunta a una posición cuyo contenido cambia.

El fallo de fondo es que la clave **excluye deliberadamente cualquier hash del registro origen**. Consecuencia: si el registro anclado cambia (línea parcial completada, `rowid` reasignado, tabla migrada), el colector encuentra la clave en el índice, **no emite nada**, y el almacén conserva para siempre un evento derivado de un contenido que ya no existe. El gate §7.1 **premia exactamente ese comportamiento**: 0 eventos nuevos. La idempotencia se compra con corrupción silenciosa del registro longitudinal — que es el único producto del ciclo.

**Corrección concreta:**
1. Ancla por fuente, con identificadores estables: opencode → `id` (TEXT), no `rowid`; codex → `turn_id`; claude-code → `uuid` del registro; kimi → hash del registro + posición; cline → `conversationHistoryIndex` **más** hash del registro (única defensa contra la reescritura en sitio).
2. **Incluir `carga_sha256` en la clave del índice**, o guardarlo junto a la clave. Si la clave coincide pero el hash difiere, el registro origen **mutó**: eso es un evento de deriva que debe contarse y reportarse (como los descartes de §3.2), no ignorarse.
3. Añadir a CO-T0 un test explícito: *registro mutado bajo el mismo ancla* → detectado y contado, no silenciado.

#### C4 — Premisa: infraestructura sin consumidor, sobre un almacén que el propio repo trata como desechable — y contra un precedente decretado el mismo día

Tres hechos verificados que el plan no reconcilia:

1. **No hay consumidor.** §2 excluye, como no-objetivos: escritura en AN-KLA · ingesta al repo · exposición por API/MCP (*"el contrato sigue siendo de diseño, no servido"*) · clasificador · daemon. Recorridos los no-objetivos, no queda ningún lector del almacén. El plan no nombra a nadie que consuma los eventos, ni en §1 ni en §7.
2. **El almacén es desechable por construcción.** P1(a) —la opción recomendada— lo pone bajo `var/`, ignorado en bloque (W6, `.gitignore:27`). No se commitea, no se respalda, no tiene retención ni rotación, y **ningún gate limita su tamaño** (W7: `check_sizes.py` sólo cubre `AGENTS.md`, `docs/**/*.md` y `scripts/`). Un `rm -rf var/`, un clon nuevo o una limpieza de disco lo borra entero. El título del plan promete *"registro longitudinal"* y §1 promete *"longitudinal, incremental y durable"*: **durable es precisamente lo que `var/` no es**. El plan vende la reversibilidad como virtud (*"ciclo reversible"*, P1a) sin ver que la reversibilidad total es indistinguible de la inutilidad para un artefacto cuyo valor es acumularse.
3. **Contradice un precedente decretado el 2026-08-22**, el mismo día que este plan. `bitacora_ciclos.md:442` registra el decreto que descartó la capa `assurance-gateway/` con esta razón textual: *"esa maquinaria de procedencia compraba control real en H7 …, pero para UNA entidad cuyo único lector es el propio proyecto es coste sin contrapartida. Lección durable: **el rigor de procedencia se dimensiona por superficie de deriva, no por costumbre**."* H9 propone 3.5 ciclos de maquinaria de procedencia (índice, cursores, validación fail-closed, gates) cuyo único lector es el propio proyecto y cuyo producto es gitignored. El plan no cita este decreto ni argumenta por qué la lección no le aplica.

Y en la misma bitácora (`:452`) el Arquitecto recomendó *"producto primero"* listando alternativas que **sí** tienen consumidor externo declarado (skopos, expertoGobernanza): casos reales del resolver, `politica_datos_proveedor`, F4b.

**Verificación:** `grep -n "Candidatos" -A 20 bitacora_ciclos.md`; lectura de §2 y §6-P1 del plan; W6; W7.

**Corrección concreta:** el plan debe añadir una sección **"Consumidor"** que responda, antes de decretarse: *¿quién lee estos eventos, para responder qué pregunta, y en qué ciclo?* Tres salidas legítimas:
- (a) Nombrar el consumidor y traer su primera consulta **a este ciclo** (aunque sea un `scripts/consultar` sobre agregados), lo que a su vez obliga a decidir P1 hacia (b) y no (a).
- (b) Reencuadrar H9 explícitamente como **experimento de ingeniería de un ciclo** —"¿es construible un colector idempotente sobre estas 5 superficies?"— con estimado recortado a ~1 ciclo, un solo CLI (codex, el único con ancla estable y versión en fuente), y sin prometer "longitudinal" ni "durable".
- (c) Devolverlo a la cola detrás de los candidatos con consumidor.

**Esta decisión es del Mediador, no del revisor.** Se escala como tal.

---

### HIGH

#### H5 — Ningún ticket tiene DoD ejecutable; la política lo prohíbe explícitamente

La tabla §4 tiene tres columnas: `Ticket | Contenido | est.`. **No hay columna de DoD, ni criterio de aceptación por ticket, ni comando esperado.** `docs/politica-agentes.md` §1.2: *"Cada tarea tiene una Definition of Done expresada como **checks ejecutables** (comando + salida esperada, test, archivo existe y mide < N). Sin check → no es contrato, es deseo."* Y §2, textual: *"Una tarea sin contrato ejecutable **se rechaza al planificar**."*

Sólo §3.1 y §7 contienen algo verificable, y son criterios de **ciclo**, no de ticket. CO-T1 ("se dotan de reanudación por ancla + adaptador codex-cli end-to-end") y CO-T2 ("`no_disponible` honesto por celda") son prosa: no hay forma de determinar si están hechos salvo por declaración del agente — que es lo que la política existe para impedir.

**Corrección:** añadir columna `DoD (comando → salida esperada)` a la tabla §4, una fila por ticket. Ejemplo mínimo para CO-T1: `npm run colector:conversacion -- --cli codex-cli --dry-run` → JSON con `eventos_emitidos > 0`, `descartados`, `cursor_final`; segunda invocación → `eventos_emitidos == 0`.

#### H6 — El gate de privacidad que el plan usa como DoD permanente **no existe** y ningún ticket lo construye

§3.3 dice: *"el gate de grep con tokens reales de las 5 fuentes se corre **en cada ticket**"*, y §7.3 lo eleva a criterio de cierre: *"0 matches de grep con tokens reales de las 5 fuentes"*.

**W24: no existe.** `grep -rniE "privacidad|fuga|leak"` sobre `*.sh`, `*.py`, `*.ts` (excluido `node_modules`) devuelve **0 coincidencias**. `scripts/ci_local.sh` tiene 5 pasos (npm ci, build, eslint, jest, check_sizes) y ninguno es este gate. La única aparición del concepto en todo el repo es prosa heredada en `DECISION_ADAPTADORES.md:51`. La nota de release habla de *"0 fugas verificadas"* pero no apunta a ningún artefacto ejecutable.

Dos problemas encadenados:
- **Ningún ticket es dueño de construirlo.** CO-T3 dice "gates de privacidad" en la misma casilla de 0.5 ciclos que ya incluye el gate de idempotencia sobre los 5 CLIs, CI local y métricas.
- **Tal como está descrito, el gate es él mismo una superficie de fuga.** "Tokens reales de las 5 fuentes" significa extraer texto real de conversación del Mediador para usarlo como patrón de búsqueda. El plan no dice dónde viven esos patrones, quién los genera, si se persisten, ni si acaban en la salida de un log o de CI. Un gate de privacidad que exige materializar el dato privado necesita su propio diseño.

**Corrección:** ticket propio (o alcance explícito en CO-T0) que entregue `scripts/gate_privacidad_colector.sh` con contrato: los patrones se derivan **en memoria** de las fuentes en la propia corrida, jamás se escriben a disco ni a stdout; la salida es únicamente `matches: N` y exit 0/1; se añade como paso 6 de `ci_local.sh`. Sin ese artefacto, §7.3 no es verificable.

#### H7 — Riesgo ausente: las fuentes contienen **credenciales**, no sólo conversación

§3.3 caracteriza el riesgo como *"conversación en claro"*. Es incompleto:

- `opencode.db` — el fichero que el colector va a leer repetidamente — contiene en el **mismo fichero** las tablas `account` (`access_token`, `refresh_token`, `token_expiry`), `control_account` (ídem) y `credential` (`value`) (W15).
- `~/.cline/data/db/sessions.db` tiene columna `prompt`, y `metadata_json` incluye `systemPrompt` y `prompt` (W16).
- Junto a `opencode.db` hay `auth.json` y `auth.json.bak-*` (W23).

`docs/politica-agentes.md` §7 es más dura que §3.3 del plan: *"**Secretos:** jamás claves/tokens en código ni en datos"*. Un `SELECT *` exploratorio, un volcado de error de `node:sqlite`, un stack trace con la fila que falló, o un `carga_ref` mal acotado sobre esa BD arrastra secretos al almacén — que además es persistente (a diferencia del reporte efímero de H6, como el propio §3.3 reconoce).

**Corrección:** añadir R8 a §5 con mitigación **estructural, no de disciplina**: (a) el adaptador opencode declara una **lista blanca de tablas y columnas** (`session.id/version/time_*`, `message.id/session_id/time_*`, `part.id/message_id`) y falla si el esquema no la satisface; (b) prohibición de `SELECT *` como regla del ciclo; (c) todo manejador de error del colector emite **sólo** tipo de excepción y ancla, nunca la fila; (d) si P4 se resuelve por copia previa, la copia **excluye** las tablas de credenciales en vez de copiar los 4.6 GB completos.

#### H8 — El volumen real no está medido: son ~10.7 GB, no "17135 prompts"

R2 (§5) describe el riesgo de volumen exclusivamente en conteos de eventos (*"codex 17135 prompts; claude-code 12687"*). Medido (W19–W21):

| Fuente | Tamaño | Ficheros |
|---|---|---|
| opencode (`opencode.db`) | **4.6 G** (4 698 304 512 B) | 1 |
| cline (`~/.cline/data`) | **3.2 G** | 492 |
| codex (`~/.codex/sessions`) | **2.2 G** | 633 |
| kimi (`~/.kimi`) | **482 M** | 519 `wire.jsonl` |
| claude-code (`~/.claude/projects`) | **167 M** | 268 |
| **Total** | **≈ 10.7 GB** | |

Además: el `.jsonl` individual mayor pesa **136 963 823 B** (W20), y los lectores existentes hacen `readFileSync` del fichero completo a string (W8). Tres consecuencias que el plan no presupuesta:

1. **P4 recomendada (copia previa a `var/`) implica duplicar ~10.7 GB** en el disco del Mediador, en cada corrida, en un directorio sin gate de tamaño (W7). El plan la vende como *"coste bajo"*. No lo es.
2. **CO-T3 = 0.5 ciclos** para "doble corrida sobre los 5" = leer ~21 GB y comparar almacenes bit a bit.
3. La reescritura de lectores de CO-T1 no es sólo "añadir reanudación": es pasar de `readFileSync` a lectura por streams con offset, o el proceso no aguanta ficheros de 137 MB × 633 en una corrida.

**Corrección:** añadir la tabla de volumen medido a R2; declarar lectura **por streams con offset** como requisito de CO-T1 (no como detalle); revisar el estimado de CO-T3; y si P4 se resuelve por copia, acotar qué se copia (H7.d) y con qué retención.

#### H9 — El gate de idempotencia es inalcanzable para claude-code por auto-referencia, y R6 no lo cubre

§7.1 exige doble corrida *"sin actividad nueva"*. claude-code es el harness con el que se trabaja en este repositorio, y **su historial se escribe mientras se trabaja**: durante esta misma revisión, `find ~/.claude/projects -type f -mmin -2` devolvió **4** ficheros (W22). Ejecutar el colector desde una sesión de claude-code garantiza que entre la corrida 1 y la corrida 2 la fuente ha crecido — con los eventos generados por el acto de correr el colector. El almacén **no** puede ser bit-idéntico.

R6 identifica correctamente *"el que audita es el auditado"*, pero su mitigación es sólo *"revisión adversarial independiente del adaptador"*: cubre el código, no el gate. Y no es exclusivo de claude-code: cualquier CLI que el Mediador tenga abierto durante la corrida rompe el gate.

**Corrección:** §7.1b se ejecuta sobre **copia congelada** de las fuentes (que es además lo que P4 recomienda por otra razón), con el `sha256` de cada copia registrado; el gate compara colector-sobre-copia vs. colector-sobre-la-misma-copia. Sobre fuentes vivas el gate se enuncia como propiedad más débil y honesta: *"ningún evento ya visto se re-emite"* (verificable por el índice), no *"0 eventos nuevos"*.

#### H10 — La atomicidad entre almacén e índice no está diseñada, y es el modo de fallo real de la idempotencia

§3.1 declara *"El índice es la garantía; el cursor no"*, pero índice (`indice.json`) y almacén (JSONL append-only) son **dos ficheros distintos**. El plan no dice cuándo se escribe el índice, ni cómo se ordenan las dos escrituras, ni qué pasa si el proceso muere entre ambas. Escenario concreto: se anexan 5 000 eventos al JSONL, el proceso muere antes de reescribir `indice.json` → la siguiente corrida no conoce esas claves y **re-anexa los 5 000**. El colector duplica, que es exactamente lo que el ciclo existe para impedir.

Los tests de CO-T0 cubren *cursor borrado*, *cursor corrupto*, *evento inválido*, *fuente truncada* — todos sobre el cursor, que el propio plan degrada a "optimización". **No hay test de índice desincronizado del almacén**, que es el único fallo capaz de romper la garantía.

**Corrección:** o bien (a) el índice deja de ser un fichero y se **reconstruye leyendo el almacén** al arrancar (una sola fuente de verdad, imposible de desincronizar; coste lineal aceptable dado el tamaño previsto del almacén), o bien (b) escritura del índice **antes** del append, con reconciliación al arrancar (claves en el índice sin evento en el almacén → se reintentan). En ambos casos: escritura atómica (`write` a temporal + `rename`) y test explícito de *muerte del proceso entre append e índice* en CO-T0.

---

### MED

#### M11 — §7.2 dejó de ser falsable

r1 objetó, con razón, que exigir *coincidir* con una matriz equivocada era absurdo. La corrección aplicada fue *"No se exige coincidencia: se exige explicación"*. El péndulo pasó de imposible a **inrefutable**: cualquier resultado, incluidos 0 eventos en 2 CLIs (C2), admite una explicación. Un criterio de cierre que no puede fallar no es un criterio.
**Corrección:** ver C2.3 — enumeración obligatoria celda a celda con causa por celda perdida; y las causas admisibles se listan de antemano (`sin_version_en_fuente`, `formato_desconocido`, `fuera_de_ventana`), no se inventan al reportar.

#### M12 — Las 5 decisiones "vinculantes" de CE-T5 llevan denominadores de 4 CLIs, obsoletos desde CE-T6

El plan declara (cabecera) que las 5 decisiones de `DECISION_ADAPTADORES.md` *"son entrada, no se re-litigan"*, y corrige sólo la aritmética de la matriz. Pero las decisiones mismas están desactualizadas: decisión 2 dice *"`turno_fallido` … (3/4 nd)"* (son 3/5); decisión 3 dice *"el colector debe reportar nd para los otros **tres**"* (son cuatro); decisión 5 dice *"los **4** almacenes"* (son cinco). Adoptar como vinculante un texto cuyo denominador cambió sin marcarlo propaga el mismo tipo de error que §1.1 corrige.
**Corrección:** que la fe de erratas de §1.1 cubra también los denominadores de las decisiones 2, 3 y 5, no sólo la línea del resumen.

#### M13 — La fe de erratas propuesta deja fuera un tercer número en circulación

§1.1 propone corregir el artefacto de H6. Pero `bitacora_ciclos.md:348` registra para CE-T5 *"matriz 16 ok / 4 parcial / 8 nd"* — cifra **correcta para 4 CLIs** (W2), engañosa hoy como total de H6. Hay tres números vivos (16/4/8, 21/5/9, 20/5/10) y el plan sólo contempla dos.
**Corrección:** la fe de erratas nombra los dos artefactos (`DECISION_ADAPTADORES.md` y `bitacora_ciclos.md:348`) y explica el mecanismo (W2: la extensión CE-T6 sumó mal la columna claude-code), que es más útil que la explicación del plan (*"una celda nd contada como ok"*).

#### M14 — "Contrastar contra la matriz" compara con conteos volátiles y de denominador no declarado

La matriz mezcla veredictos (ok/parcial/nd) con **volúmenes** (691, 17135, 12687) sin decir qué cuenta cada número. Verificado (W27): opencode aparece como `sesion_iniciada` **691** en la matriz, **815 sesiones** en el probe y en la nota de release, y **865** filas en `session` hoy. No es un error —691 cuenta eventos `session.created.1`— pero la matriz no lo dice, y §7.2 manda contrastar contra ella. Además los volúmenes crecen a diario: contra qué foto se contrasta no está fijado.
**Corrección:** §7.2 contrasta **veredictos por celda** (ok/parcial/nd), nunca volúmenes; si se publican volúmenes, van con su definición y con la fecha de la foto.

#### M15 — La afirmación de cumplimiento de la regla 1 sustituye los campos exigidos por otros

La cabecera del plan afirma: *"**Regla 1 (procedencia):** cada evento persistido lleva `fuente` con superficie y `estabilidad: interna`"*. La regla 1 de `AGENTS.md` exige `fuente_url`, `fecha_obtencion` y `hash_sha256`. `fuente.estabilidad` no es ninguno de los tres, y `fuente.fuente_url` será **null** para las cinco superficies (son artefactos locales sin doc pública — así lo describe el propio schema, W4). El cumplimiento real proviene de que el dato **no entra al repo** (`var/` ignorado), no de lo que el plan alega. Declarar cumplimiento por analogía de nombres es el patrón exacto que r1 denunció en HIGH-3 para `cli_version`.
**Corrección:** reformular: *"regla 1 no aplica: el almacén no entra al repo. Los campos análogos del contrato (`fecha_observacion`, `carga_sha256`) se rellenan igualmente; `fuente.fuente_url` es null legítimo (regla 4)."*

#### M16 — La cabecera argumenta media regla 5

*"**Regla 5 (no ejecutar los CLIs reales):** no se ejecuta ningún CLI"* — cierto y verificado. Pero la regla 5 completa dice: *"**Fases 0–1: solo fuentes públicas gratuitas.** No ejecutar los CLIs reales…"*, y `AGENTS.md:9` declara la fase actual como **0**. El colector construye un almacén persistente sobre el historial **privado y local** del Mediador, que no es una fuente pública. H6 sienta precedente para *leer*; acumular es un paso más. El plan no argumenta esa mitad.
**Corrección:** o se argumenta explícitamente (p. ej. "no es un dato del sistema, es telemetría propia del Mediador sobre su propio equipo, nunca publicada"), o se pide decreto en §6. Callarlo deja abierta una objeción de regla dura en el momento del cierre.

#### M17 — P2 propone enganchar a `vigilancia_diaria.sh` sin analizar el efecto

P2 ofrece meter el colector dentro de `scripts/vigilancia_diaria.sh`, script con contrato de salida documentado (exit 0/10/2, `docs/VIGILANCIA.md`). Añadir un recorrido de ~10.7 GB (H8) a un job diario cambia su duración, su perfil de E/S y su probabilidad de fallo — y un fallo del colector se confundiría con una alerta de vigilancia.
**Corrección:** si se engancha, entra como paso con exit code propio, aislado del contrato 0/10/2, y con la ventana de P3 ya acotada. Recomendable descartar P2(b) de plano en v0, como el propio plan sugiere.

#### M18 — Riesgos ausentes de §5 (batería)

Ninguno aparece en la tabla de riesgos:
- **Symlinks:** los lectores hacen `readdirSync` + `readFileSync` sin `lstat` (W8). Un symlink dentro de un directorio de sesiones hace que el colector lea —y hashee— un fichero arbitrario del sistema. Mitigación: `lstat` y saltar todo lo que no sea fichero regular.
- **Crecimiento sin límite del almacén:** sin retención, sin rotación, sin gate (W7). Mitigación: rotación por corrida/fecha y tope declarado.
- **Poda o borrado de las fuentes:** si un CLI purga historial antiguo, el índice conserva claves de eventos cuya fuente ya no existe. No es un fallo, pero cambia el significado de la cobertura reportada y debe declararse.
- **Relojes:** `fecha_observacion` sale del reloj local (`new Date().toISOString()` en los probes); correctamente excluida de la clave (§3.1), pero un salto de reloj o cambio de huso desordena el almacén append-only y no hay nota al respecto.
- **Concurrencia sobre JSONL vivo:** R1 sólo cubre SQLite/WAL. Leer un `.jsonl` mientras el CLI escribe deja una última línea parcial; combinado con el ancla por índice de línea, es el escenario de C3.
- **Rutas con nombre de usuario:** §3.1 dice `ruta_relativa_saneada` pero no define el saneo, y las rutas de origen contienen el nombre de usuario (`~/...`) y, en claude-code, el **path del proyecto codificado en el nombre del directorio**. Mitigación: la clave usa la ruta relativa a la raíz de la fuente, y `carga_ref` nunca la absoluta.

---

### LOW

#### L19 — Vocabulario de veredicto divergente
`docs/politica-agentes.md` §6 fija `proceed | fix-and-retry | escalate`. El plan §7.5 y el encargo de esta ronda usan `stop`. Menor, pero es el contrato del gate: conviene unificar (o registrar `stop` ≡ `escalate` en la política).

#### L20 — El Registro adversarial declara resuelto un hallazgo cuya corrección prescrita no se adoptó
r1 HIGH-3 prescribía *"bloquear el ciclo tras el contrato v1"* — es decir, H9 depende de un ticket de contrato. El plan adoptó la vía alterna (no emitir) y dejó v1 como pregunta abierta P5, pero la tabla del Registro lo anota como *"HIGH-3 → §3.5 + P5"*, sin marcar la divergencia. Aceptable como decisión; no aceptable como registro silencioso. (Y la vía elegida es la que produce C2.)

#### L21 — Referencias internas a "§7.2" y "§7.1" que no existen como numeración
§3.5 y el Registro citan *"§7.2"*; §7 es una lista numerada sin sub-numeración. Se entiende, pero un criterio de cierre citado por un identificador inexistente envejece mal.

#### L22 — CO-T4 (0.25) incluye una ronda adversarial que el Ejecutor no puede ejecutar
CO-T4 = *"Reporte + ronda adversarial de hito + cierre"*, y §7.5 exige que esa ronda sea **independiente, en subagente aislado**. El coste de la ronda no es del Ejecutor y el estimado no lo refleja. Menor, pero el mismo patrón infló CO-T2 (H5).

---

## Premisas cuestionadas

**1. ¿Este ciclo tiene consumidor real?** — No, verificado contra los propios no-objetivos del plan. Ver **C4**. Es la objeción de fondo y no es técnica: es de prioridad, y le corresponde al Mediador.

**2. ¿`var/` gitignored es soporte para un dato "longitudinal y durable"?** — No. r1 verificó `git check-ignore` y concluyó *"cubierto ✓"*; eso resuelve la pregunta de **privacidad** y el plan la reutiliza como si resolviera la de **durabilidad**, que es la contraria. `var/` es el directorio que el repositorio designa como prescindible: sin commit, sin respaldo, sin gate de tamaño (W7). Un registro cuyo valor entero reside en acumularse a lo largo de meses no puede vivir donde la convención del proyecto dice "esto se puede borrar".

**3. ¿El criterio de cierre es falsable?** — Hoy, no. §7.1 lo pasa un colector vacío (**C1**); §7.2 admite cualquier resultado con una explicación (**M11**); §7.3 depende de un gate que no existe (**H6**); §7.4 y §7.6 sí son verificables. De seis criterios, tres son declarativos.

**4. ¿Los tickets tienen DoD verificable?** — No, ninguno. La política lo tipifica como causa de **rechazo al planificar** (**H5**).

**5. ¿El estimado es coherente?** — La aritmética es correcta (W26: 3.5 exacto, y 2.75+3×0.25 = 3.5). La **calibración** no lo es. CO-T2 = 1.0 ciclo para cuatro adaptadores (dos sobre SQLite de 4.6 GB y 3.2 GB, dos sobre JSONL) **más** una revisión adversarial independiente, cuando la política define 1 ciclo como *"lo que un Ejecutor completa en una sesión"*. CO-T3 = 0.5 para dos corridas completas sobre ~21 GB acumulados. Y ninguno de los dos incluye el gate de privacidad inexistente (H6) ni la lectura por streams (H8). Estimado realista: **≥ 5 ciclos** con el alcance escrito — lo que refuerza C4 sobre la relación coste/consumidor.

**6. ¿Hay alternativa más simple para el mismo objetivo?** — Sí, y el plan no la considera. La pregunta de §1 es *"¿puede el proyecto mantener un registro longitudinal … incremental, idempotente y validado?"*. Se responde con **un solo CLI**: codex-cli es el único con ancla verdaderamente estable (`turn_id`, W10), versión en la fuente (W10), y formato append-only real (JSONL por sesión, sin reescritura en sitio). Un colector codex-only entrega la respuesta de ingeniería completa —índice, cursor, doble corrida, fail-closed— en ~1 ciclo, con el 100% de los riesgos de diseño ejercitados y ninguno de los cuatro adaptadores problemáticos. Los otros cuatro se añaden después, uno por ciclo, **si** aparece un consumidor. Esto es exactamente la lección decretada en `bitacora_ciclos.md:442` aplicada a H9.

---

## Comparación con r1

### Lo que r1 encontró y confirmo

| r1 | Mi verificación | Veredicto |
|---|---|---|
| **CRÍTICO-1** — `sha256` no cabe en `evento_id` (`format: uuid`, `additionalProperties: false`) | W4: lectura directa del schema | **Confirmado.** La corrección aplicada (clave en el índice) es correcta y deja el contrato intacto — aunque **incompleta**, ver C3: mover la clave al índice no la hace sólida |
| **CRÍTICO-2** — la matriz suma mal | W1: recuento independiente → 20/5/10 | **Confirmado**, y **ampliado** (W2/M13): el error nació al extender de 4 a 5 CLIs en CE-T6 (16/4/8 → debía dar 20/5/10, se escribió 21/5/9), y hay un tercer número vivo en `bitacora_ciclos.md:348` que la fe de erratas propuesta no cubre |
| **HIGH-3** — `cli_version` con prosa = procedencia falsa que pasa el validador | W9 | **Confirmado en el diagnóstico.** Ver "mal juzgado" abajo para la corrección |
| **HIGH-4** — los lectores no son reusables | W8: `readFileSync(...).split('\n')`, 0 apariciones de offset/cursor | **Confirmado**, y **agravado** (H8): no es sólo falta de reanudación; es incompatibilidad con ficheros de 137 MB |
| **MED-5** — `carga_ref` dice `var/probes/` | W4 | **Confirmado** (menor) |
| **MED-6** — R6 sin ticket dueño | lectura de §4/§5 r2 | **Confirmado y resuelto** en r2 (CO-T2), aunque sin presupuesto (L22) y sin cubrir la auto-referencia del **gate** (H9) |
| **LOW-7** — excluir `fecha_observacion` de la clave | §3.1 r2 | **Confirmado y resuelto.** Correcto |
| **LOW-8** — asimetría de números en §3.4 | §3.4 r2 | **Confirmado y resuelto** |

r1 verificó de verdad: sus seis verificaciones son reproducibles y ninguna resultó falsa. Como autorrevisión, es honesta y su límite lo declara ella misma.

### Lo que se le pasó

r1 predijo su propio punto ciego en la nota metodológica final (*"un revisor independiente habría además cuestionado premisas … si el registro longitudinal tiene consumidor real, o si `var/` gitignored es almacén suficiente"*). Ambas objeciones eran correctas y ninguna se atendió en r2. Lista completa de lo no cubierto:

- **C1** — el gate de idempotencia se pasa con un almacén vacío. Es el hallazgo más grave y estaba a la vista en el texto de §7.1, sin necesidad de ejecutar nada.
- **C2** — r1 **afirmó sin verificar** que las fuentes con versión son "codex `session_meta`, opencode", y el plan lo copió como regla de ciclo. Verificado (W12/W13/W14): claude-code **sí** la trae y el plan la omite; cline y kimi **no** la traen en ninguna superficie → 44% de las celdas no-`nd` se apagan. r1 revisó el relleno de `cli_version` **en el código de los probes** (V6) pero nunca **en las fuentes reales**, que es donde estaba la respuesta.
- **C3** — anclas inestables (`rowid` reasignable; `ui_messages.json` reescrito en sitio con `partial:true`) y clave sin hash de contenido. r1 validó que la clave *cabe* en el índice, no que *funcione*.
- **C4** — premisas de consumidor y durabilidad (auto-declarado por r1), más el precedente decretado en `bitacora_ciclos.md:442`, que r1 no consultó.
- **H5** — ausencia total de DoD por ticket, contra política §2 explícita.
- **H6** — el gate de privacidad no existe en el repo (0 coincidencias en todo el árbol).
- **H7** — credenciales (`access_token`/`refresh_token`/`credential.value`) en la fuente opencode.
- **H8** — volumen real ~10.7 GB; r1 sólo contó 626 ficheros de codex.
- **H9** — auto-referencia: el historial de claude-code se escribe durante la propia corrida.
- **H10** — atomicidad índice↔almacén; r1 no examinó el modo de fallo que rompe la garantía que ella misma prescribió.
- **M12, M14–M18** — decisiones con denominador de 4 CLIs, denominadores de la matriz, regla 1 argumentada por analogía, media regla 5, P2, symlinks/retención/relojes/concurrencia JSONL.

Patrón: r1 verificó **lo que el plan afirma**; no verificó **lo que el plan omite**, ni contrastó el plan contra la política y la bitácora del propio proyecto.

### Lo que considero mal juzgado en r1

1. **V3 sobre-concluye.** *"`var/` ignorado en bloque → `var/colector/` cubierto ✓"* es correcto para privacidad-en-git y el plan lo hereda como si zanjara el asunto del almacén. No zanja ni la durabilidad (C4) ni la privacidad-en-disco: el almacén sigue creciendo sin límite en el equipo del Mediador (H8, M18), donde `.gitignore` no protege nada.
2. **La corrección prescrita en HIGH-3 era mejor que la adoptada, y r1 no defendió la suya.** r1 prescribió *"bloquear el ciclo tras el contrato v1"*: bloquear obliga a decidir P5 antes de gastar ciclos. El plan optó por "no emitir" y difirió P5 al final, produciendo C2 — pérdida silenciosa del 44% de la cobertura, pre-absuelta en §7.2. Es el caso raro en que la autorrevisión acertó y la aplicación de su propio hallazgo lo empeoró.
3. **Severidad de MED-6 subestimada.** "R6 sin ticket dueño" se trató como problema de asignación. El problema real es que R6 identifica una clase —el auditor es el auditado— cuya manifestación más dañina no es el código del adaptador sino el **gate de cierre** (H9): claude-code escribe en la fuente mientras se mide la idempotencia sobre ella.
4. **"2 CRÍTICO, 2 HIGH, 2 MED, 2 LOW"** — la simetría perfecta del recuento, en una autorrevisión, es en sí una señal. No la trato como hallazgo, pero sí como razón adicional para no dar por cubierta la superficie con r1.

---

## Decisión

**`fix-and-retry`**

Recuento: **4 CRÍTICO · 6 HIGH · 8 MED · 4 LOW** (22 hallazgos).

El plan **no debe decretarse en r2**. Tres de los cuatro CRÍTICO son defectos internos corregibles dentro del propio plan y no exigen decreto:

- **C1** vacía de contenido el criterio que el plan presenta como *"el gate que separa H9 de H6"*: se pasa con un almacén vacío.
- **C2** hace que ese vaciado sea el resultado **esperado** para 2 de los 5 CLIs, sobre una premisa fáctica que resultó falsa al verificarla en las fuentes reales, y con la pérdida pre-absuelta como "resultado, no fallo".
- **C3** convierte la garantía de idempotencia en un mecanismo de corrupción silenciosa del registro longitudinal, en las dos fuentes cuyos anclajes verifiqué inestables.

C1 + C2 + C3 juntos describen un ciclo que puede declararse cerrado habiendo entregado un almacén vacío en 2 CLIs y contenido obsoleto en otros 2, con todos los criterios de §7 en verde. Eso es exactamente lo que un CRÍTICO significa.

**C4 se escala al Mediador**, no se resuelve en el plan: la pregunta de si un colector sin consumidor, cuyo producto vive en un directorio ignorado, merece 3.5 ciclos (≥5 realistas, ver Premisa 5) por delante de los candidatos con consumidor externo declarado, es decisión de prioridad. El plan debe al menos **plantearla** —hoy no la menciona— y contrastarla con el decreto de `bitacora_ciclos.md:442`, emitido el mismo día. La alternativa codex-only de la Premisa 6 responde la pregunta de ingeniería de §1 por ~1 ciclo y merece figurar como opción en §6.

**Mínimo para una r3:** C1 (gate con piso de emisión + test negativo), C2 (corregir la premisa de claude-code y decretar P5 **antes** de CO-T2), C3 (anclas estables por fuente + `carga_sha256` en el índice), H5 (DoD ejecutable por ticket), H6 (ticket dueño del gate de privacidad), H10 (atomicidad índice↔almacén), y una sección "Consumidor" que responda C4 aunque sea para escalarlo.

---

## Cierre

- **Restricciones respetadas:** cero mutaciones de git (sólo `git log`, `git status`, `git check-ignore`); ningún archivo del repo modificado ni borrado; el plan no se editó; un único archivo creado (este).
- **Regla 5:** no se ejecutó ningún CLI de IA. Todas las lecturas fueron sobre artefactos ya en disco, con SQLite abierto en `mode=ro`.
- **Privacidad:** este informe no contiene texto de conversación, ni tokens, ni valores de campos de las fuentes. Sólo nombres de campo, nombres de tabla/columna, conteos y tamaños. Todas las rutas van saneadas con `~`.
- **Gate de tamaño:** `python3 scripts/check_sizes.py` → ver salida en el reporte al Mediador (exit 0 exigido, límite duro 1500 líneas para `docs/**/*.md`).
