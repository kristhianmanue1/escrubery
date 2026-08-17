import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SKIP_DB,
  cerrarDbTest,
  dirTemp,
  getDbTest,
  limpiarEventos,
  sembrarCliTest,
} from './fixtures/test_db';
import { registrarEvento } from './event_log';
import { firmarPendientes } from './firmar';
import { verificarTodo } from './verificar';

// T1a — specs de firma Ed25519 + verificador read-only. REQUIERE PostgreSQL
// (BD de test `escrubery_test`). Exclusión local: ESCRUBERY_SKIP_DB_SPECS=1.
// Las claves se generan efímeras por test (nunca se usan claves reales).

const d = SKIP_DB ? describe.skip : describe;

let cliId = 0;
let dir: string;

beforeAll(async () => {
  const db = await getDbTest();
  cliId = await sembrarCliTest(db);
  dir = dirTemp();
  // los checks de custodia de checkpoints (T4) miran datos/checkpoints del
  // servicio real; en test apuntan a un subdir propio (no el de keyrings).
  mkdirSync(join(dir, 'checkpoints'), { recursive: true });
  process.env.ESCRUBERY_CHECKPOINT_DIR = join(dir, 'checkpoints');
});

afterAll(async () => {
  await cerrarDbTest();
});

function keys(kid: string): { privPath: string; keyringPath: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privPath = join(dir, `${kid}.pem`);
  writeFileSync(privPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const keyringPath = join(dir, `${kid}-keyring.json`);
  writeFileSync(
    keyringPath,
    JSON.stringify({
      schema: 'cagf-keyring/0.2',
      keys: {
        [kid]: {
          kid,
          type: 'ed25519-public',
          key_b64: (
            publicKey.export({ type: 'spki', format: 'der' }) as Buffer
          ).toString('base64'),
          status: 'active',
        },
      },
    }),
  );
  return { privPath, keyringPath };
}

d('firma + verificador Evidentia', () => {
  beforeEach(async () => {
    const db = await getDbTest();
    await limpiarEventos(db);
  });

  it('firmarPendientes firma los eventos y verificarTodo pasa (cadena + Ed25519)', async () => {
    const db = await getDbTest();
    await registrarEvento(db, {
      record_id: 'ev-sf-r1',
      cli_producto_id: cliId,
      categoria: 'fix_seguridad',
      resumen: '[SPEC] r1',
      fuente_url: 'spec://firma/r1',
      fuente_tipo: 'security_advisory',
      fecha_publicacion: null,
      confianza_clasificador: 0.9,
    });
    await registrarEvento(db, {
      record_id: 'ev-sf-r2',
      cli_producto_id: cliId,
      categoria: 'breaking_change',
      resumen: '[SPEC] r2',
      fuente_url: 'spec://firma/r2',
      fuente_tipo: 'changelog_repo',
      fecha_publicacion: null,
      confianza_clasificador: 0.9,
    });
    const { privPath, keyringPath } = keys('spec-kid-ok');
    const f = await firmarPendientes(db, 'spec-kid-ok', privPath);
    expect(f.firmados).toBe(2);
    const v = await verificarTodo(db, keyringPath);
    expect(v.ok).toBe(true);
    expect(v.total).toBe(2);
    expect(v.firmados).toBe(2);
  });

  it('payload alterado tras firmar → firma Ed25519 inválida (y hash mismatch)', async () => {
    const db = await getDbTest();
    await registrarEvento(db, {
      record_id: 'ev-sf-alt',
      cli_producto_id: cliId,
      categoria: 'fix_seguridad',
      resumen: '[SPEC] original',
      fuente_url: 'spec://firma/alt',
      fuente_tipo: 'security_advisory',
      fecha_publicacion: null,
      confianza_clasificador: 0.9,
    });
    const { privPath, keyringPath } = keys('spec-kid-alt');
    await firmarPendientes(db, 'spec-kid-alt', privPath);
    await db
      .updateTable('eventos_changelog')
      .set({ resumen: '[SPEC] ALTERADO' })
      .where('record_id', '=', 'ev-sf-alt')
      .execute();
    const v = await verificarTodo(db, keyringPath);
    expect(v.ok).toBe(false);
    expect(v.errores.some((e) => e.includes('hash mismatch'))).toBe(true);
    expect(v.errores.some((e) => e.includes('firma Ed25519 inválida'))).toBe(
      true,
    );
  });

  it('fail-closed: keyring inexistente rechaza (no hay verificación sin keyring)', async () => {
    const db = await getDbTest();
    await expect(
      verificarTodo(db, join(dir, 'keyring-inexistente.json')),
    ).rejects.toThrow();
  });

  it('key_id ausente del keyring → error explícito', async () => {
    const db = await getDbTest();
    await registrarEvento(db, {
      record_id: 'ev-sf-kid',
      cli_producto_id: cliId,
      categoria: 'funcion_nueva',
      resumen: '[SPEC] kid',
      fuente_url: 'spec://firma/kid',
      fuente_tipo: 'changelog_repo',
      fecha_publicacion: null,
      confianza_clasificador: 0.9,
    });
    const { privPath } = keys('spec-kid-firma');
    const { keyringPath } = keys('spec-kid-otro'); // keyring con OTRO kid
    await firmarPendientes(db, 'spec-kid-firma', privPath);
    const v = await verificarTodo(db, keyringPath);
    expect(v.ok).toBe(false);
    expect(v.errores.some((e) => e.includes('no en keyring'))).toBe(true);
  });

  it('firma sin prefijo ed25519: → error explícito', async () => {
    const db = await getDbTest();
    await registrarEvento(db, {
      record_id: 'ev-sf-pref',
      cli_producto_id: cliId,
      categoria: 'funcion_nueva',
      resumen: '[SPEC] prefijo',
      fuente_url: 'spec://firma/pref',
      fuente_tipo: 'changelog_repo',
      fecha_publicacion: null,
      confianza_clasificador: 0.9,
    });
    const { privPath, keyringPath } = keys('spec-kid-pref');
    await firmarPendientes(db, 'spec-kid-pref', privPath);
    const fila = await db
      .selectFrom('eventos_changelog')
      .select('firmas_json')
      .where('record_id', '=', 'ev-sf-pref')
      .executeTakeFirstOrThrow();
    const firmas = fila.firmas_json as Array<{
      key_id: string;
      sig: string;
      alg: 'ed25519';
    }>;
    await db
      .updateTable('eventos_changelog')
      .set({
        firmas_json: JSON.stringify([
          { ...firmas[0], sig: firmas[0].sig.replace('ed25519:', '') },
        ]),
      })
      .where('record_id', '=', 'ev-sf-pref')
      .execute();
    const v = await verificarTodo(db, keyringPath);
    expect(v.ok).toBe(false);
    expect(v.errores.some((e) => e.includes('sin prefijo ed25519'))).toBe(true);
  });

  it('marcado firmado sin firmas → error explícito', async () => {
    const db = await getDbTest();
    await registrarEvento(db, {
      record_id: 'ev-sf-vacio',
      cli_producto_id: cliId,
      categoria: 'funcion_nueva',
      resumen: '[SPEC] vacio',
      fuente_url: 'spec://firma/vacio',
      fuente_tipo: 'changelog_repo',
      fecha_publicacion: null,
      confianza_clasificador: 0.9,
    });
    const { keyringPath } = keys('spec-kid-vacio');
    await db
      .updateTable('eventos_changelog')
      .set({ firmado: true, firmas_json: JSON.stringify([]) })
      .where('record_id', '=', 'ev-sf-vacio')
      .execute();
    const v = await verificarTodo(db, keyringPath);
    expect(v.ok).toBe(false);
    expect(
      v.errores.some((e) => e.includes('marcado firmado sin firmas')),
    ).toBe(true);
  });
});
