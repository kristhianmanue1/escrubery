# Tarjeta: incorporación del 8º proveedor `typesafe` (System One / Jev)

**Fecha:** 2026-10-14 · **Clase:** Bounded (ticket único, alcance cerrado, verificación por ejecución)
**Estado:** ejecutado y verificado; cierre propuesto al Mediador.
**Origen:** análisis Atria/TypeSafe del 2026-10-14 (`docs/investigacion/Analisis_Incorporacion_Atria_Typesafe.md`) + decreto «adelante con recomendaciones».

## Alcance

Alta aditiva del proveedor `typesafe` (modelo de decisión estructurada Jev,
`POST /v1/systemone`, primitivas Choice/Score/Noul) por el camino canónico:
fuente primaria LiteLLM → generador → ingesta → consultas. Incluye política de
datos, curaduría de identidad con aliases y poller propio de Atria (recomendación
#3 del mismo decreto).

## Cambios

1. **Generador** (`scripts/generar_fichas_modelos.py`): `typesafe` en
   PROVEEDORES; filtro de modos ampliado aditivamente a `evaluation`; campo
   nuevo `modo` por modelo (de la fuente LiteLLM; explícito en todas las
   fichas).
2. **Mig `016_typesafe_modo.sql`**: enum `modelos.proveedor` += `typesafe`
   (patrón 010/015) + columna `modo TEXT NULL`.
3. **Ingesta** (`ingestar.ts`, `schema.ts`): campo `modo` en interfaz, insert y
   upsert.
4. **Consultas** (`consultas/modulo.ts`): `consultar_modelo` sirve `modo`.
5. **Contrato** (`CONTRATO_API_v0.md`): enum §2.2 += `typesafe`; **errata 10**
   aditiva — `modo` en §2.1, con la semántica honesta: en `evaluation`,
   `output_por_millon: 0` es facturación por-input-only de la fuente, no
   gratuidad limitada.
6. **Política de datos** (`politica_datos_proveedores.json`): entrada
   `typesafe` — `entrena_con_contenido: false` **confirmado por docs oficiales**
   (Privacy: "We will not train or fine tune any... models on your prompts or
   other Input"; models: "Jev is not trained on customer requests or
   responses") + ZDR enterprise. 4 capturas con hash en
   `datos/fuentes/politicas-proveedores/typesafe-*.html`.
7. **Curaduría de identidad** (`identidad_modelos.json`): 3 entradas
   `typesafe/jev-*` (familia `system-one`, pesos cerrados) + aliases oficiales
   `jev-latest`/`jev-preview` → `jev-1.13.0` con las advertencias de movilidad
   del alias. Self-hash re-sellado (algoritmo JSON.stringify replicado en node).
8. **Poller `vigilar_atria.py`** + integración en `vigilancia_diaria.sh`
   (estado incluye `atria`; exit 10 si dispara): páginas legales 404→200,
   presencia de Atria en LiteLLM, hash del landing.
9. **Docs**: README (184 modelos / 8 proveedores), VIGILANCIA.md.

## Verificación (por ejecución)

- Regeneración con **descarga fresca** de LiteLLM: 8 fichas, 184 modelos
  (drift upstream declarado: google 39→40, qwen 42→43; el resto estable).
- `db:migrate` aplicó `016`; ingesta limpia: 184 modelos, 20 filas con curaduría.
- E2E: `consultar modelo typesafe jev-1.13.0` → `modo: "evaluation"`, precios
  0.042/0, familia `system-one`, procedencia `confirmado_por_docs_oficial`.
- `consultar resolver jev-latest` → `resuelto: true` → `jev-1.13.0` con las
  advertencias de curaduría; el ingesta aceptó el self-hash re-sellado
  (b3d71d3b…).
- Regresiones: chat models sirven `modo: "chat"`; meta intacto (precios,
  aliases, resolver).
- Tests: **278/278** (2 goldens actualizados por el campo aditivo + 1 test
  nuevo de `modo: evaluation`); lint 0 errores (3 warnings preexistentes en
  `auth.spec.ts`); `check_sizes` OK; `bash -n` vigilancia OK; poller atria
  baseline exit 0 (legales 404, litellm=no, landing sellado).

## Límites declarados

- `ventana_contexto_max` de Jev: **null** en BD — LiteLLM no lo declara y la
  capa de identidad no tiene columna para contexto (los 64K de docs quedan en
  el análisis y en la ficha JSON vía `fuente_precio`, no en BD). Ampliar la
  capa de identidad sería otro contrato.
- `jev-preview` hoy apunta al mismo modelo que `jev-latest`; cuando TypeSafe
  publique un preview real, el alias se moverá en su fuente y el resolver
  seguirá sirviendo el destino curado hasta que se actualice.
- El poller de Atria NO incorpora nada por sí solo: solo canta el disparador
  (la incorporación plena es decreto del Mediador con su propio ticket).
