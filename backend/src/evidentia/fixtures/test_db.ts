import { mkdtempSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from 'pg';
import type { Kysely } from 'kysely';
import { crearKysely } from '../../db/kysely';
import type { Database } from '../../db/schema';

// Helper de BD de test (T1a). Mecanismo de exclusión documentado en el
// encabezado de cada spec de BD: ESCRUBERY_SKIP_DB_SPECS=1 salta los specs de
// BD (desarrollo local sin PostgreSQL). CI corre SIEMPRE con PostgreSQL y no
// define la variable. La BD de test es `escrubery_test` (aislada de la BD real
// `escrubery`); se crea y migra idempotentemente en el primer uso.

export const SKIP_DB = process.env.ESCRUBERY_SKIP_DB_SPECS === '1';

const TEST_DB_URL =
  process.env.ESCRUBERY_TEST_DATABASE_URL ??
  'postgresql:///escrubery_test?host=/tmp';
const ADMIN_URL =
  process.env.ESCRUBERY_TEST_ADMIN_URL ?? 'postgresql:///postgres?host=/tmp';
const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');

let db: Kysely<Database> | null = null;

async function asegurarBdCreada(): Promise<void> {
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  try {
    const { rows } = await admin.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname = 'escrubery_test'",
    );
    if (rows.length === 0) {
      await admin.query('CREATE DATABASE escrubery_test');
    }
  } catch (err) {
    // 42P04 = duplicate_database (carrera con otro worker de jest)
    const code = (err as { code?: string }).code;
    if (code !== '42P04') throw err;
  } finally {
    await admin.end();
  }
}

async function aplicarMigraciones(): Promise<void> {
  const client = new Client({ connectionString: TEST_DB_URL });
  await client.connect();
  try {
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
    for (const archivo of archivos) {
      await client.query('BEGIN');
      try {
        // lock advisory: serializa workers de jest concurrentes
        await client.query('SELECT pg_advisory_xact_lock(421978)');
        const { rows } = await client.query<{ nombre: string }>(
          'SELECT nombre FROM _migrations_aplicadas WHERE nombre = $1',
          [archivo],
        );
        if (rows.length > 0) {
          await client.query('COMMIT');
          continue;
        }
        const sql = await readFile(join(MIGRATIONS_DIR, archivo), 'utf8');
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations_aplicadas (nombre) VALUES ($1)',
          [archivo],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

export async function getDbTest(): Promise<Kysely<Database>> {
  if (db) return db;
  await asegurarBdCreada();
  await aplicarMigraciones();
  db = crearKysely(TEST_DB_URL);
  return db;
}

/** Id del cli_producto de prueba (lo siembra idempotentemente). */
export async function sembrarCliTest(db: Kysely<Database>): Promise<number> {
  await db
    .insertInto('cli_productos')
    .values({
      nombre: 'spec-cli',
      proveedor: 'spec',
      tipo: 'oficial',
    })
    .onConflict((oc) => oc.column('nombre').doNothing())
    .execute();
  const cli = await db
    .selectFrom('cli_productos')
    .select('id')
    .where('nombre', '=', 'spec-cli')
    .executeTakeFirstOrThrow();
  return cli.id;
}

/** Vacía la cadena de eventos (BD de test aislada; seguro). */
export async function limpiarEventos(db: Kysely<Database>): Promise<void> {
  await db.deleteFrom('eventos_changelog').execute();
}

/** Directorio privado efímero para llaves/keyrings de test. */
export function dirTemp(): string {
  return mkdtempSync(join(tmpdir(), 'escrubery-spec-'));
}

export async function cerrarDbTest(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
}
