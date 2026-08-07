-- 001_nucleo_fase0.sql — tablas núcleo del plan v2 §9, alineadas a CONTRATO_API_v0.md.
-- El campo canónico de procedencia es hash_sha256_contenido_original (contrato v0 §2.1),
-- no fuente_hash (nombre del §9); estado_verificacion y fuente_tipo reflejan los enums del contrato.

CREATE TABLE IF NOT EXISTS modelos (
  id                                SERIAL PRIMARY KEY,
  proveedor                         TEXT NOT NULL,
  modelo_id                         TEXT NOT NULL,
  nombre_display                    TEXT,
  ventana_contexto_max              INTEGER,
  soporta_vision                    BOOLEAN,
  soporta_tool_use                  BOOLEAN,
  soporta_caching                   BOOLEAN,
  soporta_batch                     BOOLEAN,
  soporta_computer_use              BOOLEAN,
  precio_input_por_millon           NUMERIC(12, 6),
  precio_output_por_millon          NUMERIC(12, 6),
  fuente_url                        TEXT,
  fuente_tipo                       TEXT CHECK (
    fuente_tipo IS NULL OR fuente_tipo IN (
      'litellm_json', 'changelog_repo', 'github_release', 'security_advisory',
      'docs_oficial', 'ejecucion_local_supervisada', 'curaduria_propia'
    )
  ),
  fecha_obtencion                   TIMESTAMPTZ,
  hash_sha256_contenido_original    TEXT,
  estado_verificacion               TEXT CHECK (
    estado_verificacion IS NULL OR estado_verificacion IN (
      'confirmado_por_docs_oficial', 'inferido_de_comportamiento',
      'pendiente_de_verificar', 'corroborado_cruzado', 'confirmado_por_prueba_propia'
    )
  ),
  vigente_hasta                     TIMESTAMPTZ,
  UNIQUE (proveedor, modelo_id)
);

CREATE TABLE IF NOT EXISTS cli_productos (
  id                     SERIAL PRIMARY KEY,
  nombre                 TEXT NOT NULL UNIQUE,
  proveedor              TEXT NOT NULL,
  tipo                   TEXT NOT NULL CHECK (tipo IN ('oficial', 'comunitario')),
  repo_url               TEXT,
  version_actual         TEXT,
  fecha_ultima_version   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cli_comandos (
  id                             SERIAL PRIMARY KEY,
  cli_producto_id                INTEGER NOT NULL REFERENCES cli_productos(id) ON DELETE CASCADE,
  comando                        TEXT NOT NULL,
  flags_json                     JSONB,
  descripcion                    TEXT,
  version_detectada_desde        TEXT,
  fuente_url                     TEXT,
  fuente_tipo                    TEXT CHECK (
    fuente_tipo IS NULL OR fuente_tipo IN (
      'litellm_json', 'changelog_repo', 'github_release', 'security_advisory',
      'docs_oficial', 'ejecucion_local_supervisada', 'curaduria_propia'
    )
  ),
  fecha_obtencion                TIMESTAMPTZ,
  hash_sha256_contenido_original TEXT,
  estado_verificacion            TEXT CHECK (
    estado_verificacion IS NULL OR estado_verificacion IN (
      'confirmado_por_docs_oficial', 'inferido_de_comportamiento',
      'pendiente_de_verificar', 'corroborado_cruzado', 'confirmado_por_prueba_propia'
    )
  ),
  UNIQUE (cli_producto_id, comando)
);

CREATE TABLE IF NOT EXISTS consultas_log (
  id             SERIAL PRIMARY KEY,
  consulta       JSONB NOT NULL,
  servido_desde  TEXT NOT NULL CHECK (servido_desde IN ('bd', 'fuente_externa', 'sin_datos')),
  latencia_ms    INTEGER,
  fecha          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cli_comandos_producto ON cli_comandos (cli_producto_id);
CREATE INDEX IF NOT EXISTS idx_consultas_log_fecha   ON consultas_log (fecha DESC);
