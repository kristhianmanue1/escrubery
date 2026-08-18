-- 013_campos_identidad.sql — T4b-T0 (plan post-v0.3.0, H5): campos pendientes
-- de la errata 2 del contrato + soporte de identidad.
-- precio_cache_lectura_por_millon: YA existe en las fichas generadas (LiteLLM);
--   la ingesta lo cargaba a ningún sitio (errata 2: "no disponible en v0").
-- pesos_abiertos / familia_arquitectura: requeridos por el shape original de
--   resolver_identidad_modelo (contrato §5, ADR-0002). LiteLLM no los cubre:
--   los llena la capa de curaduría (datos/fichas/curaduria/), nunca la inferencia.
-- curaduria_json: procedencia de la curaduría aplicada a la fila — separada de
--   la procedencia LiteLLM de la fila (precios/contexto), que queda intacta.
ALTER TABLE modelos ADD COLUMN IF NOT EXISTS precio_cache_lectura_por_millon NUMERIC(12, 6);
ALTER TABLE modelos ADD COLUMN IF NOT EXISTS pesos_abiertos BOOLEAN;
ALTER TABLE modelos ADD COLUMN IF NOT EXISTS familia_arquitectura TEXT;
ALTER TABLE modelos ADD COLUMN IF NOT EXISTS curaduria_json JSONB;
