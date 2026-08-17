import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { SKIP_DB } from '../evidentia/fixtures/test_db';
import { AppModule } from '../app.module';
import { reiniciarRateLimit, sha256Hex } from './auth.guard';
import {
  verificarAgentCard,
  type AgentCardFirmada,
} from '../evidentia/agent_card';
import type { Keyring } from '../evidentia/schema';

// F5 T1/T0 — guard HTTP (401/429/200) vía supertest + Agent Card firmada.
// Los casos 200 requieren PostgreSQL (BD de test): exclusión local con
// ESCRUBERY_SKIP_DB_SPECS=1 (los 401/429 y la card corren siempre porque no
// tocan BD).

const CLAVE = 'spec-clave-alpha';
const CLAVE_HASH = sha256Hex(CLAVE);
const KEYRING = JSON.parse(
  readFileSync(
    join(process.cwd(), '..', 'datos', 'keys', 'evidentia-keyring.json'),
    'utf8',
  ),
) as Keyring;

let app: INestApplication;

interface Resp {
  status: number;
  body: { error?: { codigo: string; mensaje: string }; clis?: string[] };
  headers: Record<string, string>;
}

beforeAll(async () => {
  process.env.ESCRUBERY_API_KEYS = CLAVE_HASH;
  process.env.ESCRUBERY_RATE_LIMIT_RPM = '60';
  if (!SKIP_DB) {
    process.env.DATABASE_URL =
      process.env.ESCRUBERY_TEST_DATABASE_URL ??
      'postgresql:///escrubery_test?host=/tmp';
  }
  reiniciarRateLimit();
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
});

describe('auth HTTP /v0 — fail-closed', () => {
  it('sin header X-API-Key → 401 no_autorizado (formato §4)', async () => {
    const r = (await request(app.getHttpServer())
      .post('/v0/listar')
      .send({})) as unknown as Resp;
    expect(r.status).toBe(401);
    expect(r.body.error.codigo).toBe('no_autorizado');
  });

  it('clave inválida → 401', async () => {
    const r = (await request(app.getHttpServer())
      .post('/v0/listar')
      .set('x-api-key', 'incorrecta')
      .send({})) as unknown as Resp;
    expect(r.status).toBe(401);
    expect(r.body.error.codigo).toBe('no_autorizado');
  });
});

const d200 = SKIP_DB ? describe.skip : describe;

d200('auth HTTP /v0 — clave válida', () => {
  it('clave válida → 200 con datos (listar)', async () => {
    const r = (await request(app.getHttpServer())
      .post('/v0/listar')
      .set('x-api-key', CLAVE)
      .send({})) as unknown as Resp;
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.clis)).toBe(true);
  });
});

describe('rate limit HTTP /v0', () => {
  it('RPM=2: la 3ra petición con clave VÁLIDA → 429 limite_de_tasa + Retry-After', async () => {
    process.env.ESCRUBERY_RATE_LIMIT_RPM = '2';
    reiniciarRateLimit();
    const srv = app.getHttpServer() as unknown as import('http').Server;
    const r1 = (await request(srv)
      .post('/v0/listar')
      .set('x-api-key', CLAVE)
      .send({})) as unknown as Resp;
    const r2 = (await request(srv)
      .post('/v0/listar')
      .set('x-api-key', CLAVE)
      .send({})) as unknown as Resp;
    const r3 = (await request(srv)
      .post('/v0/listar')
      .set('x-api-key', CLAVE)
      .send({})) as unknown as Resp;
    // r1/r2 pasan el guard (200 con BD; error de BD sin ella — pero NO 429)
    expect(r1.status).not.toBe(429);
    expect(r2.status).not.toBe(429);
    expect(r3.status).toBe(429);
    expect(r3.body.error.codigo).toBe('limite_de_tasa');
    expect(Number(r3.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    process.env.ESCRUBERY_RATE_LIMIT_RPM = '60';
    reiniciarRateLimit();
  });
});

describe('Agent Card firmada (datos/agent-card/agent-card.json)', () => {
  const firmada = JSON.parse(
    readFileSync(
      join(process.cwd(), '..', 'datos', 'agent-card', 'agent-card.json'),
      'utf8',
    ),
  ) as AgentCardFirmada;

  it('la card real firma verifica contra el keyring público', () => {
    expect(verificarAgentCard(firmada, KEYRING).ok).toBe(true);
  });

  it('card alterada (nombre) → firma NO verifica', () => {
    const alterada: AgentCardFirmada = {
      card: { ...firmada.card, nombre: 'escrubery-falso' },
      firma: firmada.firma,
    };
    expect(verificarAgentCard(alterada, KEYRING).ok).toBe(false);
  });

  it('key_id inexistente → error explícito', () => {
    const otra: AgentCardFirmada = {
      card: firmada.card,
      firma: { ...firmada.firma, key_id: 'inexistente' },
    };
    expect(verificarAgentCard(otra, KEYRING).ok).toBe(false);
  });

  it('declara los transportes y tools del contrato', () => {
    expect(firmada.card.transportes.http).toContain('X-API-Key');
    expect(firmada.card.tools.length).toBeGreaterThanOrEqual(8);
  });
});
