import { readFileSync } from 'node:fs';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { crearKysely } from '../db/kysely';
import { hojaMerkle, pathInclusion, raizDesdePrueba } from './checkpoint';

// F4a T2 — prueba de inclusión verificable OFFLINE por un tercero:
// salida auto-contenida; la verificación usa solo estos datos + la política
// RFC 6962 (raizDesdePrueba es el lado verificador, independiente de la
// construcción).

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida (ver backend/.env)');
    process.exit(2);
  }
  const record = arg('record');
  const archivo = arg('checkpoint');
  if (!record || !archivo) {
    console.error(
      'uso: evidentia:prueba-inclusion -- --record <record_id> --checkpoint <ruta archivo json>',
    );
    process.exit(2);
  }
  const db: Kysely<Database> = crearKysely(url);
  try {
    // el "tercero": el checkpoint se lee del ARCHIVO (no de la BD)
    const archivado = JSON.parse(readFileSync(archivo, 'utf8')) as {
      payload: { merkle_root: string; eventos_hasta: number };
    };
    const eventos = await db
      .selectFrom('eventos_changelog')
      .select(['id', 'record_id', 'hash_evento'])
      .orderBy('id', 'asc')
      .execute();
    const idx = eventos.findIndex((e) => e.record_id === record);
    if (idx < 0) {
      console.error(`record ${record} no existe`);
      process.exit(1);
    }
    if (eventos[idx].id > archivado.payload.eventos_hasta) {
      console.error(
        `record ${record} (id ${eventos[idx].id}) fuera del rango del checkpoint (hasta ${archivado.payload.eventos_hasta})`,
      );
      process.exit(1);
    }
    const dentro = eventos.filter(
      (e) => e.id <= archivado.payload.eventos_hasta,
    );
    const hojas = dentro.map((e) => hojaMerkle(e.hash_evento));
    const leafIndex = dentro.findIndex((e) => e.record_id === record);
    const path = pathInclusion(hojas, leafIndex);
    const salida = {
      record_id: record,
      hash_evento: dentro[leafIndex].hash_evento,
      leaf_index: leafIndex,
      tree_size: dentro.length,
      path,
      merkle_root: archivado.payload.merkle_root,
      como_verificar:
        'raiz = fold(path): primera=hoja(0x00‖hash_evento); paso: izq? H(0x01‖sib‖raiz) : H(0x01‖raiz‖sib); comparar con merkle_root',
    };
    // autoverificación con el lado verificador independiente
    const raiz = raizDesdePrueba(dentro[leafIndex].hash_evento, path).toString(
      'hex',
    );
    const ok = raiz === archivado.payload.merkle_root;
    console.log(JSON.stringify({ ...salida, verifica: ok }, null, 2));
    process.exitCode = ok ? 0 : 1;
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
