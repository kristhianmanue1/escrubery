import { type ColumnType, type Generated } from 'kysely';

type Ts = ColumnType<Date, string | null, string | null>;

export interface ModelosTable {
  id: Generated<number>;
  proveedor: string;
  modelo_id: string;
  nombre_display: string | null;
  ventana_contexto_max: number | null;
  // Aditivo 2026-10-14 (ticket typesafe): modo de la fuente LiteLLM
  // ("chat" | "responses" | "evaluation" | null). "evaluation" = decisión
  // estructurada (System One) — sin generación de texto, facturación por input.
  modo: string | null;
  soporta_vision: boolean | null;
  soporta_tool_use: boolean | null;
  soporta_caching: boolean | null;
  soporta_batch: boolean | null;
  soporta_computer_use: boolean | null;
  precio_input_por_millon: ColumnType<
    string | null,
    string | number | null,
    string | number | null
  >;
  precio_output_por_millon: ColumnType<
    string | null,
    string | number | null,
    string | number | null
  >;
  precio_cache_lectura_por_millon: ColumnType<
    string | null,
    string | number | null,
    string | number | null
  >;
  pesos_abiertos: boolean | null;
  familia_arquitectura: string | null;
  curaduria_json: unknown;
  fuente_url: string | null;
  fuente_tipo: string | null;
  fecha_obtencion: Ts;
  hash_sha256_contenido_original: string | null;
  estado_verificacion: string | null;
  vigente_hasta: Ts;
  fecha_deprecacion: Ts;
}

export interface CliProductosTable {
  id: Generated<number>;
  nombre: string;
  nombre_display: string | null;
  proveedor: string;
  tipo: string;
  repo_url: string | null;
  version_actual: string | null;
  fecha_ultima_version: Ts;
}

export interface CliComandosTable {
  id: Generated<number>;
  cli_producto_id: number;
  comando: string;
  flags_json: unknown;
  descripcion: string | null;
  version_detectada_desde: string | null;
  fuente_url: string | null;
  fuente_tipo: string | null;
  fecha_obtencion: Ts;
  hash_sha256_contenido_original: string | null;
  estado_verificacion: string | null;
  vigente_hasta: Ts;
  hash_confirmacion_sandbox: string | null;
  version_confirmada: string | null;
}

export interface ConsultasLogTable {
  id: Generated<number>;
  consulta: unknown;
  servido_desde: string;
  latencia_ms: number | null;
  fecha: Ts;
}

export interface FeedbackTable {
  id: Generated<number>;
  tipo: string;
  descripcion: string;
  consulta_origen: unknown;
  agente_reportante: unknown;
  hash_dedup: string;
  estado: string;
  deduplicado_de: number | null;
  fecha: Ts;
  estado_datos_hash: string | null;
  version_servicio: string | null;
}

export interface EventosChangelogTable {
  id: Generated<number>;
  record_id: string;
  cli_producto_id: number;
  categoria: string;
  resumen: string;
  fuente_url: string;
  fuente_tipo: string | null;
  fecha_publicacion: Ts;
  fecha_deteccion: Ts;
  confianza_clasificador: number | null;
  hash_evento: string;
  hash_evento_anterior: string;
  firmas_json: unknown;
  checkpoint_id: string | null;
  firmado: Generated<boolean>;
}

export interface CheckpointsTable {
  id: Generated<number>;
  tip_evento_id: number;
  eventos_hasta: number;
  merkle_root: string;
  firmado_json: string;
  key_id: string;
  sig: string;
  timestamp_rfc3161: Buffer | null;
  tsa_url: string | null;
  external_anchor: unknown;
  creado_en: Ts;
}

export interface IdentidadAliasTable {
  id: Generated<number>;
  issuer_id: string;
  proveedor: string;
  modelo_id: string;
  notas: string | null;
  fuente_url: string | null;
  fuente_tipo: string | null;
  fecha_obtencion: Ts;
  hash_sha256_contenido_original: string | null;
  estado_verificacion: string | null;
}

export interface IdentidadEndpointsTable {
  id: Generated<number>;
  endpoint: string;
  proveedor: string;
  notas: string | null;
  fuente_url: string | null;
  fuente_tipo: string | null;
  fecha_obtencion: Ts;
  hash_sha256_contenido_original: string | null;
  estado_verificacion: string | null;
}

// --- Módulo benchmarks (mig 018, Plan_Benchmarks_v0 2026-10-29) -----------
// Semántica append-only: las observaciones son hechos históricos que no se
// purgan ni sobrescriben (idempotencia por observacion_hash UNIQUE).

export interface BenchmarkFuentesTable {
  id: Generated<number>;
  slug: string;
  nombre: string;
  organizacion: string;
  canal_url: string;
  canal_tipo: string;
  licencia: string | null;
  metodologia_url: string | null;
  ventana_dias: number;
  notas: string | null;
  activa: boolean;
  fecha_ultima_captura: Ts;
  hash_ultima_captura: string | null;
  creado_en: Ts;
  actualizado_en: Ts;
}

export interface BenchmarkDefinicionesTable {
  id: Generated<number>;
  fuente_id: number;
  slug: string;
  version_metodologia: string;
  objetivo: string;
  capacidad_evaluada: string;
  metrica_principal: string;
  unidad: string;
  direccion: string;
  metodologia_url: string | null;
  incompatibilidades_json: unknown;
}

export interface BenchmarkSubjectsTable {
  id: Generated<number>;
  fuente_id: number;
  designacion_original: string;
  tipo: string;
  organizacion_declarada: string | null;
  agente_designado: string | null;
  modelo_designado: string | null;
  resuelto_proveedor: string | null;
  resuelto_modelo_id: string | null;
}

export interface BenchmarkObservacionesTable {
  id: Generated<number>;
  fuente_id: number;
  definicion_id: number;
  subject_id: number;
  run_ref: string | null;
  metrica: string;
  valor: number | null;
  unidad: string;
  direccion: string;
  incertidumbre_json: unknown;
  condiciones_json: unknown;
  publicado_por: string;
  fecha_ejecucion: Ts;
  fecha_publicacion: Ts;
  fuente_url: string;
  fuente_tipo: string | null;
  fecha_obtencion: Ts;
  hash_sha256_contenido_original: string;
  estado_verificacion: string | null;
  adaptador: string;
  adaptador_version: string;
  observacion_hash: string;
  capturado_en: Ts;
  retirado_en: Ts;
}

export interface Database {
  modelos: ModelosTable;
  cli_productos: CliProductosTable;
  cli_comandos: CliComandosTable;
  consultas_log: ConsultasLogTable;
  feedback: FeedbackTable;
  eventos_changelog: EventosChangelogTable;
  checkpoints: CheckpointsTable;
  identidad_alias: IdentidadAliasTable;
  identidad_endpoints: IdentidadEndpointsTable;
  benchmark_fuentes: BenchmarkFuentesTable;
  benchmark_definiciones: BenchmarkDefinicionesTable;
  benchmark_subjects: BenchmarkSubjectsTable;
  benchmark_observaciones: BenchmarkObservacionesTable;
}
