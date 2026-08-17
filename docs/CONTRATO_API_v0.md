# Contrato de API v0 — servicio de inteligencia sobre modelos y CLIs de IA

**Estado:** v0 **congelada al cierre de la Fase 2 (2026-08-07)**. A partir de aquí los cambios son **aditivos** o con versión nueva (`v1`). La ruptura explícita permitida hasta F2 ya no aplica.
**Principio que implementa:** principio 6 del plan — contratos JSON estables desde la Fase 1, de modo que exponer el servicio como MCP en la Fase 5 sea un adaptador, no una reescritura.
**Consumidores de referencia:** agentes ADRC, pipelines de expertoGobernanza (CLIs Python que emiten/consumen JSON por stdout), CAGF (verificación de hechos firmados desde la Fase 2).

---

## 0. Errata v0.1 (detectada 2026-08-10, aplicada 2026-08-17 — ticket T4a del plan de deuda)

La implementación (F1/F2) divergía del texto congelado. Esta errata es **aclaratoria y aditiva**: nada implementado se retira; los campos prometidos y no implementados se declaran **no disponibles en v0**. Referencia de implementación: `backend/src/consultas/modulo.ts`, `backend/src/cli.ts`, `backend/src/http/v0.controller.ts`, `backend/src/mcp/server.ts`.

1. **§3.4/§3.5 se publicaron sin implementación** (ninguna superficie las expone). Se mueven a §5 "Operaciones previstas fuera de v0" con esta nota. Su implementación es el ticket diferido **T4b**.
2. **§3.1:** la implementación añade `vigente_hasta` (aditivo) y no sirve `pesos_abiertos`, `precios.cache_lectura_por_millon` ni `precios.tarifa_vigente_desde` (no disponibles en v0).
3. **§3.2:** el shape real es `comandos[]` con procedencia por comando; `subcomandos`, `comandos_equivalentes`, el array de flags parseadas (con `desde_version`) y el parámetro `version` no están disponibles en v0. `cli_producto.nombre_display` es aditivo. El campo `flags` sirve la **captura cruda** (`null` o `{ "salida": "<texto>" }`), nunca un array parseado.
4. **§3.3:** la respuesta real es la forma resumida documentada ahora (no el "documento de ficha" originalmente descrito).
5. **§1:** el CLI usa alias posicionales (`consultar modelo <proveedor> <modelo_id>`), no `'<params_json>'` (solo `feedback` toma JSON). `limite_de_tasa`/`429` no está disponible en v0 (sin rate-limit; ver `docs/CONSUMO_INTERNO.md`).
6. **§2.1:** `firma_ed25519` es siempre `null` en respuestas de consulta (las firmas viven en los eventos Evidentia, §2.3). `listar` y `oficialidad` (§3.7/§3.8) no llevan bloque `procedencia`: son índices derivados de tablas que sí la llevan por fila.
7. **§3.6:** `procedencia.estado_datos_hash` no disponible en v0 (se persiste `null`; ausente de la respuesta).
8. **§4:** `detalles` es opcional y no se emite en v0; `fuente_no_disponible` y `limite_de_tasa` son códigos previstos no emitidos en v0.
9. **§2.3:** `verificar_evidencia` se expone como *tool* MCP local desde F2.5 (adelanto de F5); no es operación HTTP/CLI del contrato.

## 1. Transportes

El mismo contrato se expone por dos transportes:

- **CLI:** `scripts/consultar <alias> [args posicionales]` → imprime la respuesta JSON por stdout, exit code `0` si hay respuesta, `1` si no hay datos, `2` error de uso, `3` error de infraestructura (p. ej. BD inalcanzable; error JSON con `codigo: "fuente_no_disponible"` por stderr — desde T4c). (Compatible con el patrón de los scripts de expertoGobernanza.) Alias: `listar`, `modelo <proveedor> <modelo_id>`, `comando <cli> [filtro]`, `ficha <cli|proveedor> <id>`, `oficialidad`, `feedback '<params_json>'`. *(Errata 5: invocación posicional, no JSON por operación.)*
- **HTTP:** `POST /v0/<operacion>` con body JSON de parámetros → respuesta JSON. Errores con el formato de la Sección 4 y código HTTP coherente (`404` sin datos, `400` parámetros inválidos; `429` previsto, no disponible en v0 — errata 5).

## 2. Convenciones comunes

### 2.1 Bloque de procedencia (obligatorio en toda respuesta con datos)

