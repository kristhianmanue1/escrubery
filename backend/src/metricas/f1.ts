import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { crearKysely } from '../db/kysely';

// T7 (plan de deuda): métrica F1 real publicada desde consultas_log.
// NOTA DE HONESTIDAD: `fuente_externa` saldrá 0% — el patrón
// caché-al-consultar (plan v2 §4.2) aún no está implementado; hoy solo
// existen `bd` y `sin_datos`. La métrica debe decirlo, no ocultarlo.

async function metricasF1(db: Kysely<Database>): Promise<void> {
  const filas = await db
    .selectFrom('consultas_log')
    .select(['servido_desde', (eb) => eb.fn.countAll<number>().as('n')])
    .groupBy('servido_desde')
    .execute();
  const total = filas.reduce((s, f) => s + Number(f.n), 0);
  console.log(`consultas registradas: ${total}`);
  for (const f of filas) {
    const pct = total > 0 ? ((Number(f.n) / total) * 100).toFixed(1) : '0.0';
    console.log(`  ${f.servido_desde}: ${f.n} (${pct}%)`);
  }
  const sinDatos = Number(
    filas.find((f) => f.servido_desde === 'sin_datos')?.n ?? 0,
  );
  console.log(
    `\nseñal de demanda (sin_datos, plan v2 §4.5): ${sinDatos} consultas sin dato — candidatas a ingesta/curaduría`,
  );
  const fuenteExterna = Number(
    filas.find((f) => f.servido_desde === 'fuente_externa')?.n ?? 0,
  );
  console.log(
    `fuente_externa: ${fuenteExterna} (caché-al-consultar NO implementado aún — 0% es el valor honesto hoy)`,
  );
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida (ver backend/.env)');
    process.exit(2);
  }
  const db = crearKysely(url);
  try {
    await metricasF1(db);
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
