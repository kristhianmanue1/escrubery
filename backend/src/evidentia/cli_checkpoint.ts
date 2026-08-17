import { resolve } from 'node:path';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { crearKysely } from '../db/kysely';
import { crearCheckpoint, pathInclusion, hojaMerkle } from './checkpoint';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida (ver backend/.env)');
    process.exit(2);
  }
  const kid = process.argv[2] ?? 'escrubery-evidentia-001';
  const privPath =
    process.argv[3] ??
    resolve(
      process.env.HOME ?? '',
      '.escrubery/keys/escrubery-evidentia-001.pem',
    );
  const dirArchivos = resolve(process.cwd(), '..', 'datos', 'checkpoints');
  const db: Kysely<Database> = crearKysely(url);
  try {
    const r = await crearCheckpoint(db, kid, privPath, dirArchivos);
    console.log(
      r.creado
        ? `checkpoint #${r.checkpoint_id} creado: eventos_hasta=${r.payload.eventos_hasta} raíz=${r.payload.merkle_root.slice(0, 16)}...`
        : `skip: ${r.motivo} (#${r.checkpoint_id}, hasta=${r.payload.eventos_hasta})`,
    );

    // muestra: prueba de inclusión del tip, verificable por tercero
    const eventos = await db
      .selectFrom('eventos_changelog')
      .select(['id', 'record_id', 'hash_evento'])
      .orderBy('id', 'asc')
      .execute();
    const hojas = eventos.map((e) => hojaMerkle(e.hash_evento));
    const tipIdx = eventos.findIndex((e) => e.id === r.payload.eventos_hasta);
    const path = pathInclusion(hojas, tipIdx);
    console.log(
      JSON.stringify(
        {
          record_id: eventos[tipIdx].record_id,
          leaf_index: tipIdx,
          tree_size: eventos.length,
          path_length: path.length,
          merkle_root: r.payload.merkle_root,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(
    'error fatal:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