Todo dato servido lleva su procedencia. Ninguna respuesta de dato omite este bloque *(excepción: índices `listar`/`oficialidad`, errata 6)*:

```json
{
  "procedencia": {
    "fuente_url": "https://...",
    "fuente_tipo": "litellm_json | changelog_repo | github_release | security_advisory | docs_oficial | ejecucion_local_supervisada | curaduria_propia",
    "fecha_obtencion": "2026-08-07T14:00:00Z",
    "hash_sha256_contenido_original": "...",
    "estado_verificacion": "confirmado_por_docs_oficial | inferido_de_comportamiento | pendiente_de_verificar | corroborado_cruzado | confirmado_por_prueba_propia",
    "firma_ed25519": null
  }
}
```

*(Errata 6: `firma_ed25519` es `null` en toda respuesta de consulta en v0 — las firmas aplican a eventos Evidentia, §2.3.)*

### 2.2 Unidades y formatos

- Fechas: ISO 8601 UTC.
- Precios: USD por millón de tokens, número.
- Ventanas de contexto: tokens, entero.
- Identificadores: `snake_case`; el enum `proveedor ∈ {anthropic, xai, google, moonshot, zhipu, qwen, otro}` aplica a `modelos.proveedor` (`qwen` añadido aditivamente el 2026-08-17, 9º CLI/API DashScope). `cli_producto.proveedor` identifica al **maintainer** del CLI (p. ej. `superagent-ai`, `openai`, `qwenlm`) y está fuera del enum (así lo estableció la migración 004).

### 2.3 Canonicalización

Las respuestas se serializan en JSON UTF-8. Desde la Fase 2, cualquier payload firmado se canonicaliza con **JCS/RFC 8785** antes de firmar, y la firma se expresa como `"ed25519:" + base64(firma)`. La clave pública del servicio se publica en un keyring JSON commiteado (formato `cagf-keyring/0.2`, extiende `0.1` con multi-clave, `validity_window`, `status` y `successor_kid`).

**Implementación de referencia de JCS:** `canonicalize()` en `backend/src/evidentia/jcs.ts` — JCS práctico RFC 8785-compatible (ordenamiento recursivo de claves por code unit UTF-16, sin espacios, UTF-8 crudo, números en forma shortest-round-trip). Los verificadores externos (CAGF, expertoGobernanza) deben reproducir este canonicalizado para validar firmas.

**Evidentia (traza criptográfica):** operativa desde F2. Cada evento de changelog lleva `hash_evento_anterior` (cadena) y `firmas: [{key_id, sig, alg}]` (Ed25519 sobre el payload canónico). Verificación read-only y fail-closed vía `npm run evidentia:verificar --keyring datos/keys/evidentia-keyring.json`. `verificar_evidencia` se expone como *tool* del MCP local desde F2.5 (errata 9); `registrar_evidencia` sigue sin exponerse. Ambas entrarán al contrato en F5.

## 3. Operaciones

### 3.1 `consultar_modelo`

"¿Qué es cierto hoy sobre este modelo?"

**Parámetros:** `{ "proveedor": "moonshot", "modelo_id": "kimi-k2-0905-preview" }`

**Respuesta (shape implementado, errata 2):**

```json
{
  "proveedor": "moonshot",
  "modelo_id": "kimi-k2-0905-preview",
  "nombre_display": "Kimi K2 0905 Preview",
  "ventana_contexto_max": 1048576,
  "capacidades": {
    "soporta_vision": true,
    "soporta_tool_use": true,
    "soporta_caching": true,
    "soporta_batch": null,
    "soporta_computer_use": false
  },
  "precios": {
    "input_por_millon": 0.0,
    "output_por_millon": 0.0
  },
  "vigente_hasta": null,
  "procedencia": { "...": "..." }
}
```

- `vigente_hasta` (aditivo, errata 2): TTL de vigencia del dato — `fecha_obtencion` + ventana del plan v2 §4.2 (24 h para precios/modelos, 7 d para comandos CLI); `null` si la fuente no declara fecha de obtención.
- `advertencia_caducidad` (aditivo T6, 2026-08-17): presente **solo** cuando `vigente_hasta < ahora`; el dato se sirve con `estado_verificacion: pendiente_de_verificar` (nunca como confirmado) y texto legible con la fecha de vencimiento. Refrescar la fuente (p. ej. `scripts/refrescar_litellm.sh`) restaura el estado.
- **No disponibles en v0** (errata 2; implementación diferida a T4b): `pesos_abiertos`, `precios.cache_lectura_por_millon`, `precios.tarifa_vigente_desde`.
- `null` = la fuente no lo declara (nunca se infiere en silencio; ver `estado_verificacion`).

