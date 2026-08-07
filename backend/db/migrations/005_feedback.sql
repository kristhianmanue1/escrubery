-- 005_feedback.sql — tabla de feedback (contrato v0 §3.6 reportar_feedback).
CREATE TABLE IF NOT EXISTS feedback (
  id                SERIAL PRIMARY KEY,
  tipo              TEXT NOT NULL CHECK (tipo IN ('error', 'mejora', 'dato_desactualizado')),
  descripcion       TEXT NOT NULL,
  consulta_origen   JSONB,
  agente_reportante JSONB NOT NULL,
  hash_dedup        TEXT NOT NULL UNIQUE,
  estado            TEXT NOT NULL DEFAULT 'nuevo' CHECK (
    estado IN ('nuevo', 'triage', 'aceptado', 'rechazado', 'resuelto', 'duplicado')
  ),
  deduplicado_de    INTEGER REFERENCES feedback(id),
  fecha             TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado_datos_hash TEXT,
  version_servicio  TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_estado ON feedback (estado);
