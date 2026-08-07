-- 007_eventos_firmado.sql — marca eventos firmados (simplifica el firmador/verificador).
ALTER TABLE eventos_changelog ADD COLUMN firmado BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_eventos_firmado ON eventos_changelog (firmado) WHERE firmado = false;
