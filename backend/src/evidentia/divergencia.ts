import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

const RE_FLAG = /--[a-z][\w-]+/g;

export function extraerFlags(texto: string): string[] {
  const set = new Set<string>();
  if (!texto) return [];
  let m: RegExpExecArray | null;
  RE_FLAG.lastIndex = 0;
  while ((m = RE_FLAG.exec(texto)) !== null) {
    set.add(m[0]);
  }
  return [...set];
}

export interface Divergencia {
  mencionados: string[];
  no_en_inventario: string[];
}

export async function detectarDivergencia(
  db: Kysely<Database>,
  cliProductoId: number,
  textoEvento: string,
): Promise<Divergencia> {
  const mencionados = extraerFlags(textoEvento);
  if (mencionados.length === 0) {
    return { mencionados: [], no_en_inventario: [] };
  }
  const cmds = await db
    .selectFrom('cli_comandos')
    .select(['comando', 'descripcion'])
    .where('cli_producto_id', '=', cliProductoId)
    .execute();
  const inventario = new Set<string>();
  for (const c of cmds) {
    for (const f of extraerFlags(`${c.comando} ${c.descripcion ?? ''}`)) {
      inventario.add(f);
    }
  }
  const noEnInventario = mencionados.filter((f) => !inventario.has(f));
  return { mencionados, no_en_inventario: noEnInventario };
}
