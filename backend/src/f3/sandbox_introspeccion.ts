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
const RE_CMD = /^ {2,}opencode\s+(\S+)\s{2,}(.+)$/;

function extraerComandosOpencode(help: string): CmdHelp[] {
  const out: CmdHelp[] = [];
  const vistos = new Set<string>();
  for (const linea of help.split('\n')) {
    const m = linea.match(RE_CMD);
    if (m && m[1] !== '[project]' && !vistos.has(m[1])) {
      vistos.add(m[1]);
      out.push({ cmd: m[1], desc: m[2].trim() });
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
  const imagen = process.argv[3] ?? 'escrubery-sandbox-opencode';
  const db = crearKysely(url);
  try {
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

    const cmdsHelp = extraerComandosOpencode(help);
    const cliRow = await db
      .selectFrom('cli_productos')
      .select('id')
      .where('nombre', '=', cli)
      .executeTakeFirstOrThrow();
    const cmdsBD = (
      await db
        .selectFrom('cli_comandos')
        .select('comando')
        .where('cli_producto_id', '=', cliRow.id)
        .execute()
    ).map((c) => c.comando.split(/\s+/)[1] ?? c.comando);
    const setBD = new Set(cmdsBD);
    const nuevos = cmdsHelp.filter((c) => !setBD.has(c.cmd));

    for (const c of nuevos) {
      await db
        .insertInto('cli_comandos')
        .values({
          cli_producto_id: cliRow.id,
          comando: `opencode ${c.cmd}`,
          flags_json: null,
          descripcion: c.desc || null,
          version_detectada_desde: null,
          fuente_url: `ejecucion_local_supervisada:${cli}/--help`,
          fuente_tipo: 'ejecucion_local_supervisada',
          fecha_obtencion: fecha.toISOString(),
          hash_sha256_contenido_original: hash,
          estado_verificacion: 'inferido_de_comportamiento',
        })
        .onConflict((oc) =>
          oc.columns(['cli_producto_id', 'comando']).doUpdateSet({
            descripcion: c.desc || null,
            fecha_obtencion: fecha.toISOString(),
            hash_sha256_contenido_original: hash,
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

    console.log(
      JSON.stringify(
        {
          cli,
          comandos_en_help: cmdsHelp.length,
          en_inventario_antes: cmdsBD.length,
          nuevos_insertados: nuevos.length,
          nuevos: nuevos.map((c) => c.cmd),
          evento_evidentia: eventoId,
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
  console.error('error fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
