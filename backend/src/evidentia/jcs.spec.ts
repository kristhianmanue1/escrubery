import { canonicalize } from './jcs';

// T2 — JCS conforme a RFC 8785. Vectores de los anexos del RFC (números,
// strings, ordenamiento de claves por code unit UTF-16 con surrogate pairs) y
// prueba de ida y vuelta firma -> re-canonicalización (regresión del
// round-trip por BD conocido en F2). Spec pura: no requiere BD.

describe('JCS / RFC 8785 — números (shortest round-trip)', () => {
  const casos: Array<[number, string]> = [
    [1e21, '1e+21'],
    [1e-7, '1e-7'],
    [0.1, '0.1'],
    [-0, '0'],
    [0, '0'],
    [4.5, '4.5'],
    [2e-3, '0.002'],
    [1e30, '1e+30'],
    // vector RFC: el texto 333333333.33333329 se parsea al double 333333333.3333333
    [333333333.3333333, '333333333.3333333'],
    [1e-27, '1e-27'],
    [Number.MAX_SAFE_INTEGER, '9007199254740991'],
    [-3.141592653589793, '-3.141592653589793'],
    // fronteras del Apéndice B.2 del RFC
    [9.999999999999997e22, '9.999999999999997e+22'],
    [1e23, '1e+23'],
    [5e-324, '5e-324'],
    [1.7976931348623157e308, '1.7976931348623157e+308'],
  ];
  it.each(casos)('serializa %p como %s', (n, esperado) => {
    expect(canonicalize(n)).toBe(esperado);
  });

  it('rechaza números no finitos (NaN, Infinity)', () => {
    expect(() => canonicalize(Number.NaN)).toThrow(/finito/i);
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow(/finito/i);
    expect(() => canonicalize(Number.NEGATIVE_INFINITY)).toThrow(/finito/i);
  });
});

describe('JCS / RFC 8785 — strings', () => {
  // Vector del RFC 8785 §3.2.2.2: Euro, U+000F (escape), LF, quote, backslash.
  it('escapa solo lo obligatorio (", \\, control <0x20) y emite el resto crudo', () => {
    const entrada = '€$\u000F\nA\'B"\\"/';
    expect(canonicalize(entrada)).toBe('"€$\\u000f\\nA\'B\\"\\\\\\"/"');
  });

  it('U+2028 y U+2029 se emiten crudos (divergencia conocida de JSON.stringify en otros runtimes)', () => {
    expect(canonicalize('a\u2028b\u2029c')).toBe('"a\u2028b\u2029c"');
  });

  it('string vacío y null', () => {
    expect(canonicalize('')).toBe('""');
    expect(canonicalize(null)).toBe('null');
  });
});

describe('JCS / RFC 8785 — ordenamiento de claves por code unit UTF-16', () => {
  // Vector del RFC 8785 (Apéndice B): \r < 1 < U+0080 < U+00F6 < U+20AC < U+FB33
  it('ordena el ejemplo del RFC', () => {
    const entrada = {
      '\u20ac': 'Euro Sign',
      '\r': 'Carriage Return',
      '\ufb33': 'Hebrew Letter Dalet With Dots',
      '1': 'One',
      '\u0080': 'Control',
      '\u00f6': 'Latin Small Letter O With Diaeresis',
    };
    expect(canonicalize(entrada)).toBe(
      '{"\\r":"Carriage Return","1":"One","\u0080":"Control","\u00f6":"Latin Small Letter O With Diaeresis","\u20ac":"Euro Sign","\ufb33":"Hebrew Letter Dalet With Dots"}',
    );
  });

  it('surrogate pair (U+D83D U+DE00) ordena antes que U+E000 (por code unit)', () => {
    const entrada: Record<string, number> = {};
    entrada['\ue000'] = 2;
    entrada['\ud83d\ude00'] = 1;
    expect(canonicalize(entrada)).toBe('{"\ud83d\ude00":1,"\ue000":2}');
  });

  it('estructura anidada: objetos y arrays ordenados recursivamente', () => {
    expect(canonicalize({ b: [1, { z: null, y: true }], a: 'x' })).toBe(
      '{"a":"x","b":[1,{"y":true,"z":null}]}',
    );
  });

  it('array vacío y objeto vacío', () => {
    expect(canonicalize([])).toBe('[]');
    expect(canonicalize({})).toBe('{}');
  });
});

describe('JCS — idempotencia y round-trip', () => {
  it('re-canonicalizar el parse del output reproduce el mismo bytes', () => {
    const original = {
      z: { b: 1e-7, a: 'ñ' },
      n: [4.5, -0, 1e21],
      fecha: '2026-08-17T00:00:00.000Z',
    };
    const c1 = canonicalize(original);
    const c2 = canonicalize(JSON.parse(c1));
    expect(c2).toBe(c1);
  });

  it('firma sobre payload canónico verifica tras re-canonicalizar (regresión round-trip BD)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateKeyPairSync, sign, verify } = require('node:crypto') as {
      generateKeyPairSync: typeof import('node:crypto').generateKeyPairSync;
      sign: typeof import('node:crypto').sign;
      verify: typeof import('node:crypto').verify;
    };
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const evento = {
      record_id: 'ev-rt-1',
      categoria: 'fix_seguridad',
      resumen: 'parche exfiltración',
      prev_hash: '0'.repeat(64),
      fecha_publicacion: '2026-08-17T00:00:00.000Z',
      m: [1e21, -0],
    };
    const canon = canonicalize(evento);
    const sig = sign(null, Buffer.from(canon), privateKey);
    // re-canonicalización como haría un verificador externo (parse + canon)
    const reCanon = Buffer.from(canonicalize(JSON.parse(canon)));
    expect(verify(null, reCanon, publicKey, sig)).toBe(true);
    // payload alterado no verifica
    const alterado = Buffer.from(canonicalize({ ...evento, resumen: 'otro' }));
    expect(verify(null, alterado, publicKey, sig)).toBe(false);
  });
});
