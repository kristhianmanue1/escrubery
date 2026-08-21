import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { validarEventoConversacion, hashSha256 } from './conversation_event';
import type { EventoConversacion, VeredictoTipo } from './conversation_event';

export type { VeredictoTipo };

export interface ReporteProbe {
  cli: string;
  cli_version: string;
  superficie: EventoConversacion['fuente'];
  generado_en: string;
  sesiones_totales: number;
  sesiones_con_prompt: number;
  versiones_observadas: { version: string; sesiones: number }[];
  veredictos: Record<EventoConversacion['tipo'], VeredictoTipo>;
  muestras_validadas: number;
  sin_contenido: boolean;
}

const DB =
  process.env.OPENCODE_DB ??
  join(process.env.HOME ?? '.', '.local/share/opencode/opencode.db');

function contar(db: DatabaseSync, sql: string): number {
  const r = db.prepare(sql).get() as { n: number | bigint } | undefined;
  return Number(r?.n ?? 0);
}

export function probeOpencode(dirSalida: string): ReporteProbe {
  const db = new DatabaseSync(DB, { readOnly: true });
  try {
    const sesionesTotales = contar(db, 'SELECT COUNT(*) AS n FROM session');
    const ultimaVersion = (
      db
        .prepare(
          'SELECT version FROM session ORDER BY time_created DESC LIMIT 1',
        )
        .get() as { version: string } | undefined
    )?.version;
    const versiones = db
      .prepare(
        'SELECT version, COUNT(*) AS n FROM session GROUP BY version ORDER BY n DESC LIMIT 5',
      )
      .all() as { version: string; n: number }[];

    // Solo agregados y metadatos: jamás SELECT de columnas con contenido.
    const sesionIniciada = contar(
      db,
      "SELECT COUNT(*) AS n FROM event WHERE type = 'session.created.1'",
    );
    const promptsReales = contar(
      db,
      `SELECT COUNT(*) AS n FROM message m
       WHERE json_extract(m.data, '$.role') = 'user'
         AND EXISTS (SELECT 1 FROM part p
                     WHERE p.message_id = m.id
                       AND json_extract(p.data, '$.type') = 'text')`,
    );
    const sesionesConPrompt = contar(
      db,
      `SELECT COUNT(DISTINCT m.session_id) AS n FROM message m
       WHERE json_extract(m.data, '$.role') = 'user'
         AND EXISTS (SELECT 1 FROM part p
                     WHERE p.message_id = m.id
                       AND json_extract(p.data, '$.type') = 'text')`,
    );
    const pasosFinalizados = contar(
      db,
      `SELECT COUNT(*) AS n FROM part WHERE json_extract(data, '$.type') = 'step-finish'`,
    );
    const compactaciones = contar(
      db,
      `SELECT COUNT(*) AS n FROM part WHERE json_extract(data, '$.type') = 'compaction'`,
    );

    const superficie: EventoConversacion['fuente'] = {
      tipo: 'almacen_interno',
      interfaz: 'opencode.db (sqlite, lectura readOnly vía node:sqlite)',
      estabilidad: 'interna',
      fuente_url: null,
    };

    const veredictos: Record<EventoConversacion['tipo'], VeredictoTipo> = {
      sesion_iniciada: {
        veredicto: 'ok',
        conteo: sesionIniciada,
        metodo:
          "event.type = 'session.created.1' (registro de eventos interno)",
      },
      prompt_enviado: {
        veredicto: 'ok',
        conteo: promptsReales,
        metodo:
          'message.role = user con ≥1 part tipo text (excluye resultados de herramienta)',
      },
      turno_finalizado: {
        veredicto: 'parcial',
        conteo: pasosFinalizados,
        metodo:
          'part tipo step-finish: cuenta PASOS de asistente; un turno puede tener varios pasos (correlación requerida para turnos exactos)',
      },
      turno_fallido: {
        veredicto: 'no_disponible',
        conteo: null,
        metodo:
          'sin marcador explícito en el almacen; no se infiere de costes/tokens',
      },
      turno_interrumpido: {
        veredicto: 'no_disponible',
        conteo: null,
        metodo:
          "sin marcador estable (step-start sin 'reason' en el historial observado)",
      },
      compactacion: {
        veredicto: 'ok',
        conteo: compactaciones,
        metodo:
          'part tipo compaction (señal secundaria: session.summary_* no nulo)',
      },
      sesion_cerrada: {
        veredicto: 'no_disponible',
        conteo: null,
        metodo:
          'opencode no cierra sesiones formalmente; sin evento de cierre en el almacen',
      },
    };

    // Muestras normalizadas (1 por tipo con dato ok/parcial) validadas contra
    // el contrato: demuestra conformidad de punta a punta sin retener contenido.
    const idSesion = (
      db
        .prepare('SELECT id FROM session ORDER BY time_created DESC LIMIT 1')
        .get() as { id: string } | undefined
    )?.id;
    const sesionHash = idSesion
      ? hashSha256(idSesion)
      : hashSha256('sin-sesiones');
    const muestras: EventoConversacion[] = [];
    for (const [tipo, v] of Object.entries(veredictos)) {
      if (v.veredicto === 'no_disponible') continue;
      muestras.push({
        schema: 'escrubery/conversation-event/v0',
        evento_id: randomUUID(),
        cli: 'opencode',
        cli_version: ultimaVersion ?? 'desconocida',
        sesion_id_hash: sesionHash,
        turno_id_hash: null,
        secuencia: null,
        tipo: tipo as EventoConversacion['tipo'],
        fuente: superficie,
        fecha_observacion: new Date().toISOString(),
        carga_sha256: hashSha256(`muestra:${tipo}`),
        carga_ref: null,
        sensibilidad: {
          contiene_conversacion: false,
          contiene_io_herramientas: false,
          estado_redaccion: 'no_requerida',
        },
      });
    }
    const muestrasValidadas = muestras.filter(
      (m) => validarEventoConversacion(m).valido,
    ).length;

    const reporte: ReporteProbe = {
      cli: 'opencode',
      cli_version: ultimaVersion ?? 'desconocida',
      superficie,
      generado_en: new Date().toISOString(),
      sesiones_totales: sesionesTotales,
      sesiones_con_prompt: sesionesConPrompt,
      versiones_observadas: versiones.map((v) => ({
        version: v.version,
        sesiones: Number(v.n),
      })),
      veredictos,
      muestras_validadas: muestrasValidadas,
      sin_contenido: true,
    };

    mkdirSync(dirSalida, { recursive: true });
    writeFileSync(
      join(dirSalida, 'reporte.json'),
      JSON.stringify({ ...reporte, muestras }, null, 2) + '\n',
    );
    return reporte;
  } finally {
    db.close();
  }
}
