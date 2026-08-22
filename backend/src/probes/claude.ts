import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validarEventoConversacion, hashSha256 } from './conversation_event';
import type { EventoConversacion, VeredictoTipo } from './conversation_event';

const RAIZ_PROYECTOS =
  process.env.CLAUDE_PROJECTS ??
  join(process.env.HOME ?? '.', '.claude/projects');

interface RegistroClaude {
  type?: string;
  sessionId?: string;
  timestamp?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  isApiErrorMessage?: boolean;
  isCompactSummary?: boolean;
  subtype?: string;
  message?: { role?: string; stop_reason?: string } & Record<string, unknown>;
}

function* recorrerSesiones(): Generator<{
  sid: string;
  registro: RegistroClaude;
}> {
  for (const dirProy of readdirSync(RAIZ_PROYECTOS)) {
    const dir = join(RAIZ_PROYECTOS, dirProy);
    let archivos: string[];
    try {
      archivos = readdirSync(dir);
    } catch {
      continue;
    }
    for (const nombre of archivos) {
      if (!nombre.endsWith('.jsonl')) continue;
      const sid = nombre.replace(/\.jsonl$/, '');
      for (const linea of readFileSync(join(dir, nombre), 'utf-8').split(
        '\n',
      )) {
        if (!linea.trim()) continue;
        try {
          yield { sid, registro: JSON.parse(linea) as RegistroClaude };
        } catch {
          // línea corrupta: ignorada (conteo honesto de registros válidos)
        }
      }
    }
  }
}

export function probeClaudeCode(dirSalida: string) {
  const sesiones = new Set<string>();
  const c = {
    promptsReales: 0,
    turnosEnd: 0,
    turnosToolUse: 0,
    apiErrors: 0,
    compactBoundary: 0,
    compactSummary: 0,
    registros: 0,
  };
  let primerSesion = 'sin-sesiones';
  // Solo type/isSidechain/isMeta/stop_reason/subtype: nunca contenido de mensajes
  for (const { sid, registro } of recorrerSesiones()) {
    c.registros++;
    sesiones.add(sid);
    if (primerSesion === 'sin-sesiones') primerSesion = sid;
    const m = registro.message;
    if (
      registro.type === 'user' &&
      m?.role === 'user' &&
      !registro.isMeta &&
      !registro.isSidechain
    ) {
      c.promptsReales++;
    } else if (registro.type === 'assistant' && !registro.isSidechain) {
      if (m?.stop_reason === 'end_turn') c.turnosEnd++;
      else if (m?.stop_reason === 'tool_use') c.turnosToolUse++;
    }
    if (registro.isApiErrorMessage) c.apiErrors++;
    if (registro.subtype === 'compact_boundary') c.compactBoundary++;
    if (registro.isCompactSummary) c.compactSummary++;
  }

  const superficie: EventoConversacion['fuente'] = {
    tipo: 'almacen_interno',
    interfaz:
      '~/.claude/projects/<proyecto>/<sesion>.jsonl (un registro JSON por línea)',
    estabilidad: 'interna',
    fuente_url: null,
  };

  const veredictos: Record<EventoConversacion['tipo'], VeredictoTipo> = {
    sesion_iniciada: {
      veredicto: 'ok',
      conteo: sesiones.size,
      metodo: 'un archivo .jsonl por sesión (nombre = sessionId)',
    },
    prompt_enviado: {
      veredicto: 'ok',
      conteo: c.promptsReales,
      metodo:
        'type=user con role=user, excluyendo isMeta y isSidechain (resultados de herramienta)',
    },
    turno_finalizado: {
      veredicto: 'ok',
      conteo: c.turnosEnd,
      metodo:
        "assistant.stop_reason='end_turn' (fuera de sidechains); los turnos con tool_use continúan",
    },
    turno_fallido: {
      veredicto: 'parcial',
      conteo: c.apiErrors,
      metodo:
        'isApiErrorMessage=true marca fallos de API del asistente; no distingue fallo de turno completo',
    },
    turno_interrumpido: {
      veredicto: 'no_disponible',
      conteo: null,
      metodo:
        'sin stop_reason de interrupción en el historial (los aborts del cliente no dejan marca estable observada)',
    },
    compactacion: {
      veredicto: 'ok',
      conteo: c.compactBoundary,
      metodo:
        "subtype='compact_boundary' (señal secundaria: isCompactSummary en el mensaje resumen)",
    },
    sesion_cerrada: {
      veredicto: 'no_disponible',
      conteo: null,
      metodo: 'sin evento de cierre de sesión en el jsonl',
    },
  };

  const muestras: EventoConversacion[] = [];
  const sesionHash = hashSha256(primerSesion);
  for (const [tipo, v] of Object.entries(veredictos)) {
    if (v.veredicto === 'no_disponible') continue;
    muestras.push({
      schema: 'escrubery/conversation-event/v0',
      evento_id: randomUUID(),
      cli: 'claude-code',
      cli_version: 'por sesión (origen del jsonl; no proyectada aquí)',
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
    cli: 'claude-code',
    cli_version: 'por sesión (no proyectada)',
    superficie,
    generado_en: new Date().toISOString(),
    sesiones_totales: sesiones.size,
    registros_validos: c.registros,
    turnos_con_tool_use: c.turnosToolUse,
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
