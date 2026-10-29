import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Kysely } from 'kysely';
import { crearKysely } from '../db/kysely';
import type { Database } from '../db/schema';
import {
  ADAPTADOR_SWEBENCH,
  DEFINICION_SWEBENCH,
  FUENTE_SWEBENCH,
  INCOMPATIBILIDADES_SWEBENCH,
  designacionSwebench,
  fechaONull,
  hashObservacion,
  normalizarFilaSwebench,
  type FilaSwebench,
} from './dominio';

// Adaptador SWE-bench Verified (Plan_Benchmarks_v0 F1; spike 2026-10-29).
// Canal: HTML estático de swebench.com con el leaderboard embebido como
// <script type="application/json" id="leaderboard-data">. La captura cruda
// es el HTML COMPLETO hasheado (el sitio no versiona: nuestra captura diaria
// es la historia). Fail-closed igual que Arena: esquema cambiado o captura
// imposible → exit 3 sin escribir; append-only con idempotencia por hash.

const URL_SITIO = 'https://www.swebench.com/';
const LEADERBOARD = 'Verified'; // scope v0 (decreto 2026-10-29)
const REINTENTOS = 2;
const BACKOFF_MS = 2000;
const ADAPTADOR_VERSION = '0.1.0';

/** Extrae y parsea el JSON embebido (exportado para specs). */
export function extraerLeaderboards(html: string): {
  name: string;
  results: Record<string, unknown>[];
}[] {
  const m = html.match(
    /<script type="application\/json" id="leaderboard-data">\s*(\[[\s\S]*?\])\s*<\/script>/,
  );
  if (!m) {
    throw new Error(
      'bloque #leaderboard-data no encontrado (¿estructura del sitio cambió? — fail-closed)',
    );
  }
  return JSON.parse(m[1]) as { name: string; results: Record<string, unknown>[] }[];
}

