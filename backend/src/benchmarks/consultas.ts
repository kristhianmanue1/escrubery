import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../db/schema';
import { registrarConsulta } from '../consultas/log';
import { grupoComparabilidad } from './dominio';

// Consultas del módulo benchmarks. Contrato (errata 13): tres operaciones
// aditivas — listar_benchmarks (índice, sin procedencia), consultar_benchmark
// y consultar_resultados (procedencia por observación). Reglas:
// - La respuesta devuelve EVIDENCIA ESTRUCTURADA, nunca una decisión sobre
//   qué modelo usar (sin IA en el path: todo se sirve desde BD).
// - Caducidad por fuente: si la última captura supera la ventana de la
//   fuente, las observaciones se sirven degradadas (pendiente_de_verificar +
//   advertencia), igual que el resto del servicio.
// - Comparabilidad DERIVADA: grupo_comparabilidad por observación; mismo
//   grupo = comparables entre sí. Nunca se promedia ni se ordena como
//   "mejor modelo" — el orden es por rank declarado por la fuente, por
//   fecha de publicación, y solo dentro del grupo.

const DIAS_MS = 24 * 60 * 60 * 1000;

interface FuenteFrescura {
  ventana_dias: number;
  fecha_ultima_captura: Date | null;
}

function caducaFuente(f: FuenteFrescura): boolean {
  if (!f.fecha_ultima_captura) return true; // nunca capturada: sin vigencia
  return (
    Date.now() - f.fecha_ultima_captura.getTime() > f.ventana_dias * DIAS_MS
  );
}

function advertenciaFuente(f: FuenteFrescura): string | undefined {
  if (!f.fecha_ultima_captura) {
    return 'fuente sin captura registrada: no hay datos vigentes';
  }
  return caducaFuente(f)
    ? `última captura de la fuente el ${f.fecha_ultima_captura.toISOString()}; trátalas como pendientes de verificación hasta refrescar`
    : undefined;
}

export async function listarBenchmarks(db: Kysely<Database>) {
  const t0 = Date.now();
  const filas = await db
    .selectFrom('benchmark_definiciones as d')
    .innerJoin('benchmark_fuentes as f', 'f.id', 'd.fuente_id')
    .select([
      'f.slug as fuente',
      'f.nombre as fuente_nombre',
      'f.organizacion',
      'f.licencia',
      'f.canal_tipo',
      'd.slug as benchmark',
      'd.version_metodologia',
      'd.capacidad_evaluada',
      'd.objetivo',
      'd.metrica_principal',
    ])
    .orderBy('f.slug')
    .orderBy('d.slug')
    .execute();
  await registrarConsulta(
    db,
    { operacion: 'listar_benchmarks' },
    'bd',
    Date.now() - t0,
  );
  return {
    benchmarks: filas.map((f) => ({
      benchmark: f.benchmark,
      fuente: f.fuente,
      organizacion: f.organizacion,
      capacidad_evaluada: f.capacidad_evaluada,
      objetivo: f.objetivo,
      metrica_principal: f.metrica_principal,
      version_metodologia: f.version_metodologia,
      licencia: f.licencia,
    })),
    nota: 'observaciones publicadas por terceros con procedencia; escrubery no ejecuta evaluaciones ni crea rankings propios',
  };
}

