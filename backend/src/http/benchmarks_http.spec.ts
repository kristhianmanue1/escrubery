import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  SKIP_DB,
  cerrarDbTest,
  getDbTest,
} from '../evidentia/fixtures/test_db';
import { AppModule } from '../app.module';
import { reiniciarRateLimit, sha256Hex } from './auth.guard';
import { cerrarDbV0 } from './v0.controller';
import { aplicarCapturaLmarena } from '../benchmarks/ingesta';

// Errata 13 — endpoints HTTP del módulo benchmarks (supertest sobre la app
// real con guard activo). Los 200 requieren PostgreSQL (BD de test);
// los 400 de validación también tocan BD por el guard → todo el spec se
// excluye con ESCRUBERY_SKIP_DB_SPECS=1.

const skip = SKIP_DB ? describe.skip : describe;
const CLAVE = 'spec-clave-benchmarks';
const META = {
  config: 'webdev',
  fuente_url: 'https://datasets-server.huggingface.co/filter?…',
  hash_sha256: 'b'.repeat(64),
  fecha_obtencion: new Date(),
};

let app: INestApplication;

interface Resp {
  status: number;
  body: Record<string, unknown> & {
    error?: { codigo: string };
    benchmarks?: { benchmark: string }[];
  };
}

beforeAll(async () => {
  process.env.ESCRUBERY_API_KEYS = sha256Hex(CLAVE);
  process.env.ESCRUBERY_RATE_LIMIT_RPM = '120';
  process.env.DATABASE_URL =
    process.env.ESCRUBERY_TEST_DATABASE_URL ??
    'postgresql:///escrubery_test?host=/tmp';
  reiniciarRateLimit();
  const db = await getDbTest();
  await aplicarCapturaLmarena(db, META, [
    {
      model_name: 'GLM-5.3 (Max)',
      organization: 'zai',
      license: 'MIT',
      rating: 1622.8,
      rating_lower: 1615.5,
      rating_upper: 1630.0,
      variance: 13.6,
      vote_count: 11150,
      rank: 27,
      category: 'overall',
      leaderboard_publish_date: '2026-10-28',
    },
  ]);
  await cerrarDbTest();
  const mod = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = mod.createNestApplication();
  await app.init();
});

afterAll(async () => {
  delete process.env.ESCRUBERY_API_KEYS;
  delete process.env.ESCRUBERY_RATE_LIMIT_RPM;
  await app.close();
  await cerrarDbV0();
});

skip('HTTP /v0 benchmarks (errata 13)', () => {
  it('listar_benchmarks → 200 con definiciones', async () => {
    const r = (await request(app.getHttpServer())
      .post('/v0/listar_benchmarks')
      .set('x-api-key', CLAVE)
      .send({})) as unknown as Resp;
    expect(r.status).toBe(200);
    const slugs = (r.body.benchmarks ?? []).map((b) => b.benchmark);
    expect(slugs).toContain('lm-arena-webdev');
  });

  it('consultar_benchmark inválido → 400; desconocido → 404 sin_datos', async () => {
    const r1 = (await request(app.getHttpServer())
      .post('/v0/consultar_benchmark')
      .set('x-api-key', CLAVE)
      .send({})) as unknown as Resp;
    expect(r1.status).toBe(400);
    const r2 = (await request(app.getHttpServer())
      .post('/v0/consultar_benchmark')
      .set('x-api-key', CLAVE)
      .send({ benchmark: 'no-existe' })) as unknown as Resp;
    expect(r2.status).toBe(404);
    expect(r2.body.error?.codigo).toBe('sin_datos');
  });

  it('consultar_resultados exige exactamente un filtro → 400 si 0 o 2', async () => {
    for (const body of [
      {},
      { benchmark: 'lm-arena-webdev', modelo: 'glm-5.3' },
    ]) {
      const r = (await request(app.getHttpServer())
        .post('/v0/consultar_resultados')
        .set('x-api-key', CLAVE)
        .send(body)) as unknown as Resp;
      expect(r.status).toBe(400);
    }
  });

  it('consultar_resultados por benchmark → 200 con procedencia por observación', async () => {
    const r = (await request(app.getHttpServer())
      .post('/v0/consultar_resultados')
      .set('x-api-key', CLAVE)
      .send({ benchmark: 'lm-arena-webdev' })) as unknown as Resp;
    expect(r.status).toBe(200);
    const resultados = r.body.resultados as {
      procedencia: { fuente_tipo: string };
      grupo_comparabilidad: string;
    }[];
    expect(resultados.length).toBeGreaterThan(0);
    expect(resultados[0].procedencia.fuente_tipo).toBe('leaderboard_json');
    expect(resultados[0].grupo_comparabilidad).toHaveLength(12);
  });
});
