# Reporte: fix-resolver-args (intento 1)

## Identidad

- Run: fix-resolver-args-20260818-01 · Intento: 1 · Rama: `fix/resolver-args-extra` · SHA base: `add1349`
- Ejecutor: opencode (sesión `escrubery-opencode-resolver-args`)
- Tarjeta: `docs/planning/tarjeta-fix-resolver-args-intento-1.md`

## Cambio

Un único archivo: `backend/src/cli.ts` (+3/−1). El caso `resolver` hacía `const [a, b] = rest` y descartaba en silencio los posicionales 3+ (LOW del adversarial H5). El fix añade una guarda de cantidad antes del destructuring:

```ts
// dos formas (contrato §3.9): 1 arg = issuer_id; 2 args = modelo+endpoint;
// cualquier otra cantidad (0 o 3+) es uso inválido (exit 2), sin descartar extras en silencio
if (rest.length !== 1 && rest.length !== 2) usage();
```

`usage()` emite `{"error":{"codigo":"parametros_invalidos",...}}` por stderr y `process.exit(2)` (patrón del resto del CLI). La segunda línea de defensa (`paramsResolverValidos`, cli.ts:122→120) sigue atrapando strings vacíos/solo espacios; la guarda nueva es exacta para conteos ("usage sii count ∉ {1,2}") y hace sound el destructuring (`b === undefined` ⇔ length 1).

**Specs:** no existe spec del CLI (`cli.spec.ts` no existe; las specs cubren módulos, no `process.argv`). La tarjeta (línea 26) prevé verificación manual por DoD — eso se hizo (abajo). No se creó spec nueva porque `cli.ts` ejecuta `main()` al importar y llama `process.exit`; hacerlo testeable requiere refactor fuera de alcance.

## Entorno de verificación

El worktree NO tiene `backend/.env` (fallback previsto por la tarjeta). Se instaló `npm ci` en `backend/` (worktree fresco sin node_modules). Comando exacto usado para todos los checks de CLI:

```bash
cd /Users/krisnova/www/aria/escrubery-wt-resolver-args/backend
DATABASE_URL='postgresql:///escrubery?host=/tmp' node --import tsx src/cli.ts <args>
```

(BD real `escrubery` vía socket `/tmp`; wrapper `scripts/consultar` idéntico salvo `--env-file=.env` inexistente aquí.)

## Definition of Done — evidencia (comando → salida)

### 1. `resolver a b c` → exit 2 con `parametros_invalidos` por stderr

```
$ DATABASE_URL='postgresql:///escrubery?host=/tmp' node --import tsx src/cli.ts resolver a b c
(exit 2, stdout vacío; stderr:)
{"error":{"codigo":"parametros_invalidos","mensaje":"uso:\n  consultar listar\n  consultar modelo <proveedor> <modelo_id>\n  consultar comando <cli_id> [filtro]\n  consultar ficha cli <id> | consultar ficha proveedor <id>\n  consultar oficialidad\n  consultar resolver <issuer_id> | consultar resolver <modelo_id> <endpoint>\n  consultar feedback <params_json>"}}
EXIT=2
```

Extra: `resolver` (0 args) → exit 2 (sin stdout). `resolver "" ` / `resolver "  "` → exit 2 vía `paramsResolverValidos`.

### 2. `resolver claude-sonnet-5-cowork` → exit 0, `resuelto:true`

```
{"resuelto":true,"identidad_canonica":{"proveedor":"anthropic","modelo_id":"claude-sonnet-5","familia_arquitectura":"claude","pesos_abiertos":false},"advertencias":[...2 avisos...],"configuration_fingerprint_sugerido":"sha256:9bb6b4707318267cef2984d10f9d6803b27cf716a5ca12d2018894cb347d777e",...}
EXIT=0
```

### 3. `resolver qwen3.8-max https://dashscope.aliyuncs.com` → exit 0

```
{"resuelto":true,"identidad_canonica":{"proveedor":"qwen","modelo_id":"qwen3.8-max","familia_arquitectura":"qwen3","pesos_abiertos":false},...}
EXIT=0
```

### 4. Build / lint / tests

```
$ cd backend && npm run build
> backend@0.2.0 build / nest build
(sin errores)

$ npx eslint src/cli.ts
(sin salida → sin errores)

$ npm test
Test Suites: 15 passed, 15 total
Tests:       140 passed, 140 total
```

### 5. Gates del repo

```
$ python3 scripts/check_sizes.py   (desde la raíz del worktree)
check_sizes: OK — todos los archivos dentro del límite duro.

$ git diff --check
(limpio, exit 0)
$ git status --porcelain
 M backend/src/cli.ts        ← único archivo del alcance tocado
```