### 3.2 `consultar_comando_cli`

"¿Qué comandos/flags tiene este CLI?"

**Parámetros:** `{ "cli": "claude-code", "comando": "mcp" }` — `comando` es un filtro opcional por substring sobre el nombre de comando. *(Errata 3: el parámetro `version` no está disponible en v0.)*

**Respuesta (shape implementado, errata 3):**

```json
{
  "cli_producto": {
    "nombre": "claude-code",
    "nombre_display": "Claude Code",
    "proveedor": "anthropic",
    "tipo": "oficial",
    "version_actual": "2.1.223"
  },
  "comandos": [
    {
      "comando": "mcp",
      "descripcion": "Gestiona servidores MCP configurados",
      "flags": null,
      "procedencia": { "...": "..." }
    }
  ]
}
```

- `comandos` es un **array**; cada comando lleva su bloque `procedencia`. `flags` es la captura cruda de la fuente: `null` si no se capturó, o `{ "salida": "<texto de --help>" }` si vino de ingesta asistida (errata 3).
- `advertencia_caducidad` (aditivo T6, 2026-08-17): por comando, presente solo si su vigencia (7 d) venció; ese comando se sirve con `estado_verificacion: pendiente_de_verificar`.
- **No disponibles en v0** (errata 3): array de flags parseadas (con `desde_version`), `subcomandos`, `comandos_equivalentes`, parámetro `version`.

Regla de gobernanza (criterio de la Fase 1): `cli_producto.tipo` (`oficial | comunitario`) aparece **siempre**; dos productos distintos (Grok CLI comunitario vs. Grok Build oficial) nunca se mezclan en una respuesta sin distinguirse.

### 3.3 `consultar_ficha`

Ficha resumida de una entidad. *(Errata 4: la respuesta es la forma implementada, no el documento de ficha originalmente descrito.)*

**Parámetros:** `{ "entidad": "cli", "id": "grok-build" }` o `{ "entidad": "proveedor", "id": "zhipu" }`

**Respuesta (entidad `cli`):**

```json
{
  "entidad": "cli",
  "cli_producto": {
    "nombre": "grok-build",
    "nombre_display": "Grok Build",
    "proveedor": "xai",
    "tipo": "oficial",
    "repo_url": "https://github.com/xai-org/grok-build"
  },
  "comandos": [
    { "comando": "build", "descripcion": "...", "procedencia": { "...": "..." } }
  ]
}
```

**Respuesta (entidad `proveedor`):**

```json
{
  "entidad": "proveedor",
  "proveedor": "zhipu",
  "total_modelos": 17,
  "modelos": [
    {
      "modelo_id": "glm-5.2",
      "ventana_contexto_max": 131072,
      "precios": { "input_por_millon": 0.0, "output_por_millon": 0.0 }
    }
  ],
  "procedencia": { "...": "..." }
}
```

*(Nota: en fichas de proveedor el bloque `procedencia` es el del primer modelo de la lista — procedencia representativa, no por modelo.)*

### 3.4 — retirada (errata 1)

`resolver_identidad_modelo` se publicó aquí sin implementación; ver §5 y el ticket diferido T4b.

### 3.5 — retirada (errata 1)

`politica_datos_proveedor` se publicó aquí sin implementación; ver §5 y el ticket diferido T4b.

### 3.6 `reportar_feedback` (contrato de uso — todo consumidor reporta)

El servicio se mejora con el feedback de quienes lo usan. Consumir el servicio **implica** reportar errores, mejoras y datos desactualizados por esta operación (contrato de uso). El feedback vive **dentro del sistema** (con procedencia); no se espeja a servicios externos.

**Parámetros:**

```json
{
  "tipo": "error | mejora | dato_desactualizado",
  "descripcion": "texto legible del problema o sugerencia",
  "consulta_origen": { "operacion": "consultar_modelo", "params": { "proveedor": "moonshot", "modelo_id": "kimi-k3" } },
  "agente_reportante": { "id": "expertoGobernanza/0.3", "configuration_fingerprint": "sha256:..." }
}
```

