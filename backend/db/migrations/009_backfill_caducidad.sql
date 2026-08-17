-- 009_backfill_caducidad.sql — T6 (residual del adversarial H2): backfill de
-- ventanas en filas pre-T6 (ingesta sandbox/F3 con fecha_obtencion pero sin
-- vigente_hasta) para que NADA envejezca en silencio. Idempotente.
UPDATE cli_comandos
   SET vigente_hasta = fecha_obtencion + interval '7 days'
 WHERE vigente_hasta IS NULL
   AND fecha_obtencion IS NOT NULL;
