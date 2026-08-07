-- 004_drop_cli_productos_proveedor_check.sql
-- El CHECK de dominio proveedor (contrato v0 §2.2) aplica a modelos.proveedor (los 5 proveedores
-- cargados: anthropic, xai, google, moonshot, zhipu, otro). cli_productos.proveedor es el maintainer
-- del CLI, que incluye openai (codex), "comunidad (...)" (cline, grok-cli-community) — no se restringe
-- al enum de proveedores de modelos. Se elimina el CHECK de cli_productos; modelos lo conserva.
ALTER TABLE cli_productos DROP CONSTRAINT cli_productos_proveedor_check;
