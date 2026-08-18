import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Kysely } from 'kysely';
import { crearKysely } from './kysely';
import type { Database } from './schema';

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
    cache_lectura_por_millon: number | null;
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

// --- Curaduría de identidad (T4b-T0) ---------------------------------------
// Capa separada de los generados (§7): datos/fichas/curaduria/*.json. Llena
// familia_arquitectura/pesos_abiertos (LiteLLM no los cubre) con su PROPIA
// procedencia en curaduria_json; la procedencia LiteLLM de la fila queda
// intacta. Fail-closed: si el self-hash declarado no reproduce, no se aplica.

interface CuraduriaEntry {
  familia_arquitectura: string | null;
  pesos_abiertos: boolean | null;
  fuente_url: string | null;
}

interface CuraduriaAlias {
  issuer_id: string;
  proveedor: string;
  modelo_id: string;
  notas: string | null;
}

interface CuraduriaEndpoint {
  endpoint: string;
  proveedor: string;
  notas: string | null;
}

interface CuraduriaIdentidad {
  esquema: string;
  modelos: Record<string, CuraduriaEntry>;
  aliases: CuraduriaAlias[];
  endpoints: CuraduriaEndpoint[];
  procedencia: Procedencia;
}

/** Self-hash del archivo: sha256 del JSON (indent 2, sin ascii-escape, claves
 * ordenadas) con el campo hash vacío — mismo convenio que el script de sellado. */
function selfHashCuraduria(d: CuraduriaIdentidad): string {
  const copia = {
    ...d,
    procedencia: { ...d.procedencia, hash_sha256_contenido_original: '' },
  };
  const canon = JSON.stringify(copia, null, 2);
  return createHash('sha256').update(canon, 'utf8').digest('hex');
}

async function aplicarCuraduriaIdentidad(
  db: Kysely<Database>,
): Promise<number> {
  const dir = join(FICHAS, 'curaduria');
  let archivos: string[];
  try {
    archivos = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    return 0; // sin capa de curaduría todavía — no es error
  }
  let n = 0;
  for (const archivo of archivos.sort()) {
    const texto = await readFile(join(dir, archivo), 'utf8');
    const d = JSON.parse(texto) as CuraduriaIdentidad;
    if (d.esquema !== 'escrubery/curaduria-identidad/0.1') {
      throw new Error(`curaduría ${archivo}: esquema desconocido ${d.esquema}`);
    }
    const calculado = selfHashCuraduria(d);
    const declarado = d.procedencia?.hash_sha256_contenido_original ?? '';
    if (calculado !== declarado) {
      throw new Error(
        `curaduría ${archivo}: hash declarado ${declarado.slice(0, 12)}… != calculado ${calculado.slice(0, 12)}… (¿edición sin re-sellado?)`,
      );
    }
    for (const [clave, entry] of Object.entries(d.modelos ?? {})) {
      const [proveedor, ...resto] = clave.split('/');
      const modeloId = resto.join('/');
      if (!proveedor || !modeloId) {
        throw new Error(`curaduría ${archivo}: clave inválida "${clave}"`);
      }
      const curaduriaJson = {
        esquema: d.esquema,
        familia_arquitectura: entry.familia_arquitectura ?? null,
        pesos_abiertos: entry.pesos_abiertos ?? null,
        fuente_url: entry.fuente_url ?? null,
        procedencia: d.procedencia,
      };
      const r = await db
        .updateTable('modelos')
        .set({
          familia_arquitectura: entry.familia_arquitectura ?? null,
          pesos_abiertos: entry.pesos_abiertos ?? null,
          curaduria_json: curaduriaJson,
        })
        .where('proveedor', '=', proveedor)
        .where('modelo_id', '=', modeloId)
        .executeTakeFirst();
      n += Number(r.numUpdatedRows ?? 0);
    }

    // aliases issuer_id → identidad canónica (con procedencia de la curaduría)
    for (const a of d.aliases ?? []) {
      if (!a.issuer_id || !a.proveedor || !a.modelo_id) {
        throw new Error(
          `curaduría ${archivo}: alias incompleto ${JSON.stringify(a)}`,
        );
      }
      await db
        .insertInto('identidad_alias')
        .values({
          issuer_id: a.issuer_id,
          proveedor: a.proveedor,
          modelo_id: a.modelo_id,
          notas: a.notas ?? null,
          fuente_url: d.procedencia.fuente_url ?? null,
          fuente_tipo: d.procedencia.fuente_tipo ?? null,
          fecha_obtencion: d.procedencia.fecha_obtencion ?? null,
          hash_sha256_contenido_original:
            d.procedencia.hash_sha256_contenido_original ?? null,
          estado_verificacion: d.procedencia.estado_verificacion ?? null,
        })
        .onConflict((oc) =>
          oc.column('issuer_id').doUpdateSet({
            proveedor: a.proveedor,
            modelo_id: a.modelo_id,
            notas: a.notas ?? null,
            fuente_url: d.procedencia.fuente_url ?? null,
            fuente_tipo: d.procedencia.fuente_tipo ?? null,
            fecha_obtencion: d.procedencia.fecha_obtencion ?? null,
            hash_sha256_contenido_original:
              d.procedencia.hash_sha256_contenido_original ?? null,
            estado_verificacion: d.procedencia.estado_verificacion ?? null,
          }),
        )
        .execute();
    }

    // endpoints → proveedor (con procedencia de la curaduría)
    for (const e of d.endpoints ?? []) {
      if (!e.endpoint || !e.proveedor) {
        throw new Error(
          `curaduría ${archivo}: endpoint incompleto ${JSON.stringify(e)}`,
        );
      }
      await db
        .insertInto('identidad_endpoints')
        .values({
          endpoint: e.endpoint,
          proveedor: e.proveedor,
          notas: e.notas ?? null,
          fuente_url: d.procedencia.fuente_url ?? null,
          fuente_tipo: d.procedencia.fuente_tipo ?? null,
          fecha_obtencion: d.procedencia.fecha_obtencion ?? null,
          hash_sha256_contenido_original:
            d.procedencia.hash_sha256_contenido_original ?? null,
          estado_verificacion: d.procedencia.estado_verificacion ?? null,
        })
        .onConflict((oc) =>
          oc.column('endpoint').doUpdateSet({
            proveedor: e.proveedor,
            notas: e.notas ?? null,
            fuente_url: d.procedencia.fuente_url ?? null,
            fuente_tipo: d.procedencia.fuente_tipo ?? null,
            fecha_obtencion: d.procedencia.fecha_obtencion ?? null,
            hash_sha256_contenido_original:
              d.procedencia.hash_sha256_contenido_original ?? null,
            estado_verificacion: d.procedencia.estado_verificacion ?? null,
          }),
        )
        .execute();
    }
  }
  return n;
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
          precio_cache_lectura_por_millon:
            pre?.cache_lectura_por_millon ?? null,
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
            precio_cache_lectura_por_millon:
              pre?.cache_lectura_por_millon ?? null,
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

  const nCur = await aplicarCuraduriaIdentidad(db);

  await db.destroy();
  console.log(
    `ingesta: ${nCli} cli_productos, ${nCmd} cli_comandos, ${nMod} modelos, ${nCur} filas con curaduría de identidad`,
  );
}

main().catch((err) => {
  console.error(
    'error fatal:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
