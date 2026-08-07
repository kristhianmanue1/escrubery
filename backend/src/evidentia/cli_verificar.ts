import { resolve } from 'node:path';
import { crearKysely } from '../db/kysely';
import { verificarTodo } from './verificar';

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
  const keyringPath =
    arg('keyring') ??
    resolve(process.cwd(), '..', 'datos', 'keys', 'evidentia-keyring.json');
  const db = crearKysely(url);
  try {
    const r = await verificarTodo(db, keyringPath);
    console.log(
      `verificar: ${r.ok ? 'OK' : 'FAIL'} (total=${r.total}, firmados=${r.firmados})`,
    );
    if (!r.ok) {
      console.error('errores:\n  ' + r.errores.join('\n  '));
    }
    process.exit(r.ok ? 0 : 1);
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
