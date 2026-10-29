-- 018_benchmark_observaciones.sql — módulo benchmarks (Plan_Benchmarks_v0,
-- decreto del Mediador 2026-10-29 «adelante… no te detengas hasta concluir el
-- módulo completo»): dominio nuevo de observaciones de evaluaciones publicadas
-- por terceros. Semántica append-only (NUEVA respecto del patrón
-- regenerar-y-purgar del catálogo): una observación es un hecho histórico que
-- jamás se purga ni se sobrescribe; la idempotencia la garantiza
-- observacion_hash UNIQUE (misma captura → mismo hash → no duplica; score
-- distinto o publicación distinta → fila nueva = historia).
-- Procedencia por fila igual que el resto de tablas (contrato §2.1); el enum
-- fuente_tipo local crece con 'leaderboard_json' (solo estas tablas nuevas).

CREATE TABLE IF NOT EXISTS benchmark_fuentes (
  id                   SERIAL PRIMARY KEY,
  slug                 TEXT NOT NULL UNIQUE,
  nombre               TEXT NOT NULL,
  organizacion         TEXT NOT NULL,
  canal_url            TEXT NOT NULL,
  canal_tipo           TEXT NOT NULL,
  licencia             TEXT,
  metodologia_url      TEXT,
  ventana_dias         INTEGER NOT NULL DEFAULT 3,
  notas                TEXT,
  activa               BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_ultima_captura TIMESTAMPTZ,
  hash_ultima_captura  TEXT,
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS benchmark_definiciones (
  id                    SERIAL PRIMARY KEY,
  fuente_id             INTEGER NOT NULL REFERENCES benchmark_fuentes(id),
  slug                  TEXT NOT NULL,
  version_metodologia   TEXT NOT NULL,
  objetivo              TEXT NOT NULL,
  capacidad_evaluada    TEXT NOT NULL,
  metrica_principal     TEXT NOT NULL,
  unidad                TEXT NOT NULL DEFAULT 'rating_bt',
  direccion             TEXT NOT NULL DEFAULT 'mayor_es_mejor',
  metodologia_url       TEXT,
  incompatibilidades_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (fuente_id, slug, version_metodologia)
);

CREATE TABLE IF NOT EXISTS benchmark_subjects (
  id                     SERIAL PRIMARY KEY,
  fuente_id              INTEGER NOT NULL REFERENCES benchmark_fuentes(id),
  designacion_original   TEXT NOT NULL,
  tipo                   TEXT NOT NULL CHECK (
    tipo IN ('modelo', 'agente', 'sistema_compuesto')
  ),
  organizacion_declarada TEXT,
  agente_designado       TEXT,
  modelo_designado       TEXT,
  -- Vinculación canónica vía curaduría (identidad_alias): NULL = no resuelta
  -- (fail-closed; la designación original SIEMPRE se conserva verbatim).
  resuelto_proveedor     TEXT,
  resuelto_modelo_id     TEXT,
  UNIQUE (fuente_id, designacion_original)
);

CREATE TABLE IF NOT EXISTS benchmark_observaciones (
  id                             SERIAL PRIMARY KEY,
  fuente_id                      INTEGER NOT NULL REFERENCES benchmark_fuentes(id),
  definicion_id                  INTEGER NOT NULL REFERENCES benchmark_definiciones(id),
  subject_id                     INTEGER NOT NULL REFERENCES benchmark_subjects(id),
  run_ref                        TEXT,
  metrica                        TEXT NOT NULL,
  valor                          DOUBLE PRECISION,
  unidad                         TEXT NOT NULL,
  direccion                      TEXT NOT NULL,
  incertidumbre_json             JSONB,
  condiciones_json               JSONB,
  publicado_por                  TEXT NOT NULL CHECK (
    publicado_por IN ('plataforma', 'fabricante', 'tercero')
  ),
  fecha_ejecucion                TIMESTAMPTZ,
  fecha_publicacion              TIMESTAMPTZ,
  fuente_url                     TEXT NOT NULL,
  fuente_tipo                    TEXT CHECK (
    fuente_tipo IS NULL OR fuente_tipo IN (
      'litellm_json', 'changelog_repo', 'github_release', 'security_advisory',
      'docs_oficial', 'ejecucion_local_supervisada', 'curaduria_propia',
      'leaderboard_json'
    )
  ),
  fecha_obtencion                TIMESTAMPTZ NOT NULL,
  hash_sha256_contenido_original TEXT NOT NULL,
  estado_verificacion            TEXT CHECK (
    estado_verificacion IS NULL OR estado_verificacion IN (
      'confirmado_por_docs_oficial', 'inferido_de_comportamiento',
      'pendiente_de_verificar', 'corroborado_cruzado', 'confirmado_por_prueba_propia'
    )
  ),
  adaptador                      TEXT NOT NULL,
  adaptador_version              TEXT NOT NULL,
  observacion_hash               TEXT NOT NULL UNIQUE,
  capturado_en                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  retirado_en                     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_benchmark_obs_subject
  ON benchmark_observaciones (subject_id, metrica, capturado_en DESC);
CREATE INDEX IF NOT EXISTS idx_benchmark_obs_definicion
  ON benchmark_observaciones (definicion_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_obs_publicacion
  ON benchmark_observaciones (fecha_publicacion DESC);
