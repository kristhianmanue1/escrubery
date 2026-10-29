import { createHash } from 'node:crypto';

// Módulo benchmarks (Plan_Benchmarks_v0, 2026-10-29) — dominio de observaciones
// de evaluaciones publicadas por terceros. Fronteras: escrubery LEE resultados
// públicos y los sirve con procedencia; NO ejecuta evaluaciones (eso es F4b,
// aparcado), NO crea rankings propios, NO promedia métricas heterogéneas.
//
// Semántica append-only: a diferencia del catálogo de modelos (regenerar-y-
// purgar), una observación es un hecho histórico — jamás se purga ni edita.
// Idempotencia por observacion_hash UNIQUE: la misma publicación con el mismo
// valor → mismo hash → no duplica; una publicación nueva o un valor corregido
// → hash distinto → fila nueva (la historia conserva ambas evidencias).

export interface FilaLmarena {
  model_name: string;
  organization: string | null;
  license: string | null;
  rating: number | null;
  rating_lower: number | null;
  rating_upper: number | null;
  variance: number | null;
  vote_count: number | null;
  rank: number | null;
  category: string;
  leaderboard_publish_date: string;
}

/** Mapa de campos por config — DECLARADO por la card del dataset (features
 * difieren: agent usa score/score_ci_*, el resto rating/rating_*). Normalizar
 * no es inferir: es el mapeo documentado de la propia fuente. El campo
 * original queda en condiciones (campo_original_metrica). */
export const CAMPO_METRICA_POR_CONFIG: Record<string, { valor: string; inferior: string; superior: string; votos: string }> = {
  agent: { valor: 'score', inferior: 'score_ci_lower', superior: 'score_ci_upper', votos: 'observation_count' },
};
const CAMPO_DEFAULT = { valor: 'rating', inferior: 'rating_lower', superior: 'rating_upper', votos: 'vote_count' };

type FilaCruda = Record<string, unknown>;

