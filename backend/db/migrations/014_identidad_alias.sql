-- 014_identidad_alias.sql — T4b-T1 (plan post-v0.3.0, H5): registro externo de
-- identidad (ADR-0002, necesidad de expertoGobernanza). NO autodeclarado: los
-- aliases y endpoints son curaduría propia (datos/fichas/curaduria/) con
-- procedencia por fila; el resolver nunca adivina (resuelto=false si no hay dato).

CREATE TABLE IF NOT EXISTS identidad_alias (
  id                             SERIAL PRIMARY KEY,
  issuer_id                      TEXT NOT NULL UNIQUE,
  proveedor                      TEXT NOT NULL,
  modelo_id                      TEXT NOT NULL,
  notas                          TEXT,
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
  )
);

CREATE TABLE IF NOT EXISTS identidad_endpoints (
  id                             SERIAL PRIMARY KEY,
  endpoint                       TEXT NOT NULL UNIQUE,
  proveedor                      TEXT NOT NULL,
  notas                          TEXT,
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
  )
);
