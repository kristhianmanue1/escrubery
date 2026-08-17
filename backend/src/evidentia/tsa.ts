import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

// F4a T3 — sello RFC 3161 del checkpoint con TSA público gratuito.
// openssl ts (CLI): node:crypto no parsea PKCS#7. El imprint es
// SHA-256 único sobre los BYTES EXACTOS de firmado_json (ancla root,
// creado_en y firma en el tiempo). Verificación offline: firma CMS +
// cadena contra CAfile del sistema + EKU timestamping.

// Default DigiCert: su cert TSA encadena a RAÍCES PÚBLICAS del sistema (la CA
// de freetsa.org es auto-firmada y requeriría pinning). HTTP es el endpoint
// clásico RFC 3161: un MITM solo puede repetir/DoS — forjar un TSR para otros
// datos exige la clave de la TSA (el imprint es determinista de firmado_json).
export const TSA_URL_DEFAULT = 'http://timestamp.digicert.com';

export interface ResultadoSello {
  ok: boolean;
  tsa: string;
  error?: string;
  tsr?: Buffer;
}

function openssl(args: string[]): {
  status: number;
  stdout: Buffer;
  stderr: string;
} {
  const r = spawnSync('openssl', args, {
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? Buffer.alloc(0),
    stderr: r.stderr?.toString('utf8') ?? '',
  };
}

/** Sella (RFC 3161) los bytes de firmado_json contra tsaUrl. */
export function sellar(firmadoJson: string, tsaUrl: string): ResultadoSello {
  const dir = mkdtempSync(join(tmpdir(), 'escrubery-tsa-'));
  const dataPath = join(dir, 'firmado.json');
  const queryPath = join(dir, 'query.tsq');
  const tsrPath = join(dir, 'reply.tsr');
  writeFileSync(dataPath, firmadoJson, 'utf8');

  const q = openssl([
    'ts',
    '-query',
    '-data',
    dataPath,
    '-sha256',
    '-cert',
    '-no_nonce', // nonce descartado por diseño (Plan F4a): custodia git del TSR
    '-out',
    queryPath,
  ]);
  if (q.status !== 0)
    return {
      ok: false,
      tsa: tsaUrl,
      error: `query: ${q.stderr.slice(0, 200)}`,
    };

  // POST application/timestamp-query → application/timestamp-reply
  const post = spawnSync(
    'curl',
    [
      '-sSf',
      '--max-time',
      '25',
      '-H',
      'Content-Type: application/timestamp-query',
      '-H',
      'Accept: application/timestamp-reply',
      '--data-binary',
      `@${queryPath}`,
      '-o',
      tsrPath,
      '-w',
      '%{http_code}',
      tsaUrl,
    ],
    { timeout: 30000 },
  );
  const http = post.stdout ? post.stdout.toString('utf8').trim() : '';
  if (post.status !== 0 || http !== '200') {
    return {
      ok: false,
      tsa: tsaUrl,
      error: `POST ${tsaUrl}: http=${http || 'sin-respuesta'} ${(post.stderr?.toString('utf8') ?? '').slice(0, 120)}`,
    };
  }

  const tsr = readFileSync(tsrPath);
  if (tsr.length < 100)
    return { ok: false, tsa: tsaUrl, error: 'TSR sospechosamente corto' };
  return { ok: true, tsa: tsaUrl, tsr };
}

/** CAfile para openssl: env explícito > default del sistema > keychain macOS
 * (Homebrew openssl no ve el keychain; se extrae a caché temporal). */
export function resolverCAFile(): string | undefined {
  if (process.env.ESCRUBERY_TSA_CAFILE) return process.env.ESCRUBERY_TSA_CAFILE;
  const r = spawnSync('openssl', ['version', '-d'], { encoding: 'utf8' });
  const dir = (r.stdout ?? '').match(/OPENSSLDIR: *"([^"]+)"/)?.[1];
  const candidato = dir ? join(dir, 'cert.pem') : undefined;
  if (candidato && existsSync(candidato)) {
    const tam = statSync(candidato).size;
    if (tam > 1000) return candidato; // CAfile poblado
  }
  if (process.platform === 'darwin') {
    const cache = join(tmpdir(), 'escrubery-sysroots.pem');
    if (!existsSync(cache)) {
      const k = spawnSync(
        'security',
        [
          'find-certificate',
          '-a',
          '-p',
          '/System/Library/Keychains/SystemRootCertificates.keychain',
        ],
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
      );
      if (k.status !== 0 || !`${k.stdout ?? ''}`.includes('BEGIN'))
        return undefined;
      writeFileSync(cache, k.stdout ?? '');
    }
    return cache;
  }
  return undefined;
}

