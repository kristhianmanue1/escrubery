import { randomUUID } from 'node:crypto';
import {
  validarEventoConversacion,
  hashSha256,
  type EventoConversacion,
} from './conversation_event';

// Muestra sintética base: válida por construcción; cada caso muta un campo.
// Nunca contiene contenido de conversación (solo hashes y metadatos).
function muestraBase(tipo: EventoConversacion['tipo']): EventoConversacion {
  return {
    schema: 'escrubery/conversation-event/v0',
    evento_id: randomUUID(),
    cli: 'opencode',
    cli_version: '1.18.21',
    sesion_id_hash: hashSha256('sesion-sintetica-001'),
    turno_id_hash: null,
    secuencia: 0,
    tipo,
    fuente: {
      tipo: 'almacen_interno',
      interfaz: 'opencode.db (sqlite)',
      estabilidad: 'interna',
      fuente_url: null,
    },
    fecha_observacion: '2026-08-21T18:30:00.000Z',
    carga_sha256: hashSha256('{"tipo":"nativo","payload":"sintetico"}'),
    carga_ref: null,
    sensibilidad: {
      contiene_conversacion: false,
      contiene_io_herramientas: false,
      estado_redaccion: 'no_requerida',
    },
  };
}

const TIPOS: EventoConversacion['tipo'][] = [
  'sesion_iniciada',
  'prompt_enviado',
  'turno_finalizado',
  'turno_fallido',
  'turno_interrumpido',
  'compactacion',
  'sesion_cerrada',
];

describe('contrato conversation-event/v0', () => {
  describe('muestras válidas (una por tipo)', () => {
    it.each(TIPOS)('evento %s valida', (tipo) => {
      const r = validarEventoConversacion(muestraBase(tipo));
      expect(r.valido).toBe(true);
      expect(r.errores).toBeNull();
    });

    it('valida con todos los opcionales presentes y con hash de turno', () => {
      const e = muestraBase('turno_finalizado');
      e.turno_id_hash = hashSha256('turno-42');
      e.secuencia = 7;
      e.carga_ref = 'var/probes/opencode/2026-08-21/sesion-abc.jsonl';
      e.fuente.fuente_url = 'https://dev.opencode.ai/docs/server/';
      expect(validarEventoConversacion(e).valido).toBe(true);
    });

    it('valida los 4 CLIs del enum', () => {
      for (const cli of [
        'opencode',
        'codex-cli',
        'cline',
        'kimi-code',
      ] as const) {
        const e = muestraBase('prompt_enviado');
        e.cli = cli;
        expect(validarEventoConversacion(e).valido).toBe(true);
      }
    });
  });

  describe('casos inválidos', () => {
    it('propiedad extra → inválido (additionalProperties: false)', () => {
      const e = muestraBase('sesion_iniciada') as unknown as Record<
        string,
        unknown
      >;
      e.contenido_del_prompt = 'hola'; // jamás permitido por contrato
      const r = validarEventoConversacion(e);
      expect(r.valido).toBe(false);
      expect(r.errores?.some((x) => x.keyword === 'additionalProperties')).toBe(
        true,
      );
    });

    it('tipo fuera del enum → inválido', () => {
      const e = muestraBase('sesion_iniciada') as unknown as Record<
        string,
        unknown
      >;
      e.tipo = 'session.started'; // notación del borrador del issue: rechazada en v0
      const r = validarEventoConversacion(e);
      expect(r.valido).toBe(false);
      expect(
        r.errores?.some(
          (x) => x.keyword === 'enum' && (x.instancePath ?? '') === '/tipo',
        ),
      ).toBe(true);
    });

    it('falta un campo required (carga_sha256) → inválido', () => {
      const e = muestraBase('prompt_enviado') as unknown as Record<
        string,
        unknown
      >;
      delete e.carga_sha256;
      const r = validarEventoConversacion(e);
      expect(r.valido).toBe(false);
      expect(r.errores?.some((x) => x.keyword === 'required')).toBe(true);
    });

    it('evento_id que no es UUID → inválido', () => {
      const e = muestraBase('sesion_cerrada');
      e.evento_id = 'ev-no-soy-uuid';
      const r = validarEventoConversacion(e);
      expect(r.valido).toBe(false);
      expect(r.errores?.some((x) => x.keyword === 'format')).toBe(true);
    });

    it('sesion_id_hash sin formato sha256 → inválido', () => {
      const e = muestraBase('compactacion');
      e.sesion_id_hash = 'sesion-en-claro-123'; // prohibido: puede filtrar rutas/usuarios
      const r = validarEventoConversacion(e);
      expect(r.valido).toBe(false);
      expect(r.errores?.some((x) => x.keyword === 'pattern')).toBe(true);
    });

    it('cli_version vacío → inválido (minLength 1)', () => {
      const e = muestraBase('turno_fallido');
      e.cli_version = '';
      const r = validarEventoConversacion(e);
      expect(r.valido).toBe(false);
    });

    it('fecha_observacion sin formato date-time → inválido', () => {
      const e = muestraBase('turno_interrumpido');
      e.fecha_observacion = 'ayer';
      expect(validarEventoConversacion(e).valido).toBe(false);
    });

    it('fuente con estabilidad fuera de enum → inválido', () => {
      const e = muestraBase('sesion_iniciada');
      e.fuente.estabilidad = 'rocosa' as never;
      expect(validarEventoConversacion(e).valido).toBe(false);
    });
  });

  it('hashSha256 produce el prefijo y 64 hex', () => {
    const h = hashSha256('x');
    expect(h).toMatch(/^sha256:[0-9a-f]{64}$/);
    // vector conocido: sha256("x") = 2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881
    expect(h).toBe(
      'sha256:2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881',
    );
  });
});
