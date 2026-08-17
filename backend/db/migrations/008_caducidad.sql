-- 008_caducidad.sql — T6 del plan de deuda: caducidad de datos (plan v2 §4.2).
-- fecha_deprecacion en modelos: dato real de la fuente (antes se volcaba
-- erróneamente en vigente_hasta — deprecación ≠ TTL de vigencia; decisión del
-- Mediador 2026-08-17: conservarla como columna propia).
-- vigente_hasta en cli_comandos: ventana de vigencia 7 días (comandos CLI).
ALTER TABLE modelos ADD COLUMN IF NOT EXISTS fecha_deprecacion TIMESTAMPTZ;
ALTER TABLE cli_comandos ADD COLUMN IF NOT EXISTS vigente_hasta TIMESTAMPTZ;
