import { generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main(): void {
  const kid = arg('kid') ?? 'escrubery-evidentia-001';
  const keysDir =
    process.env.EVIDENTIA_KEYS_DIR ?? `${process.env.HOME}/.escrubery/keys`;
  const privPath = resolve(keysDir, `${kid}.pem`);

  const repoRoot = resolve(process.cwd(), '..');
  const worktreeRoot = repoRoot;
  if (privPath.startsWith(worktreeRoot)) {
    console.error(
      `§7 violada: la privada NO puede ir dentro del worktree (${privPath} bajo ${worktreeRoot}). Define EVIDENTIA_KEYS_DIR fuera del repo.`,
    );
    process.exit(2);
  }

  if (existsSync(privPath)) {
    console.error(
      `Ya existe ${privPath}. Para rotar, usa un kid nuevo (sucesor).`,
    );
    process.exit(1);
  }

  mkdirSync(keysDir, { recursive: true, mode: 0o700 });
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  writeFileSync(privPath, privPem, { mode: 0o600 });

  const pubDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer;
  const keyB64 = pubDer.toString('base64');

  const keyringPath =
    arg('keyring') ??
    resolve(repoRoot, 'datos', 'keys', 'evidentia-keyring.json');
  let keyring: {
    schema: 'cagf-keyring/0.2';
    keys: Record<string, unknown>;
  };
  if (existsSync(keyringPath)) {
    keyring = JSON.parse(readFileSync(keyringPath, 'utf8')) as typeof keyring;
  } else {
    keyring = { schema: 'cagf-keyring/0.2', keys: {} };
    mkdirSync(dirname(keyringPath), { recursive: true });
  }
  if (keyring.keys[kid]) {
    console.error(`El kid ${kid} ya está en ${keyringPath}. Usa un kid nuevo.`);
    process.exit(1);
  }
  keyring.keys[kid] = {
    kid,
    type: 'ed25519-public',
    key_b64: keyB64,
    role: 'service-evidentia',
    parent_kid: null,
    validity_window: { not_before: new Date().toISOString(), not_after: null },
    status: 'active',
    successor_kid: null,
    note: 'F2 base. Custodia tiered (passphrase/KMS/HSM) y rotación se activan en F4/público.',
  };
  writeFileSync(keyringPath, JSON.stringify(keyring, null, 2) + '\n');

  console.log(
    JSON.stringify(
      {
        kid,
        privada_path: privPath,
        privada_permisos: '0600',
        publica_keyring: keyringPath,
        publica_b64_prefijo: keyB64.slice(0, 16),
        nota: 'Guarda la privada fuera del repo (KMS/HSM para producción). El keyring es público y se commitea.',
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(
    'error fatal:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
