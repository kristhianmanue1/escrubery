import { createHash } from 'node:crypto';
import {
  hojaMerkle,
  mayorPotenciaDeDosMenorQue,
  pathInclusion,
  raizDesdePrueba,
  raizMerkle,
} from './checkpoint';

// F4a T1/T2 — specs Merkle RFC 6962 + prueba de inclusión. Raíces esperadas
// generadas con el ORÁCULO PYTHON INDEPENDIENTE (hashlib, misma semántica
// RFC 6962 §2.1: hoja 0x00, nodo 0x01, split potencia de 2) — si esta spec y
// el oráculo divergen, una de las dos implementaciones está mal.

function hashesDePrueba(n: number): string[] {
  return Array.from({ length: n }, (_, i) =>
    createHash('sha256').update(`ev-${i}`).digest('hex'),
  );
}

// Raíces del oráculo (python3, ejecutado 2026-08-17):
const RAICES_ORACULO: Record<number, string> = {
  1: 'd25ef1d320c5a060202d31ec7ba10491d38eebe0b3dacedfcb06e8da49a69ed5',
  2: 'c1cedc21f827ee58ff05c4c44585991dfcdbde4c530746ced4175dbb86e490fe',
  3: 'f1609ea95833cd2c4c12bf177c187284fdb4ed0918e40f7b7fc1e9381b0e2192',
  7: '78d2a19a312c9b5192da655ff97e2245e06adf69cb537bb7624adb72d9a3b77c',
};

describe('Merkle RFC 6962 — raíces contra oráculo Python', () => {
  it.each([1, 2, 3, 7])('%i hojas coincide con el oráculo', (n) => {
    const hojas = hashesDePrueba(n).map((h) => hojaMerkle(h));
    expect(raizMerkle(hojas).toString('hex')).toBe(RAICES_ORACULO[n]);
  });

  it('árbol vacío lanza', () => {
    expect(() => raizMerkle([])).toThrow(/vacío/);
  });

  it('mayorPotenciaDeDosMenorQue: 2→1, 3→2, 4→2, 5→4, 8→4, 9→8', () => {
    expect(mayorPotenciaDeDosMenorQue(2)).toBe(1);
    expect(mayorPotenciaDeDosMenorQue(3)).toBe(2);
    expect(mayorPotenciaDeDosMenorQue(4)).toBe(2);
    expect(mayorPotenciaDeDosMenorQue(5)).toBe(4);
    expect(mayorPotenciaDeDosMenorQue(8)).toBe(4);
    expect(mayorPotenciaDeDosMenorQue(9)).toBe(8);
  });
});

describe('prueba de inclusión RFC 6962 (construcción ↔ verificación)', () => {
  it.each([1, 2, 3, 7, 13])(
    'árbol de %i hojas: toda hoja verifica contra la raíz',
    (n) => {
      const hashes = hashesDePrueba(n);
      const hojas = hashes.map((h) => hojaMerkle(h));
      const raiz = raizMerkle(hojas).toString('hex');
      for (let i = 0; i < n; i += 1) {
        const path = pathInclusion(hojas, i);
        expect(raizDesdePrueba(hashes[i], path).toString('hex')).toBe(raiz);
      }
    },
  );

  it('path alterado (hash de sibling) → raíz distinta', () => {
    const hashes = hashesDePrueba(7);
    const hojas = hashes.map((h) => hojaMerkle(h));
    const raiz = raizMerkle(hojas).toString('hex');
    const path = pathInclusion(hojas, 3);
    const alterado = path.map((p, i) =>
      i === 0 ? { ...p, hash: 'f'.repeat(64) } : p,
    );
    expect(raizDesdePrueba(hashes[3], alterado).toString('hex')).not.toBe(raiz);
  });

  it('dirección alterada (izquierda↔derecha) → raíz distinta', () => {
    const hashes = hashesDePrueba(7);
    const hojas = hashes.map((h) => hojaMerkle(h));
    const raiz = raizMerkle(hojas).toString('hex');
    const path = pathInclusion(hojas, 5).map((p) => ({
      ...p,
      izquierda: !p.izquierda,
    }));
    expect(raizDesdePrueba(hashes[5], path).toString('hex')).not.toBe(raiz);
  });

  it('hash de hoja distinto con el mismo path → raíz distinta', () => {
    const hashes = hashesDePrueba(7);
    const hojas = hashes.map((h) => hojaMerkle(h));
    const raiz = raizMerkle(hojas).toString('hex');
    const path = pathInclusion(hojas, 0);
    const otraHoja = createHash('sha256').update('otro').digest('hex');
    expect(raizDesdePrueba(otraHoja, path).toString('hex')).not.toBe(raiz);
  });

  it('prefijo estable: insertar hoja N+1 no cambia la raíz del prefijo 1..N', () => {
    const hashes = hashesDePrueba(7);
    const hojas = hashes.map((h) => hojaMerkle(h));
    const raizAntes = raizMerkle(hojas);
    const conNueva = [
      ...hojas,
      hojaMerkle(createHash('sha256').update('ev-7').digest('hex')),
    ];
    // la raíz del checkpoint anterior (prefijo) sigue siendo la misma
    expect(raizMerkle(conNueva.slice(0, 7))).toEqual(raizAntes);
    // y cambia la del árbol completo (el nuevo checkpoint ancla la nueva)
    expect(raizMerkle(conNueva)).not.toEqual(raizAntes);
  });
});
