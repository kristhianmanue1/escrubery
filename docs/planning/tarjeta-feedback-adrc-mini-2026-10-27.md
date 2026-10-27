# Tarjeta: feedback adrc-mini — alta de consumidor, aliases de identidad y 9º proveedor `openai`

**Fecha:** 2026-10-27 · **Clase:** Bounded (ticket único, alcance cerrado, verificación por ejecución)
**Estado:** ejecutado y verificado.
**Origen:** 3 feedbacks de `adrc-mini/0.2.0` (fb_10, fb_11, fb_12, 2026-10-27, canal formal §3.6) + decreto del Mediador «adelante con propuestas» (misma fecha). Primer consumidor real del resolver.

## Alcance

1. **Triaje fb_10/11/12** (contrato §3.6: `nuevo → triage → resuelto|aceptado`), con verificación de reclamos por ejecución.
2. **fb_12 — alta de consumidor:** adrc-mini (`~/www/adrc-mini`) consume `resolver_identidad_modelo` para decorrelación de revisores por `familia_arquitectura`. Documentado en `docs/CONSUMO_INTERNO.md`.
3. **fb_10 — capa de identidad:** aliases `identidad_alias` + `familia_arquitectura` para los identificadores reportados (el catálogo YA los tiene: zhipu `glm-5.3`/`glm-5.3-flash` y anthropic `claude-opus-5-5`/`claude-sonnet-5-5` en fichas 2026-10-14 — reclamo del feedback verificado verdadero).
4. **fb_11 — 9º proveedor `openai`:** camino canónico typesafe/meta: generador → mig `017` (enum aditivo) → regeneración con descarga fresca → ingesta → politica_datos → curaduría familia `gpt` + aliases.

## Cambios

1. `scripts/generar_fichas_modelos.py`: `"openai": "openai"` en PROVEEDORES.
2. `backend/db/migrations/017_openai_proveedor.sql`: enum `modelos.proveedor` += `'openai'` (patrón 015/016).
3. `datos/fichas/curaduria/identidad_modelos.json`: familia `glm` para `zhipu/glm-5.3` y `zhipu/glm-5.3-flash`; familia `claude` para `anthropic/claude-opus-5-5` y `anthropic/claude-sonnet-5-5`; familia `gpt` para los modelos openai declarados por la fuente; aliases: `zai-coding-plan/glm-5.3`, `opencode/glm-5.3`, `glm-5.3`, `glm-5.3-flash`, `claude-opus-5-5`, `claude-sonnet-5-5` + bare aliases de los modelos `gpt` solicitados. Self-hash re-sellado.
4. `datos/fichas/curaduria/politica_datos_proveedores.json`: entrada `openai` (captura de fuente primaria con hash; si la fuente no es capturable → `null` con causa, patrón xai).
5. `docs/CONSUMO_INTERNO.md` + `README.md`: consumidor adrc-mini y conteos frescos.
6. `bitacora_ciclos.md` + estados de feedback actualizados con evidencia.

## Verificación (por ejecución)

- Matriz resolver: los issuer_id de fb_10 → `resuelto: true` con `familia_arquitectura` correcta; `consultar modelo openai gpt-6.1-sol` → ficha con precios y procedencia.
- Regresiones: meta/typesafe/jev intactos; `consultar listar` muestra 9 proveedores.
- Gates: `npm test` verde (goldens actualizados si aplica), lint, `check_sizes`, divergencia opencode.

## Límites declarados

- **`zai-coding-plan/glm-5.3-highspeed`:** sin alias si ninguna fuente primaria declara "highspeed" — no se infiere `highspeed → flash` (regla dura #4). Queda `sin_datos` y adrc-mini lo cubre con su política de familia de respaldo (así lo declara fb_12).
- **`gpt-6.1-terra`:** reportado por adrc-mini (models_cache de codex) pero NO declarado por la fuente LiteLLM → sin alta; entra cuando la fuente lo declare.
- Solo se curan los identificadores solicitados; brechas vecinas (p. ej. `familia_arquitectura` de `glm-5.2`, `claude-opus-5`) quedan como residuales, no en este alcance.
- La regeneración de las 9 fichas con descarga fresca puede traer drift upstream (se declara, patrón 2026-10-13).
