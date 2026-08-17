import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  SKIP_DB,
  cerrarDbTest,
  dirTemp,
  getDbTest,
  limpiarEventos,
  sembrarCliTest,
} from './fixtures/test_db';
import { crearCheckpoint } from './checkpoint';
import { hashEvento, registrarEvento, ZERO_HASH } from './event_log';
import { verificarTodo } from './verificar';
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';

// F4a T4 — spec de OMISIÓN (criterio de cierre 5 del plan): un atacante con
// acceso a la BD borra eventos y RE-HACE la cadena desde cero; el checkpoint
// archivado (custodia externa) lo delata en `evidentia:verificar`.
// REQUIERE PostgreSQL (BD de test). Exclusión local: ESCRUBERY_SKIP_DB_SPECS=1.

const d = SKIP_DB ? describe.skip : describe;
let cliId = 0;
let dir: string;
let cpDir: string;
let keyringPath: string;

beforeAll(async () => {
  const db = await getDbTest();
  cliId = await sembrarCliTest(db);
  dir = dirTemp();
  cpDir = join(dir, 'checkpoints');
  mkdirSync(cpDir, { recursive: true });
  process.env.ESCRUBERY_CHECKPOINT_DIR = cpDir;
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  writeFileSync(
    join(dir, 'k.pem'),
    privateKey.export({ type: 'pkcs8', format: 'pem' }),
  );
  keyringPath = join(dir, 'keyring.json');
  writeFileSync(
    keyringPath,
    JSON.stringify({
      schema: 'cagf-keyring/0.2',
      keys: {
        'spec-cp': {
          kid: 'spec-cp',
          type: 'ed25519-public',
          key_b64: (
            publicKey.export({ type: 'spki', format: 'der' }) as Buffer
          ).toString('base64'),
          status: 'active',
        },
      },
    }),
  );
});

afterAll(async () => {
  delete process.env.ESCRUBERY_CHECKPOINT_DIR;
  await cerrarDbTest();
});

async function sembrar3(
  db: Awaited<ReturnType<typeof getDbTest>>,
): Promise<void> {
  await limpiarEventos(db);
  await db.deleteFrom('checkpoints').execute();
  for (const n of [1, 2, 3]) {
    await registrarEvento(db, {
      record_id: `ev-cp-${n}`,
      cli_producto_id: cliId,
      categoria: 'funcion_nueva',
      resumen: `[SPEC] ${n}`,
      fuente_url: `spec://cp/${n}`,
      fuente_tipo: 'changelog_repo',
      fecha_publicacion: null,
      confianza_clasificador: 0.9,
    });
  }
}

d('checkpoint — detección de omisión (criterio de cierre 5)', () => {
  it('ancla 3 eventos y verifica OK', async () => {
    const db = await getDbTest();
    await sembrar3(db);
    const r = await crearCheckpoint(db, 'spec-cp', join(dir, 'k.pem'), cpDir);
    expect(r.creado).toBe(true);
    const v = await verificarTodo(db, keyringPath);
    expect(v.ok).toBe(true);
    expect(v.checkpoints.total).toBe(1);
    expect(v.checkpoints.cola_sin_anclar).toBe(0);
  });

  it('ATAQUE: borrar el evento 2 y re-hacer la cadena → verificar FALLA', async () => {
    const db = await getDbTest();
    // el atacante borra un evento del medio
    await db
      .deleteFrom('eventos_changelog')
      .where('record_id', '=', 'ev-cp-2')
      .execute();
    // ...y re-hace la cadena completa para que sea internamente consistente
    const vivos = await db
      .selectFrom('eventos_changelog')
      .selectAll()
      .orderBy('id', 'asc')
      .execute();
    let prev = ZERO_HASH;
    for (const e of vivos) {
      const base = {
        record_id: e.record_id,
        cli_producto_id: e.cli_producto_id,
        categoria: e.categoria,
        resumen: e.resumen,
        fuente_url: e.fuente_url,
        fuente_tipo: e.fuente_tipo ?? '',
        fecha_publicacion: e.fecha_publicacion
          ? new Date(e.fecha_publicacion).toISOString()
          : null,
        confianza_clasificador: e.confianza_clasificador ?? null,
        prev_hash: prev,
      };
      const nuevoHash = hashEvento(base);
      await db
        .updateTable('eventos_changelog')
        .set({ hash_evento_anterior: prev, hash_evento: nuevoHash })
        .where('id', '=', e.id)
        .execute();
      prev = nuevoHash;
    }
    // la cadena re-hecha es internamente consistente PERO el checkpoint
    // archivado (con el hash original de ev-cp-2 y la raíz de 3 hojas)
    // delata la omisión:
    const v = await verificarTodo(db, keyringPath);
    expect(v.ok).toBe(false);
    expect(v.errores.some((x) => x.includes('raíz del prefijo vivo'))).toBe(
      true,
    );
  });

  it('ATAQUE: borrar TAMBIÉN la fila del checkpoint → verificar delata el archivo huérfano', async () => {
    const db = await getDbTest();
    await db.deleteFrom('checkpoints').execute();
    const v = await verificarTodo(db, keyringPath);
    // sin fila, el archivo archivado queda huérfano: custodia externa delata
    expect(v.ok).toBe(false);
    expect(v.errores.some((x) => x.includes('huérfano'))).toBe(true);
  });
});
