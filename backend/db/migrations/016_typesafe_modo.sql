-- 016_typesafe_modo.sql — 8º proveedor typesafe (System One / Jev) + columna
-- `modo`. Cambios aditivos (2026-10-14, ticket typesafe):
--   1. enum de modelos.proveedor += 'typesafe' (mismo patrón que 010/015).
--   2. columna `modo` TEXT NULL: modo de la fuente LiteLLM
--      ("chat" | "responses" | "evaluation" | NULL). "evaluation" declara
--      modelos de decisión estructurada que no generan texto y facturan solo
--      input (output_cost_per_token = 0 es real, no gratuito-limitado).
--      NULL = la fuente no declara modo (entradas legacy previas a la columna).
ALTER TABLE modelos DROP CONSTRAINT IF EXISTS modelos_proveedor_check;
ALTER TABLE modelos ADD CONSTRAINT modelos_proveedor_check
  CHECK (proveedor IN ('anthropic', 'xai', 'google', 'moonshot', 'zhipu', 'qwen', 'meta', 'typesafe', 'otro'));
ALTER TABLE modelos ADD COLUMN IF NOT EXISTS modo TEXT;
