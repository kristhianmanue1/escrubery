import { crearKysely } from '../db/kysely';
import { firmarPendientes } from './firmar';

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
  const kid = arg('kid') ?? process.env.EVIDENTIA_KEY_ID;
  const privPath = arg('priv') ?? process.env.EVIDENTIA_PRIVATE_KEY_PATH;
  if (!kid || !privPath) {
    console.error(
      'uso: evidentia:firmar -- --kid <kid> --priv <path-PEM> (o EVIDENTIA_KEY_ID / EVIDENTIA_PRIVATE_KEY_PATH)',
    );
    process.exit(2);
  }
  const db = crearKysely(url);
  try {
    const r = await firmarPendientes(db, kid, privPath);
    console.log(JSON.stringify(r));
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
