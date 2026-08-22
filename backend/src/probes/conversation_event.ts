import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

export interface EventoConversacion {
  schema: 'escrubery/conversation-event/v0';
  evento_id: string;
  cli: 'opencode' | 'codex-cli' | 'cline' | 'kimi-code' | 'claude-code';
  cli_version: string;
  sesion_id_hash: string;
  turno_id_hash?: string | null;
  secuencia?: number | null;
  tipo:
    | 'sesion_iniciada'
    | 'prompt_enviado'
    | 'turno_finalizado'
    | 'turno_fallido'
    | 'turno_interrumpido'
    | 'compactacion'
    | 'sesion_cerrada';
  fuente: {
    tipo:
      | 'oficial_hook'
      | 'oficial_api'
      | 'oficial_export'
      | 'stream_soportado'
      | 'almacen_interno';
    interfaz: string;
    estabilidad: 'estable' | 'beta' | 'experimental' | 'interna';
    fuente_url?: string | null;
  };
  fecha_observacion: string;
  carga_sha256: string;
  carga_ref?: string | null;
  sensibilidad: {
    contiene_conversacion: boolean;
    contiene_io_herramientas: boolean;
    estado_redaccion: 'no_requerida' | 'pendiente' | 'redactada' | 'rechazada';
  };
}

let validadorCompilado: ((datos: unknown) => boolean) | null = null;
let ajvInstancia: Ajv2020 | null = null;

function cargarValidador() {
  if (validadorCompilado && ajvInstancia) return;
  const rutaSchema = join(
    __dirname,
    '../../../datos/schemas/conversation-event-v0.schema.json',
  );
  const schema = JSON.parse(readFileSync(rutaSchema, 'utf-8')) as Record<
    string,
    unknown
  >;
  ajvInstancia = new Ajv2020({ allErrors: true });
  addFormats(ajvInstancia);
  validadorCompilado = ajvInstancia.compile(schema);
}

export interface ResultadoValidacion {
  valido: boolean;
  errores: ErrorObject[] | null;
}

export interface VeredictoTipo {
  veredicto: 'ok' | 'parcial' | 'no_disponible';
  conteo: number | null;
  metodo: string;
}

/** Valida un evento contra conversation-event/v0 (draft 2020-12). */
export function validarEventoConversacion(datos: unknown): ResultadoValidacion {
  cargarValidador();
  const fn = validadorCompilado as unknown as ((d: unknown) => boolean) & {
    errors?: ErrorObject[] | null;
  };
  const valido = fn(datos);
  return { valido, errores: valido ? null : (fn.errors ?? null) };
}

/** SHA-256 hex de un valor nativo (para sesion_id_hash/carga_sha256). */
export function hashSha256(valor: string | Uint8Array): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require('node:crypto') as typeof import('node:crypto');
  const h = createHash('sha256').update(valor).digest('hex');
  return `sha256:${h}`;
}
