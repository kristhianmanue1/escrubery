import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import { canonicalize } from './jcs';
import type { Database } from '../db/schema';
import type { EventoBase, EventRecord } from './schema';

export const ZERO_HASH = '0'.repeat(64);

function normFecha(f: string | Date | null | undefined): string | null {
  if (!f) return null;
  if (f instanceof Date) return f.toISOString();
  const d = new Date(f);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function baseHasheable(r: EventoBase): Record<string, unknown> {
  return {
    record_id: r.record_id,
    cli_producto_id: r.cli_producto_id,
    categoria: r.categoria,
    resumen: r.resumen,
    fuente_url: r.fuente_url,
    fuente_tipo: r.fuente_tipo,
    fecha_publicacion: normFecha(r.fecha_publicacion),
    prev_hash: r.prev_hash,
  };
}

export function hashEvento(r: EventoBase): string {
  return createHash('sha256')
    .update(canonicalize(baseHasheable(r)))
    .digest('hex');
}

export function canonicalFirmable(r: EventoBase): string {
  return canonicalize(baseHasheable(r));
}

export async function ultimoHash(db: Kysely<Database>): Promise<string> {
  const r = await db
    .selectFrom('eventos_changelog')
    .select('hash_evento')
    .orderBy('id', 'desc')
    .limit(1)
    .executeTakeFirst();
  return r?.hash_evento ?? ZERO_HASH;
}

export async function registrarEvento(
  db: Kysely<Database>,
  base: Omit<EventoBase, 'prev_hash'>,
): Promise<{ record: EventRecord; hash: string }> {
  const prevHash = await ultimoHash(db);
  const baseCompleto: EventoBase = {
    ...base,
    prev_hash: prevHash,
    fecha_publicacion: normFecha(base.fecha_publicacion),
  };
  const hash = hashEvento(baseCompleto);
  const record: EventRecord = { ...baseCompleto, firmas: [] };
  await db
    .insertInto('eventos_changelog')
    .values({
      record_id: record.record_id,
      cli_producto_id: record.cli_producto_id,
      categoria: record.categoria,
      resumen: record.resumen,
      fuente_url: record.fuente_url,
      fuente_tipo: record.fuente_tipo,
      fecha_publicacion: record.fecha_publicacion,
      confianza_clasificador: record.confianza_clasificador,
      hash_evento: hash,
      hash_evento_anterior: prevHash,
      firmas_json: [],
      checkpoint_id: null,
    })
    .onConflict((oc) =>
      oc.columns(['cli_producto_id', 'fuente_url', 'resumen']).doUpdateSet({
        categoria: record.categoria,
        confianza_clasificador: record.confianza_clasificador,
        fecha_publicacion: record.fecha_publicacion,
      }),
    )
    .execute();
  return { record, hash };
}

export async function verificarCadena(
  db: Kysely<Database>,
): Promise<{ ok: boolean; errores: string[]; total: number }> {
  const eventos = await db
    .selectFrom('eventos_changelog')
    .selectAll()
    .orderBy('id', 'asc')
    .execute();
  const errores: string[] = [];
  let prev = ZERO_HASH;
  for (const e of eventos) {
    if (e.hash_evento_anterior !== prev) {
      errores.push(`prev_hash mismatch en ${e.record_id}`);
    }
    const base = reconstruirBase(e);
    const h = createHash('sha256')
      .update(canonicalize(baseHasheable(base)))
      .digest('hex');
    if (h !== e.hash_evento) {
      errores.push(`hash mismatch en ${e.record_id}`);
    }
    prev = e.hash_evento;
  }
  return { ok: errores.length === 0, errores, total: eventos.length };
}

export function reconstruirBase(e: {
  record_id: string;
  cli_producto_id: number;
  categoria: string;
  resumen: string;
  fuente_url: string;
  fuente_tipo: string | null;
  fecha_publicacion: Date | null;
  confianza_clasificador: number | null;
  hash_evento_anterior: string;
}): EventoBase {
  return {
    record_id: e.record_id,
    cli_producto_id: e.cli_producto_id,
    categoria: e.categoria as EventoBase['categoria'],
    resumen: e.resumen,
    fuente_url: e.fuente_url,
    fuente_tipo: e.fuente_tipo ?? '',
    fecha_publicacion: normFecha(e.fecha_publicacion),
    confianza_clasificador: e.confianza_clasificador ?? null,
    prev_hash: e.hash_evento_anterior,
  };
}