(`.opencode/`, `.qwen/`, `docs/planning/` son no-rastreados preexistentes de las sesiones de control.)

## Ronda adversarial (contexto fresco, subagente propio)

Subagente independiente (`general`, sin historial de autoría). Verificó por ejecución propia: conteos 0/1/2/3/5/20, strings vacíos y solo espacios (`exit 2`), flags posicionales (`resolver --foo` → `sin_datos` exit 1, fail-closed), eslint/build/tests/gates.

**Hallazgos:**

- Aplicables a ESTE diff: **ninguno** (BLOCKER/HIGH/MED: 0).
- [LOW, preexistente, fuera de alcance] `modelo` (cli.ts:64-65), `ficha` (cli.ts:95-96) y `comando` (cli.ts:81-82) aún descartan posicionales extra en silencio (misma clase de defecto). La tarjeta declara fuera de alcance cualquier otro cambio → **candidato a ticket propio** (nota: `comando` tiene 2º arg opcional legítimo; su guarda sería `> 2`).
- [NIT, preexistente] Sin parsing de flags en todo el CLI (errata 5: invocación posicional); fail-closed, sin cambio por este diff — solo se estrecha (`resolver --issuer x y` antes descartaba `y`; ahora exit 2).
- [NIT, preexistente] `usage()` hace `process.exit(2)` dentro del `try`, saltándose el `finally { db.destroy() }`; inofensivo (ninguna query corrió, pool lazy) y patrón idéntico en todos los casos.
- [NIT] Sin spec automatizada del conteo de args (verificado manualmente, anticipado por la tarjeta).

**Correcciones aplicables repetidas:** ninguna (no hubo hallazgos aplicables).

**Decisión: `proceed`** — el fix es correcto para todos los conteos y casos límite (verificado por ejecución, no por lectura), sin regresiones ni divergencia de contrato (§1 exit codes, §3.9 formas exactas; alineado con HTTP v0.controller y MCP server, que validan la misma invariante). Hallazgos restantes son preexistentes de otra clase de caso del switch, correctamente excluidos por el alcance.

## Estado

- No se hizo commit/push/merge/tag (el commit lo hace el controlador).
- Archivos tocados: `backend/src/cli.ts` (+ este reporte, ambos dentro del alcance declarado).

## Cierre del controlador (auditoría independiente, intento 1)

**Auditoría: APROBADA.** El reporte se verificó como afirmación, no como verdad:

- `git status --short` / `git diff --stat` / `git diff --check`: solo `backend/src/cli.ts` modificado (+3/−1); diff idéntico al descrito (guarda `rest.length ∉ {1,2} → usage()` antes del destructuring; comentario actualizado). Sin cambios fuera de alcance, sin secretos.
- Lectura de `cli.ts` completo: la guarda es exacta para los conteos del contrato §3.9; `usage()` emite `parametros_invalidos` por stderr y `exit 2` (contrato §1); `paramsResolverValidos` sigue cubriendo strings vacíos/solo espacios.
- Gates independientes (corridos por el controlador): `npm run build` ✓ · `npx eslint src/cli.ts` ✓ (sin salida) · `npm test` 15 suites / 140 tests ✓ · `python3 scripts/check_sizes.py` ✓ · `git diff --check` limpio ✓.
- DoD por ejecución (con `DATABASE_URL='postgresql:///escrubery?host=/tmp' node --import tsx src/cli.ts`): `resolver a b c` → exit 2 con `parametros_invalidos` ✓ · `resolver claude-sonnet-5-cowork` → exit 0, `resuelto:true` ✓ · `resolver qwen3.8-max https://dashscope.aliyuncs.com` → exit 0 ✓ · `resolver` (0 args) → exit 2 ✓.
- Ronda adversarial del ejecutor revisada: decisión `proceed` coherente; los LOW/NIT restantes son preexistentes y fuera de alcance.

**Commit del controlador:** `3105dbf261aff88c3312c1535810c9c8dfb7bde0` en `fix/resolver-args-extra` (solo `backend/src/cli.ts`; `.opencode/`, `.qwen/` no se commitean). **Sin push/merge/PR/tag** — pendientes de autorización del supervisor y el humano.

**Candidato a ticket propio (del adversarial):** mismo defecto de descarte silencioso de posicionales extra en los casos `modelo` (cli.ts:64-65), `ficha` (cli.ts:95-96) y `comando` (cli.ts:81-82; allí la guarda sería `> 2` por el filtro opcional legítimo).
