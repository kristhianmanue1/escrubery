import { crearKysely } from '../db/kysely';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida (ver backend/.env)');
    process.exit(2);
  }
  const db = crearKysely(url);
  try {
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const alertas = await db
      .selectFrom('eventos_changelog')
      .innerJoin(
        'cli_productos',
        'cli_productos.id',
        'eventos_changelog.cli_producto_id',
      )
      .select([
        'eventos_changelog.record_id',
        'cli_productos.nombre as cli',
        'eventos_changelog.categoria',
        'eventos_changelog.resumen',
        'eventos_changelog.fuente_url',
        'eventos_changelog.fecha_deteccion',
        'eventos_changelog.firmado',
      ])
      .where('eventos_changelog.categoria', 'in', [
        'fix_seguridad',
        'breaking_change',
      ])
      .where('eventos_changelog.fecha_deteccion', '>=', hace24h)
      .orderBy('eventos_changelog.fecha_deteccion', 'desc')
      .execute();
    console.log(
      JSON.stringify(
        { alertas_alta_severidad_ultimas_24h: alertas.length, alertas },
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
