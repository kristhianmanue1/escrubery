import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';

const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL no definida (ver backend/.env)');
    process.exit(2);
  }

  const client = new Client({ connectionString });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations_aplicadas (
      id           SERIAL PRIMARY KEY,
      nombre       TEXT NOT NULL UNIQUE,
      aplicada_en  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const archivos = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const { rows: yaAplicadas } = await client.query<{ nombre: string }>(
    'SELECT nombre FROM _migrations_aplicadas',
  );
  const setAplicadas = new Set(yaAplicadas.map((r) => r.nombre));

  let aplicadasAhora = 0;
  for (const archivo of archivos) {
    if (setAplicadas.has(archivo)) {
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, archivo), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO _migrations_aplicadas (nombre) VALUES ($1)',
        [archivo],
      );
      await client.query('COMMIT');
      aplicadasAhora += 1;
      console.log(`aplicada: ${archivo}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(
        `fallo ${archivo}:`,
        err instanceof Error ? err.message : String(err),
      );
      await client.end();
      process.exit(1);
    }
  }

  if (aplicadasAhora === 0) {
    console.log(
      'nada que aplicar (todas las migraciones ya estaban aplicadas)',
    );
  }
  await client.end();
}

main().catch((err) => {
  console.error(
    'error fatal:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