export async function consultarBenchmark(
  db: Kysely<Database>,
  benchmark: string,
) {
  const t0 = Date.now();
  const def = await db
    .selectFrom('benchmark_definiciones as d')
    .innerJoin('benchmark_fuentes as f', 'f.id', 'd.fuente_id')
    .selectAll('d')
    .select([
      'f.slug as fuente_slug',
      'f.nombre as fuente_nombre',
      'f.organizacion',
      'f.licencia',
      'f.canal_url',
      'f.ventana_dias',
      'f.fecha_ultima_captura',
      'f.hash_ultima_captura',
      'f.metodologia_url as fuente_metodologia_url',
    ])
    .where('d.slug', '=', benchmark)
    .executeTakeFirst();
  if (!def) {
    await registrarConsulta(
      db,
      { operacion: 'consultar_benchmark', params: { benchmark } },
      'sin_datos',
      Date.now() - t0,
    );
    return null;
  }
  const versiones = await db
    .selectFrom('benchmark_definiciones')
    .select(['version_metodologia', 'id'])
    .where('slug', '=', benchmark)
    .where('fuente_id', '=', def.fuente_id)
    .orderBy('version_metodologia')
    .execute();
  const total = await db
    .selectFrom('benchmark_observaciones')
    .select((eb) => eb.fn.countAll<number>().as('n'))
    .where('definicion_id', '=', def.id)
    .executeTakeFirst();
  await registrarConsulta(
    db,
    { operacion: 'consultar_benchmark', params: { benchmark } },
    'bd',
    Date.now() - t0,
  );
  return {
    benchmark: def.slug,
    fuente: {
      slug: def.fuente_slug,
      nombre: def.fuente_nombre,
      organizacion: def.organizacion,
      licencia: def.licencia,
      canal_url: def.canal_url,
    },
    objetivo: def.objetivo,
    capacidad_evaluada: def.capacidad_evaluada,
    metrica_principal: def.metrica_principal,
    unidad: def.unidad,
    direccion: def.direccion,
    version_metodologia: def.version_metodologia,
    versiones_metodologia: versiones.map((v) => v.version_metodologia),
    incompatibilidades_documentadas: def.incompatibilidades_json,
    metodologia_url: def.metodologia_url ?? def.fuente_metodologia_url,
    total_observaciones: Number(total?.n ?? 0),
    // Procedencia representativa de la fuente (errata 13 §3.11 — adversarial
    // r1: el contrato la promete, se sirve): de la ÚLTIMA captura del ciclo
    // de ingesta (la fuente registra una por corrida; ver plan §6).
    procedencia: {
      fuente_url: def.canal_url,
      fuente_tipo: 'leaderboard_json',
      fecha_obtencion: def.fecha_ultima_captura
        ? def.fecha_ultima_captura.toISOString()
        : null,
      hash_sha256_contenido_original: def.hash_ultima_captura,
      estado_verificacion: 'pendiente_de_verificar',
      firma_ed25519: null,
    },
    advertencia_caducidad: advertenciaFuente({
      ventana_dias: def.ventana_dias,
      fecha_ultima_captura: def.fecha_ultima_captura,
    }),
  };
}

export interface FiltroResultados {
  benchmark?: string;
  modelo?: string;
  agente?: string;
}

