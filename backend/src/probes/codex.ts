import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validarEventoConversacion, hashSha256 } from './conversation_event';
import type { EventoConversacion, VeredictoTipo } from './conversation_event';

const RAIZ_SESIONES =
  process.env.CODEX_SESSIONS ??
  join(process.env.HOME ?? '.', '.codex/sessions');

interface RegistroRollout {
  timestamp?: string;
  type?: string;
  payload?: { type?: string; session_id?: unknown } & Record<string, unknown>;
}

function* recorrerJsonl(raiz: string): Generator<RegistroRollout> {
  for (const ano of listar(raiz).filter((x) => /^\d{4}$/.test(basename(x)))) {
    for (const mes of listar(ano)) {
      for (const dia of listar(mes)) {
        for (const ruta of listar(dia)) {
          if (!ruta.endsWith('.jsonl')) continue;
          for (const linea of readFileSync(ruta, 'utf-8').split('\n')) {
            if (!linea.trim()) continue;
            try {
              yield JSON.parse(linea) as RegistroRollout;
            } catch {
              // línea corrupta: ignorada (conteo honesto de registros válidos)
            }
          }
        }
      }
    }
  }
}

function listar(ruta: string): string[] {
  try {
    return readdirSync(ruta).map((x) => join(ruta, x));
  } catch {
    return [];
  }
}

export function probeCodex(dirSalida: string) {
  const sesiones = new Set<string>();
  const conteos = {
    sesionIniciada: 0,
    prompts: 0,
    turnosCompletados: 0,
    turnosAbortados: 0,
    compactaciones: 0,
    registros: 0,
  };
  // Solo type/payload.type/session_id: nunca se acumula contenido.
  for (const r of recorrerJsonl(RAIZ_SESIONES)) {
    conteos.registros++;
    const t = r.type ?? '?';
    const pt = r.payload?.type;
    if (t === 'session_meta') {
      conteos.sesionIniciada++;
      const sid =
        typeof r.payload?.session_id === 'string' ? r.payload.session_id : '';
      if (sid) sesiones.add(sid);
    } else if (t === 'event_msg' && pt === 'user_message') {
      conteos.prompts++;
    } else if (t === 'event_msg' && pt === 'task_complete') {
      conteos.turnosCompletados++;
    } else if (t === 'event_msg' && pt === 'turn_aborted') {
      conteos.turnosAbortados++;
    } else if (
      (t === 'event_msg' && pt === 'context_compacted') ||
      t === 'compacted'
    ) {
      conteos.compactaciones++;
    }
  }

  const superficie: EventoConversacion['fuente'] = {
    tipo: 'almacen_interno',
    interfaz: 'rollout-*.jsonl (~/.codex/sessions; un registro JSON por línea)',
    estabilidad: 'interna',
    fuente_url: null,
  };

  const veredictos: Record<EventoConversacion['tipo'], VeredictoTipo> = {
    sesion_iniciada: {
      veredicto: 'ok',
      conteo: sesiones.size,
      metodo:
        'session_meta deduplicada por session_id (los forks re-emiten meta)',
    },
    prompt_enviado: {
      veredicto: 'ok',
      conteo: conteos.prompts,
      metodo: "event_msg.payload.type = 'user_message'",
    },
    turno_finalizado: {
      veredicto: 'ok',
      conteo: conteos.turnosCompletados,
      metodo:
        "event_msg.payload.type = 'task_complete' (lleva turn_id y duración)",
    },
    turno_fallido: {
      veredicto: 'no_disponible',
      conteo: null,
      metodo:
        'sin marcador de fallo (task_complete no lleva estado de error); no se infiere',
    },
    turno_interrumpido: {
      veredicto: 'ok',
      conteo: conteos.turnosAbortados,
      metodo:
        "event_msg.payload.type = 'turn_aborted' (lleva reason y turn_id)",
    },
    compactacion: {
      veredicto: 'ok',
      conteo: conteos.compactaciones,
      metodo:
        "event_msg.context_compacted + registro 'compacted' (doble señal del mismo evento)",
    },
    sesion_cerrada: {
      veredicto: 'no_disponible',
      conteo: null,
      metodo: 'sin evento de cierre de sesión en el rollout',
    },
  };

  const sesionHash = hashSha256([...sesiones][0] ?? 'sin-sesiones');
  const muestras: EventoConversacion[] = [];
  for (const [tipo, v] of Object.entries(veredictos)) {
    if (v.veredicto === 'no_disponible') continue;
    muestras.push({
      schema: 'escrubery/conversation-event/v0',
      evento_id: randomUUID(),
      cli: 'codex-cli',
      cli_version: 'ver por sesión (session_meta origen; no proyectada aquí)',
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

  const reporte = {
    cli: 'codex-cli',
    cli_version:
      'por sesión (origen: session_meta; no proyectada en reporte global)',
    superficie,
    generado_en: new Date().toISOString(),
    sesiones_totales: sesiones.size,
    registros_validos: conteos.registros,
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
}
