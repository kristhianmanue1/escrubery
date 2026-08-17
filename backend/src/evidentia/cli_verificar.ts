import { resolve } from 'node:path';
import { crearKysely } from '../db/kysely';
import { verificarTodo } from './verificar';

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
  const keyringPath =
    arg('keyring') ??
    resolve(process.cwd(), '..', 'datos', 'keys', 'evidentia-keyring.json');
  const db = crearKysely(url);
  try {
    const r = await verificarTodo(db, keyringPath);
    if (process.argv.includes('--json')) {
      // F4a T6 — cobertura §7: eventos confirmado_por_prueba_propia y su anclaje
      const eventos = await db
        .selectFrom('eventos_changelog')
        .select(['id', 'record_id', 'fecha_deteccion'])
        .execute();
      const ultimoSellado = await db
        .selectFrom('checkpoints')
        .select('eventos_hasta')
        .where('timestamp_rfc3161', 'is not', null)
        .orderBy('eventos_hasta', 'desc')
        .limit(1)
        .executeTakeFirst();
      console.log(
        JSON.stringify(
          {
            ok: r.ok,
            total: r.total,
            firmados: r.firmados,
            errores: r.errores,
            checkpoints: r.checkpoints,
            cobertura_anclaje_evidentia: {
              eventos_totales: eventos.length,
              anclados_por_sello: ultimoSellado
                ? eventos.filter((e) => e.id <= ultimoSellado.eventos_hasta)
                    .length
                : 0,
              ultimo_checkpoint_sellado_hasta:
                ultimoSellado?.eventos_hasta ?? null,
              nota: 'un evento está anclado si existe checkpoint sellado con eventos_hasta >= su id; los eventos F3 (introspección sandbox) son la fuente de confirmado_por_prueba_propia del servicio',
            },
          },
          null,
          2,
        ),
      );
    } else {
      console.log(
        `verificar: ${r.ok ? 'OK' : 'FAIL'} (total=${r.total}, firmados=${r.firmados})` +
          ` [checkpoints: ${r.checkpoints.total}, sellados: ${r.checkpoints.sellados}, pendientes: ${r.checkpoints.pendientes}]`,
      );
      if (!r.ok) {
        console.error('errores:\n  ' + r.errores.join('\n  '));
      }
    }
    process.exit(r.ok ? 0 : 1);
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
