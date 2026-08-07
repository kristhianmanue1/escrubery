import { crearKysely } from '../db/kysely';
import { verificarCadena } from './event_log';
import { pollerVulnerableMcp } from './vulnerable_mcp';

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida (ver backend/.env)');
    process.exit(2);
  }
  const fuente =
    arg('fuente') ??
    process.env.VULNERABLE_MCP_URL ??
    'datos/fuentes/vulnerable_mcp/advisories.json';
  const db = crearKysely(url);
  try {
    const r = await pollerVulnerableMcp(db, fuente);
    console.log(JSON.stringify(r));
    const v = await verificarCadena(db);
    console.log(`verificarCadena: ${v.ok ? 'OK' : 'FAIL'} (total=${v.total})`);
    if (!v.ok) {
      console.error('errores:', v.errores);
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(
    'error fatal:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
