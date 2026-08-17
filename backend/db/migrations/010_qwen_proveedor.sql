-- 010_qwen_proveedor.sql — 9º CLI (qwen-code) y proveedor qwen (API DashScope).
-- Extiende el CHECK de modelos con 'qwen' (cambio aditivo al enum §2.2,
-- 2026-08-17). El CHECK de cli_productos fue retirado en la mig 004
-- (proveedor ahí = maintainer, fuera del enum).
ALTER TABLE modelos DROP CONSTRAINT IF EXISTS modelos_proveedor_check;
ALTER TABLE modelos ADD CONSTRAINT modelos_proveedor_check
  CHECK (proveedor IN ('anthropic', 'xai', 'google', 'moonshot', 'zhipu', 'qwen', 'otro'));
