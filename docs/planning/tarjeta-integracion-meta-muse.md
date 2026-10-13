# Tarjeta: integración familia Meta/Muse (proveedor `meta` + CLI `muse-code`)

**Fecha:** 2026-10-13 · **Clase:** Bounded (cambios aditivos alineados al precedente `010_qwen_proveedor.sql`) · **Estado:** ejecutado, pendiente adversarial + decreto de cierre

**Disparador/autorización:** decreto del Mediador («toda la familia, adelante con toda la integración») tras investigación verificada (docs oficiales Meta + LiteLLM vivo + npm registry).

## Alcance (DoD del plan de sesión)

1. **T1 generador:** `meta` en `PROVEEDORES` de `scripts/generar_fichas_modelos.py` + regeneración con descarga fresca.
   Check: `consultar ficha proveedor meta` → 6 modelos (spark 1.1/1.2/1.3 + 2 contributor + wonder 1.0); hash fuente = hash de la descarga viva.
2. **T2 BD:** migración aditiva `015_meta_proveedor.sql` (CHECK de modelos + `'meta'`) + ingesta.
   Check: `db:migrate` aplica; `db:ingestar` reporta 180 modelos; `cli modelo meta muse-wonder-1.0` sirve con procedencia.
3. **T3 curaduría identidad:** familia muse completa (8 entradas `meta/*`), 2 aliases Contributor→identidad canónica, endpoint `https://api.meta.ai`; re-sellado del self-hash (convención verificada contra el hash previo antes de editar).
   Check: claves canónicas validadas; `cli resolver muse-spark-1.3-contributor` resuelve con advertencia de gobernanza.
4. **T4 ficha CLI:** `datos/fichas/clis/muse-code.json` (10 comandos documentados, `repo_url: null` — binario cerrado) + capturas crudas con hash en `datos/fuentes/muse-code/`.
   Check: `cli ficha cli muse-code` desde BD con procedencia por comando.
5. **T5 gates:** `bash scripts/ci_local.sh` VERDE (277 tests + tamaños + divergencia).

## Hallazgo del camino (defecto preexistente, arreglado aquí)

`db:ingestar` estaba **roto desde H7** (2026-08-22): `aplicarCuraduriaIdentidad` lanzaba `esquema desconocido` con cualquier JSON de `datos/fichas/curaduria/` que no fuera de identidad (`assurance_*`, `integracion_*` conviven desde H7). Nadie lo había notado porque la última ingesta precede a esos archivos. Fix mínimo: saltar capas no-identidad (`continue`), conservando el gate fail-closed de self-hash para las de identidad. Deuda relacionada (fuera de alcance): `modelos` retiene filas antiguas del catálogo (245 filas vs 180 vigentes) — lo gobierna la caducidad (mig 008/009), no la ingesta.

## Gobernanza declarada

- **No-chat de la familia** (muse-image, muse-voice-transcribe, sam-3.1): fuera de la ficha generada por diseño del contrato (precios por token chat; LiteLLM solo los declara en modos no-chat o no los declara). Documentados en curaduría con `pesos_abiertos: false` y fuente. **Muse Glimmer** (30B, Apache-2.0, open-weight) documentado en curaduría con `pesos_abiertos: true`.
- **Advertencia de identidad:** paquete npm `muse` (2011) NO es este producto; adaptadores comunitarios (opencode-muse-code, ACP) nunca se mezclan con el oficial.
- **Vigilancia:** CLI cerrado sin releases GitHub → poller GitHub no aplica; changelog en docs (limitación declarada en la ficha). Señal proxy posible: releases npm de `@muse-code/sdk`.
- **D1 (ToS) pendiente para muse-code:** modo Contributor ON por defecto en suscripciones (el contenido entrena a Meta). Sin ejecución activa F3 hasta curaduría ToS.
