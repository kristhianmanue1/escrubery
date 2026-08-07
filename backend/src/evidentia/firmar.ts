import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { canonicalFirmable, reconstruirBase } from './event_log';
import type { Signature } from './schema';

export async function firmarPendientes(
  db: Kysely<Database>,
  kid: string,
  privPath: string,
): Promise<{ firmados: number }> {
  const priv = createPrivateKey(readFileSync(privPath));
  const pendientes = await db
    .selectFrom('eventos_changelog')
    .selectAll()
    .where('firmado', '=', false)
    .orderBy('id', 'asc')
    .execute();
  let firmados = 0;
  for (const e of pendientes) {
    const base = reconstruirBase(e);
    const sigBytes = sign(null, Buffer.from(canonicalFirmable(base)), priv);
    const firma: Signature = {
      key_id: kid,
      sig: `ed25519:${sigBytes.toString('base64')}`,
      alg: 'ed25519',
    };
    await db
      .updateTable('eventos_changelog')
      .set({ firmas_json: JSON.stringify([firma]), firmado: true })
      .where('id', '=', e.id)
      .execute();
    firmados += 1;
  }
  return { firmados };
}
