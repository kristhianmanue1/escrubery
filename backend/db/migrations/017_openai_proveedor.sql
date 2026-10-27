-- 017_openai_proveedor.sql — 9º proveedor openai (2026-10-27, ticket feedback
-- adrc-mini, fb_11). Cambio aditivo: enum de modelos.proveedor += 'openai'
-- (mismo patrón que 010/015/016). Sin columnas nuevas.
ALTER TABLE modelos DROP CONSTRAINT IF EXISTS modelos_proveedor_check;
ALTER TABLE modelos ADD CONSTRAINT modelos_proveedor_check
  CHECK (proveedor IN ('anthropic', 'xai', 'google', 'moonshot', 'zhipu', 'qwen', 'meta', 'typesafe', 'openai', 'otro'));
