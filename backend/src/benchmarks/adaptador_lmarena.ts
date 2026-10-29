import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { crearKysely } from '../db/kysely';
import type { FilaLmarena } from './dominio';
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
  rows?: { row: FilaLmarena }[];
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
  let urlCanal = filtro;
  try {
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
      const url = `${filtro}&offset=${pagina * PAGINA}`;
      urlCanal = url;
      const data = (await obtener(url)) as RespuestaFilas;
      const filas2 = (data.rows ?? []).map((r) => r.row);
      filas.push(...filas2);
      if (
        filas.length >= (data.num_rows_total ?? 0) ||
        filas2.length < PAGINA
      ) {
        break;
      }
    }
    if (filas.length > 0) {
      if (filas.length >= MAX_PAGINAS * PAGINA) {
        console.error(
          `aviso: ${config} truncado a ${filas.length} filas (tope de presupuesto)`,
        );
      }
      return { filas, urlCanal };
    }
  } catch {
    // respaldo /rows (todas las categorías; filtrado local)
  }
  const rowsUrl = `${base}/rows?dataset=${encodeURIComponent(DATASET)}&config=${config}&split=latest&length=${PAGINA}`;
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
    const url = `${rowsUrl}&offset=${pagina * PAGINA}`;
    urlCanal = url;
    const data = (await obtener(url)) as RespuestaFilas;
    const lote = (data.rows ?? []).map((r) => r.row);
    filas.push(...lote);
    if (lote.length < PAGINA) break;
  }
  const overall = filas.filter((f) => f.category === 'overall');
  return { filas: overall, urlCanal: rowsUrl };
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
  try {
    for (const config of CONFIGS) {
      const { filas, urlCanal } = await filasDeConfig(config);
      if (filas.length === 0) {
        throw new Error(
          `config ${config}: 0 filas overall (¿estructura de la fuente cambió? — fail-closed, no se ingesta nada)`,
        );
      }
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
    }
    console.log(
      `ingesta benchmarks: ${totalNuevas} nuevas, ${totalDuplicadas} duplicadas`,
    );
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
