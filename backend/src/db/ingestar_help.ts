import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { crearKysely } from './kysely';

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const cli = arg('cli');
  const comando = arg('comando');
  const desde = arg('desde');
  const url = process.env.DATABASE_URL;
  if (!cli || !comando || !desde) {
    console.error(
      'uso: db:ingestar-help -- --cli <id> --comando <comando> --desde <archivo>',
    );
    process.exit(2);
  }
  if (!url) {
    console.error('DATABASE_URL no definida (ver backend/.env)');
    process.exit(2);
  }
  const contenido = await readFile(desde, 'utf8');
  const hash = createHash('sha256').update(contenido).digest('hex');
  const ahora = new Date();
  const vigenteCmd = new Date(
    ahora.getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const db = crearKysely(url);
  try {
    const cliRow = await db
      .selectFrom('cli_productos')
      .select('id')
      .where('nombre', '=', cli)
      .executeTakeFirst();
    if (!cliRow) {
      console.error(`cli "${cli}" no encontrado en cli_productos`);
      process.exit(1);
    }
    const fuenteUrl = `ejecucion_local_supervisada:${cli}/${comando}`;
    await db
      .insertInto('cli_comandos')
      .values({
        cli_producto_id: cliRow.id,
        comando,
        flags_json: { salida: contenido },
        descripcion: null,
        version_detectada_desde: null,
        fuente_url: fuenteUrl,
        fuente_tipo: 'ejecucion_local_supervisada',
        fecha_obtencion: ahora.toISOString(),
        hash_sha256_contenido_original: hash,
        estado_verificacion: 'inferido_de_comportamiento',
        vigente_hasta: vigenteCmd,
      })
      .onConflict((oc) =>
        oc.columns(['cli_producto_id', 'comando']).doUpdateSet({
          flags_json: { salida: contenido },
          fuente_url: fuenteUrl,
          fuente_tipo: 'ejecucion_local_supervisada',
          fecha_obtencion: ahora.toISOString(),
          hash_sha256_contenido_original: hash,
          estado_verificacion: 'inferido_de_comportamiento',
          vigente_hasta: vigenteCmd,
        }),
      )
      .execute();
    console.log(
      `ingestado: cli=${cli} comando=${comando} hash=${hash.slice(0, 12)}... fuente=ejecucion_local_supervisada`,
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
