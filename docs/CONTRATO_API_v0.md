# Contrato de API v0 — servicio de inteligencia sobre modelos y CLIs de IA

**Estado:** propuesta v0. Versionado explícitamente: **se permite ruptura de compatibilidad hasta el cierre de la Fase 2**; a partir de ahí los cambios son aditivos o con versión nueva (`v1`).
**Principio que implementa:** principio 6 del plan — contratos JSON estables desde la Fase 1, de modo que exponer el servicio como MCP en la Fase 5 sea un adaptador, no una reescritura.
**Consumidores de referencia:** agentes ADRC, pipelines de expertoGobernanza (CLIs Python que emiten/consumen JSON por stdout), CAGF (verificación de hechos firmados desde la Fase 2).

---

## 1. Transportes

El mismo contrato se expone por dos transportes:

- **CLI:** `consultar <operacion> '<params_json>'` → imprime la respuesta JSON por stdout, exit code `0` si hay respuesta, `1` si no hay datos, `2` error de uso. (Compatible con el patrón de los scripts de expertoGobernanza.)
- **HTTP:** `POST /v0/<operacion>` con body JSON de parámetros → respuesta JSON. Errores con el formato de la Sección 4 y código HTTP coherente (`404` sin datos, `400` parámetros inválidos, `429` límite de tasa).

## 2. Convenciones comunes

### 2.1 Bloque de procedencia (obligatorio en toda respuesta)

Todo dato servido lleva su procedencia. Ninguna respuesta omite este bloque:

```json
{
  "procedencia": {
    "fuente_url": "https://...",
    "fuente_tipo": "litellm_json | changelog_repo | github_release | security_advisory | docs_oficial | ejecucion_local_supervisada | curaduria_propia",
    "fecha_obtencion": "2026-08-07T14:00:00Z",
    "hash_sha256_contenido_original": "...",
    "estado_verificacion": "confirmado_por_docs_oficial | inferido_de_comportamiento | pendiente_de_verificar | corroborado_cruzado | confirmado_por_prueba_propia",
    "firma_ed25519": "ed25519:... (presente desde la Fase 2; null antes)"
  }
}
```

### 2.2 Unidades y formatos

- Fechas: ISO 8601 UTC.
- Precios: USD por millón de tokens, número.
- Ventanas de contexto: tokens, entero.
- Identificadores: `snake_case`; `proveedor ∈ {anthropic, xai, google, moonshot, zhipu, otro}`.

### 2.3 Canonicalización

Las respuestas se serializan en JSON UTF-8. Desde la Fase 2, cualquier payload firmado se canonicaliza con **JCS/RFC 8785** antes de firmar, y la firma se expresa como `"ed25519:" + base64(firma)`. La clave pública del servicio se publica en un keyring JSON commiteado (formato compatible con `cagf-keyring/0.1`).

## 3. Operaciones

### 3.1 `consultar_modelo`

"¿Qué es cierto hoy sobre este modelo?"

**Parámetros:** `{ "proveedor": "moonshot", "modelo_id": "kimi-k3" }`

**Respuesta:**

```json
{
  "proveedor": "moonshot",
  "modelo_id": "kimi-k3",
  "nombre_display": "Kimi K3",
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
    "output_por_millon": 0.0,
    "cache_lectura_por_millon": null,
    "tarifa_vigente_desde": "2026-08-01"
  },
  "pesos_abiertos": true,
  "procedencia": { "...": "..." }
}
```

`null` = la fuente no lo declara (nunca se infiere en silencio; ver `estado_verificacion`).

### 3.2 `consultar_comando_cli`

"¿Qué comandos/flags tiene este CLI (o este subcomando)?"

**Parámetros:** `{ "cli": "claude-code", "comando": "mcp", "version": null }` (`version: null` = versión más reciente conocida)

**Respuesta:**

