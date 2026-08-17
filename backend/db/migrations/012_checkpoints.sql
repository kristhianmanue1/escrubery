-- 012_checkpoints.sql — F4a T0: checkpoints del tip de la cadena Evidentia.
-- Ancla el PREFIJO id <= eventos_hasta con raíz Merkle RFC 6962, firma
-- Ed25519 del payload JCS y (T3) sello RFC 3161. Inmutables por diseño:
-- inserts posteriores de eventos no invalidan un checkpoint existente.
-- NOTA: eventos_changelog.checkpoint_id (mig 006, siempre NULL) queda
-- DEPRECADO — el modelo de prefijos lo reemplaza sin mutar eventos.
CREATE TABLE IF NOT EXISTS checkpoints (
  id                  SERIAL PRIMARY KEY,
  tip_evento_id       INTEGER NOT NULL,
  eventos_hasta       INTEGER NOT NULL UNIQUE,  -- max(id) cubierto; enforcement del skip idempotente
  merkle_root         TEXT NOT NULL,            -- hex(sha256 raíz RFC 6962)
  firmado_json        TEXT NOT NULL,            -- bytes JCS exactos firmados (verbatim, igual al archivo)
  key_id              TEXT NOT NULL,
  sig                 TEXT NOT NULL,            -- ed25519:base64 sobre firmado_json
  timestamp_rfc3161   BYTEA,                    -- TSR (T3); NULL = pendiente_sello
  tsa_url             TEXT,
  external_anchor     JSONB,                    -- {tipo, tsa, hash_anclado} (T3)
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_hasta ON checkpoints (eventos_hasta);
