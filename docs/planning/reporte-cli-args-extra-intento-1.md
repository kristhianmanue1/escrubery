# Reporte: cli-args-extra (intento 1)

## Identidad

- Run: cli-args-extra-20260818-01 · Intento: 1 · Rama: `fix/cli-positional-args` · SHA base: `82ce086`
- Ejecutor: opencode (sesión `escrubery-opencode-resolver-args`)
- Tarjeta: `docs/planning/tarjeta-cli-args-extra-intento-1.md`
- Adversarial (modalidad A, archivo separado): `docs/planning/cli-args-extra-adversarial-intento-1.md`

## Cambio

Un único archivo: `backend/src/cli.ts` (+6/−0). El defecto LOW ya corregido en `resolver` (3105dbf) vivía en los otros casos posicionales: descartaban en silencio los args extra. Guardas de conteo añadidas antes del destructuring, siguiendo el patrón gemelo de `resolver` (guarda + comentario), y **conservando las guardas de contenido preexistentes** (necesarias: con conteo correcto, un string vacío `""` debe seguir siendo exit 2, no llegar a la consulta):

```ts
case 'modelo': {
  // exactamente 2 posicionales (contrato §1): 0, 1 o 3+ → uso inválido (exit 2)
  if (rest.length !== 2) usage();
  ...
case 'comando': {
  // 1 obligatorio + filtro opcional (contrato §1): 0 o 3+ → uso inválido (exit 2)
  if (rest.length === 0 || rest.length > 2) usage();
  ...
case 'ficha': {
  // exactamente 2 posicionales (contrato §1): 0, 1 o 3+ → uso inválido (exit 2)
  if (rest.length !== 2) usage();
```

`comando` usa `=== 0 || > 2` (no `!== 2`) porque su filtro es un opcional legítimo (contrato §1: `comando <cli> [filtro]`). `resolver` no se tocó (ya corregido en 3105dbf).

**Specs:** no existe suite del CLI (`cli.spec.ts` no existe; `cli.ts` ejecuta `main()` al importar y llama `process.exit`). La tarjeta (líneas 40-41) prevé DoD por ejecución directa — eso se hizo.

## Entorno de verificación

Worktree sin `backend/.env` (patrón del intento anterior). `node_modules` ya instalado. Comando exacto de todos los checks:

```bash
cd /Users/krisnova/www/aria/escrubery-wt-resolver-args/backend
DATABASE_URL='postgresql:///escrubery?host=/tmp' node --import tsx src/cli.ts <args>; echo $?
```

## Definition of Done — evidencia (comando → salida)

### modelo

| Invocación | Resultado |
|---|---|
| `modelo` (0 args) | exit 2, `{"error":{"codigo":"parametros_invalidos",...}}` por stderr, stdout vacío |
| `modelo anthropic` (1 arg) | exit 2, ídem |
| `modelo anthropic claude-sonnet-5 extra` (3 args) | exit 2, ídem |
| `modelo anthropic claude-sonnet-5` (2 válidos) | **exit 0**, `{"proveedor":"anthropic","modelo_id":"claude-sonnet-5","nombre_display":null,...}` |
| `modelo "" x` (string vacío) | exit 2 (guarda de contenido preservada) |

### ficha

| Invocación | Resultado |
|---|---|
| `ficha` (0) / `ficha cli` (1) / `ficha cli claude-code extra` (3) | exit 2, `parametros_invalidos` por stderr; stdout verificado vacío (0 bytes) en el caso de 3 args |
| `ficha cli claude-code` (2 válidos) | **exit 0**, `{"entidad":"cli","cli_producto":{"nombre":"claude-code","nombre_display":"Claude...` |

### comando

| Invocación | Resultado |
|---|---|
| `comando` (0 args) | exit 2 |
| `comando claude-code a b` (3 args) | exit 2 |
| `comando claude-code` (1 arg) | **exit 0**, JSON completo del CLI |
| `comando claude-code mcp` (2 args, con filtro) | **exit 0** y el filtro funciona: 17 comandos sin filtro → 1 (`claude mcp`) con filtro |
| `comando ""` (string vacío) | exit 2 (guarda de contenido preservada) |

### resolver (no regresión)

| Invocación | Resultado |
|---|---|
| `resolver claude-sonnet-5-cowork` (1 arg) | **exit 0** |
| `resolver a b c` (3 args) | exit 2 |

### Build / lint / tests / gates

```
$ cd backend && npm run build
> backend@0.2.0 build / nest build
(sin errores)

$ npx eslint src/cli.ts
(sin salida → sin errores)

$ npm test
Test Suites: 15 passed, 15 total
Tests:       140 passed, 140 total

$ python3 scripts/check_sizes.py   (desde la raíz del worktree)
check_sizes: OK — todos los archivos dentro del límite duro.

$ git diff --check
(limpio, exit 0)
$ git status --porcelain
 M backend/src/cli.ts            ← único archivo de código tocado
 M docs/planning/ESTADO_CONTROLADOR.md   ← modificación del controlador, no del ejecutor
```

## Ronda adversarial (modalidad A)

Subagente independiente (`general`, contexto fresco), verificación por ejecución propia: matriz completa 0/1/2/3/5 args por caso, strings vacíos, no-regresión de `resolver`/`listar`/`oficialidad`/`feedback`, búsqueda de consumidores con args en exceso (ninguno: `scripts/consultar` es passthrough, `vigilancia_diaria.sh` no usa `cli.ts`), eslint, `tsc --noEmit`, tests, gates.

- **Hallazgos aplicables: ninguno** (BLOCKER/HIGH/MED/LOW: 0).
- Preexistentes fuera de alcance (observaciones): `listar`/`oficialidad`/`feedback` aún descartan extras en silencio (LOW, candidato a ticket de seguimiento); args de solo espacios caen en `sin_datos` exit 1 (NIT); `process.exit` dentro del `try` salta el `finally` (NIT, patrón ya aprobado).
- **Decisión: `proceed`** (no bloqueante). Detalle completo en `docs/planning/cli-args-extra-adversarial-intento-1.md`.

## Estado

- No se hizo commit/push/merge/tag/release (commit: controlador tras auditoría).
- Archivos tocados por el ejecutor: `backend/src/cli.ts` (+ este reporte y el adversarial, dentro del alcance).
