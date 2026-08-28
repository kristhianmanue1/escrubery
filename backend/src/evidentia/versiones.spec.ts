import { compararVersiones, parsearVersion, versionMayor } from './versiones';

// Spec del comparador semver casero (incidente cline 2026-08-28). Sin BD:
// corre siempre, también con ESCRUBERY_SKIP_DB_SPECS=1.

describe('parsearVersion', () => {
  it.each([
    ['1.18.23', [1, 18, 23], null],
    ['v1.18.23', [1, 18, 23], null],
    ['0.150.0-alpha.5', [0, 150, 0], ['alpha', '5']],
    [
      '0.22.0-nightly.20260825.22bb5e8b',
      [0, 22, 0],
      ['nightly', '20260825', '22bb5e8b'],
    ],
    ['3.0.56', [3, 0, 56], null],
    ['1.0', [1, 0], null],
  ] as const)('parsea %s', (s, nucleos, pre) => {
    const v = parsearVersion(s);
    expect(v).not.toBeNull();
    expect(v!.nucleos).toEqual([...nucleos]);
    expect(v!.pre).toEqual(pre === null ? null : [...pre]);
  });

  it.each([
    [''],
    ['release-2026-words-only'],
    ['words.1.2'],
    ['1.2.3.beta'], // pre separado por punto: ambiguo con núcleo → indecidible
    ['vX1.2'],
  ])('rechaza %s (fail-closed)', (s) => {
    expect(parsearVersion(s)).toBeNull();
  });
});

describe('compararVersiones', () => {
  it.each([
    // El incidente: el tag desktop-v0.0.17 jamás debe superar al CLI real
    ['0.0.17', '3.0.56', -1],
    ['1.18.23', '1.18.21', 1],
    ['1.18.23', '1.18.23', 0],
    ['1.0', '1.0.0', 0], // núcleos con ceros implícitos
    ['0.150.0-alpha.5', '0.150.0', -1], // semver §11.3: prerelease < release
    ['0.150.0', '0.150.0-alpha.5', 1],
    ['0.150.0-alpha.5', '0.149.0', 1], // el núcleo manda sobre el pre
    ['0.148.0-alpha.20', '1.0.0', -1],
    ['2.0.0-alpha', '2.0.0-alpha.1', -1], // §11.4.4: menos identificadores = menor
    ['2.0.0-alpha.1', '2.0.0-alpha.beta', -1], // §11.4.1: numérico < alfanumérico
    ['2.0.0-alpha.2', '2.0.0-alpha.10', -1], // numéricos por valor, no lexicográfico
    ['2.0.0-beta', '2.0.0-alpha', 1],
  ] as const)('%s vs %s → %d', (a, b, esperado) => {
    expect(compararVersiones(a, b)).toBe(esperado);
    // simetría; -0 ≠ 0 bajo Object.is, se normaliza
    expect(compararVersiones(b, a)).toBe(esperado === 0 ? 0 : -esperado);
  });

  it('indecidible → null (fail-closed)', () => {
    expect(compararVersiones('raro', '1.0.0')).toBeNull();
    expect(compararVersiones('1.0.0', 'raro')).toBeNull();
  });
});

describe('versionMayor', () => {
  it('true solo si es semver-Mayor', () => {
    expect(versionMayor('3.0.57', '3.0.56')).toBe(true);
    expect(versionMayor('3.0.56', '3.0.56')).toBe(false);
    expect(versionMayor('0.0.17', '3.0.56')).toBe(false);
  });

  it('indecidible → false (fail-closed)', () => {
    expect(versionMayor('raro', '1.0.0')).toBe(false);
    expect(versionMayor('1.0.0', 'raro')).toBe(false);
  });
});