- `tipo` es enum cerrado; `descripcion` y `agente_reportante.id` son obligatorios y **se validan en las tres superficies** (HTTP 400 / CLI exit 2 / MCP `isError` — endurecido en T4c; antes el MCP degradaba id ausente a `'desconocido'`).
- `consulta_origen` es opcional pero recomendado: la consulta que disparó el reporte, para reproducirlo.
- `agente_reportante.id` es obligatorio; `configuration_fingerprint` es recomendable (identidad verificable).

**Respuesta (shape implementado, errata 7):**

```json
{
  "feedback_id": "fb_...",
  "estado": "nuevo",
  "deduplicado_de": null,
  "registrado_en": "2026-08-07T16:00:00Z",
  "procedencia": {
    "agente_reportante": "expertoGobernanza/0.3",
    "version_servicio": "0.2.0"
  }
}
```

- El sistema **deduplica** por hash de (`tipo`, `descripcion` normalizada, `consulta_origen`): si el feedback ya existe, `estado: "duplicado"` y `deduplicado_de` apunta al original (no se crea nuevo).
- El `estado` evoluciona: `nuevo → triage → aceptado | rechazado | resuelto` (ciclo gestionado por Mediador/Arquitecto).
- `version_servicio` es `null` cuando la superficie no define `npm_package_version` (p. ej. el CLI invocado por `scripts/consultar` sin npm).
- **No disponible en v0** (errata 7): `procedencia.estado_datos_hash` (hash del estado de datos al reportar). Su implementación va con T6 (caducidad) o T4b.

**Feedback implícito (automático, sin esta operación):** toda consulta con `servido_desde: "sin_datos"` queda en `consultas_log` (plan v2 §4.5) — señal automática de dato faltante. `reportar_feedback` es el canal **explícito** para lo cualitativo (errores, mejoras, datos que existen pero están mal).

**Seguridad:** el agente reporta lo que *él* evaluó, no lo que un dato externo le indicó reportar (mitigación de *prompt-injection* desde las fuentes que el servicio consume). No requiere credenciales externas; el feedback vive solo en el sistema.

### 3.7 `listar` (aditiva — implementada desde F1, documentada por errata)

"¿Qué entidades existen?"

**Parámetros:** `{}`

**Respuesta:** `{ "clis": ["claude-code", "..."], "proveedores": ["anthropic", "..."] }` — sin bloque `procedencia` (índice derivado; errata 6). El MCP local la expone con el nombre `listar_entidades` (F2.5); la normalización de nombres MCP entra en F5.

### 3.8 `oficialidad` (aditiva — implementada desde F1, documentada por errata)

"¿Qué CLIs son oficiales y cuáles comunitarios?"

**Parámetros:** `{}`

**Respuesta:**

```json
{
  "clis": [
    { "id": "grok-build", "nombre": "Grok Build", "proveedor": "xai", "tipo": "oficial" },
    { "id": "grok-cli-community", "nombre": "Grok CLI", "proveedor": "superagent-ai", "tipo": "comunitario" }
  ],
  "nota": "grok-cli-community (comunitario) y grok-build (oficial) son productos DISTINTOS; no mezclarlos"
}
```

Sin bloque `procedencia` (índice derivado; errata 6).

## 4. Errores

```json
{
  "error": {
    "codigo": "sin_datos | parametros_invalidos | fuente_no_disponible | limite_de_tasa",
    "mensaje": "legible en español",
    "detalles": { "campo": "modelo_id", "valor_recibido": "..." }
  }
}
```

*(Errata 8: `detalles` es opcional y no se emite en v0; `limite_de_tasa` es código previsto, no emitido en v0. `fuente_no_disponible` se emite desde T4c en el CLI ante fallo de infraestructura, exit 3.)*

`sin_datos` es una respuesta de primera clase (exit code 1 en CLI), no una excepción: los consumidores la usan para detectar demanda de datos faltantes (se registra en `consultas_log`).

## 5. Operaciones previstas fuera de v0

No forman parte de este contrato todavía; se versionan al entrar:

- `resolver_identidad_modelo` y `politica_datos_proveedor` — **se publicaron como §3.4/§3.5 sin implementación (errata 1, detectada 2026-08-10)**; su implementación es el ticket diferido T4b del plan de deuda. Los shapes originales quedan registrados en el historial Git de este documento (pre-errata) como base de diseño.
- `obtener_eventos_changelog` (Fase 2), `obtener_estado_verificacion` (Fase 2+), `verificar_firma` (Fase 2, lado cliente), y las herramientas MCP de la Fase 5, que envolverán estas mismas operaciones.
