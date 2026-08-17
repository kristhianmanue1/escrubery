import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crearKysely } from '../db/kysely';
import { registrarEvento } from '../evidentia/event_log';

interface CmdHelp {
  cmd: string;
  desc: string;
}

const BINARIO: Record<string, string> = {
  opencode: 'opencode',
  'claude-code': 'claude',
  'codex-cli': 'codex',
  'qwen-code': 'qwen',
};

const RE_OPEN = /^ {2,}opencode\s+(\S+)\s{2,}(.+)$/;
// qwen-code (hereda de gemini-cli): "  qwen mcp     Manage MCP servers"
// — comando multi-palabra "qwen <sub>"; el default es "qwen [query..]".
// "qwen extensions <command>": el sub-comando lleva placeholder <...>.
const RE_QWEN = /^ {2,}qwen\s+(\S+)(?:\s+<[^>]+>)*(\s+\[[^\]]+\])*\s{2,}(.+)$/;
const RE_GEN = /^ {2,}(\S+)(?:\s+\[[^\]]+\])*\s{2,}(.+)$/;

function extraerComandos(cli: string, help: string): CmdHelp[] {
  const out: CmdHelp[] = [];
  const vistos = new Set<string>();
  const enSeccion = cli !== 'opencode';
  let dentro = !enSeccion;
  for (const linea of help.split('\n')) {
    if (enSeccion) {
      if (/^Commands:\s*$/.test(linea)) {
        dentro = true;
        continue;
      }
      if (dentro && linea.trim() === '') {
        break;
      }
      if (!dentro) {
        continue;
      }
    }
    let m: RegExpMatchArray | null = null;
    if (cli === 'opencode') {
      m = linea.match(RE_OPEN);
      if (m && m[1] !== '[project]') {
        const cmd = m[1].split('|')[0];
        if (!vistos.has(cmd)) {
          vistos.add(cmd);
          out.push({ cmd, desc: m[2].trim() });
        }
      }
    } else if (cli === 'qwen-code') {
      m = linea.match(RE_QWEN);
      if (m && m[1] !== '[query..]') {
        const cmd = m[1].split('|')[0];
        if (!vistos.has(cmd)) {
          vistos.add(cmd);
          out.push({ cmd, desc: m[3].trim() });
        }
      }
    } else {
      m = linea.match(RE_GEN);
      if (m) {
        const cmd = m[1].split('|')[0];
        if (!vistos.has(cmd)) {
          vistos.add(cmd);
          out.push({ cmd, desc: m[2].trim() });
        }
      }
    }
  }
  return out;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida');
    process.exit(2);
  }
  const cli = process.argv[2] ?? 'opencode';
  const imagen = process.argv[3] ?? `escrubery-sandbox-${cli}`;
  const binario = process.argv[4] ?? BINARIO[cli] ?? cli;
  const db = crearKysely(url);
  try {
    // --version primero: alimenta cli_productos.version_actual (T3c)
    const rv = spawnSync(
      'docker',
      ['run', '--rm', '--init', imagen, '--version'],
      {
        encoding: 'utf8',
        timeout: 60000,
      },
    );
    const versionRaw = `${rv.stdout ?? ''}${rv.stderr ?? ''}`.trim();
    const version =
      versionRaw.match(/(\d+\.\d+[\d.]*(?:[-.][\w.]+)?)/)?.[1] ?? null;

    const r = spawnSync('docker', ['run', '--rm', '--init', imagen, '--help'], {
      encoding: 'utf8',
      timeout: 60000,
    });
    const help = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    const hash = createHash('sha256').update(help).digest('hex');
    const fecha = new Date();
    const dir = join(process.cwd(), '..', 'datos', 'fuentes', 'sandbox', cli);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${fecha.toISOString()}.txt`), help);

    const cmdsHelp = extraerComandos(cli, help);
    const cliRow = await db
      .selectFrom('cli_productos')
      .select('id')
      .where('nombre', '=', cli)
      .executeTakeFirstOrThrow();
    // version_actual desde el sandbox (T3c) — dato de fuente primaria
    if (version) {
      await db
        .updateTable('cli_productos')
        .set({
          version_actual: version,
          fecha_ultima_version: fecha,
        })
        .where('id', '=', cliRow.id)
        .execute();
    }
    // Dedup contra TODAS las filas (cualquier fuente): un comando ya conocido
    // por ficha (docs_oficial) NO es "nuevo" del sandbox, y su fila NO se
    // toca (el onConflict no debe pisar fecha/hash de otra fuente).
    const filasBD = await db
      .selectFrom('cli_comandos')
      .select(['comando', 'fuente_tipo'])
      .where('cli_producto_id', '=', cliRow.id)
      .execute();
    const setTodos = new Set(
      filasBD.map((c) => {
        const parts = c.comando.split(/\s+/);
        return parts.length > 1 ? parts[1] : c.comando;
      }),
    );
    // T3a: eliminados = ingeridos por introspección previa que YA NO están
    // en el --help (solo fuente ejecucion_local_supervisada: los de ficha
    // curada no se marcan porque el help no es su fuente).
    const setBD = new Set(
      filasBD
        .filter((c) => c.fuente_tipo === 'ejecucion_local_supervisada')
        .map((c) => {
          const parts = c.comando.split(/\s+/);
          return parts.length > 1 ? parts[1] : c.comando;
        }),
    );
    const setHelp = new Set(cmdsHelp.map((c) => c.cmd));
    const nuevos = cmdsHelp.filter((c) => !setTodos.has(c.cmd));
    const eliminados = [...setBD].filter((c) => !setHelp.has(c));

    for (const c of nuevos) {
      await db
        .insertInto('cli_comandos')
        .values({
          cli_producto_id: cliRow.id,
          comando: `${binario} ${c.cmd}`,
          flags_json: null,
          descripcion: c.desc || null,
          version_detectada_desde: null,
          fuente_url: `ejecucion_local_supervisada:${cli}/--help`,
          fuente_tipo: 'ejecucion_local_supervisada',
          fecha_obtencion: fecha.toISOString(),
          hash_sha256_contenido_original: hash,
          estado_verificacion: 'inferido_de_comportamiento',
          vigente_hasta: new Date(
            fecha.getTime() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        })
        .onConflict((oc) =>
          oc.columns(['cli_producto_id', 'comando']).doUpdateSet({
            descripcion: c.desc || null,
            fecha_obtencion: fecha.toISOString(),
            hash_sha256_contenido_original: hash,
            vigente_hasta: new Date(
              fecha.getTime() + 7 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }),
        )
        .execute();
    }

    let eventoId: string | null = null;
    if (nuevos.length > 0) {
      const ev = await registrarEvento(db, {
        record_id: `ev-f3-${cli}-${Date.now()}`,
        cli_producto_id: cliRow.id,
        categoria: 'funcion_nueva',
        resumen: `F3 introspeccion --help: ${nuevos.length} comando(s) anadidos al inventario: ${nuevos.map((c) => c.cmd).join(', ')}`,
        fuente_url: `ejecucion_local_supervisada:${cli}/--help`,
        fuente_tipo: 'ejecucion_local_supervisada',
        fecha_publicacion: fecha.toISOString(),
        confianza_clasificador: 0.9,
      });
      eventoId = ev.record.record_id;
    }

    // T3a: comando ausente del --help → deprecacion (evento) + vigencia
    // vencida ya (no se borra: el historial permanece; deja de servirse
    // como vigente y consulta lo degrada por caducidad).
    let eventoEliminados: string | null = null;
    if (eliminados.length > 0) {
      const ev = await registrarEvento(db, {
        record_id: `ev-f3-${cli}-removed-${Date.now()}`,
        cli_producto_id: cliRow.id,
        categoria: 'deprecacion',
        resumen: `F3 introspeccion --help: ${eliminados.length} comando(s) ausentes en la version actual: ${eliminados.join(', ')}`,
        fuente_url: `ejecucion_local_supervisada:${cli}/--help`,
        fuente_tipo: 'ejecucion_local_supervisada',
        fecha_publicacion: fecha.toISOString(),
        confianza_clasificador: 0.9,
      });
      eventoEliminados = ev.record.record_id;
      await db
        .updateTable('cli_comandos')
        .set({
          vigente_hasta: fecha.toISOString(),
          estado_verificacion: 'pendiente_de_verificar',
        })
        .where('cli_producto_id', '=', cliRow.id)
        .where('fuente_tipo', '=', 'ejecucion_local_supervisada')
        .where((eb) =>
          eb.or(eliminados.map((e) => eb('comando', '=', `${binario} ${e}`))),
        )
        .execute();
    }

    console.log(
      JSON.stringify(
        {
          cli,
          binario,
          version_sandbox: version,
          comandos_en_help: cmdsHelp.length,
          en_inventario_antes: filasBD.length,
          nuevos_insertados: nuevos.length,
          nuevos: nuevos.map((c) => c.cmd),
          eliminados_detectados: eliminados.length,
          eliminados,
          evento_evidentia: eventoId,
          evento_eliminados: eventoEliminados,
          hash_help: hash.slice(0, 12),
        },
        null,
        2,
      ),
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
  process.exit(1);
});
