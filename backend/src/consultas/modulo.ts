import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { registrarConsulta } from './log';

export interface ProcedenciaResp {
  fuente_url: string | null;
  fuente_tipo: string | null;
  fecha_obtencion: string | null;
  hash_sha256_contenido_original: string | null;
  estado_verificacion: string | null;
  firma_ed25519: null;
}

interface Procedible {
  fuente_url: string | null;
  fuente_tipo: string | null;
  fecha_obtencion: Date | null;
  hash_sha256_contenido_original: string | null;
  estado_verificacion: string | null;
}

function proc(f: Procedible): ProcedenciaResp {
  return {
    fuente_url: f.fuente_url,
    fuente_tipo: f.fuente_tipo,
    fecha_obtencion: f.fecha_obtencion ? f.fecha_obtencion.toISOString() : null,
    hash_sha256_contenido_original: f.hash_sha256_contenido_original,
    estado_verificacion: f.estado_verificacion,
    firma_ed25519: null,
  };
}

function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

/** Caducidad (T6, plan v2 §4.2): dato expirado se sirve degradado —
 * estado_verificacion: pendiente_de_verificar + advertencia visible.
 * Nunca se sirve como confirmado; null antes que inferir sigue intacto. */
function caduco(vigenteHasta: Date | null): boolean {
  return vigenteHasta !== null && vigenteHasta.getTime() < Date.now();
}

function procDegradado(
  f: Procedible,
  vigenteHasta: Date | null,
): ProcedenciaResp {
  const p = proc(f);
  return caduco(vigenteHasta)
    ? { ...p, estado_verificacion: 'pendiente_de_verificar' }
    : p;
}

function advertencia(vigenteHasta: Date | null): string | undefined {
  return caduco(vigenteHasta)
    ? `dato con vigencia vencida el ${iso(vigenteHasta)}; trátalo como pendiente de verificación hasta refrescar la fuente`
    : undefined;
}

export async function listar(db: Kysely<Database>) {
  const t0 = Date.now();
  const clis = await db
    .selectFrom('cli_productos')
    .select('nombre')
    .orderBy('nombre')
    .execute();
  const provs = await db
    .selectFrom('modelos')
    .select('proveedor')
    .distinct()
    .orderBy('proveedor')
    .execute();
  await registrarConsulta(db, { operacion: 'listar' }, 'bd', Date.now() - t0);
  return {
    clis: clis.map((c) => c.nombre),
    proveedores: provs.map((p) => p.proveedor),
  };
}

export async function consultarModelo(
  db: Kysely<Database>,
  proveedor: string,
  modeloId: string,
) {
  const t0 = Date.now();
  const m = await db
    .selectFrom('modelos')
    .selectAll()
    .where('proveedor', '=', proveedor)
    .where('modelo_id', '=', modeloId)
    .executeTakeFirst();
  const latencia = Date.now() - t0;
  if (!m) {
    await registrarConsulta(
      db,
      {
        operacion: 'consultar_modelo',
        params: { proveedor, modelo_id: modeloId },
      },
      'sin_datos',
      latencia,
    );
    return null;
  }
  const datos = {
    proveedor: m.proveedor,
    modelo_id: m.modelo_id,
    nombre_display: m.nombre_display,
    ventana_contexto_max: m.ventana_contexto_max,
    capacidades: {
      soporta_vision: m.soporta_vision,
      soporta_tool_use: m.soporta_tool_use,
      soporta_caching: m.soporta_caching,
      soporta_batch: m.soporta_batch,
      soporta_computer_use: m.soporta_computer_use,
    },
    precios: {
      input_por_millon:
        m.precio_input_por_millon === null
          ? null
          : Number(m.precio_input_por_millon),
      output_por_millon:
        m.precio_output_por_millon === null
          ? null
          : Number(m.precio_output_por_millon),
    },
    vigente_hasta: iso(m.vigente_hasta),
    advertencia_caducidad: advertencia(m.vigente_hasta),
    procedencia: procDegradado(m, m.vigente_hasta),
  };
  await registrarConsulta(
    db,
    {
      operacion: 'consultar_modelo',
      params: { proveedor, modelo_id: modeloId },
    },
    'bd',
    latencia,
  );
  return datos;
}

