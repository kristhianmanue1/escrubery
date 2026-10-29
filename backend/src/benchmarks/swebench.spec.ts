import { afterEach, afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { Kysely } from 'kysely';
import { SKIP_DB, cerrarDbTest, getDbTest } from '../evidentia/fixtures/test_db';
import type { Database } from '../db/schema';
import {
  aplicarCapturaSwebench,
  extraerLeaderboards,
} from './adaptador_swebench';
import { designacionSwebench, normalizarFilaSwebench } from './dominio';
import { consultarBenchmark, consultarResultados } from './consultas';

// Specs del adaptador SWE-bench Verified (Plan_Benchmarks_v0 F1). BD de test
// aislada (ESCRUBERY_SKIP_DB_SPECS=1 las salta; CI nunca la define).

const skip = SKIP_DB ? describe.skip : describe;

const META = {
  fuente_url: 'https://www.swebench.com/',
  hash_sha256: 'c'.repeat(64),
  fecha_obtencion: new Date('2026-10-29T22:00:00Z'),
};

function run(overrides: Record<string, unknown> = {}) {
  return normalizarFilaSwebench({
    agent: 'mini-SWE-agent',
    agent_org: 'SWE-agent',
    model_display: 'GLM 5',
    model_org: 'Z.ai',
    resolved: 79.2,
    checked: true,
    date: '2025-12-05',
    folder: '20251205_mini-swe-agent_glm-5',
    reasoning_effort: null,
    cost: 105.55,
    instance_cost: 0.35,
    instance_calls: 52.45,
    os_model: false,
    site: null,
    warning: null,
    ...overrides,
  });
}

async function limpiar(db: Kysely<Database>) {
  await db.deleteFrom('benchmark_observaciones').execute();
  await db.deleteFrom('benchmark_subjects').execute();
  await db.deleteFrom('benchmark_definiciones').execute();
  await db.deleteFrom('benchmark_fuentes').execute();
}

skip('adaptador SWE-bench Verified', () => {
  let db: Kysely<Database>;

  beforeEach(async () => {
    db = await getDbTest();
    await limpiar(db);
  });

  afterEach(async () => {
    await limpiar(db);
  });

  afterAll(async () => {
    await cerrarDbTest();
  });

  it('extrae el JSON embebido del HTML (canal del spike) y falla si no está', () => {
    const html = `<html><script type="application/json" id="leaderboard-data">
      [{"name":"Verified","results":[{"agent":"a","model_display":"m","resolved":1.5,"checked":true,"date":"2026-01-01","folder":"f"}]}]
    </script></html>`;
    const data = extraerLeaderboards(html);
    expect(data[0].name).toBe('Verified');
    expect(data[0].results.length).toBe(1);
    expect(() => extraerLeaderboards('<html>sin bloque</html>')).toThrow(
      /fail-closed/,
    );
  });

  it('criterio 2: doble captura idéntica no produce duplicados', async () => {
    const r1 = await aplicarCapturaSwebench(db, META, [run()]);
    const r2 = await aplicarCapturaSwebench(db, META, [run()]);
    expect(r1.nuevas).toBe(1);
    expect(r2.nuevas).toBe(0);
    expect(r2.duplicadas).toBe(1);
    const n = await db.selectFrom('benchmark_observaciones').select('id').execute();
    expect(n.length).toBe(1);
  });

  it('checked mapea a publicado_por plataforma|tercero (verificado vs autoreporte)', async () => {
    await aplicarCapturaSwebench(db, META, [
      run({ folder: 'f1', checked: true }),
      run({ folder: 'f2', checked: false, model_display: 'GPT 5' }),
    ]);
    const obs = await db
      .selectFrom('benchmark_observaciones')
      .select(['run_ref', 'publicado_por'])
      .orderBy('run_ref')
      .execute();
    expect(obs).toEqual([
      { run_ref: 'f1', publicado_por: 'plataforma' },
      { run_ref: 'f2', publicado_por: 'tercero' },
    ]);
  });

  it('subject sistema_compuesto con designación compuesta y vinculación por modelo', async () => {
    await db
      .insertInto('identidad_alias')
      .values({
        issuer_id: 'GLM 5',
        proveedor: 'zhipu',
        modelo_id: 'glm-5',
        notas: 'display SWE-bench',
        fuente_tipo: 'curaduria_propia',
        estado_verificacion: 'pendiente_de_verificar',
      })
      .onConflict((oc) => oc.column('issuer_id').doNothing())
      .execute();
    await aplicarCapturaSwebench(db, META, [run()]);
    const r = await consultarResultados(db, { modelo: 'glm-5' });
    expect(r?.resultados.length).toBe(1);
    expect(r?.resultados[0]?.subject).toMatchObject({
      tipo: 'sistema_compuesto',
      agente: 'mini-SWE-agent',
      modelo_designado: 'GLM 5',
      vinculacion_canonica: { resuelto: true, proveedor: 'zhipu', modelo_id: 'glm-5' },
    });
    expect(r?.resultados[0]?.subject.designacion_original).toBe(
      designacionSwebench({ agent: 'mini-SWE-agent', model_display: 'GLM 5' }),
    );
    await db.deleteFrom('identidad_alias').where('issuer_id', '=', 'GLM 5').execute();
  });

  it('warning del equipo se conserva VERBATIM como limitación declarada', async () => {
    const w = 'Model was run without caching; results may differ.';
    await aplicarCapturaSwebench(db, META, [run({ warning: w })]);
    const o = await db
      .selectFrom('benchmark_observaciones')
      .select('condiciones_json')
      .executeTakeFirstOrThrow();
    expect((o.condiciones_json as { warning_equipo: string }).warning_equipo).toBe(w);
  });

  it('filas parciales sin agente/modelo se saltan declaradas; valor en porcentaje intacto', async () => {
    const r = await aplicarCapturaSwebench(db, META, [
      run(),
      run({ agent: '', folder: 'f-x' }),
      run({ model_display: '', folder: 'f-y' }),
    ]);
    expect(r.nuevas).toBe(1);
    expect(r.filas_saltar).toBe(2);
    const o = await db
      .selectFrom('benchmark_observaciones')
      .select(['valor', 'unidad'])
      .executeTakeFirstOrThrow();
    expect(o.valor).toBe(79.2); // porcentaje 0–100, sin reescalar
    expect(o.unidad).toBe('porcentaje');
  });

  it('guarda de deriva de esquema: columna ausente en TODAS las filas → abort', async () => {
    await expect(
      aplicarCapturaSwebench(db, META, [
        run({ resolved: null, folder: 'a' }),
        run({ resolved: null, folder: 'b' }),
      ]),
    ).rejects.toThrow(/fail-closed/);
    const n = await db.selectFrom('benchmark_observaciones').select('id').execute();
    expect(n.length).toBe(0); // nada ingerido
  });

  it('consultar_benchmark sirve la definición con incompatibilidades propias', async () => {
    await aplicarCapturaSwebench(db, META, [run()]);
    const r = await consultarBenchmark(db, 'swe-bench-verified');
    expect(r?.metrica_principal).toBe('resolved_pct');
    expect(r?.version_metodologia).toBe('verified-1');
    const inc = r?.incompatibilidades_documentadas as string[];
    expect(inc.some((i) => i.includes('Bash Only'))).toBe(true);
  });
});
