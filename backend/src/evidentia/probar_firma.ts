import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { crearKysely } from '../db/kysely';
import { registrarEvento } from './event_log';
import { firmarPendientes } from './firmar';
import { verificarTodo } from './verificar';

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida');
    process.exit(2);
  }
  const keysDir = '/tmp/escrubery-test-keys';
  mkdirSync(keysDir, { recursive: true, mode: 0o700 });
  const kid = `test-e2e-${Date.now()}`;
  const privPath = `${keysDir}/${kid}.pem`;
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }), {
    mode: 0o600,
  });
  const keyB64 = (
    publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  ).toString('base64');
  const keyringPath = '/tmp/test-keyring-e2e.json';
  writeFileSync(
    keyringPath,
    JSON.stringify({
      schema: 'cagf-keyring/0.2',
      keys: {
        [kid]: {
          kid,
          type: 'ed25519-public',
          key_b64: keyB64,
          status: 'active',
        },
      },
    }),
  );

  const db = crearKysely(url);
  try {
    await db.deleteFrom('eventos_changelog').execute();
    const cli = await db
      .selectFrom('cli_productos')
      .select('id')
      .where('nombre', '=', 'claude-code')
      .executeTakeFirstOrThrow();
    await registrarEvento(db, {
      record_id: `ef-a-${kid}`,
      cli_producto_id: cli.id,
      categoria: 'fix_seguridad',
      resumen: '[E2E] parche MCP',
      fuente_url: `test/e2e/${kid}/a`,
      fuente_tipo: 'security_advisory',
      fecha_publicacion: new Date().toISOString(),
      confianza_clasificador: 0.9,
    });
    await registrarEvento(db, {
      record_id: `ef-b-${kid}`,
      cli_producto_id: cli.id,
      categoria: 'breaking_change',
      resumen: '[E2E] break',
      fuente_url: `test/e2e/${kid}/b`,
      fuente_tipo: 'changelog_repo',
      fecha_publicacion: new Date().toISOString(),
      confianza_clasificador: 0.9,
    });

    const f = await firmarPendientes(db, kid, privPath);
    const v = await verificarTodo(db, keyringPath);
    console.log(
      `firmados=${f.firmados} verificar=${v.ok ? 'OK' : 'FAIL'} total=${v.total} firmados_verif=${v.firmados}`,
    );
    if (!v.ok) console.error('errores:', v.errores);

    await db.deleteFrom('eventos_changelog').execute();
    await db.destroy();
    process.exit(v.ok && f.firmados === 2 ? 0 : 1);
  } catch (err) {
    await db.destroy();
    throw err;
  }
}

main().catch((err) => {
  console.error(
    'error fatal:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
