import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalize } from './jcs';
import { resolverCAFile, verificarSello } from './tsa';

// F4a T3 — verificación RFC 3161 OFFLINE como la haría un TERCERO: solo los
// artefactos commiteados (datos/checkpoints/*.json + .tsr). El tercero
// re-canonicaliza el payload con JCS (determinista) para reproducir los
// bytes sellados. Requiere openssl en el sistema; si no hay CAfile
// resoluble, la suite se salta con nota (no puede verificar — fail-closed).

const DIR = join(process.cwd(), '..', 'datos', 'checkpoints');
const CAFILE = resolverCAFile();
const d = CAFILE ? describe : describe.skip;

d(
  'sello RFC 3161 — verificación de tercero sobre artefactos commiteados',
  () => {
    const tsrs = existsSafe()
      ? readdirSync(DIR).filter((f) => f.endsWith('.tsr'))
      : [];
    const jsons = readdirSync(DIR).filter((f) => f.endsWith('.json'));

    it('hay al menos un checkpoint sellado y archivado (evidencia real)', () => {
      expect(tsrs.length).toBeGreaterThanOrEqual(1);
      expect(jsons.length).toBeGreaterThanOrEqual(1);
    });

    it.each(tsrs.map((f) => [f] as const))(
      '%s: TSR verifica contra el JCS del payload archivado',
      (tsrFile) => {
        const jsonFile = tsrFile.replace(/\.tsr$/, '.json');
        const archivado = JSON.parse(
          readFileSync(join(DIR, jsonFile), 'utf8'),
        ) as {
          payload: unknown;
        };
        // el tercero reproduce los bytes firmados con JCS
        const firmadoJson = canonicalize(archivado.payload);
        const tsr = readFileSync(join(DIR, tsrFile));
        const v = verificarSello(tsr, firmadoJson, CAFILE);
        expect(v.ok).toBe(true);
      },
    );

    it('payload alterado → el sello NO verifica (imprint distinto)', () => {
      const archivado = JSON.parse(
        readFileSync(join(DIR, jsons[0]), 'utf8'),
      ) as { payload: Record<string, unknown> };
      const alterado = canonicalize({
        ...archivado.payload,
        eventos_hasta: (archivado.payload.eventos_hasta as number) + 999,
      });
      const tsr = readFileSync(join(DIR, tsrs[0]));
      const v = verificarSello(tsr, alterado, CAFILE);
      expect(v.ok).toBe(false);
    });
  },
);

function existsSafe(): boolean {
  try {
    readdirSync(DIR);
    return true;
  } catch {
    return false;
  }
}
