import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

export async function registrarConsulta(
  db: Kysely<Database>,
  consulta: unknown,
  servidoDesde: string,
  latenciaMs: number,
): Promise<void> {
  await db
    .insertInto('consultas_log')
    .values({
      consulta,
      servido_desde: servidoDesde,
      latencia_ms: latenciaMs,
    })
    .execute();
}
