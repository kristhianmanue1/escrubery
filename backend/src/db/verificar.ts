import { Client } from 'pg';

const TABLAS = [
  'modelos',
  'cli_productos',
  'cli_comandos',
  'consultas_log',
] as const;

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL no definida (ver backend/.env)');
    process.exit(2);
  }

  const client = new Client({ connectionString });
  await client.connect();

  const counts: Record<string, string> = {};
  for (const tabla of TABLAS) {
    const { rows } = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ${tabla}`,
    );
    counts[tabla] = rows[0].n;
  }
  await client.end();

  const linea = TABLAS.map((t) => `${t}=${counts[t]}`).join(' ');
  const todasVacias = TABLAS.every((t) => counts[t] === '0');
  console.log(linea);
  console.log(
    todasVacias ? 'OK' : 'AVISO: hay filas (¿migración sobre BD con datos?)',
  );
  process.exit(todasVacias ? 0 : 1);
}

main().catch((err) => {
  console.error(
    'error fatal:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
