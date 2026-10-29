import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import {
  ADAPTADOR,
  ADAPTADOR_VERSION,
  DEFINICIONES_LMARENA,
  FUENTE_LMARENA,
  INCOMPATIBILIDADES_BT,
  VERSION_METODOLOGIA_BT,
  fechaONull,
  hashObservacion,
  type FilaLmarena,
} from './dominio';

// Ingesta append-only de capturas de Arena (ex LMArena). Entrada: las filas
// del dataset + los metadatos de la captura cruda (URL, hash, fecha). La
// captura cruda vive en datos/fuentes/benchmarks/lmarena/ (árbol congelado,
// skevi ADR-033); este módulo solo escribe en BD.
//
// Reglas duras del dominio (espejo de las del repo):
// - El contenido de la fuente es DATO no confiable: se persiste verbatim
//   (designacion_original) y jamás se interpreta como instrucción.
// - La vinculación canónica pasa por identidad_alias (curaduría); sin alias
//   → resuelto_* NULL (fail-closed, "no_resuelta" es estado válido).
// - valor NULL se persiste NULL (la ausencia de rating nunca es cero).

export interface MetaCaptura {
  config: string;
  fuente_url: string;
  hash_sha256: string;
  fecha_obtencion: Date;
}

export interface ResultadoIngesta {
  nuevas: number;
  duplicadas: number;
  subjects: number;
}

async function asegurarFuente(db: Kysely<Database>): Promise<number> {
  await db
    .insertInto('benchmark_fuentes')
    .values({
      slug: FUENTE_LMARENA.slug,
      nombre: FUENTE_LMARENA.nombre,
      organizacion: FUENTE_LMARENA.organizacion,
      canal_url: FUENTE_LMARENA.canal_url,
      canal_tipo: FUENTE_LMARENA.canal_tipo,
      licencia: FUENTE_LMARENA.licencia,
      metodologia_url: FUENTE_LMARENA.metodologia_url,
      ventana_dias: FUENTE_LMARENA.ventana_dias,
      notas: FUENTE_LMARENA.notas,
      activa: true,
    })
    .onConflict((oc) =>
      oc.column('slug').doUpdateSet({
        nombre: FUENTE_LMARENA.nombre,
        organizacion: FUENTE_LMARENA.organizacion,
        canal_url: FUENTE_LMARENA.canal_url,
        canal_tipo: FUENTE_LMARENA.canal_tipo,
        licencia: FUENTE_LMARENA.licencia,
        metodologia_url: FUENTE_LMARENA.metodologia_url,
        ventana_dias: FUENTE_LMARENA.ventana_dias,
        notas: FUENTE_LMARENA.notas,
        actualizado_en: new Date().toISOString(),
      }),
    )
    .execute();
  const f = await db
    .selectFrom('benchmark_fuentes')
    .select('id')
    .where('slug', '=', FUENTE_LMARENA.slug)
    .executeTakeFirstOrThrow();
  return f.id;
}

async function asegurarDefinicion(
  db: Kysely<Database>,
  fuenteId: number,
  config: string,
): Promise<number> {
  const def = DEFINICIONES_LMARENA.find((d) => d.config === config);
  if (!def) {
    throw new Error(`config de Arena sin definición declarada: ${config}`);
  }
  await db
    .insertInto('benchmark_definiciones')
    .values({
      fuente_id: fuenteId,
      slug: def.slug,
      version_metodologia: VERSION_METODOLOGIA_BT,
      objetivo: def.objetivo,
      capacidad_evaluada: def.capacidad_evaluada,
      metrica_principal: 'rating_bt',
      unidad: 'rating_bt',
      direccion: 'mayor_es_mejor',
      metodologia_url: FUENTE_LMARENA.metodologia_url,
      incompatibilidades_json: JSON.stringify(INCOMPATIBILIDADES_BT),
    })
    .onConflict((oc) =>
      oc.columns(['fuente_id', 'slug', 'version_metodologia']).doUpdateSet({
        objetivo: def.objetivo,
        capacidad_evaluada: def.capacidad_evaluada,
        metodologia_url: FUENTE_LMARENA.metodologia_url,
        incompatibilidades_json: JSON.stringify(INCOMPATIBILIDADES_BT),
      }),
    )
    .execute();
  const d = await db
    .selectFrom('benchmark_definiciones')
    .select('id')
    .where('fuente_id', '=', fuenteId)
    .where('slug', '=', def.slug)
    .where('version_metodologia', '=', VERSION_METODOLOGIA_BT)
    .executeTakeFirstOrThrow();
  return d.id;
}

/** Vinculación canónica del subject vía curaduría (identidad_alias). Sin
 * alias curado → NULL (fail-closed; la designación original se conserva). */
