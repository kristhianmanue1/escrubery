import { readFile } from 'node:fs/promises';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { registrarEvento } from './event_log';

export interface AdvisoryVulnerableMcp {
  id: string;
  resumen: string;
  fuente_url: string;
  fecha?: string | null;
  cli_afectados?: string[];
}

export async function obtenerAdvisories(
  fuente: string,
): Promise<AdvisoryVulnerableMcp[]> {
  if (fuente.startsWith('http://') || fuente.startsWith('https://')) {
    const res = await fetch(fuente, {
      headers: { 'User-Agent': 'escrubery-poller/0.1' },
    });
    if (!res.ok) {
      throw new Error(`VulnerableMCP ${res.status}: ${await res.text()}`);
    }
    return (await res.json()) as AdvisoryVulnerableMcp[];
  }
  return JSON.parse(await readFile(fuente, 'utf8')) as AdvisoryVulnerableMcp[];
}

export async function pollerVulnerableMcp(
  db: Kysely<Database>,
  fuente: string,
): Promise<{ advisories: number; eventos: number }> {
  const lista = await obtenerAdvisories(fuente);
  const clis = await db
    .selectFrom('cli_productos')
    .select(['id', 'nombre'])
    .execute();
  const porNombre = new Map(clis.map((c) => [c.nombre, c.id]));
  let eventos = 0;
  for (const a of lista) {
    const afectados =
      a.cli_afectados && a.cli_afectados.length > 0
        ? a.cli_afectados
        : clis.map((c) => c.nombre);
    for (const nombre of afectados) {
      const cliId = porNombre.get(nombre);
      if (cliId === undefined) continue;
      await registrarEvento(db, {
        record_id: `ev-vmcp-${a.id}-${nombre}`,
        cli_producto_id: cliId,
        categoria: 'fix_seguridad',
        resumen: a.resumen,
        fuente_url: a.fuente_url,
        fuente_tipo: 'security_advisory',
        fecha_publicacion: a.fecha ?? null,
        confianza_clasificador: 0.95,
      });
      eventos += 1;
    }
  }
  return { advisories: lista.length, eventos };
}
