import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { crearKysely } from '../db/kysely';
import type { FilaLmarena } from './dominio';
import {
  CAMPO_METRICA_POR_CONFIG,
  normalizarFila,
} from './dominio';
import { aplicarCapturaLmarena } from './ingesta';

// Adaptador Arena (ex LMArena) — canal: datasets-server de HuggingFace (JSON
// público, sin auth; licencia del dataset CC-BY-4.0). Presupuesto educado:
// /filter primero (1-2 páginas por config) con /rows como respaldo, 2
// reintentos con backoff. Fail-closed: si la fuente no responde tras los
// reintentos, exit 3 SIN escribir nada en BD (un fallo de acceso jamás
// elimina ni degrada resultados previos).
//
// La captura cruda (respuesta íntegra) se custodia hasheada en
// datos/fuentes/benchmarks/lmarena/ — evidencia del hash de procedencia.

const DATASET = 'lmarena-ai/leaderboard-dataset';
const CONFIGS = ['text_style_control', 'webdev', 'agent'];
const PAGINA = 100;
const MAX_PAGINAS = 12; // tope de presupuesto: >= 1200 filas por config
const REINTENTOS = 2;
const BACKOFF_MS = 1500;

interface RespuestaFilas {
  rows?: { row: Record<string, unknown> }[];
  num_rows_total?: number;
}

