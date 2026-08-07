import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { canonicalFirmable, reconstruirBase, ZERO_HASH } from './event_log';
import type { Keyring, Signature } from './schema';

export interface ResultadoVerificacion {
  ok: boolean;
  total: number;
  firmados: number;
  errores: string[];
}

export async function verificarTodo(
  db: Kysely<Database>,
  keyringPath: string,
): Promise<ResultadoVerificacion> {
  const keyring = JSON.parse(readFileSync(keyringPath, 'utf8')) as Keyring;
  const eventos = await db
    .selectFrom('eventos_changelog')
    .selectAll()
    .orderBy('id', 'asc')
    .execute();
  const errores: string[] = [];
  let prev = ZERO_HASH;
  let firmados = 0;
  for (const e of eventos) {
    if (e.hash_evento_anterior !== prev) {
      errores.push(`prev_hash mismatch en ${e.record_id}`);
    }
    const base = reconstruirBase(e);
    const payload = Buffer.from(canonicalFirmable(base));
    const h = createHash('sha256').update(payload).digest('hex');
    if (h !== e.hash_evento) {
      errores.push(`hash mismatch en ${e.record_id}`);
    }
    if (e.firmado) {
      const firmas = (e.firmas_json as Signature[] | null) ?? [];
      if (firmas.length === 0) {
        errores.push(`${e.record_id}: marcado firmado sin firmas`);
      }
      for (const f of firmas) {
        const entry = keyring.keys[f.key_id];
        if (!entry) {
          errores.push(`${e.record_id}: key_id ${f.key_id} no en keyring`);
          continue;
        }
        if (entry.status === 'revoked') {
          errores.push(`${e.record_id}: key_id ${f.key_id} revocada`);
          continue;
        }
        if (!f.sig.startsWith('ed25519:')) {
          errores.push(`${e.record_id}: firma sin prefijo ed25519`);
          continue;
        }
        const pub = createPublicKey({
          key: Buffer.from(entry.key_b64, 'base64'),
          format: 'der',
          type: 'spki',
        });
        const sigBytes = Buffer.from(f.sig.slice('ed25519:'.length), 'base64');
        if (!verify(null, payload, pub, sigBytes)) {
          errores.push(
            `${e.record_id}: firma Ed25519 inválida (key ${f.key_id})`,
          );
        }
      }
      firmados += 1;
    }
    prev = e.hash_evento;
  }
  return { ok: errores.length === 0, total: eventos.length, firmados, errores };
}
