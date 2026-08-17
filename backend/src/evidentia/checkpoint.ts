import { createHash, createPrivateKey, sign as edSign } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { canonicalize } from './jcs';

// F4a T1 — checkpoint del tip de la cadena Evidentia.
// Merkle RFC 6962 (RFC 6962 §2.1): MTH = HASH(0x01 ‖ MTH(izq) ‖ MTH(der)),
// k = mayor potencia de 2 < n; hoja = SHA256(0x00 ‖ hash_evento_bytes).
// Inmutable por prefijo (id <= eventos_hasta): inserts posteriores no
// invalidan checkpoints existentes.

const LEAF = Buffer.from([0x00]);
const NODE = Buffer.from([0x01]);

export function hojaMerkle(hashHex: string): Buffer {
  return createHash('sha256')
    .update(Buffer.concat([LEAF, Buffer.from(hashHex, 'hex')]))
    .digest();
}

function nodoMerkle(l: Buffer, r: Buffer): Buffer {
  return createHash('sha256')
    .update(Buffer.concat([NODE, l, r]))
    .digest();
}

export function mayorPotenciaDeDosMenorQue(n: number): number {
  if (n < 2) throw new Error('n < 2');
  return 2 ** Math.floor(Math.log2(n - 1));
}

/** Raíz RFC 6962 sobre hashes-hex de hoja, en orden. Recursiva pura. */
export function raizMerkle(hojas: Buffer[]): Buffer {
  if (hojas.length === 0) throw new Error('Merkle: árbol vacío');
  if (hojas.length === 1) return hojas[0];
  const k = mayorPotenciaDeDosMenorQue(hojas.length);
  return nodoMerkle(raizMerkle(hojas.slice(0, k)), raizMerkle(hojas.slice(k)));
}

export interface CheckpointPayload {
  tip_hash: string;
  merkle_root: string;
  eventos_hasta: number;
  creado_en: string;
}

export interface PasoPath {
  hash: string;
  izquierda: boolean;
}

export interface PruebaInclusion {
  record_id: string;
  hash_evento: string;
  leaf_index: number;
  tree_size: number;
  path: PasoPath[];
  merkle_root: string;
}

/** Auditor path RFC 6962: en cada nivel, el sibling es la raíz del subárbol
 * hermano. Orden hoja→raíz (path[0] = sibling más profundo: así pliega el
 * verificador). */
export function pathInclusion(hojas: Buffer[], leafIndex: number): PasoPath[] {
  const path: PasoPath[] = [];
  let nivel = hojas;
  let idx = leafIndex;
  while (nivel.length > 1) {
    const k = mayorPotenciaDeDosMenorQue(nivel.length);
    if (idx < k) {
      path.push({
        hash: raizMerkle(nivel.slice(k)).toString('hex'),
        izquierda: false,
      });
      nivel = nivel.slice(0, k);
    } else {
      path.push({
        hash: raizMerkle(nivel.slice(0, k)).toString('hex'),
        izquierda: true,
      });
      nivel = nivel.slice(k);
      idx -= k;
    }
  }
  return path.reverse();
}

/** Lado verificador: recomputa la raíz desde hoja + path (independiente de pathInclusion). */
export function raizDesdePrueba(hashHex: string, path: PasoPath[]): Buffer {
  let actual = hojaMerkle(hashHex);
  for (const paso of path) {
    const hermano = Buffer.from(paso.hash, 'hex');
    actual = paso.izquierda
      ? nodoMerkle(hermano, actual)
      : nodoMerkle(actual, hermano);
  }
  return actual;
}

export interface ResultadoCheckpoint {
  creado: boolean;
  checkpoint_id?: number;
  payload: CheckpointPayload;
  motivo?: string;
}

export async function crearCheckpoint(
  db: Kysely<Database>,
  kid: string,
  privPath: string,
  dirArchivos: string,
): Promise<ResultadoCheckpoint> {
  const eventos = await db
    .selectFrom('eventos_changelog')
    .select(['id', 'record_id', 'hash_evento'])
    .orderBy('id', 'asc')
    .execute();
  if (eventos.length === 0) throw new Error('sin eventos: nada que anclar');

  const eventosHasta = eventos[eventos.length - 1].id;
  const existente = await db
    .selectFrom('checkpoints')
    .selectAll()
    .where('eventos_hasta', '=', eventosHasta)
    .executeTakeFirst();
  if (existente) {
    return {
      creado: false,
      checkpoint_id: existente.id,
      payload: JSON.parse(existente.firmado_json) as CheckpointPayload,
      motivo: 'prefijo ya anclado (skip idempotente)',
    };
  }

  const raiz = raizMerkle(eventos.map((e) => hojaMerkle(e.hash_evento)));
  const payload: CheckpointPayload = {
    tip_hash: eventos[eventos.length - 1].hash_evento,
    merkle_root: raiz.toString('hex'),
    eventos_hasta: eventosHasta,
    creado_en: new Date().toISOString(),
  };
  const firmado = canonicalize(payload);
  const priv = createPrivateKey(readFileSync(privPath, 'utf8'));
  const sig = `ed25519:${edSign(null, Buffer.from(firmado), priv).toString('base64')}`;

  const fila = await db
    .insertInto('checkpoints')
    .values({
      tip_evento_id: eventosHasta,
      eventos_hasta: eventosHasta,
      merkle_root: payload.merkle_root,
      firmado_json: firmado,
      key_id: kid,
      sig,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  mkdirSync(dirArchivos, { recursive: true });
  writeFileSync(
    join(dirArchivos, `${payload.creado_en.replace(/[:.]/g, '-')}.json`),
    `${JSON.stringify({ payload, sig, key_id: kid, alg: 'ed25519' }, null, 2)}\n`,
  );

  return { creado: true, checkpoint_id: fila.id, payload };
}
