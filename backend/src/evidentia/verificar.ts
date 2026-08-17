import { createHash, createPublicKey, verify } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { canonicalFirmable, reconstruirBase, ZERO_HASH } from './event_log';
import { hojaMerkle, raizMerkle } from './checkpoint';
import { verificarSello } from './tsa';
import type { Keyring, Signature } from './schema';

export interface ResultadoVerificacion {
  ok: boolean;
  total: number;
  firmados: number;
  errores: string[];
  checkpoints: {
    total: number;
    sellados: number;
    pendientes: number;
    ultimo_hasta: number | null;
    cola_sin_anclar: number;
  };
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

  // F4a T4 — verificación de checkpoints (detección de omisión/alteración):
  // (a) firma Ed25519 de firmado_json contra keyring; (b) archivo↔BD byte
  // idéntico; (c) recompute del root sobre el prefijo VIVO vs guardado (un
  // evento borrado+cadena rehecha delata aquí); (d) TSR re-verificado.
  const checkpoints = await db
    .selectFrom('checkpoints')
    .selectAll()
    .orderBy('eventos_hasta', 'asc')
    .execute();
  let sellados = 0;
  let pendientes = 0;
  // dir de custodia: env (specs de BD lo apuntan a temp) o el real commiteable
  const dirCheckpoints =
    process.env.ESCRUBERY_CHECKPOINT_DIR ??
    join(process.cwd(), '..', 'datos', 'checkpoints');
  for (const cp of checkpoints) {
    const payload = JSON.parse(cp.firmado_json) as {
      creado_en: string;
      merkle_root: string;
    };
    // (a) firma
    const entry = keyring.keys[cp.key_id];
    if (!entry) {
      errores.push(`checkpoint #${cp.id}: key_id ${cp.key_id} no en keyring`);
    } else if (!cp.sig.startsWith('ed25519:')) {
      errores.push(`checkpoint #${cp.id}: firma sin prefijo ed25519`);
    } else {
      const pub = createPublicKey({
        key: Buffer.from(entry.key_b64, 'base64'),
        format: 'der',
        type: 'spki',
      });
      const sigBytes = Buffer.from(cp.sig.slice('ed25519:'.length), 'base64');
      if (!verify(null, Buffer.from(cp.firmado_json), pub, sigBytes)) {
        errores.push(`checkpoint #${cp.id}: firma Ed25519 inválida`);
      }
    }
    // (b) archivo ↔ BD byte idéntico
    const archivo = join(
      dirCheckpoints,
      `${payload.creado_en.replace(/[:.]/g, '-')}.json`,
    );
    if (!existsSync(archivo)) {
      errores.push(
        `checkpoint #${cp.id}: archivo archivado ausente (${archivo})`,
      );
    } else {
      const archivado = JSON.parse(readFileSync(archivo, 'utf8')) as {
        payload: unknown;
        sig: string;
      };
      // identidad reproducible: el JCS del payload archivado == bytes firmados en BD
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { canonicalize } = require('./jcs') as typeof import('./jcs');
      if (
        canonicalize(archivado.payload) !== cp.firmado_json ||
        archivado.sig !== cp.sig
      ) {
        errores.push(`checkpoint #${cp.id}: archivo ↔ BD difieren`);
      }
    }
    // (c) recompute del root sobre el prefijo vivo
    const vivos = await db
      .selectFrom('eventos_changelog')
      .select(['id', 'hash_evento'])
      .where('id', '<=', cp.eventos_hasta)
      .orderBy('id', 'asc')
      .execute();
    if (vivos.length === 0 || vivos[vivos.length - 1].id !== cp.eventos_hasta) {
      errores.push(
        `checkpoint #${cp.id}: prefijo roto — el tip ${cp.eventos_hasta} ya no existe (¿eventos borrados?)`,
      );
    } else {
      const raizViva = raizMerkle(vivos.map((v) => hojaMerkle(v.hash_evento)));
      if (raizViva.toString('hex') !== payload.merkle_root) {
        errores.push(
          `checkpoint #${cp.id}: raíz del prefijo vivo ≠ raíz anclada (omisión o alteración)`,
        );
      }
    }
    // (d) TSR
    if (cp.timestamp_rfc3161) {
      const v = verificarSello(
        Buffer.from(cp.timestamp_rfc3161),
        cp.firmado_json,
      );
      if (!v.ok)
        errores.push(
          `checkpoint #${cp.id}: sello RFC 3161 no verifica — ${v.detalle}`,
        );
      sellados += 1;
    } else {
      pendientes += 1;
    }
  }
  // archivos huérfanos (archivo sin fila)
  if (existsSync(dirCheckpoints)) {
    const archivos = readdirSync(dirCheckpoints).filter((f) =>
      f.endsWith('.json'),
    );
    const hastaSet = new Set(
      checkpoints.map((c) =>
        (JSON.parse(c.firmado_json) as { creado_en: string }).creado_en.replace(
          /[:.]/g,
          '-',
        ),
      ),
    );
    for (const a of archivos) {
      if (!hastaSet.has(a.replace(/\.json$/, ''))) {
        errores.push(`archivo de checkpoint huérfano: ${a}`);
      }
    }
  }
  const ultimoHasta = checkpoints.length
    ? checkpoints[checkpoints.length - 1].eventos_hasta
    : null;
  const colaSinAnclar = ultimoHasta
    ? eventos.filter((e) => e.id > ultimoHasta).length
    : eventos.length;

  return {
    ok: errores.length === 0,
    total: eventos.length,
    firmados,
    errores,
    checkpoints: {
      total: checkpoints.length,
      sellados,
      pendientes,
      ultimo_hasta: ultimoHasta,
      cola_sin_anclar: colaSinAnclar,
    },
  };
}
