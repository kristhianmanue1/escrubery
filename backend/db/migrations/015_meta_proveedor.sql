-- 015_meta_proveedor.sql — proveedor meta (Model API de Meta: familia Muse).
-- Extiende el CHECK de modelos con 'meta' (cambio aditivo al enum §2.2,
-- 2026-10-13). Mismo patrón que 010_qwen_proveedor.sql. El CHECK de
-- cli_productos fue retirado en la mig 004 (proveedor ahí = maintainer,
-- fuera del enum).
ALTER TABLE modelos DROP CONSTRAINT IF EXISTS modelos_proveedor_check;
ALTER TABLE modelos ADD CONSTRAINT modelos_proveedor_check
  CHECK (proveedor IN ('anthropic', 'xai', 'google', 'moonshot', 'zhipu', 'qwen', 'meta', 'otro'));
