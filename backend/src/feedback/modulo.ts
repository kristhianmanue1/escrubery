import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

export interface FeedbackInput {
  tipo: string;
  descripcion: string;
  consulta_origen?: unknown;
  agente_reportante: { id: string; configuration_fingerprint?: string };
}

export interface FeedbackResp {
  feedback_id: string;
  estado: string;
  deduplicado_de: string | null;
  registrado_en: string;
  procedencia: {
    agente_reportante: string;
    version_servicio: string | null;
  };
}

function dedupHash(i: FeedbackInput): string {
  const norm = i.descripcion.trim().toLowerCase();
  return createHash('sha256')
    .update(
      JSON.stringify({
        tipo: i.tipo,
        descripcion: norm,
        consulta_origen: i.consulta_origen ?? null,
      }),
    )
    .digest('hex');
}

export async function reportarFeedback(
  db: Kysely<Database>,
  input: FeedbackInput,
): Promise<FeedbackResp> {
  const hash = dedupHash(input);
  const version = process.env.npm_package_version ?? null;
  const existente = await db
    .selectFrom('feedback')
    .select(['id', 'fecha'])
    .where('hash_dedup', '=', hash)
    .executeTakeFirst();
  if (existente) {
    return {
      feedback_id: `fb_${existente.id}`,
      estado: 'duplicado',
      deduplicado_de: `fb_${existente.id}`,
      registrado_en: existente.fecha
        ? new Date(existente.fecha).toISOString()
        : new Date().toISOString(),
      procedencia: {
        agente_reportante: input.agente_reportante.id,
        version_servicio: version,
      },
    };
  }
  const ahora = new Date();
  const r = await db
    .insertInto('feedback')
    .values({
      tipo: input.tipo,
      descripcion: input.descripcion,
      consulta_origen: input.consulta_origen ?? null,
      agente_reportante: input.agente_reportante,
      hash_dedup: hash,
      estado: 'nuevo',
      deduplicado_de: null,
      estado_datos_hash: null,
      version_servicio: version,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return {
    feedback_id: `fb_${r.id}`,
    estado: 'nuevo',
    deduplicado_de: null,
    registrado_en: ahora.toISOString(),
    procedencia: {
      agente_reportante: input.agente_reportante.id,
      version_servicio: version,
    },
  };
}