async function resolverSubject(
  db: Kysely<Database>,
  designacion: string,
): Promise<{ proveedor: string | null; modeloId: string | null }> {
  const alias = await db
    .selectFrom('identidad_alias')
    .select(['proveedor', 'modelo_id'])
    .where('issuer_id', '=', designacion)
    .executeTakeFirst();
  return alias
    ? { proveedor: alias.proveedor, modeloId: alias.modelo_id }
    : { proveedor: null, modeloId: null };
}

export async function aplicarCapturaLmarena(
  db: Kysely<Database>,
  meta: MetaCaptura,
  filas: FilaLmarena[],
): Promise<ResultadoIngesta> {
  const def = DEFINICIONES_LMARENA.find((d) => d.config === meta.config);
  if (!def) {
    throw new Error(`config de Arena sin definición declarada: ${meta.config}`);
  }
  const fuenteId = await asegurarFuente(db);
  const definicionId = await asegurarDefinicion(db, fuenteId, meta.config);

  let nuevas = 0;
  let duplicadas = 0;
  const subjects = new Set<string>();

  for (const fila of filas) {
    if (!fila.model_name) continue; // fila sin designación: nada que registrar
    // Subject: upsert por (fuente, designacion verbatim). La resolución se
    // re-intenta en cada captura: si la curaduría añadió el alias, la próxima
    // corrida lo vincula (sin reescribir historia de observaciones).
    const res = await resolverSubject(db, fila.model_name);
    const subject = await db
      .insertInto('benchmark_subjects')
      .values({
        fuente_id: fuenteId,
        designacion_original: fila.model_name,
        tipo: 'modelo',
        organizacion_declarada: fila.organization ?? null,
        agente_designado: null,
        modelo_designado: fila.model_name,
        resuelto_proveedor: res.proveedor,
        resuelto_modelo_id: res.modeloId,
      })
      .onConflict((oc) =>
        oc.columns(['fuente_id', 'designacion_original']).doUpdateSet({
          organizacion_declarada: fila.organization ?? null,
          resuelto_proveedor: res.proveedor,
          resuelto_modelo_id: res.modeloId,
        }),
      )
      .returning('id')
      .executeTakeFirstOrThrow();
    subjects.add(fila.model_name);

    const fechaPub = fechaONull(fila.leaderboard_publish_date);
    const observacionHash = hashObservacion({
      fuente: FUENTE_LMARENA.slug,
      definicion: def.slug,
      version_metodologia: VERSION_METODOLOGIA_BT,
      metrica: 'rating_bt',
      designacion: fila.model_name,
      fecha_publicacion: fechaPub ? fechaPub.toISOString().slice(0, 10) : null,
      valor: fila.rating,
      ic_inferior: fila.rating_lower,
      ic_superior: fila.rating_upper,
      run_ref: null,
    });
    const insertado = await db
      .insertInto('benchmark_observaciones')
      .values({
        fuente_id: fuenteId,
        definicion_id: definicionId,
        subject_id: subject.id,
        run_ref: null,
        metrica: 'rating_bt',
        valor: fila.rating ?? null,
        unidad: 'rating_bt',
        direccion: 'mayor_es_mejor',
        incertidumbre_json:
          fila.rating_lower !== null || fila.rating_upper !== null
            ? JSON.stringify({
                tipo: 'ic_95',
                inferior: fila.rating_lower ?? null,
                superior: fila.rating_upper ?? null,
                varianza: fila.variance ?? null,
              })
            : null,
        condiciones_json: JSON.stringify({
          arena_config: meta.config,
          categoria: fila.category ?? null,
          votos: fila.vote_count ?? null,
          rank_en_publicacion: fila.rank ?? null,
          licencia_modelo_declarada: fila.license ?? null,
          organizacion_declarada: fila.organization ?? null,
        }),
        publicado_por: 'plataforma',
        fecha_ejecucion: null,
        fecha_publicacion: fechaPub ? fechaPub.toISOString() : null,
        fuente_url: meta.fuente_url,
        fuente_tipo: 'leaderboard_json',
        fecha_obtencion: meta.fecha_obtencion.toISOString(),
        hash_sha256_contenido_original: meta.hash_sha256,
        estado_verificacion: 'pendiente_de_verificar',
        adaptador: ADAPTADOR,
        adaptador_version: ADAPTADOR_VERSION,
        observacion_hash: observacionHash,
      })
      .onConflict((oc) => oc.column('observacion_hash').doNothing())
      .returning('id')
      .executeTakeFirst();
    if (insertado) {
      nuevas += 1;
    } else {
      duplicadas += 1;
    }
  }

  await db
    .updateTable('benchmark_fuentes')
    .set({
      fecha_ultima_captura: meta.fecha_obtencion.toISOString(),
      hash_ultima_captura: meta.hash_sha256,
      actualizado_en: new Date().toISOString(),
    })
    .where('id', '=', fuenteId)
    .execute();

  return { nuevas, duplicadas, subjects: subjects.size };
}
