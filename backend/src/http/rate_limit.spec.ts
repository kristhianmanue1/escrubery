import { reiniciarRateLimit, sha256Hex } from './auth.guard';
import { consumirToken } from './rate_limit';

// F5 T2 — token bucket unitario (sin HTTP). Espec pura.

const ID = 'spec-bucket';

beforeEach(() => {
  process.env.ESCRUBERY_RATE_LIMIT_RPM = '3';
  reiniciarRateLimit();
});

afterAll(() => {
  delete process.env.ESCRUBERY_RATE_LIMIT_RPM;
});

describe('rate_limit — token bucket', () => {
  it('RPM tokens disponibles; el siguiente → 429 con Retry-After', () => {
    for (let i = 0; i < 3; i += 1) {
      expect(consumirToken(ID)).toEqual({ ok: true, rpm: 3 });
    }
    const r = consumirToken(ID);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.rpm).toBe(3);
      expect(r.retryAfterS).toBeGreaterThanOrEqual(1);
    }
  });

  it('identificadores distintos tienen buckets independientes', () => {
    for (let i = 0; i < 3; i += 1) consumirToken(ID);
    expect(consumirToken(`${ID}-otro`).ok).toBe(true);
  });

  it('sha256Hex determinista (identificador nunca expone la clave)', () => {
    expect(sha256Hex('clave')).toBe(sha256Hex('clave'));
    expect(sha256Hex('clave')).not.toBe(sha256Hex('clave2'));
    expect(sha256Hex('clave')).toMatch(/^[0-9a-f]{64}$/);
  });
});
