import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { validarEventoConversacion, hashSha256 } from './conversation_event';
import type { EventoConversacion, VeredictoTipo } from './conversation_event';

const DIR_CLINE =
  process.env.CLINE_DATA ?? join(process.env.HOME ?? '.', '.cline/data');
const DB_SESIONES = join(DIR_CLINE, 'db/sessions.db');
const DIR_TAREAS = join(DIR_CLINE, 'tasks');

function contarUserPrompts(): { user: number; assistant: number } {
  // Solo se extrae el campo role: nunca se acumula contenido de mensajes.
  let user = 0;
  let assistant = 0;
  for (const id of readdirSync(DIR_TAREAS)) {
    const f = join(DIR_TAREAS, id, 'api_conversation_history.json');
    try {
      const msgs = JSON.parse(readFileSync(f, 'utf-8')) as { role?: string }[];
      for (const m of msgs) {
        if (m.role === 'user') user++;
        else if (m.role === 'assistant') assistant++;
      }
    } catch {
      // tarea ilegible/sin historial: ignorada
    }
  }
  return { user, assistant };
}

function contarUiEventos(): Record<string, number> {
  const c: Record<string, number> = {};
  for (const id of readdirSync(DIR_TAREAS)) {
    const f = join(DIR_TAREAS, id, 'ui_messages.json');
    try {
      const msgs = JSON.parse(readFileSync(f, 'utf-8')) as {
        type?: string;
        say?: string;
        ask?: string;
      }[];
      for (const m of msgs) {
        const sub = m.say ?? m.ask ?? '';
        const clave = `${m.type ?? '?'}.${sub}`;
        c[clave] = (c[clave] ?? 0) + 1;
      }
    } catch {
      // sin ui_messages: ignorada
    }
  }
  return c;
}

export function probeCline(dirSalida: string) {
  const db = new DatabaseSync(DB_SESIONES, { readOnly: true });
  let sesiones = 0;
  let cerradas = 0;
  let fallidasSesion = 0;
  let canceladas = 0;
  let idSesion = 'sin-sesiones';
  try {
    const r = db
      .prepare(
        `SELECT COUNT(*) AS n,
                SUM(CASE WHEN ended_at IS NOT NULL THEN 1 ELSE 0 END) AS cerradas,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS fallidas,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS canceladas
         FROM sessions`,
      )
      .get() as
      | { n: number; cerradas: number; fallidas: number; canceladas: number }
      | undefined;
    sesiones = Number(r?.n ?? 0);
    cerradas = Number(r?.cerradas ?? 0);
    fallidasSesion = Number(r?.fallidas ?? 0);
    canceladas = Number(r?.canceladas ?? 0);
    const una = db.prepare('SELECT session_id FROM sessions LIMIT 1').get() as
      { session_id: string } | undefined;
    if (una) idSesion = una.session_id;
  } finally {
    db.close();
  }

  const { user: prompts } = contarUserPrompts();
  const ui = contarUiEventos();

  const superficie: EventoConversacion['fuente'] = {
    tipo: 'almacen_interno',
    interfaz:
      'db/sessions.db (sqlite) + tasks/*/ui_messages.json y api_conversation_history.json (solo campo role/type)',
    estabilidad: 'interna',
    fuente_url: null,
  };

  const veredictos: Record<EventoConversacion['tipo'], VeredictoTipo> = {
    sesion_iniciada: {
      veredicto: 'ok',
      conteo: sesiones,
      metodo:
        'tabla sessions (sessions.db): una fila por sesión con started_at',
    },
    prompt_enviado: {
      veredicto: 'ok',
      conteo: prompts,
      metodo:
        "api_conversation_history.json: role='user' (solo se proyecta el campo role)",
    },
    turno_finalizado: {
      veredicto: 'parcial',
      conteo: ui['say.completion_result'] ?? 0,
      metodo:
        'ui_messages say.completion_result marca tarea completada (en cline tarea≈turno); las sesiones también llevan status terminal',
    },
    turno_fallido: {
      veredicto: 'parcial',
      conteo: (ui['ask.api_req_failed'] ?? 0) + (ui['say.error'] ?? 0),
      metodo:
        "ask.api_req_failed + say.error a nivel tarea; señal secundaria de sesión: status='failed' " +
        `(${fallidasSesion} sesiones). Sin marcador de turno exacto`,
    },
    turno_interrumpido: {
      veredicto: 'parcial',
      conteo: canceladas,
      metodo: `sessions.status='cancelled' (${canceladas}) es cancelación de SESIÓN; interrupción de turno no distinguible en artefactos`,
    },
    compactacion: {
      veredicto: 'no_disponible',
      conteo: null,
      metodo: 'sin marcador de compactación en ui_messages ni en sessions.db',
    },
    sesion_cerrada: {
      veredicto: 'ok',
      conteo: cerradas,
      metodo:
        'sessions.ended_at IS NOT NULL (con exit_code y status terminal) — cierre formal de sesión',
    },
  };

  const muestras: EventoConversacion[] = [];
  const sesionHash = hashSha256(idSesion);
  for (const [tipo, v] of Object.entries(veredictos)) {
    if (v.veredicto === 'no_disponible') continue;
    muestras.push({
      schema: 'escrubery/conversation-event/v0',
      evento_id: randomUUID(),
      cli: 'cline',
      cli_version: 'por sesión (sessions.db origen; no proyectada aquí)',
      sesion_id_hash: sesionHash,
      turno_id_hash: null,
      secuencia: null,
      tipo: tipo as EventoConversacion['tipo'],
      fuente: superficie,
      fecha_observacion: new Date().toISOString(),
      carga_sha256: hashSha256(`muestra:${tipo}`),
      carga_ref: 'muestra_sintetica',
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
    cli: 'cline',
    cli_version: 'por sesión (origen sessions.db; no proyectada)',
    superficie,
    generado_en: new Date().toISOString(),
    sesiones_totales: sesiones,
    sesiones_cerradas: cerradas,
    sesiones_fallidas: fallidasSesion,
    tareas_con_ui: Object.keys(ui).length > 0,
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
