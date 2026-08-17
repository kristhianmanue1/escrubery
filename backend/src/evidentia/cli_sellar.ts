import { resolve } from 'node:path';
import { crearKysely } from '../db/kysely';
import { sellarPendientes, TSA_URL_DEFAULT, verificarSello } from './tsa';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida (ver backend/.env)');
    process.exit(2);
  }
  const tsa = process.env.ESCRUBERY_TSA_URL ?? TSA_URL_DEFAULT;
  const dirArchivos = resolve(process.cwd(), '..', 'datos', 'checkpoints');
  const db = crearKysely(url);
  try {
    const r = await sellarPendientes(db, dirArchivos, tsa);
    console.log(
      `sellados=${r.sellados} pendientes_restantes=${r.pendientes_restantes}` +
        (r.errores.length ? ` errores=${JSON.stringify(r.errores)}` : ''),
    );

    // verificación offline de todos los sellados (fallo = exit 1)
    const selladosFilas = await db
      .selectFrom('checkpoints')
      .selectAll()
      .where('timestamp_rfc3161', 'is not', null)
      .execute();
    let fallos = 0;
    for (const cp of selladosFilas) {
      if (!cp.timestamp_rfc3161) continue;
      const v = verificarSello(
        Buffer.from(cp.timestamp_rfc3161),
        cp.firmado_json,
      );
      if (!v.ok) {
        fallos += 1;
        console.error(`checkpoint #${cp.id}: sello NO verifica — ${v.detalle}`);
      }
    }
    if (fallos > 0) process.exit(1);
    console.log(`verificación offline: ${selladosFilas.length} sello(s) OK`);
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
