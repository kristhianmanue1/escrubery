-- 002_proveedor_check.sql — refuerza el dominio de proveedor (CONTRATO_API_v0.md §2.2).
-- Migración evolutiva: el runner garantiza idempotencia a nivel de archivo via _migrations_aplicadas.

ALTER TABLE modelos ADD CONSTRAINT modelos_proveedor_check
  CHECK (proveedor IN ('anthropic', 'xai', 'google', 'moonshot', 'zhipu', 'otro'));

ALTER TABLE cli_productos ADD CONSTRAINT cli_productos_proveedor_check
  CHECK (proveedor IN ('anthropic', 'xai', 'google', 'moonshot', 'zhipu', 'otro'));
