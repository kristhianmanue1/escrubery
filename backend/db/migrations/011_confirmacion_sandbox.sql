-- 011_confirmacion_sandbox.sql — F3 (adversarial r1): el refresco de vigencia
-- de comandos confirmados por el sandbox NO debe pisar la procedencia original
-- (fuente_*, fecha_obtencion, hash_sha256_contenido_original de otra fuente).
-- Columnas aditivas de confirmación: última corroboración por introspección.
ALTER TABLE cli_comandos ADD COLUMN IF NOT EXISTS hash_confirmacion_sandbox TEXT;
ALTER TABLE cli_comandos ADD COLUMN IF NOT EXISTS version_confirmada TEXT;