```json
{
  "cli_producto": {
    "nombre": "claude-code",
    "proveedor": "anthropic",
    "tipo": "oficial",
    "version_actual": "2.1.223"
  },
  "comando": "mcp",
  "descripcion": "Gestiona servidores MCP configurados",
  "flags": [
    { "flag": "--json", "descripcion": "Salida en JSON", "desde_version": "2.1.200" }
  ],
  "subcomandos": ["add", "list", "remove", "get"],
  "comandos_equivalentes": [
    { "cli": "kimi-code", "comando": "mcp", "nota": "sintaxis equivalente" }
  ],
  "procedencia": { "...": "..." }
}
```

Regla de gobernanza (criterio de la Fase 1): `cli_producto.tipo` (`oficial | comunitario`) aparece **siempre**; dos productos distintos (Grok CLI comunitario vs. Grok Build oficial) nunca se mezclan en una respuesta sin distinguirse.

### 3.3 `consultar_ficha`

Ficha completa de una entidad (la Ficha v0 de la Fase 0 es el caso base de esta operación).

**Parámetros:** `{ "entidad": "cli", "id": "grok-build" }` o `{ "entidad": "proveedor", "id": "zhipu" }`

**Respuesta:** documento JSON de la ficha con sus secciones (identidad, fuentes de monitoreo, notas de gobernanza/riesgo para CLIs; modelos y capacidades para proveedores) + `procedencia` por sección.

### 3.4 `resolver_identidad_modelo` (nuevo en v2 — necesidad de expertoGobernanza, ADR-0002)

Registro externo, no autodeclarado: resuelve un identificador declarado por un agente/CLI a la identidad canónica verificada.

**Parámetros:** `{ "issuer_id": "claude-sonnet-5-cowork" }` o `{ "modelo_id": "glm-5.2", "endpoint": "https://api.example/v1" }`

**Respuesta:**

```json
{
  "resuelto": true,
  "identidad_canonica": {
    "proveedor": "zhipu",
    "modelo_id": "glm-5.2",
    "familia_arquitectura": "glm",
    "pesos_abiertos": true
  },
  "advertencias": [
    "issuer_id incluye sufijo de harness ('-cowork'); la identidad del modelo es la de la API subyacente"
  ],
  "configuration_fingerprint_sugerido": "sha256:...",
  "procedencia": { "...": "..." }
}
```

`familia_arquitectura` es el campo que permite a un quórum multi-proveedor verificar **decorrelación real** (dos CLIs distintos sobre el mismo modelo no decorrelacionan). Si el identificador no se puede resolver, `resuelto: false` y `estado_verificacion: pendiente_de_verificar` — nunca se adivina.

### 3.5 `politica_datos_proveedor` (nuevo en v2 — necesidad del router de expertoGobernanza)

Metadatos de política de datos por proveedor, curaduría propia (LiteLLM no los cubre).

**Parámetros:** `{ "proveedor": "xai" }`

**Respuesta:**

```json
{
  "proveedor": "xai",
  "retencion": {
    "entrena_con_datos_api": null,
    "retencion_dias": null,
    "opcion_sin_retencion": null
  },
  "transferencia": {
    "jurisdiccion_principal": "US",
    "notas": "..."
  },
  "avisos": [
    { "tipo": "incidente_seguridad", "resumen": "...", "fecha": "2026-07-..." }
  ],
  "procedencia": { "...": "..." }
}
```

`null` = no documentado. El consumidor decide bajo su propia política (p. ej. default-deny): el servicio informa, no autoriza.

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

`sin_datos` es una respuesta de primera clase (exit code 1 en CLI), no una excepción: los consumidores la usan para detectar demanda de datos faltantes (se registra en `consultas_log`).

## 5. Operaciones previstas fuera de v0

No forman parte de este contrato todavía; se versionan al entrar:

- `obtener_eventos_changelog` (Fase 2), `obtener_estado_verificacion` (Fase 2+), `verificar_firma` (Fase 2, lado cliente), y las herramientas MCP de la Fase 5, que envolverán estas mismas operaciones.
