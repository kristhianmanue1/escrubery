import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { crearKysely } from './kysely';

interface Procedencia {
  fuente_url: string | null;
  fuente_tipo: string | null;
  fecha_obtencion: string | null;
  hash_sha256_contenido_original: string | null;
  estado_verificacion: string | null;
}

interface ComandoFicha {
  comando: string;
  descripcion: string | null;
  fuente: string | null;
}

interface FichaCli {
  id: string;
  nombre: string;
  proveedor: string;
  tipo: string;
  repo_url: string | null;
  comandos: ComandoFicha[];
  procedencia: Procedencia;
}

interface ModeloFicha {
  modelo_id: string;
  ventana_contexto_max: number | null;
  capacidades: {
    soporta_vision: boolean | null;
    soporta_tool_use: boolean | null;
    soporta_caching: boolean | null;
    soporta_batch: boolean | null;
    soporta_computer_use: boolean | null;
  } | null;
  precios: {
    input_por_millon: number | null;
    output_por_millon: number | null;
  } | null;
  fecha_deprecacion: string | null;
}

interface FichaProveedor {
  id: string;
  modelos: Record<string, ModeloFicha>;
  procedencia: Procedencia;
}

const FICHAS =
  process.env.FICHAS_DIR ?? join(process.cwd(), '..', 'datos', 'fichas');

// Ventanas de vigencia (plan v2 §4.2): 24 h precios/modelos, 7 d comandos CLI.
const VENTANA_MODELO_MS = 24 * 60 * 60 * 1000;
const VENTANA_COMANDO_MS = 7 * 24 * 60 * 60 * 1000;

function vigenteHasta(
  fechaObtencion: string | null,
  ventanaMs: number,
): string | null {
  if (!fechaObtencion) return null;
  const d = new Date(fechaObtencion);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + ventanaMs).toISOString();
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida (ver backend/.env)');
    process.exit(2);
  }
  const db = crearKysely(url);
  let nCli = 0;
  let nCmd = 0;
  let nMod = 0;

  const archivosCli = (await readdir(join(FICHAS, 'clis'))).filter((f) =>
    f.endsWith('.json'),
  );
  for (const archivo of archivosCli) {
    const c = JSON.parse(
      await readFile(join(FICHAS, 'clis', archivo), 'utf8'),
    ) as unknown as FichaCli;
    const p = c.procedencia;
    const r = await db
      .insertInto('cli_productos')
      .values({
        nombre: c.id,
        nombre_display: c.nombre ?? null,
        proveedor: c.proveedor,
        tipo: c.tipo,
        repo_url: c.repo_url ?? null,
        version_actual: null,
        fecha_ultima_version: null,
      })
      .onConflict((oc) =>
        oc.column('nombre').doUpdateSet({
          nombre_display: c.nombre ?? null,
          proveedor: c.proveedor,
          tipo: c.tipo,
          repo_url: c.repo_url ?? null,
        }),
      )
      .returning('id')
      .executeTakeFirstOrThrow();
    nCli += 1;
    for (const cmd of c.comandos ?? []) {
      await db
        .insertInto('cli_comandos')
        .values({
          cli_producto_id: r.id,
          comando: cmd.comando,
          flags_json: null,
          descripcion: cmd.descripcion ?? null,
          version_detectada_desde: null,
          fuente_url: p.fuente_url ?? null,
          fuente_tipo: p.fuente_tipo ?? null,
          fecha_obtencion: p.fecha_obtencion ?? null,
          hash_sha256_contenido_original:
            p.hash_sha256_contenido_original ?? null,
          estado_verificacion: p.estado_verificacion ?? null,
          vigente_hasta: vigenteHasta(
            p.fecha_obtencion ?? null,
            VENTANA_COMANDO_MS,
          ),
        })
        .onConflict((oc) =>
          oc.columns(['cli_producto_id', 'comando']).doUpdateSet({
            descripcion: cmd.descripcion ?? null,
            fuente_url: p.fuente_url ?? null,
            fuente_tipo: p.fuente_tipo ?? null,
            fecha_obtencion: p.fecha_obtencion ?? null,
            hash_sha256_contenido_original:
              p.hash_sha256_contenido_original ?? null,
            estado_verificacion: p.estado_verificacion ?? null,
            vigente_hasta: vigenteHasta(
              p.fecha_obtencion ?? null,
              VENTANA_COMANDO_MS,
            ),
          }),
        )
        .execute();
      nCmd += 1;
    }
  }

  const archivosProv = (await readdir(join(FICHAS, 'proveedores'))).filter(
    (f) => f.endsWith('.json'),
  );
  for (const archivo of archivosProv) {
    const pr = JSON.parse(
      await readFile(join(FICHAS, 'proveedores', archivo), 'utf8'),
    ) as unknown as FichaProveedor;
    const p = pr.procedencia;
    for (const [clave, m] of Object.entries(pr.modelos ?? {})) {
      const caps = m.capacidades;
      const pre = m.precios;
      await db
        .insertInto('modelos')
        .values({
          proveedor: pr.id,
          modelo_id: m.modelo_id ?? clave,
          nombre_display: null,
          ventana_contexto_max: m.ventana_contexto_max ?? null,
          soporta_vision: caps?.soporta_vision ?? null,
          soporta_tool_use: caps?.soporta_tool_use ?? null,
          soporta_caching: caps?.soporta_caching ?? null,
          soporta_batch: caps?.soporta_batch ?? null,
          soporta_computer_use: caps?.soporta_computer_use ?? null,
          precio_input_por_millon: pre?.input_por_millon ?? null,
          precio_output_por_millon: pre?.output_por_millon ?? null,
          fuente_url: p.fuente_url ?? null,
          fuente_tipo: p.fuente_tipo ?? null,
          fecha_obtencion: p.fecha_obtencion ?? null,
          hash_sha256_contenido_original:
            p.hash_sha256_contenido_original ?? null,
          estado_verificacion: p.estado_verificacion ?? null,
          vigente_hasta: vigenteHasta(
            p.fecha_obtencion ?? null,
            VENTANA_MODELO_MS,
          ),
          fecha_deprecacion: m.fecha_deprecacion ?? null,
        })
        .onConflict((oc) =>
          oc.columns(['proveedor', 'modelo_id']).doUpdateSet({
            ventana_contexto_max: m.ventana_contexto_max ?? null,
            soporta_vision: caps?.soporta_vision ?? null,
            soporta_tool_use: caps?.soporta_tool_use ?? null,
            soporta_caching: caps?.soporta_caching ?? null,
            soporta_batch: caps?.soporta_batch ?? null,
            soporta_computer_use: caps?.soporta_computer_use ?? null,
            precio_input_por_millon: pre?.input_por_millon ?? null,
            precio_output_por_millon: pre?.output_por_millon ?? null,
            fuente_url: p.fuente_url ?? null,
            fuente_tipo: p.fuente_tipo ?? null,
            fecha_obtencion: p.fecha_obtencion ?? null,
            hash_sha256_contenido_original:
              p.hash_sha256_contenido_original ?? null,
            estado_verificacion: p.estado_verificacion ?? null,
            vigente_hasta: vigenteHasta(
              p.fecha_obtencion ?? null,
              VENTANA_MODELO_MS,
            ),
            fecha_deprecacion: m.fecha_deprecacion ?? null,
          }),
        )
        .execute();
      nMod += 1;
    }
  }

  await db.destroy();
  console.log(
    `ingesta: ${nCli} cli_productos, ${nCmd} cli_comandos, ${nMod} modelos`,
  );
}

main().catch((err) => {
  console.error(
    'error fatal:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
