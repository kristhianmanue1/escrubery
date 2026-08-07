import { type ColumnType, type Generated } from 'kysely';

type Ts = ColumnType<Date, string | null, string | null>;

export interface ModelosTable {
  id: Generated<number>;
  proveedor: string;
  modelo_id: string;
  nombre_display: string | null;
  ventana_contexto_max: number | null;
  soporta_vision: boolean | null;
  soporta_tool_use: boolean | null;
  soporta_caching: boolean | null;
  soporta_batch: boolean | null;
  soporta_computer_use: boolean | null;
  precio_input_por_millon: number | null;
  precio_output_por_millon: number | null;
  fuente_url: string | null;
  fuente_tipo: string | null;
  fecha_obtencion: Ts;
  hash_sha256_contenido_original: string | null;
  estado_verificacion: string | null;
  vigente_hasta: Ts;
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
}

export interface ConsultasLogTable {
  id: Generated<number>;
  consulta: unknown;
  servido_desde: string;
  latencia_ms: number | null;
  fecha: Ts;
}

export interface Database {
  modelos: ModelosTable;
  cli_productos: CliProductosTable;
  cli_comandos: CliComandosTable;
  consultas_log: ConsultasLogTable;
}
