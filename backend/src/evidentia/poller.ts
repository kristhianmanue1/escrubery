import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { clasificar } from './clasificador';
import { registrarEvento } from './event_log';
import { parsearVersion, versionMayor } from './versiones';

interface Release {
  tag_name: string;
  published_at: string | null;
  body: string | null;
  html_url: string;
}

// Gate de fuente primaria (tarjeta gate-fuente-primaria-versiones, 2026-09-03):
// para CLIs cuya fuente de instalación es npm, una versión candidata solo puede
// alcanzar version_actual si EXISTE en el paquete que el sandbox instala de
// verdad. Residual R1 de fix-version-poller-cline manifestado: los tags v4.x de
// cline/cline (extensión/desktop, número MAYOR que el CLI real 3.0.61) atravesaban
// el gate semver y envenenaban version_actual → rebuild con npm-404. Mapeo
// extraído de docker/sandbox/Dockerfile.* (la fuente de instalación real),
// verificado con `npm view` el 2026-09-03. Sin mapeo (grok-build: instalador
// curl) → solo gate semver, comportamiento anterior.
export const PAQUETE_NPM: Record<string, string> = {
  'claude-code': '@anthropic-ai/claude-code',
  cline: 'cline',
  'codex-cli': '@openai/codex',
  opencode: 'opencode-ai',
  'qwen-code': '@qwen-code/qwen-code',
  'kimi-code': '@moonshot-ai/kimi-code',
  'grok-cli-community': 'grok-cli',
};

export type RazonVersion = 'ausente_en_npm' | 'npm_indisponible';

// ¿La versión existe en el paquete npm? 200 = sí; 404 = no; cualquier otra
// respuesta o fallo de red = indecidible → null (fail-closed: no se escribe
// una versión no verificada). Timeout acotado para no colgar el poller.
export async function versionExisteEnNpm(
  paquete: string,
  version: string,
): Promise<boolean | null> {
  try {
    const res = await fetch(
      `https://registry.npmjs.org/${paquete}/${encodeURIComponent(version)}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    return null;
  } catch {
    return null;
  }
}

function obtenerOwnerRepo(
  repoUrl: string,
): { owner: string; repo: string } | null {
  const m = repoUrl.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

async function fetchReleases(
  owner: string,
  repo: string,
  token?: string,
): Promise<Release[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'escrubery-poller/0.1',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`,
    { headers },
  );
  if (res.status === 404) {
    return [];
  }
  if (!res.ok) {
    throw new Error(
      `GitHub ${res.status} para ${owner}/${repo}: ${await res.text()}`,
    );
  }
  return (await res.json()) as Release[];
}

export interface ResultadoPoller {
  cli: string;
  owner_repo: string;
  releases_obtenidas: number;
  eventos_registrados: number;
  muestra: { tag: string; categoria: string } | null;
  // Presente cuando el gate de fuente primaria decidió NO escribir
  // version_actual (la decisión de no escribir debe ser visible, no silenciosa).
  nota_version?: { candidata: string; razon: RazonVersion };
}

export async function pollerCli(
  db: Kysely<Database>,
  cliNombre: string,
  token?: string,
  paquetesNpm: Record<string, string> = PAQUETE_NPM,
): Promise<ResultadoPoller> {
  const cli = await db
    .selectFrom('cli_productos')
    .selectAll()
    .where('nombre', '=', cliNombre)
    .executeTakeFirst();
  if (!cli?.repo_url) {
    throw new Error(`CLI ${cliNombre} sin repo_url`);
  }
  const or = obtenerOwnerRepo(cli.repo_url);
  if (!or) {
    throw new Error(`repo_url no parseable: ${cli.repo_url}`);
  }
  const releases = await fetchReleases(or.owner, or.repo, token);
  let eventos = 0;
  let muestra: { tag: string; categoria: string } | null = null;
  // version_actual recibe la versión MÁXIMA parseable de la ventana de
  // releases, y solo si es semver-Mayor que la conocida: un tag de otro
  // artefacto (incidente cline 2026-08-28: desktop-v0.0.17 con el CLI real
  // en 3.0.56) o una release vieja no deben contaminar el dato ni disparar
  // rebuilds inválidos (§6.2). Fallar cerrado: no parseable → no escribe.
  const candidatas = releases
    .map((r) => r.tag_name?.match(/(\d+\.\d+[\d.]*(?:[-.][\w.]+)?)/)?.[1])
    .filter(
      (v): v is string => typeof v === 'string' && parsearVersion(v) !== null,
    );
  const versionRelease = candidatas.reduce<string | null>(
    (max, v) => (max === null || versionMayor(v, max) ? v : max),
    null,
  );
  let notaVersion: ResultadoPoller['nota_version'];
  if (
    versionRelease &&
    (cli.version_actual === null ||
      versionMayor(versionRelease, cli.version_actual))
  ) {
    // Gate de fuente primaria: el sandbox instala `paquete@VERSION` desde npm;
    // una versión que npm no tiene es un artefacto hermano (cline v4.1.17) o
    // un dato no instalable. Indecidible (npm caído) → no escribe (fail-closed).
    const paquete = paquetesNpm[cliNombre];
    let escribir = true;
    if (paquete) {
      const existe = await versionExisteEnNpm(paquete, versionRelease);
      if (existe === false) {
        escribir = false;
        notaVersion = { candidata: versionRelease, razon: 'ausente_en_npm' };
      } else if (existe === null) {
        escribir = false;
        notaVersion = { candidata: versionRelease, razon: 'npm_indisponible' };
      }
    }
    if (escribir) {
      await db
        .updateTable('cli_productos')
        .set({ version_actual: versionRelease })
        .where('id', '=', cli.id)
        .execute();
    }
  }
  for (const rel of releases) {
    const texto = `${rel.tag_name}: ${rel.body ?? ''}`;
    const c = clasificar(texto);
    if (!muestra) {
      muestra = { tag: rel.tag_name, categoria: c.categoria };
    }
    await registrarEvento(db, {
      record_id: `ev-${cliNombre}-${rel.tag_name}`,
      cli_producto_id: cli.id,
      categoria: c.categoria,
      resumen: `${rel.tag_name}: ${(rel.body ?? '').slice(0, 200)}`,
      fuente_url: rel.html_url,
      fuente_tipo: 'github_release',
      fecha_publicacion: rel.published_at,
      confianza_clasificador: c.confianza,
    });
    eventos += 1;
  }
  return {
    cli: cliNombre,
    owner_repo: `${or.owner}/${or.repo}`,
    releases_obtenidas: releases.length,
    eventos_registrados: eventos,
    muestra,
    ...(notaVersion ? { nota_version: notaVersion } : {}),
  };
}