function num(v: unknown): number | null {
  return typeof v === 'number' ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

export function normalizarFila(config: string, row: FilaCruda): FilaLmarena {
  const c = CAMPO_METRICA_POR_CONFIG[config] ?? CAMPO_DEFAULT;
  return {
    model_name: str(row.model_name) ?? '',
    organization: str(row.organization),
    license: str(row.license),
    rating: num(row[c.valor]),
    rating_lower: num(row[c.inferior]),
    rating_upper: num(row[c.superior]),
    variance: num(row.variance),
    vote_count: num(row[c.votos]),
    rank: num(row.rank),
    category: str(row.category) ?? '',
    leaderboard_publish_date: str(row.leaderboard_publish_date) ?? '',
  };
}

export interface DefinicionLmarena {
  config: string;
  slug: string;
  objetivo: string;
  capacidad_evaluada: string;
  metrica: string;
  unidad: string;
}

// Definiciones ingeridas v0: las tres arenas alineadas con el consumidor
// (epistates/el ecosistema eligen modelos para programar y agentes).
// La arena "text" se toma en su variante canónica con style control.
// OJO (incidente 2026-10-29 r2): agent publica `score` en escala 0–1 (IPS),
// NO un rating BT (~1500) — métrica y unidad PROPIAS por config para no
// inducir comparaciones engañosas entre escalas distintas.
export const DEFINICIONES_LMARENA: DefinicionLmarena[] = [
  {
    config: 'text_style_control',
    slug: 'lm-arena-text',
    objetivo:
      'Preferencia humana por votos pareados en conversación (Bradley-Terry con style control)',
    capacidad_evaluada: 'conversacion_general',
    metrica: 'rating_bt',
    unidad: 'rating_bt',
  },
  {
    config: 'webdev',
    slug: 'lm-arena-webdev',
    objetivo:
      'Preferencia humana por votos pareados en construcción de aplicaciones web',
    capacidad_evaluada: 'programacion_web',
    metrica: 'rating_bt',
    unidad: 'rating_bt',
  },
  {
    config: 'agent',
    slug: 'lm-arena-agent',
    objetivo:
      'Preferencia humana por votos pareados en tareas agénticas multi-turno (score con signo de la fuente, centrado en ~0; la fuente no declara rango)',
    capacidad_evaluada: 'agentes',
    metrica: 'score_agente',
    unidad: 'score_con_signo',
  },
];

export const FUENTE_LMARENA = {
  slug: 'lmarena',
  nombre: 'Arena (ex LMArena) Leaderboard Dataset',
  organizacion: 'LMSYS / Arena',
  canal_url:
    'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset (datasets-server /filter y /rows)',
  canal_tipo: 'hf_datasets_server',
  licencia: 'CC-BY-4.0 (dataset; atribución)',
  metodologia_url:
    'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset',
  // Cadencia observada del dataset: ~semanal; ventana de frescura de la
  // CAPTURA (no del dato): si no refrescamos en 3 días, se sirve degradado.
  ventana_dias: 3,
  notas:
    'Web arena.ai devuelve 403 a clientes no-navegador; el canal canónico es este dataset. Rating BT (mayor = mejor). Cambios metodológicos documentados por la fuente: Elo→BT 2024-01-09, style control por defecto 2025-05-16, re-weighting 2025-07-23.',
} as const;

// Versión metodológica de las definiciones v0: BT con style control. Las
// incompatibilidades documentadas se persisten en la definición (nunca se
// derivan en silencio).
export const VERSION_METODOLOGIA_BT = 'bt-style-control-1';
export const INCOMPATIBILIDADES_BT = [
  'No comparar con ratings publicados antes del 2025-05-16 (sin style control).',
  'No comparar con ratings tipo Elo previos al 2024-01-09.',
  'Re-weighting del 2025-07-23: comparaciones entre snapshots que lo cruzan son limitadas.',
];

export const ADAPTADOR = 'escrubery-benchmarks-lmarena';
export const ADAPTADOR_VERSION = '0.1.0';

/** Hash de observación: canónico y determinista (orden de claves fijo por
 * construcción). Misma publicación + mismo valor → mismo hash (idempotencia);
 * cualquier cambio relevante → hash distinto (fila nueva = historia). */
export function hashObservacion(o: {
  fuente: string;
  definicion: string;
  version_metodologia: string;
  metrica: string;
  designacion: string;
  fecha_publicacion: string | null;
  valor: number | null;
  ic_inferior: number | null;
  ic_superior: number | null;
  run_ref: string | null;
}): string {
  const canon = JSON.stringify(o);
  return createHash('sha256').update(canon, 'utf8').digest('hex');
}

/** Grupo de comparabilidad: observaciones con el mismo grupo comparten
 * fuente+definición+versión metodológica+métrica → comparables entre sí
 * (comparabilidad demostrada). Grupo distinto → comparabilidad limitada o
 * desconocida (ver consultar_resultados). Derivado, nunca persistido. */
export function grupoComparabilidad(
  fuente: string,
  definicion: string,
  versionMetodologia: string,
  metrica: string,
): string {
  return createHash('sha256')
    .update(`${fuente}|${definicion}|${versionMetodologia}|${metrica}`, 'utf8')
    .digest('hex')
    .slice(0, 12);
}

export function fechaONull(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// --- Fuente 2: SWE-bench (spike 2026-10-29 POSITIVO; decreto de ejecución
// --- misma fecha). Canal: swebench.com es HTML estático con el leaderboard
// --- EMBEBIDO como JSON (#leaderboard-data) — extracción probada. Scope
// --- v0: SOLO el leaderboard Verified (los otros 4 declarados, no ingeridos).
// --- ToS registrado: sitio sin términos propios; repo del equipo MIT
// --- (SWE-bench/SWE-bench, verificado vía API 2026-10-29); submissions con
// --- trazas S3 públicas por diseño.

export interface FilaSwebench {
  agent: string;
  agent_org: string | null;
  model_display: string;
  model_org: string | null;
  resolved: number | null;
  checked: boolean | null;
  date: string | null;
  folder: string | null;
  reasoning_effort: string | null;
  cost: number | null;
  instance_cost: number | null;
  instance_calls: number | null;
  os_model: boolean | null;
  site: string | null;
  warning: string | null;
}

export const FUENTE_SWEBENCH = {
  slug: 'swebench',
  nombre: 'SWE-bench Official Leaderboards',
  organizacion: 'SWE-bench Team (Princeton)',
  canal_url: 'https://www.swebench.com/ (JSON embebido #leaderboard-data en HTML estático)',
  canal_tipo: 'html_json_embebido',
  licencia: 'repo del equipo MIT (github.com/SWE-bench/SWE-bench); sitio sin ToS propio',
  metodologia_url: 'https://www.swebench.com/',
  ventana_dias: 3,
  notas:
    'Resultados run-level enviados por terceros; "checked" = verificado por el equipo SWE-bench. resolved es PORCENTAJE 0–100. Otros leaderboards del sitio (Full/Lite/Multilingual/Multimodal) declarados, no ingeridos en v0. El sitio no versiona su HTML: la captura cruda diaria hasheada ES la historia.',
} as const;

export const DEFINICION_SWEBENCH = {
  slug: 'swe-bench-verified',
  version_metodologia: 'verified-1',
  objetivo:
    'Resolver issues reales de GitHub (500 instancias human-validadas) medido por verificación de tests unitarios; % resueltas por run agente+modelo',
  capacidad_evaluada: 'ingenieria_de_software',
  metrica: 'resolved_pct',
  unidad: 'porcentaje',
};

export const INCOMPATIBILIDADES_SWEBENCH = [
  'No comparar con Full/Lite/Multilingual/Multimodal: conjuntos de instancias distintos.',
  'Harnesses heterogéneos entre runs: un resultado mide al PAR agente+modelo; para comparar modelos (no harnesses) exigen entorno fijo (p. ej. mini-SWE-agent/"Bash Only").',
  'Issues públicos pre-2024: riesgo de contaminación por entrenamiento.',
  'checked=false = autoreporte sin verificación del equipo SWE-bench (publicado_por=tercero).',
];

export const ADAPTADOR_SWEBENCH = 'escrubery-benchmarks-swebench';

/** Designación verbatim del sujeto compuesto SWE-bench. */
export function designacionSwebench(f: {
  agent: string;
  model_display: string;
}): string {
  return `${f.agent} · ${f.model_display}`;
}

export function normalizarFilaSwebench(
  row: Record<string, unknown>,
): FilaSwebench {
  const num = (v: unknown): number | null =>
    typeof v === 'number' ? v : null;
  const str = (v: unknown): string | null =>
    typeof v === 'string' ? v : null;
  return {
    agent: str(row.agent) ?? '',
    agent_org: str(row.agent_org),
    model_display: str(row.model_display) ?? '',
    model_org: str(row.model_org),
    resolved: num(row.resolved),
    checked: typeof row.checked === 'boolean' ? row.checked : null,
    date: str(row.date),
    folder: str(row.folder),
    reasoning_effort: str(row.reasoning_effort),
    cost: num(row.cost),
    instance_cost: num(row.instance_cost),
    instance_calls: num(row.instance_calls),
    os_model: typeof row.os_model === 'boolean' ? row.os_model : null,
    site: str(row.site),
    warning: str(row.warning),
  };
}
