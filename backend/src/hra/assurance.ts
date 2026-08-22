import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

export type Peldano = 'L1' | 'L2' | 'L3' | 'L4';
export type NormaId = 'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'N6' | 'N7' | 'N8';

export interface Evidencia {
  fuente_url: string | null;
  fecha_obtencion: string;
  hash_sha256?: string | null;
  evento_evidentia?: string | null;
}

export interface Mecanismo {
  peldano: Peldano;
  donde: string;
  enforcement_verificado?: boolean;
  evidencia: Evidencia;
}

export interface NormaClasificada {
  norma_id: NormaId;
  estado: 'clasificada' | 'pendiente_de_verificar';
  peldano_maximo?: Peldano;
  capado_por_n9?: boolean;
  mecanismos?: Mecanismo[];
  nota?: string;
}

export interface FichaAssurance {
  schema: 'escrubery/assurance/v0';
  cli_id: 'claude-code' | 'codex-cli' | 'opencode' | 'cline' | 'kimi-code';
  perfil: string;
  corpus_id: 'hra-corpus/n1-n8@2026-08-22';
  n9_gate: {
    estado:
      'gate_cerrado' | 'gate_abierto_verificado' | 'pendiente_de_verificar';
    nota: string;
    evidencia: Evidencia;
  };
  distribucion_garantia: {
    L1: number;
    L2: number;
    L3: number;
    L4: number;
    pendiente: number;
  };
  normas: NormaClasificada[];
  estado_verificacion: 'curado' | 'parcial' | 'pendiente_de_verificar';
  procedencia: {
    fuente_tipo: 'curaduria_propia';
    fuente_url: string;
    fecha_obtencion: string;
    hash_sha256: string;
  };
}

let validadorCompilado: ((d: unknown) => boolean) | null = null;

function cargarValidador() {
  if (validadorCompilado) return;
  const ruta = join(
    __dirname,
    '../../../datos/schemas/assurance-v0.schema.json',
  );
  const schema = JSON.parse(readFileSync(ruta, 'utf-8')) as Record<
    string,
    unknown
  >;
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  validadorCompilado = ajv.compile(schema) as (d: unknown) => boolean;
}

export interface ResultadoValidacionAssurance {
  valido: boolean;
  errores: ErrorObject[] | null;
}

/** Valida una ficha assurance contra escrubery/assurance/v0 (draft 2020-12). */
export function validarFichaAssurance(
  datos: unknown,
): ResultadoValidacionAssurance {
  cargarValidador();
  const fn = validadorCompilado as unknown as ((d: unknown) => boolean) & {
    errors?: ErrorObject[] | null;
  };
  const valido = fn(datos);
  return { valido, errores: valido ? null : (fn.errors ?? null) };
}

/** Self-hash reproducible del contenido curado (patrón T4b): sha256 del JCS-like (claves ordenadas). */
export function selfHashAssurance(
  ficha: Omit<FichaAssurance, 'procedencia'>,
): string {
  const ordenado = ordenar(ficha);
  const canon = JSON.stringify(ordenado);
  return `sha256:${createHash('sha256').update(canon).digest('hex')}`;
}

function ordenar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor && typeof valor === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(valor).sort()) {
      out[k] = ordenar((valor as Record<string, unknown>)[k]);
    }
    return out;
  }
  return valor;
}

/**
 * Recalcula la distribución desde las normas (una norma = un peldaño máximo).
 * Si gateN9Abierto, toda L4 cuenta como L3 (capada por N9 — regla de la taxonomía §3).
 */
export function calcularDistribucion(
  normas: NormaClasificada[],
  gateN9Abierto: boolean,
): FichaAssurance['distribucion_garantia'] {
  const d = { L1: 0, L2: 0, L3: 0, L4: 0, pendiente: 0 };
  for (const n of normas) {
    if (n.estado === 'pendiente_de_verificar' || !n.peldano_maximo) {
      d.pendiente++;
      continue;
    }
    let p = n.peldano_maximo;
    if (gateN9Abierto && p === 'L4') p = 'L3';
    d[p]++;
  }
  return d;
}
