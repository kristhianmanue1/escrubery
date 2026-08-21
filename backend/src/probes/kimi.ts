import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validarEventoConversacion, hashSha256 } from './conversation_event';
import type { EventoConversacion, VeredictoTipo } from './conversation_event';

const RAIZ_KIMI =
  process.env.KIMI_SESSIONS ?? join(process.env.HOME ?? '.', '.kimi/sessions');

interface RegistroWire {
  message?: { type?: string } & Record<string, unknown>;
}

export function probeKimi(dirSalida: string) {
  const sesiones = new Set<string>();
  const c = {
    turnBegin: 0,
    turnEnd: 0,
    stepInterrupted: 0,
    compactionBegin: 0,
    compactionEnd: 0,
  };
  let primerSesion = 'sin-sesiones';
  // Solo message.type y el hash de directorio de sesión: nunca payload
  // (TurnBegin.payload.user_input contiene el prompt completo en claro).
  for (const sid of readdirSync(RAIZ_KIMI)) {
    const dirSesion = join(RAIZ_KIMI, sid);
    let agentes: string[];
    try {
      agentes = readdirSync(dirSesion);
    } catch {
      continue;
    }
    let conWire = false;
    for (const agente of agentes) {
      const f = join(dirSesion, agente, 'wire.jsonl');
      try {
        for (const linea of readFileSync(f, 'utf-8').split('\n')) {
          if (!linea.trim()) continue;
          let j: RegistroWire;
          try {
            j = JSON.parse(linea) as RegistroWire;
          } catch {
            continue;
          }
          const t = j.message?.type;
          if (t === 'TurnBegin') c.turnBegin++;
          else if (t === 'TurnEnd') c.turnEnd++;
          else if (t === 'StepInterrupted') c.stepInterrupted++;
          else if (t === 'CompactionBegin') c.compactionBegin++;
          else if (t === 'CompactionEnd') c.compactionEnd++;
          if (t) conWire = true;
        }
      } catch {
        // wire ilegible: ignorado
      }
    }
    if (conWire) {
      sesiones.add(sid);
      if (primerSesion === 'sin-sesiones') primerSesion = sid;
    }
  }

  const superficie: EventoConversacion['fuente'] = {
    tipo: 'almacen_interno',
    interfaz:
      '~/.kimi/sessions/<sid>/<agente>/wire.jsonl (línea por mensaje del protocolo Wire)',
    estabilidad: 'interna',
    fuente_url: null,
  };

  const veredictos: Record<EventoConversacion['tipo'], VeredictoTipo> = {
    sesion_iniciada: {
      veredicto: 'ok',
      conteo: sesiones.size,
      metodo:
        'directorio de sesión con ≥1 wire.jsonl con mensajes (32 directorios, 30 con mensajes)',
    },
    prompt_enviado: {
      veredicto: 'ok',
      conteo: c.turnBegin,
      metodo:
        "message.type='TurnBegin' (payload NO proyectado: contiene el prompt en claro)",
    },
    turno_finalizado: {
      veredicto: 'ok',
      conteo: c.turnEnd,
      metodo:
        "message.type='TurnEnd' (sin payload de estado; el par Begin/End delimita el turno)",
    },
    turno_fallido: {
      veredicto: 'no_disponible',
      conteo: null,
      metodo:
        'TurnEnd no diferencia éxito de fallo; Notification no es marker estable; no se infiere',
    },
    turno_interrumpido: {
      veredicto: 'ok',
      conteo: c.stepInterrupted,
      metodo:
        "message.type='StepInterrupted' (interrupción de paso; aproximación más cercana a turno)",
    },
    compactacion: {
      veredicto: 'ok',
      conteo: c.compactionBegin,
      metodo:
        "message.type='CompactionBegin' (61) contrastado con CompactionEnd (56); se cuenta Begin",
    },
    sesion_cerrada: {
      veredicto: 'no_disponible',
      conteo: null,
      metodo:
        'state.json.archived existe pero es estado persistente, no evento con timestamp; sin cierre observable',
    },
  };

  const muestras: EventoConversacion[] = [];
  const sesionHash = hashSha256(primerSesion);
  for (const [tipo, v] of Object.entries(veredictos)) {
    if (v.veredicto === 'no_disponible') continue;
    muestras.push({
      schema: 'escrubery/conversation-event/v0',
      evento_id: randomUUID(),
      cli: 'kimi-code',
      cli_version:
        'observada en metadata del wire (protocol_version 1.7); CLI 1.47.0',
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
    cli: 'kimi-code',
    cli_version: 'CLI 1.47.0 (latest_version.txt); protocol Wire 1.7',
    superficie,
    generado_en: new Date().toISOString(),
    sesiones_totales: sesiones.size,
    compaction_end_contraste: c.compactionEnd,
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
