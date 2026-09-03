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
// adversarial F3-r4): la ventana de releases de GitHub alimenta
// cli_productos.version_actual, que dispara el rebuild del sandbox (§6.2).
// Fix 2026-08-28 (incidente cline desktop-v0.0.17): escribe la MÁXIMA
// parseable de la ventana, solo si es semver-Mayor que la conocida —
// nunca contamina hacia abajo. Sin red: fetch global mockeado.
// REQUIERE PostgreSQL (BD de test).

const d = SKIP_DB ? describe.skip : describe;

const REPO = 'https://github.com/spec-org/spec-cli';
// Mapeo inyectado en los specs: spec-cli "instala" del paquete npm spec-cli
// (el mapeo de producción PAQUETE_NPM no incluye CLIs de test).
const PAQUETES_SPEC = { 'spec-cli': 'spec-cli' };

function mockReleases(tags: string[]): void {
  const globalConFetch = globalThis as { fetch?: unknown };
  globalConFetch.fetch = jest.fn().mockImplementation((url: string | URL) => {
    const u = String(url);
    if (u.includes('registry.npmjs.org')) {
      // registry.npmjs.org/<pkg>/<version> — 200 existe, 404 no; el mock solo
      // conoce versiones del paquete npm "spec-cli" (ver setVersionesNpm).
      const version = decodeURIComponent(u.split('/').pop() ?? '');
      const existe = versionesNpmMock.includes(version);
      return Promise.resolve({ status: existe ? 200 : 404, ok: existe });
    }
    return Promise.resolve({
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
  });
}

let versionesNpmMock: string[] = ['1.0.0'];

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
    versionesNpmMock = ['1.0.0', '2.3.4', '2.3.3', '2.3.2', '3.0.56', '3.1.0'];
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
    await pollerCli(db, 'spec-cli', undefined, PAQUETES_SPEC);
    expect(await versionActual(db)).toBe('2.3.4');
  });

  it('misma versión → no reescribe (y sigue igual)', async () => {
    mockReleases(['v1.0.0']);
    const db = await getDbTest();
    await pollerCli(db, 'spec-cli', undefined, PAQUETES_SPEC);
    expect(await versionActual(db)).toBe('1.0.0');
  });

  it('tag patológico: rust-v0.148.0-alpha.20 extrae y escribe si es mayor', async () => {
    mockReleases(['rust-v0.148.0-alpha.20']);
    versionesNpmMock = ['0.147.0', '0.148.0-alpha.20'];
    const db = await getDbTest();
    await db
      .updateTable('cli_productos')
      .set({ version_actual: '0.147.0' })
      .where('nombre', '=', 'spec-cli')
      .execute();
    await pollerCli(db, 'spec-cli', undefined, PAQUETES_SPEC);
    expect(await versionActual(db)).toBe('0.148.0-alpha.20');
  });

  it('tag sin versión parseable → version_actual intacta (1.0.0)', async () => {
    mockReleases(['release-2026-words-only']);
    const db = await getDbTest();
    await pollerCli(db, 'spec-cli', undefined, PAQUETES_SPEC);
    expect(await versionActual(db)).toBe('1.0.0');
  });

  it('incidente cline: desktop-v0.0.17 (menor) no contamina 3.0.56', async () => {
    mockReleases(['desktop-v0.0.17', 'v3.0.56', 'v3.0.55']);
    const db = await getDbTest();
    await db
      .updateTable('cli_productos')
      .set({ version_actual: '3.0.56' })
      .where('nombre', '=', 'spec-cli')
      .execute();
    await pollerCli(db, 'spec-cli', undefined, PAQUETES_SPEC);
    expect(await versionActual(db)).toBe('3.0.56');
  });

  it('release verdadera mayor en la ventana escribe aunque releases[0] sea de otro artefacto', async () => {
    mockReleases(['desktop-v0.0.18', 'v3.1.0', 'v3.0.56']);
    const db = await getDbTest();
    await db
      .updateTable('cli_productos')
      .set({ version_actual: '3.0.56' })
      .where('nombre', '=', 'spec-cli')
      .execute();
    await pollerCli(db, 'spec-cli', undefined, PAQUETES_SPEC);
    expect(await versionActual(db)).toBe('3.1.0');
  });

  it('baseline null → escribe la máxima parseable de la ventana', async () => {
    mockReleases(['v2.3.4', 'v2.3.3']);
    const db = await getDbTest();
    await db
      .updateTable('cli_productos')
      .set({ version_actual: null })
      .where('nombre', '=', 'spec-cli')
      .execute();
    await pollerCli(db, 'spec-cli', undefined, PAQUETES_SPEC);
    expect(await versionActual(db)).toBe('2.3.4');
  });

  // --- Gate de fuente primaria (tarjeta gate-fuente-primaria-versiones) ---

  it('gate npm: versión MAYOR pero ausente en npm → no escribe + nota (caso cline v4.1.17 real)', async () => {
    // Ventana real del hallazgo 2026-09-03: el tag v4.1.17 de cline/cline
    // (extensión/desktop) es semver-Mayor que el CLI npm (3.0.61) pero NO
    // existe en el paquete que el sandbox instala.
    mockReleases(['v4.1.17', 'v3.0.61']);
    versionesNpmMock = ['3.0.56', '3.0.60', '3.0.61'];
    const db = await getDbTest();
    await db
      .updateTable('cli_productos')
      .set({ version_actual: '3.0.60' })
      .where('nombre', '=', 'spec-cli')
      .execute();
    const r = await pollerCli(db, 'spec-cli', undefined, PAQUETES_SPEC);
    expect(await versionActual(db)).toBe('3.0.60');
    expect(r.nota_version).toEqual({
      candidata: '4.1.17',
      razon: 'ausente_en_npm',
    });
  });

  it('gate npm: la segunda mayor npm-existente de la ventana no se escribe si la mayor fue rechazada', async () => {
    // La candidata es la MÁXIMA de la ventana; si el gate la rechaza, no se
    // "cae" a la siguiente (la ventana siguiente la traerá si es real).
    mockReleases(['v4.1.17', 'v3.0.61']);
    versionesNpmMock = ['3.0.56', '3.0.60', '3.0.61'];
    const db = await getDbTest();
    await db
      .updateTable('cli_productos')
      .set({ version_actual: '3.0.60' })
      .where('nombre', '=', 'spec-cli')
      .execute();
    await pollerCli(db, 'spec-cli', undefined, PAQUETES_SPEC);
    expect(await versionActual(db)).toBe('3.0.60');
  });

  it('gate npm: prerelease npm-existente SÍ se escribe (codex 0.154.0-alpha.1 no debe romperse)', async () => {
    mockReleases(['rust-v0.154.0-alpha.1']);
    versionesNpmMock = ['0.153.0-alpha.2', '0.154.0-alpha.1'];
    const db = await getDbTest();
    await db
      .updateTable('cli_productos')
      .set({ version_actual: '0.153.0-alpha.2' })
      .where('nombre', '=', 'spec-cli')
      .execute();
    const r = await pollerCli(db, 'spec-cli', undefined, PAQUETES_SPEC);
    expect(await versionActual(db)).toBe('0.154.0-alpha.1');
    expect(r.nota_version).toBeUndefined();
  });

  it.each([['500'], ['red']])(
    'gate npm: registry %s → fail-closed, NO escribe + nota',
    async (modo) => {
      mockReleases(['v2.3.4']);
      const globalConError = globalThis as { fetch?: unknown };
      globalConError.fetch = jest
        .fn()
        .mockImplementation((url: string | URL) => {
          if (String(url).includes('registry.npmjs.org')) {
            if (modo === '500') {
              return Promise.resolve({ status: 500, ok: false });
            }
            return Promise.reject(new Error('red caída'));
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve([
                {
                  tag_name: 'v2.3.4',
                  published_at: '2026-09-01T00:00:00Z',
                  body: 'notes',
                  html_url:
                    'https://github.com/spec-org/spec-cli/releases/tag/v2.3.4',
                },
              ]),
          });
        });
      const db = await getDbTest();
      const r = await pollerCli(db, 'spec-cli', undefined, PAQUETES_SPEC);
      expect(await versionActual(db)).toBe('1.0.0');
      expect(r.nota_version).toEqual({
        candidata: '2.3.4',
        razon: 'npm_indisponible',
      });
    },
  );

  it('CLI sin mapeo npm (grok-build) → comportamiento semver-only intacto', async () => {
    mockReleases(['v9.9.9']);
    // Sin paquete en el mapeo: el gate npm no participa aunque npm no conozca
    // la versión (la única fuente es GitHub).
    const db = await getDbTest();
    await pollerCli(db, 'spec-cli', undefined, {});
    expect(await versionActual(db)).toBe('9.9.9');
  });

  it('baseline null con gate npm y candidata ausente → NO escribe (null no autoriza)', async () => {
    mockReleases(['v4.1.17']);
    versionesNpmMock = ['3.0.61'];
    const db = await getDbTest();
    await db
      .updateTable('cli_productos')
      .set({ version_actual: null })
      .where('nombre', '=', 'spec-cli')
      .execute();
    const r = await pollerCli(db, 'spec-cli', undefined, PAQUETES_SPEC);
    expect(await versionActual(db)).toBeNull();
    expect(r.nota_version?.razon).toBe('ausente_en_npm');
  });
});
