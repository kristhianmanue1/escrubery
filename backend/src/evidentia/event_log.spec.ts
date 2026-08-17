import {
  SKIP_DB,
  cerrarDbTest,
  getDbTest,
  limpiarEventos,
  sembrarCliTest,
} from './fixtures/test_db';
import {
  ZERO_HASH,
  hashEvento,
  registrarEvento,
  verificarCadena,
} from './event_log';
import type { EventoBase } from './schema';

// T1a — specs de la cadena Evidentia. REQUIERE PostgreSQL (la BD de test
// aislada `escrubery_test`, nunca la BD real). Exclusión para desarrollo local
// sin BD: ESCRUBERY_SKIP_DB_SPECS=1 npm test (CI corre siempre con PostgreSQL).

const d = SKIP_DB ? describe.skip : describe;

function base(n: string, prevHash: string = ZERO_HASH): EventoBase {
  return {
    record_id: `ev-spec-${n}`,
    cli_producto_id: 0,
    categoria: 'funcion_nueva',
    resumen: `[SPEC] evento ${n}`,
    fuente_url: `spec://cadena/${n}`,
    fuente_tipo: 'changelog_repo',
    fecha_publicacion: '2026-08-17T00:00:00.000Z',
    confianza_clasificador: 0.9,
    prev_hash: prevHash,
  };
}

d('event_log — hash puro (sin BD)', () => {
  it('hashEvento es determinista', () => {
    expect(hashEvento(base('x'))).toBe(hashEvento(base('x')));
  });

  it('cambiar prev_hash cambia el hash (encadenamiento real)', () => {
    expect(hashEvento(base('x', ZERO_HASH))).not.toBe(
      hashEvento(base('x', 'f'.repeat(64))),
    );
  });
});

d('event_log — cadena en BD', () => {
  let cliId = 0;

  beforeAll(async () => {
    const db = await getDbTest();
    cliId = await sembrarCliTest(db);
  });

  afterAll(async () => {
    await cerrarDbTest();
  });

  beforeEach(async () => {
    const db = await getDbTest();
    await limpiarEventos(db);
  });

  it('registrarEvento encadena B contra el hash de A', async () => {
    const db = await getDbTest();
    const a = await registrarEvento(db, {
      record_id: 'ev-spec-a',
      cli_producto_id: cliId,
      categoria: 'funcion_nueva',
      resumen: '[SPEC] A',
      fuente_url: 'spec://cadena/a',
      fuente_tipo: 'changelog_repo',
      fecha_publicacion: new Date('2026-08-17T00:00:00Z'),
      confianza_clasificador: 0.9,
    });
    const b = await registrarEvento(db, {
      record_id: 'ev-spec-b',
      cli_producto_id: cliId,
      categoria: 'fix_seguridad',
      resumen: '[SPEC] B',
      fuente_url: 'spec://cadena/b',
      fuente_tipo: 'security_advisory',
      fecha_publicacion: new Date('2026-08-17T01:00:00Z'),
      confianza_clasificador: 0.95,
    });
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(b.record.prev_hash).toBe(a.hash);

    const v = await verificarCadena(db);
    expect(v.ok).toBe(true);
    expect(v.total).toBe(2);
  });

  it('primer evento de la cadena parte de ZERO_HASH', async () => {
    const db = await getDbTest();
    const a = await registrarEvento(db, {
      record_id: 'ev-spec-first',
      cli_producto_id: cliId,
      categoria: 'ruido_irrelevante',
      resumen: '[SPEC] first',
      fuente_url: 'spec://cadena/first',
      fuente_tipo: 'changelog_repo',
      fecha_publicacion: null,
      confianza_clasificador: null,
    });
    expect(a.record.prev_hash).toBe(ZERO_HASH);
  });

  it('prev_hash alterado → verificarCadena falla con prev_hash mismatch', async () => {
    const db = await getDbTest();
    await registrarEvento(db, {
      record_id: 'ev-spec-t1',
      cli_producto_id: cliId,
      categoria: 'funcion_nueva',
      resumen: '[SPEC] T1',
      fuente_url: 'spec://cadena/t1',
      fuente_tipo: 'changelog_repo',
      fecha_publicacion: null,
      confianza_clasificador: null,
    });
    await registrarEvento(db, {
      record_id: 'ev-spec-t2',
      cli_producto_id: cliId,
      categoria: 'funcion_nueva',
      resumen: '[SPEC] T2',
      fuente_url: 'spec://cadena/t2',
      fuente_tipo: 'changelog_repo',
      fecha_publicacion: null,
      confianza_clasificador: null,
    });
    await db
      .updateTable('eventos_changelog')
      .set({ hash_evento_anterior: 'ff'.repeat(32) })
      .where('record_id', '=', 'ev-spec-t2')
      .execute();
    const v = await verificarCadena(db);
    expect(v.ok).toBe(false);
    expect(v.errores.some((e) => e.includes('prev_hash mismatch'))).toBe(true);
  });

  it('payload alterado sin recalcular → verificarCadena falla con hash mismatch', async () => {
    const db = await getDbTest();
    await registrarEvento(db, {
      record_id: 'ev-spec-p1',
      cli_producto_id: cliId,
      categoria: 'funcion_nueva',
      resumen: '[SPEC] P1',
      fuente_url: 'spec://cadena/p1',
      fuente_tipo: 'changelog_repo',
      fecha_publicacion: null,
      confianza_clasificador: null,
    });
    await db
      .updateTable('eventos_changelog')
      .set({ resumen: '[SPEC] P1 ALTERADO' })
      .where('record_id', '=', 'ev-spec-p1')
      .execute();
    const v = await verificarCadena(db);
    expect(v.ok).toBe(false);
    expect(v.errores.some((e) => e.includes('hash mismatch'))).toBe(true);
  });

  it('la fecha normalizada a ISO hace que el hash verifique tras el round-trip por BD', async () => {
    const db = await getDbTest();
    const fecha = new Date('2026-08-17T12:34:56.789Z');
    const a = await registrarEvento(db, {
      record_id: 'ev-spec-fecha',
      cli_producto_id: cliId,
      categoria: 'cambio_precio',
      resumen: '[SPEC] fecha',
      fuente_url: 'spec://cadena/fecha',
      fuente_tipo: 'github_release',
      fecha_publicacion: fecha,
      confianza_clasificador: 0.75,
    });
    // el hash se computó sobre la fecha ISO normalizada...
    expect(a.record.fecha_publicacion).toBe(fecha.toISOString());
    // ...y verifica tras el round-trip TIMESTAMPTZ por la BD
    const v = await verificarCadena(db);
    expect(v.ok).toBe(true);
  });
});
