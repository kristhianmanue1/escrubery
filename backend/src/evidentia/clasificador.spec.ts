import { clasificar, esAltaSeveridad } from './clasificador';

// T1a — clasificador de severidad heurístico (sin IA): 6 reglas ordenadas por
// precedencia + default ruido_irrelevante. Spec pura: no requiere BD.

describe('clasificador — 7 categorías con casos representativos', () => {
  it('fix_seguridad (regla 1)', () => {
    const r = clasificar('Fixes CVE-2026-1234: sandbox escape in MCP server');
    expect(r.categoria).toBe('fix_seguridad');
    expect(r.confianza).toBe(0.9);
  });

  it('deprecacion (regla 2)', () => {
    const r = clasificar(
      'The legacy auth API is deprecated and reaches end of life',
    );
    expect(r.categoria).toBe('deprecacion');
    expect(r.confianza).toBe(0.7);
  });

  it('breaking_change (regla 3)', () => {
    const r = clasificar(
      'Breaking: removed support for Node 18, migration required',
    );
    expect(r.categoria).toBe('breaking_change');
    expect(r.confianza).toBe(0.9);
  });

  it('cambio_precio (regla 4)', () => {
    const r = clasificar(
      'Announcing new pricing: input price change per token',
    );
    expect(r.categoria).toBe('cambio_precio');
    expect(r.confianza).toBe(0.75);
  });

  it('cambio_limite (regla 5)', () => {
    const r = clasificar('Context window and max tokens quota now larger');
    expect(r.categoria).toBe('cambio_limite');
    expect(r.confianza).toBe(0.75);
  });

  it('funcion_nueva (regla 6)', () => {
    const r = clasificar('Added a new feature: now supports batch output');
    expect(r.categoria).toBe('funcion_nueva');
    expect(r.confianza).toBe(0.7);
  });

  it('ruido_irrelevante (default)', () => {
    const r = clasificar('Updated README and contributor docs');
    expect(r.categoria).toBe('ruido_irrelevante');
    expect(r.confianza).toBe(0.3);
  });

  it('texto vacío/null-safe → ruido_irrelevante', () => {
    expect(clasificar('').categoria).toBe('ruido_irrelevante');
  });
});

describe('clasificador — precedencia de reglas (orden declarado)', () => {
  it('seguridad gana sobre funcion_nueva cuando ambas matchean', () => {
    expect(clasificar('Added fix for unauthorized access bug').categoria).toBe(
      'fix_seguridad',
    );
  });

  it('deprecacion gana sobre breaking_change cuando ambas matchean', () => {
    expect(clasificar('Deprecated flags will be removed in v3').categoria).toBe(
      'deprecacion',
    );
  });

  it('cambio_precio gana sobre cambio_limite cuando ambas matchean', () => {
    expect(clasificar('Pricing update affects rate limit tier').categoria).toBe(
      'cambio_precio',
    );
  });
});

describe('esAltaSeveridad — solo fix_seguridad y breaking_change', () => {
  it.each([
    ['fix_seguridad', true],
    ['breaking_change', true],
    ['deprecacion', false],
    ['cambio_precio', false],
    ['cambio_limite', false],
    ['funcion_nueva', false],
    ['ruido_irrelevante', false],
  ])('%s → %p', (cat, esperado) => {
    expect(esAltaSeveridad(cat as never)).toBe(esperado);
  });
});
