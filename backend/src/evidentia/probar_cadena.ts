import { crearKysely } from '../db/kysely';
import { registrarEvento, verificarCadena } from './event_log';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida (ver backend/.env)');
    process.exit(2);
  }
  const db = crearKysely(url);
  try {
    const cli = await db
      .selectFrom('cli_productos')
      .select('id')
      .where('nombre', '=', 'claude-code')
      .executeTakeFirstOrThrow();

    const a = await registrarEvento(db, {
      record_id: `ev-test-${Date.now()}-a`,
      cli_producto_id: cli.id,
      categoria: 'funcion_nueva',
      resumen: '[TEST] nuevo flag --json en claude mcp',
      fuente_url: 'ejecucion_local_supervisada:test/a',
      fuente_tipo: 'changelog_repo',
      fecha_publicacion: new Date().toISOString(),
      confianza_clasificador: 0.9,
    });
    const b = await registrarEvento(db, {
      record_id: `ev-test-${Date.now()}-b`,
      cli_producto_id: cli.id,
      categoria: 'fix_seguridad',
      resumen: '[TEST] parche de exfiltracion MCP',
      fuente_url: 'ejecucion_local_supervisada:test/b',
      fuente_tipo: 'security_advisory',
      fecha_publicacion: new Date().toISOString(),
      confianza_clasificador: 0.95,
    });
    console.log('evento A hash:', a.hash.slice(0, 16), '...');
    console.log('evento B prev_hash:', b.record.prev_hash.slice(0, 16), '...');
    console.log('B encadena con A:', b.record.prev_hash === a.hash);

    const v = await verificarCadena(db);
    console.log('verificarCadena:', v.ok ? 'OK' : 'FAIL', `(total=${v.total})`);
    if (!v.ok) console.error('errores:', v.errores);

    await db
      .deleteFrom('eventos_changelog')
      .where('fuente_url', 'like', 'ejecucion_local_supervisada:test/%')
      .execute();
    await db.destroy();
    process.exit(v.ok ? 0 : 1);
  } catch (err) {
    await db.destroy();
    console.error(
      'error fatal:',
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