export async function consultarComandoCli(
  db: Kysely<Database>,
  cliId: string,
  filtro?: string,
) {
  const t0 = Date.now();
  const cli = await db
    .selectFrom('cli_productos')
    .selectAll()
    .where('nombre', '=', cliId)
    .executeTakeFirst();
  if (!cli) {
    await registrarConsulta(
      db,
      {
        operacion: 'consultar_comando_cli',
        params: { cli: cliId, filtro: filtro ?? null },
      },
      'sin_datos',
      Date.now() - t0,
    );
    return null;
  }
  let q = db
    .selectFrom('cli_comandos')
    .selectAll()
    .where('cli_producto_id', '=', cli.id);
  if (filtro) {
    q = q.where('comando', 'like', `%${filtro}%`);
  }
  const cmds = await q.orderBy('comando').execute();
  const latencia = Date.now() - t0;
  const datos = {
    cli_producto: {
      nombre: cli.nombre,
      nombre_display: cli.nombre_display,
      proveedor: cli.proveedor,
      tipo: cli.tipo,
      version_actual: cli.version_actual,
    },
    comandos: cmds.map((c) => ({
      comando: c.comando,
      descripcion: c.descripcion,
      flags: c.flags_json,
      advertencia_caducidad: advertencia(c.vigente_hasta),
      procedencia: procDegradado(c, c.vigente_hasta),
    })),
  };
  await registrarConsulta(
    db,
    {
      operacion: 'consultar_comando_cli',
      params: { cli: cliId, filtro: filtro ?? null },
    },
    'bd',
    latencia,
  );
  return datos;
}

export async function oficialidad(db: Kysely<Database>) {
  const t0 = Date.now();
  const clis = await db
    .selectFrom('cli_productos')
    .select(['nombre', 'nombre_display', 'proveedor', 'tipo'])
    .orderBy('nombre')
    .execute();
  await registrarConsulta(
    db,
    { operacion: 'oficialidad' },
    'bd',
    Date.now() - t0,
  );
  return {
    clis: clis.map((c) => ({
      id: c.nombre,
      nombre: c.nombre_display,
      proveedor: c.proveedor,
      tipo: c.tipo,
    })),
    nota: 'grok-cli-community (comunitario) y grok-build (oficial) son productos DISTINTOS; no mezclarlos',
  };
}

export async function consultarFicha(
  db: Kysely<Database>,
  entidad: string,
  id: string,
) {
  const t0 = Date.now();
  if (entidad === 'cli') {
    const cli = await db
      .selectFrom('cli_productos')
      .selectAll()
      .where('nombre', '=', id)
      .executeTakeFirst();
    if (!cli) {
      await registrarConsulta(
        db,
        { operacion: 'consultar_ficha', params: { entidad, id } },
        'sin_datos',
        Date.now() - t0,
      );
      return null;
    }
    const cmds = await db
      .selectFrom('cli_comandos')
      .selectAll()
      .where('cli_producto_id', '=', cli.id)
      .orderBy('comando')
      .execute();
    const latencia = Date.now() - t0;
    await registrarConsulta(
      db,
      { operacion: 'consultar_ficha', params: { entidad, id } },
      'bd',
      latencia,
    );
    return {
      entidad: 'cli',
      cli_producto: {
        nombre: cli.nombre,
        nombre_display: cli.nombre_display,
        proveedor: cli.proveedor,
        tipo: cli.tipo,
        repo_url: cli.repo_url,
      },
      comandos: cmds.map((c) => ({
        comando: c.comando,
        descripcion: c.descripcion,
        advertencia_caducidad: advertencia(c.vigente_hasta),
        procedencia: procDegradado(c, c.vigente_hasta),
      })),
    };
  }
  if (entidad === 'proveedor') {
    const modelos = await db
      .selectFrom('modelos')
      .selectAll()
      .where('proveedor', '=', id)
      .orderBy('modelo_id')
      .execute();
    if (modelos.length === 0) {
      await registrarConsulta(
        db,
        { operacion: 'consultar_ficha', params: { entidad, id } },
        'sin_datos',
        Date.now() - t0,
      );
      return null;
    }
    const proc0 = modelos[0];
    const latencia = Date.now() - t0;
    await registrarConsulta(
      db,
      { operacion: 'consultar_ficha', params: { entidad, id } },
      'bd',
      latencia,
    );
    return {
      entidad: 'proveedor',
      proveedor: id,
      total_modelos: modelos.length,
      modelos: modelos.map((m) => ({
        modelo_id: m.modelo_id,
        ventana_contexto_max: m.ventana_contexto_max,
        precios: {
          input_por_millon:
            m.precio_input_por_millon === null
              ? null
              : Number(m.precio_input_por_millon),
          output_por_millon:
            m.precio_output_por_millon === null
              ? null
              : Number(m.precio_output_por_millon),
        },
      })),
      procedencia: procDegradado(proc0, proc0.vigente_hasta),
    };
  }
  await registrarConsulta(
    db,
    { operacion: 'consultar_ficha', params: { entidad, id } },
    'sin_datos',
    Date.now() - t0,
  );
  return null;
}