/** Verifica OFFLINE el TSR contra el queryfile regenerado de firmado_json
 * (firma CMS + cadena CAfile sistema + EKU + imprint). Fail-closed. */
export function verificarSello(
  tsr: Buffer,
  firmadoJson: string,
  caFile?: string,
): { ok: boolean; detalle: string } {
  caFile = caFile ?? resolverCAFile();
  const dir = mkdtempSync(join(tmpdir(), 'escrubery-tsa-verify-'));
  const dataPath = join(dir, 'firmado.json');
  const queryPath = join(dir, 'query.tsq');
  const tsrPath = join(dir, 'reply.tsr');
  writeFileSync(dataPath, firmadoJson, 'utf8');
  writeFileSync(tsrPath, tsr);
  const q = openssl([
    'ts',
    '-query',
    '-data',
    dataPath,
    '-sha256',
    '-cert',
    '-no_nonce',
    '-out',
    queryPath,
  ]);
  if (q.status !== 0)
    return { ok: false, detalle: `query: ${q.stderr.slice(0, 200)}` };
  const args = ['ts', '-verify', '-in', tsrPath, '-queryfile', queryPath];
  if (caFile) args.push('-CAfile', caFile);
  const v = openssl(args);
  return {
    ok: v.status === 0,
    detalle:
      v.status === 0
        ? 'OK: respuesta verificada'
        : `${v.stderr.trim().slice(0, 300)}`,
  };
}

export async function sellarPendientes(
  db: Kysely<Database>,
  dirArchivos: string,
  tsaUrl: string,
): Promise<{
  sellados: number;
  pendientes_restantes: number;
  errores: string[];
}> {
  const pendientes = await db
    .selectFrom('checkpoints')
    .selectAll()
    .where('timestamp_rfc3161', 'is', null)
    .orderBy('eventos_hasta', 'asc') // oldest-first
    .execute();
  let sellados = 0;
  const errores: string[] = [];
  for (const cp of pendientes) {
    const r = sellar(cp.firmado_json, tsaUrl);
    if (!r.ok) {
      errores.push(`checkpoint #${cp.id}: ${r.error}`);
      continue;
    }
    const hashAnclado = Buffer.from(r.tsr!).toString('base64').slice(0, 0); // hash_anclado = sha256 del firmado (informativo)
    const { createHash } = await import('node:crypto');
    const anchorHash = createHash('sha256')
      .update(cp.firmado_json, 'utf8')
      .digest('hex');
    void hashAnclado;
    await db
      .updateTable('checkpoints')
      .set({
        timestamp_rfc3161: Buffer.from(r.tsr!),
        tsa_url: tsaUrl,
        external_anchor: {
          tipo: 'rfc3161',
          tsa: tsaUrl,
          hash_anclado: anchorHash,
        },
      })
      .where('id', '=', cp.id)
      .execute();
    // archivo del TSR (custodia git)
    const creado = (JSON.parse(cp.firmado_json) as { creado_en: string })
      .creado_en;
    writeFileSync(
      join(dirArchivos, `${creado.replace(/[:.]/g, '-')}.tsr`),
      r.tsr!,
    );
    sellados += 1;
  }
  const restantes = await db
    .selectFrom('checkpoints')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('timestamp_rfc3161', 'is', null)
    .executeTakeFirst();
  return { sellados, pendientes_restantes: Number(restantes?.n ?? 0), errores };
}