async function obtenerHtml(): Promise<string> {
  let ultimo: unknown = null;
  for (let intento = 0; intento <= REINTENTOS; intento += 1) {
    try {
      const r = await fetch(URL_SITIO, {
        headers: { 'user-agent': 'escrubery-benchmarks/0.1 (vigilancia diaria)' },
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} en ${URL_SITIO}`);
      const html = await r.text();
      if (!html.includes('leaderboard-data')) {
        throw new Error('HTML sin bloque leaderboard-data (¿cambió el sitio?)');
      }
      return html;
    } catch (err) {
      ultimo = err;
      if (intento < REINTENTOS) {
        await new Promise((res) => setTimeout(res, BACKOFF_MS * (intento + 1)));
      }
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error('fetch fallido');
}

/** Guarda de deriva de esquema: claves obligatorias en TODAS las filas. */
function exigirEsquema(filas: FilaSwebench[]): void {
  const claves: (keyof FilaSwebench)[] = [
    'agent',
    'model_display',
    'resolved',
    'checked',
    'date',
    'folder',
  ];
  for (const clave of claves) {
    const ausentes = filas.filter((f) => f[clave] === null || f[clave] === '');
    // 'resolved'/'checked' pueden ser null legítimos en OTRAS filas, pero no
    // en TODAS (columna renombrada); agent/model_display nunca vacíos en todas.
    if (ausentes.length === filas.length) {
      throw new Error(
        `esquema de SWE-bench cambió: 0/${filas.length} filas con ${String(clave)} — NO se ingesta (fail-closed)`,
      );
    }
  }
  if (filas.some((f) => !f.agent || !f.model_display)) {
    // filas individuales sin agente/modelo se saltan (dato parcial de la
    // fuente); si fueran TODAS, la guarda anterior ya abortó
    if (filas.every((f) => !f.agent || !f.model_display)) {
      throw new Error('todas las filas sin agente/modelo — fail-closed');
    }
  }
}

export interface MetaCapturaSwebench {
  fuente_url: string;
  hash_sha256: string;
  fecha_obtencion: Date;
}

export interface ResultadoIngestaSwebench {
  nuevas: number;
  duplicadas: number;
  subjects: number;
  filas_saltar: number;
}

export async function aplicarCapturaSwebench(
  db: Kysely<Database>,
  meta: MetaCapturaSwebench,
  filas: FilaSwebench[],
): Promise<ResultadoIngestaSwebench> {
  exigirEsquema(filas);
  // fuente
  await db
    .insertInto('benchmark_fuentes')
    .values({
      slug: FUENTE_SWEBENCH.slug,
      nombre: FUENTE_SWEBENCH.nombre,
      organizacion: FUENTE_SWEBENCH.organizacion,
      canal_url: FUENTE_SWEBENCH.canal_url,
      canal_tipo: FUENTE_SWEBENCH.canal_tipo,
      licencia: FUENTE_SWEBENCH.licencia,
      metodologia_url: FUENTE_SWEBENCH.metodologia_url,
      ventana_dias: FUENTE_SWEBENCH.ventana_dias,
      notas: FUENTE_SWEBENCH.notas,
      activa: true,
    })
    .onConflict((oc) =>
      oc.column('slug').doUpdateSet({
        nombre: FUENTE_SWEBENCH.nombre,
        organizacion: FUENTE_SWEBENCH.organizacion,
        canal_url: FUENTE_SWEBENCH.canal_url,
        canal_tipo: FUENTE_SWEBENCH.canal_tipo,
        licencia: FUENTE_SWEBENCH.licencia,
        metodologia_url: FUENTE_SWEBENCH.metodologia_url,
        ventana_dias: FUENTE_SWEBENCH.ventana_dias,
        notas: FUENTE_SWEBENCH.notas,
        actualizado_en: new Date().toISOString(),
      }),
    )
    .execute();
  const fuente = await db
    .selectFrom('benchmark_fuentes')
    .select('id')
    .where('slug', '=', FUENTE_SWEBENCH.slug)
    .executeTakeFirstOrThrow();
  // definición
  await db
    .insertInto('benchmark_definiciones')
    .values({
      fuente_id: fuente.id,
      slug: DEFINICION_SWEBENCH.slug,
      version_metodologia: DEFINICION_SWEBENCH.version_metodologia,
      objetivo: DEFINICION_SWEBENCH.objetivo,
      capacidad_evaluada: DEFINICION_SWEBENCH.capacidad_evaluada,
      metrica_principal: DEFINICION_SWEBENCH.metrica,
      unidad: DEFINICION_SWEBENCH.unidad,
      direccion: 'mayor_es_mejor',
      metodologia_url: FUENTE_SWEBENCH.metodologia_url,
      incompatibilidades_json: JSON.stringify(INCOMPATIBILIDADES_SWEBENCH),
    })
    .onConflict((oc) =>
      oc
        .columns(['fuente_id', 'slug', 'version_metodologia'])
        .doUpdateSet({
          objetivo: DEFINICION_SWEBENCH.objetivo,
          capacidad_evaluada: DEFINICION_SWEBENCH.capacidad_evaluada,
          metrica_principal: DEFINICION_SWEBENCH.metrica,
          unidad: DEFINICION_SWEBENCH.unidad,
          metodologia_url: FUENTE_SWEBENCH.metodologia_url,
          incompatibilidades_json: JSON.stringify(INCOMPATIBILIDADES_SWEBENCH),
        }),
    )
    .execute();
  const def = await db
    .selectFrom('benchmark_definiciones')
    .select('id')
    .where('fuente_id', '=', fuente.id)
    .where('slug', '=', DEFINICION_SWEBENCH.slug)
    .where('version_metodologia', '=', DEFINICION_SWEBENCH.version_metodologia)
    .executeTakeFirstOrThrow();

  let nuevas = 0;
  let duplicadas = 0;
  let saltar = 0;
  const subjects = new Set<string>();
  for (const fila of filas) {
    if (!fila.agent || !fila.model_display) {
      saltar += 1;
      continue; // dato parcial de la fuente: se declara en el resumen, no se ingiere
    }
    const designacion = designacionSwebench(fila);
    const alias = await db
      .selectFrom('identidad_alias')
      .select(['proveedor', 'modelo_id'])
      .where('issuer_id', '=', fila.model_display)
      .executeTakeFirst();
    const subject = await db
      .insertInto('benchmark_subjects')
      .values({
        fuente_id: fuente.id,
        designacion_original: designacion,
        tipo: 'sistema_compuesto',
        organizacion_declarada: fila.model_org,
        agente_designado: fila.agent,
        modelo_designado: fila.model_display,
        resuelto_proveedor: alias?.proveedor ?? null,
        resuelto_modelo_id: alias?.modelo_id ?? null,
      })
      .onConflict((oc) =>
        oc.columns(['fuente_id', 'designacion_original']).doUpdateSet({
          organizacion_declarada: fila.model_org,
          agente_designado: fila.agent,
          modelo_designado: fila.model_display,
          resuelto_proveedor: alias?.proveedor ?? null,
          resuelto_modelo_id: alias?.modelo_id ?? null,
        }),
      )
      .returning('id')
      .executeTakeFirstOrThrow();
    subjects.add(designacion);

    const fechaPub = fechaONull(fila.date);
    const observacionHash = hashObservacion({
      fuente: FUENTE_SWEBENCH.slug,
      definicion: DEFINICION_SWEBENCH.slug,
      version_metodologia: DEFINICION_SWEBENCH.version_metodologia,
      metrica: DEFINICION_SWEBENCH.metrica,
      designacion,
      fecha_publicacion: fechaPub ? fechaPub.toISOString().slice(0, 10) : null,
      valor: fila.resolved,
      ic_inferior: null,
      ic_superior: null,
      run_ref: fila.folder,
    });
    const insertado = await db
      .insertInto('benchmark_observaciones')
      .values({
        fuente_id: fuente.id,
        definicion_id: def.id,
        subject_id: subject.id,
        run_ref: fila.folder,
        metrica: DEFINICION_SWEBENCH.metrica,
        valor: fila.resolved,
        unidad: DEFINICION_SWEBENCH.unidad,
        direccion: 'mayor_es_mejor',
        incertidumbre_json: null, // la fuente no publica IC por run
        condiciones_json: JSON.stringify({
          agente: fila.agent,
          agente_org: fila.agent_org,
          reasoning_effort: fila.reasoning_effort,
          coste_total_usd: fila.cost,
          coste_por_instancia_usd: fila.instance_cost,
          llamadas_por_instancia: fila.instance_calls,
          open_weights: fila.os_model,
          sitio_del_agente: fila.site,
          // warning VERBATIM del equipo: limitación declarada por la fuente
          warning_equipo: fila.warning,
        }),
        // checked=true → verificado por el equipo (plataforma); false → autoreporte
        publicado_por: fila.checked ? 'plataforma' : 'tercero',
        fecha_ejecucion: null,
        fecha_publicacion: fechaPub ? fechaPub.toISOString() : null,
        fuente_url: meta.fuente_url,
        fuente_tipo: 'leaderboard_json',
        fecha_obtencion: meta.fecha_obtencion.toISOString(),
        hash_sha256_contenido_original: meta.hash_sha256,
        estado_verificacion: 'pendiente_de_verificar',
        adaptador: ADAPTADOR_SWEBENCH,
        adaptador_version: ADAPTADOR_VERSION,
        observacion_hash: observacionHash,
      })
      .onConflict((oc) => oc.column('observacion_hash').doNothing())
      .returning('id')
      .executeTakeFirst();
    if (insertado) nuevas += 1;
    else duplicadas += 1;
  }

  await db
    .updateTable('benchmark_fuentes')
    .set({
      fecha_ultima_captura: meta.fecha_obtencion.toISOString(),
      hash_ultima_captura: meta.hash_sha256,
      actualizado_en: new Date().toISOString(),
    })
    .where('id', '=', fuente.id)
    .execute();

  return { nuevas, duplicadas, subjects: subjects.size, filas_saltar: saltar };
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida (ver backend/.env)');
    process.exit(2);
  }
  const db = crearKysely(url);
  const dirCapturas = join(
    process.cwd(),
    '..',
    'datos',
    'fuentes',
    'benchmarks',
    'swebench',
  );
  await mkdir(dirCapturas, { recursive: true });
  try {
    const html = await obtenerHtml();
    const leaderboards = extraerLeaderboards(html);
    const objetivo = leaderboards.find((l) => l.name === LEADERBOARD);
    if (!objetivo || objetivo.results.length === 0) {
      throw new Error(
        `leaderboard ${LEADERBOARD} ausente o vacío (¿estructura cambió? — fail-closed)`,
      );
    }
    const ahora = new Date();
    const ts = ahora.toISOString().replace(/[:.]/g, '-');
    const hash = createHash('sha256').update(html, 'utf8').digest('hex');
    const ruta = join(dirCapturas, `swebench-${LEADERBOARD.toLowerCase()}-${ts}.html`);
    await writeFile(ruta, html, 'utf8');
    const filas = objetivo.results.map((r) => normalizarFilaSwebench(r));
    const r = await aplicarCapturaSwebench(
      db,
      { fuente_url: URL_SITIO, hash_sha256: hash, fecha_obtencion: ahora },
      filas,
    );
    console.log(
      `swebench/${LEADERBOARD}: ${filas.length} runs → ${r.nuevas} nuevas, ${r.duplicadas} duplicadas (idempotentes), ${r.subjects} subjects, ${r.filas_saltar} parciales saltadas; captura ${ruta} hash ${hash.slice(0, 12)}…`,
    );
  } finally {
    await db.destroy();
  }
}

// solo como entrypoint (bajo jest/JEST_WORKER_ID el módulo se importa para
// specs: no ejecutar la captura en un import)
if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => {
    console.error(
      'error fatal:',
      err instanceof Error ? err.message : String(err),
    );
    process.exit(3);
  });
}
