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
}

export async function pollerCli(
  db: Kysely<Database>,
  cliNombre: string,
  token?: string,
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
  if (
    versionRelease &&
    (cli.version_actual === null ||
      versionMayor(versionRelease, cli.version_actual))
  ) {
    await db
      .updateTable('cli_productos')
      .set({ version_actual: versionRelease })
      .where('id', '=', cli.id)
      .execute();
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
  };
}
