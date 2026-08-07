-- 006_eventos_changelog.sql — tabla de eventos de changelog (Evidentia, plan v2 §9).
-- El campo canónico de firma es firmas_json (lista Signature[], M-of-N extensible);
-- está [] hasta T6 (firma). hash_evento_anterior encadena (prev_hash en payload hasheable).
CREATE TABLE IF NOT EXISTS eventos_changelog (
  id                      SERIAL PRIMARY KEY,
  record_id               TEXT NOT NULL UNIQUE,
  cli_producto_id         INTEGER NOT NULL REFERENCES cli_productos(id) ON DELETE CASCADE,
  categoria               TEXT NOT NULL CHECK (categoria IN (
    'funcion_nueva', 'breaking_change', 'fix_seguridad', 'deprecacion',
    'cambio_precio', 'cambio_limite', 'ruido_irrelevante'
  )),
  resumen                 TEXT NOT NULL,
  fuente_url              TEXT NOT NULL,
  fuente_tipo             TEXT,
  fecha_publicacion       TIMESTAMPTZ,
  fecha_deteccion         TIMESTAMPTZ NOT NULL DEFAULT now(),
  confianza_clasificador  REAL,
  hash_evento             TEXT NOT NULL,
  hash_evento_anterior    TEXT NOT NULL,
  firmas_json             JSONB NOT NULL DEFAULT '[]',
  checkpoint_id           TEXT,
  UNIQUE (cli_producto_id, fuente_url, resumen)
);

CREATE INDEX IF NOT EXISTS idx_eventos_cli ON eventos_changelog (cli_producto_id);
CREATE INDEX IF NOT EXISTS idx_eventos_categoria ON eventos_changelog (categoria);
CREATE INDEX IF NOT EXISTS idx_eventos_deteccion ON eventos_changelog (fecha_deteccion DESC);