async function obtener(url: string): Promise<unknown> {
  let ultimoError: unknown = null;
  for (let intento = 0; intento <= REINTENTOS; intento += 1) {
    try {
      const r = await fetch(url, {
        headers: {
          'user-agent': 'escrubery-benchmarks/0.1 (vigilancia diaria)',
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) {
        throw new Error(`HTTP ${r.status} en ${url}`);
      }
      return (await r.json()) as unknown;
    } catch (err) {
      ultimoError = err;
      if (intento < REINTENTOS) {
        await new Promise((res) => setTimeout(res, BACKOFF_MS * (intento + 1)));
      }
    }
  }
  throw ultimoError instanceof Error
    ? ultimoError
    : new Error(`fetch fallido: ${url}`);
}

/** /filter con where category='overall'; respaldo /rows con filtrado local
 * (el /filter de algunas configs responde 500 transitoriamente). */
async function filasDeConfig(
  config: string,
): Promise<{ filas: FilaLmarena[]; urlCanal: string }> {
  const base = `https://datasets-server.huggingface.co`;
  const filtro = `${base}/filter?dataset=${encodeURIComponent(DATASET)}&config=${config}&split=latest&length=${PAGINA}&where=${encodeURIComponent(`"category"='overall'`)}`;
  const filas: FilaLmarena[] = [];
  const crudas: Record<string, unknown>[] = [];
  let urlCanal = filtro;
  let totalDeclarado: number | undefined;
  try {
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
      const url = `${filtro}&offset=${pagina * PAGINA}`;
      urlCanal = url;
      const data = (await obtener(url)) as RespuestaFilas;
      const lote = (data.rows ?? []).map((r) => r.row);
      crudas.push(...lote);
      if (data.num_rows_total !== undefined) {
        totalDeclarado = data.num_rows_total;
      }
      // undefined = la fuente no declaró total: solo cortar por página corta
      if (
        (data.num_rows_total !== undefined &&
          crudas.length >= data.num_rows_total) ||
        lote.length < PAGINA
      ) {
        break;
      }
    }
  } catch (err) {
    // adversarial r1 LOW: dejar rastro del motivo antes del respaldo /rows
    console.error(
      `filter ${config} falló (${err instanceof Error ? err.message : String(err)}); respaldo /rows`,
    );
    crudas.length = 0;
    filas.length = 0;
    totalDeclarado = undefined;
    const rowsUrl = `${base}/rows?dataset=${encodeURIComponent(DATASET)}&config=${config}&split=latest&length=${PAGINA}`;
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
      const url = `${rowsUrl}&offset=${pagina * PAGINA}`;
      urlCanal = url;
      const data = (await obtener(url)) as RespuestaFilas;
      const lote = (data.rows ?? []).map((r) => r.row);
      crudas.push(...lote);
      if (data.num_rows_total !== undefined) {
        totalDeclarado = data.num_rows_total;
      }
      if (
        (data.num_rows_total !== undefined &&
          crudas.length >= data.num_rows_total) ||
        lote.length < PAGINA
      ) {
        break;
      }
    }
    // El total del split cubre TODAS las categorías: la completitud se mide
    // sobre lo DESCARGADO (no sobre el subconjunto overall filtrado abajo).
    if (totalDeclarado !== undefined && totalDeclarado > crudas.length) {
      throw new Error(
        `config ${config}: respaldo /rows descargó ${crudas.length} de ${totalDeclarado} filas del split (tope ${MAX_PAGINAS * PAGINA}) — captura incompleta, NO se ingesta (fail-closed)`,
      );
    }
    const overallCrudas = crudas.filter(
      (r) => r.category === 'overall',
    );
    crudas.length = 0;
    crudas.push(...overallCrudas);
    // el check externo compara contra el subconjunto overall; re-anclar el
    // total al ya-validado (descargado completo) para no disparar dos veces
    totalDeclarado = overallCrudas.length;
  }
  // adversarial r1 HIGH (rama /filter): presupuesto excedido o captura
  // incompleta → NADA se ingesta (fail-closed; jamás parcial silencioso).
  if (totalDeclarado !== undefined && totalDeclarado > crudas.length) {
    throw new Error(
      `config ${config}: ${crudas.length} filas overall servidas < ${totalDeclarado} declaradas (tope de presupuesto ${MAX_PAGINAS * PAGINA}) — captura incompleta, NO se ingesta (fail-closed; ampliar MAX_PAGINAS con decreto)`,
    );
  }
  // adversarial r1 MED: guarda de deriva de esquema sobre las filas CRUDAS
  // con el campo de métrica que la card del dataset declara por config —
  // incidente real 2026-10-29: agent publica score (no rating) y 51 filas
  // se ingeraron con valor null antes de esta guarda.
  if (crudas.length > 0) {
    const claveMetrica = CAMPO_METRICA_POR_CONFIG[config]?.valor ?? 'rating';
    const sinNombre = crudas.filter((r) => !('model_name' in r)).length;
    const sinMetrica = crudas.filter((r) => !(claveMetrica in r)).length;
    if (sinNombre === crudas.length || sinMetrica === crudas.length) {
      throw new Error(
        `config ${config}: esquema de la fuente cambió (0/${crudas.length} filas con ${sinNombre === crudas.length ? 'model_name' : claveMetrica}) — NO se ingesta (fail-closed)`,
      );
    }
  }
  filas.push(...crudas.map((r) => normalizarFila(config, r)));
  if (filas.length === 0) {
    throw new Error(
      `config ${config}: 0 filas overall (¿estructura de la fuente cambió? — fail-closed, no se ingesta nada)`,
    );
  }
  return { filas, urlCanal };
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
    'lmarena',
  );
  await mkdir(dirCapturas, { recursive: true });
  const ahora = new Date();
  const ts = ahora.toISOString().replace(/[:.]/g, '-');
  let totalNuevas = 0;
  let totalDuplicadas = 0;
  const fallos: string[] = [];
  try {
    for (const config of CONFIGS) {
      // Aislamiento por config (lección operativa 2026-10-29: /filter de
      // datasets-server puede caer por minutos para UNA config y no debe
      // bloquear el refresco de las demás). El fallo se reporta y el exit
      // final es 3 — nada se traga en silencio.
      try {
        const { filas, urlCanal } = await filasDeConfig(config);
        const capturaCruda = JSON.stringify(
          { capturado_en: ahora.toISOString(), canal: urlCanal, filas },
          null,
          2,
        );
        const hash = createHash('sha256')
          .update(capturaCruda, 'utf8')
          .digest('hex');
        const ruta = join(dirCapturas, `${config}-latest-${ts}.json`);
        await writeFile(ruta, capturaCruda, 'utf8');
        const r = await aplicarCapturaLmarena(
          db,
          {
            config,
            fuente_url: urlCanal,
            hash_sha256: hash,
            fecha_obtencion: ahora,
          },
          filas,
        );
        totalNuevas += r.nuevas;
        totalDuplicadas += r.duplicadas;
        console.log(
          `arena/${config}: ${filas.length} filas → ${r.nuevas} nuevas, ${r.duplicadas} duplicadas (idempotentes), ${r.subjects} subjects; captura ${ruta} hash ${hash.slice(0, 12)}…`,
        );
      } catch (err) {
        fallos.push(config);
        console.error(
          `FALLO config ${config}: ${err instanceof Error ? err.message : String(err)} (continuando con el resto)`,
        );
      }
    }
    console.log(
      `ingesta benchmarks: ${totalNuevas} nuevas, ${totalDuplicadas} duplicadas${fallos.length > 0 ? `, ${fallos.length} config(s) con fallo: ${fallos.join(', ')}` : ''}`,
    );
    if (fallos.length > 0) {
      process.exitCode = 3; // infra parcial declarada, no silenciosa
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(
    'error fatal:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(3);
});