export async function consultarResultados(
  db: Kysely<Database>,
  filtro: FiltroResultados,
  limite = 50,
) {
  const t0 = Date.now();
  let q = db
    .selectFrom('benchmark_observaciones as o')
    .innerJoin('benchmark_definiciones as d', 'd.id', 'o.definicion_id')
    .innerJoin('benchmark_subjects as s', 's.id', 'o.subject_id')
    .innerJoin('benchmark_fuentes as f', 'f.id', 'o.fuente_id')
    .select([
      'o.id',
      'd.slug as benchmark',
      'd.version_metodologia',
      'o.metrica',
      'o.valor',
      'o.unidad',
      'o.direccion',
      'o.incertidumbre_json',
      'o.condiciones_json',
      'o.publicado_por',
      'o.fecha_publicacion',
      'o.fecha_obtencion',
      'o.fuente_url',
      'o.hash_sha256_contenido_original',
      'o.estado_verificacion',
      'o.adaptador',
      'o.adaptador_version',
      'o.capturado_en',
      's.designacion_original',
      's.tipo as subject_tipo',
      's.organizacion_declarada',
      's.agente_designado',
      's.modelo_designado',
      's.resuelto_proveedor',
      's.resuelto_modelo_id',
      'f.slug as fuente',
      'f.ventana_dias',
      'f.fecha_ultima_captura',
    ]);
  if (filtro.benchmark) {
    q = q.where('d.slug', '=', filtro.benchmark);
  }
  if (filtro.modelo) {
    q = q.where((eb) =>
      eb.or([
        eb('s.resuelto_modelo_id', '=', filtro.modelo!),
        eb('s.modelo_designado', '=', filtro.modelo!),
        eb('s.resuelto_proveedor', '=', filtro.modelo!),
      ]),
    );
  }
  if (filtro.agente) {
    q = q.where('s.agente_designado', '=', filtro.agente);
  }
  // Total REAL de coincidencias (adversarial r1 MED: sin esto, "total" era
  // el nº servido y un consumidor de lm-arena-text veía 50 de 419 sin señal).
  let qc = db
    .selectFrom('benchmark_observaciones as o')
    .innerJoin('benchmark_definiciones as d', 'd.id', 'o.definicion_id')
    .innerJoin('benchmark_subjects as s', 's.id', 'o.subject_id')
    .select((eb) => eb.fn.countAll<number>().as('n'));
  if (filtro.benchmark) {
    qc = qc.where('d.slug', '=', filtro.benchmark);
  }
  if (filtro.modelo) {
    qc = qc.where((eb) =>
      eb.or([
        eb('s.resuelto_modelo_id', '=', filtro.modelo!),
        eb('s.modelo_designado', '=', filtro.modelo!),
        eb('s.resuelto_proveedor', '=', filtro.modelo!),
      ]),
    );
  }
  if (filtro.agente) {
    qc = qc.where('s.agente_designado', '=', filtro.agente);
  }
  const conteo = await qc.executeTakeFirst();
  const totalCoincidencias = Number(conteo?.n ?? 0);
  const rows = await q
    .orderBy('o.fecha_publicacion', 'desc')
    // nulls last explícito: Postgres ordena NULLS FIRST en DESC y una fila
    // sin rating no debe encabezar los resultados (criterio 6: ausencia ≠ 0)
    .orderBy(sql`o.valor desc nulls last`)
    .limit(limite)
    .execute();
  const latencia = Date.now() - t0;
  if (rows.length === 0) {
    await registrarConsulta(
      db,
      { operacion: 'consultar_resultados', params: filtro },
      'sin_datos',
      latencia,
    );
    return null;
  }
  await registrarConsulta(
    db,
    { operacion: 'consultar_resultados', params: filtro },
    'bd',
    latencia,
  );
  const obs = rows.map((r) => {
    const caduco = caducaFuente({
      ventana_dias: r.ventana_dias,
      fecha_ultima_captura: r.fecha_ultima_captura,
    });
    return {
      benchmark: r.benchmark,
      fuente: r.fuente,
      version_metodologia: r.version_metodologia,
      metrica: r.metrica,
      valor: r.valor,
      unidad: r.unidad,
      direccion: r.direccion,
      incertidumbre: r.incertidumbre_json,
      condiciones: r.condiciones_json,
      publicado_por: r.publicado_por,
      fecha_publicacion: r.fecha_publicacion
        ? r.fecha_publicacion.toISOString()
        : null,
      subject: {
        designacion_original: r.designacion_original,
        tipo: r.subject_tipo,
        organizacion_declarada: r.organizacion_declarada,
        agente: r.agente_designado,
        modelo_designado: r.modelo_designado,
        vinculacion_canonica:
          r.resuelto_proveedor && r.resuelto_modelo_id
            ? {
                resuelto: true,
                proveedor: r.resuelto_proveedor,
                modelo_id: r.resuelto_modelo_id,
              }
            : { resuelto: false, motivo: 'sin_datos' },
      },
      grupo_comparabilidad: grupoComparabilidad(
        r.fuente,
        r.benchmark,
        r.version_metodologia,
        r.metrica,
      ),
      advertencia_caducidad: advertenciaFuente({
        ventana_dias: r.ventana_dias,
        fecha_ultima_captura: r.fecha_ultima_captura,
      }),
      procedencia: {
        fuente_url: r.fuente_url,
        fuente_tipo: 'leaderboard_json',
        fecha_obtencion: r.fecha_obtencion.toISOString(),
        hash_sha256_contenido_original: r.hash_sha256_contenido_original,
        estado_verificacion: caduco
          ? 'pendiente_de_verificar'
          : r.estado_verificacion,
        firma_ed25519: null,
      },
      adaptador: { id: r.adaptador, version: r.adaptador_version },
    };
  });
  return {
    total: obs.length,
    total_coincidencias: totalCoincidencias,
    truncado: obs.length < totalCoincidencias,
    nota_comparabilidad:
      'observaciones con el mismo grupo_comparabilidad comparten fuente+definición+versión metodológica+métrica y son directamente comparables entre sí; grupos distintos: comparabilidad limitada o desconocida (ver incompatibilidades del benchmark). No se promedian métricas heterogéneas.',
    resultados: obs,
  };
}
