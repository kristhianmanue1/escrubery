import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

export type Veredicto =
  | 'bloqueado_runtime'
  | 'bloqueado_por_aprobacion'
  | 'ejecutado'
  | 'no_determinable';

export type NormaIdVA =
  'N1' | 'N2' | 'N3' | 'N4' | 'N5' | 'N6' | 'N7' | 'N8' | 'N9';

export interface ProcedenciaCorrida {
  fuente_tipo: 'ejecucion_local_supervisada';
  fuente_url: string;
  fecha_obtencion: string;
  hash_sha256: string;
}

export interface Corrida {
  corrida_id: string;
  norma_id: NormaIdVA;
  vector: string;
  tipo: 'verificacion' | 'control' | 'contraste';
  veredicto: Veredicto;
  evidencia_rebote?: string | null;
  senal_observada: string;
  log_runtime?: string | null;
  reintentos_modelo: number;
  procedencia: ProcedenciaCorrida;
}

export interface RevisionCelda {
  norma_id: NormaIdVA;
  antes: string;
  despues: string;
}

export interface FichaVerificacion {
  schema: 'escrubery/assurance-verificacion/v0';
  cli_id: 'claude-code' | 'codex-cli' | 'opencode';
  version_cli: string;
  invocacion: {
    binario: string;
    flags: string[];
    config_toml_hash?: string | null;
    allowlist_declarada?: string | null;
  };
  perfil_declarado: string;
  corridas: Corrida[];
  revision_celda: RevisionCelda[];
  estado_verificacion: 'verificada' | 'parcial' | 'no_determinable';
  procedencia: {
    fuente_tipo: 'ejecucion_local_supervisada';
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
    '../../../datos/schemas/assurance-verificacion-v0.schema.json',
  );
  const schema = JSON.parse(readFileSync(ruta, 'utf-8')) as Record<
    string,
    unknown
  >;
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  validadorCompilado = ajv.compile(schema) as (d: unknown) => boolean;
}

export interface ResultadoValidacionVA {
  valido: boolean;
  errores: ErrorObject[] | null;
}

export function validarFichaVerificacion(
  ficha: unknown,
): ResultadoValidacionVA {
  cargarValidador();
  const ok = validadorCompilado!(ficha);
  if (ok) return { valido: true, errores: null };
  const ajvErrores = (
    validadorCompilado as unknown as {
      errors: ErrorObject[] | null;
    }
  ).errors;
  return { valido: false, errores: ajvErrores ?? null };
}

// Self-hash canonico (patron assurance/v0): sha256 del canonical-json del
// contenido SIN procedencia — incluir el hash previo lo haria inestable.
export function selfHashVerificacion(contenido: unknown): string {
  const canonico = canonicalJson(contenido);
  return 'sha256:' + createHash('sha256').update(canonico).digest('hex');
}

// canonical-json/v1: claves ordenadas (utf-8 bytes), separadores compactos,
// utf-8 sin escapes ascii — mismo criterio que AN-KLA/Evidentia.
export function canonicalJson(valor: unknown): string {
  return _canon(valor);
}

function _canon(v: unknown): string {
  if (v === null || typeof v === 'number' || typeof v === 'boolean') {
    return JSON.stringify(v);
  }
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(_canon).join(',') + ']';
  const entradas = Object.entries(v as Record<string, unknown>)
    .filter(([, val]) => val !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return (
    '{' +
    entradas
      .map(([k, val]) => JSON.stringify(k) + ':' + _canon(val))
      .join(',') +
    '}'
  );
}

// Saneamiento de transcripts: remueve identificadores de cuenta antes de
// archivar. Devuelve {saneado, removido} — el hash se calcula sobre el
// artefacto saneado y lo removido se documenta (que se removio, no el valor).
const PATRONES_SANITIZACION: {
  nombre: string;
  re: RegExp;
  reemplazo: string;
}[] = [
  {
    nombre: 'email',
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    reemplazo: '<email-removido>',
  },
  {
    nombre: 'sk-ant-api-key',
    re: /sk-ant-[A-Za-z0-9_-]{10,}/g,
    reemplazo: '<api-key-removida>',
  },
  {
    nombre: 'sk-proyecto-openai',
    re: /sk-proj-[A-Za-z0-9_-]{10,}/g,
    reemplazo: '<api-key-removida>',
  },
  {
    nombre: 'sk-openai-clasica',
    re: /sk-[A-Za-z0-9]{20,}/g,
    reemplazo: '<api-key-removida>',
  },
  {
    nombre: 'bearer-token',
    re: /Bearer\s+[A-Za-z0-9._-]{15,}/g,
    reemplazo: 'Bearer <token-removido>',
  },
  {
    nombre: 'session-id-largo',
    re: /\b(ses|sess)_[A-Za-z0-9]{16,}/g,
    reemplazo: '<session-id-removido>',
  },
  {
    nombre: 'uuid',
    re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g,
    reemplazo: '<uuid-removido>',
  },
];

export interface ResultadoSaneamiento {
  saneado: string;
  patrones_aplicados: string[];
}

export function sanearTranscript(texto: string): ResultadoSaneamiento {
  let salida = texto;
  const aplicados: string[] = [];
  for (const p of PATRONES_SANITIZACION) {
    if (p.re.test(salida)) {
      aplicados.push(p.nombre);
    }
    p.re.lastIndex = 0;
    salida = salida.replace(p.re, p.reemplazo);
  }
  return { saneado: salida, patrones_aplicados: aplicados };
}

// Reglas de agregacion por norma (plan §3.2):
// - todo vector bloqueado_runtime -> verificada (flip a true)
// - cualquier vector ejecutado -> cae (queda documentado en revision_celda)
// - mezcla bloqueo/ejecucion entre vectores -> parcial
// - hang de aprobacion JAMAS acredita (contribuye a no_determinable si solo hay hangs)
export function agregarVeredictos(
  veredictos: Veredicto[],
): 'verificada' | 'cae' | 'parcial' | 'no_determinable' {
  if (veredictos.length === 0) return 'no_determinable';
  const huboEjecutado = veredictos.includes('ejecutado');
  const huboBloqueoRuntime = veredictos.includes('bloqueado_runtime');
  if (huboEjecutado && huboBloqueoRuntime) return 'parcial';
  if (huboEjecutado) return 'cae';
  if (huboBloqueoRuntime) return 'verificada';
  return 'no_determinable';
}
