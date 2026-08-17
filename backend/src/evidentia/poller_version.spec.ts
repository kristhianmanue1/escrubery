import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import {
  SKIP_DB,
  cerrarDbTest,
  getDbTest,
  limpiarEventos,
} from './fixtures/test_db';
import { pollerCli } from './poller';

// F4a T5 — spec del eslabón poller→version_actual (residual LOW del
// adversarial F3-r4): la última release de GitHub alimenta
// cli_productos.version_actual, que dispara el rebuild del sandbox (§6.2).
// Sin red: fetch global mockeado. REQUIERE PostgreSQL (BD de test).

const d = SKIP_DB ? describe.skip : describe;

const REPO = 'https://github.com/spec-org/spec-cli';

function mockReleases(tags: string[]): void {
  const globalConFetch = globalThis as { fetch?: unknown };
  globalConFetch.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve(
        tags.map((t, i) => ({
          tag_name: t,
          published_at: `2026-08-1${i}T00:00:00Z`,
          body: `release notes ${t}`,
          html_url: `https://github.com/spec-org/spec-cli/releases/tag/${t}`,
        })),
      ),
  });
}

beforeAll(async () => {
  const db = await getDbTest();
  await db
    .insertInto('cli_productos')
    .values({
      nombre: 'spec-cli',
      proveedor: 'spec',
      tipo: 'oficial',
      repo_url: REPO,
      version_actual: '1.0.0',
    })
    .onConflict((oc) =>
      oc.column('nombre').doUpdateSet({ repo_url: REPO, tipo: 'oficial' }),
    )
    .execute();
});

afterAll(async () => {
  await cerrarDbTest();
});

async function versionActual(db: Kysely<Database>): Promise<string | null> {
  const r = await db
    .selectFrom('cli_productos')
    .select('version_actual')
    .where('nombre', '=', 'spec-cli')
    .executeTakeFirst();
  return r?.version_actual ?? null;
}

d('poller — eslabón version_actual (§6.2)', () => {
  beforeEach(async () => {
    const db = await getDbTest();
    await limpiarEventos(db);
    await db
      .updateTable('cli_productos')
      .set({ version_actual: '1.0.0' })
      .where('nombre', '=', 'spec-cli')
      .execute();
  });

  it('la release más nueva escribe version_actual cuando difiere', async () => {
    mockReleases(['v2.3.4', 'v2.3.3', 'v2.3.2']);
    const db = await getDbTest();
    await pollerCli(db, 'spec-cli');
    expect(await versionActual(db)).toBe('2.3.4');
  });

  it('misma versión → no reescribe (y sigue igual)', async () => {
    mockReleases(['v1.0.0']);
    const db = await getDbTest();
    await pollerCli(db, 'spec-cli');
    expect(await versionActual(db)).toBe('1.0.0');
  });

  it('tags patológicos: rust-v0.148.0-alpha.20 → 0.148.0-alpha.20', async () => {
    mockReleases(['rust-v0.148.0-alpha.20']);
    const db = await getDbTest();
    await pollerCli(db, 'spec-cli');
    expect(await versionActual(db)).toBe('0.148.0-alpha.20');
  });

  it('tag sin versión parseable → version_actual intacta (1.0.0)', async () => {
    mockReleases(['release-2026-words-only']);
    const db = await getDbTest();
    await pollerCli(db, 'spec-cli');
    expect(await versionActual(db)).toBe('1.0.0');
  });
});
