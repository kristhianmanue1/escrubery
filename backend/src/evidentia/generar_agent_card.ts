import { resolve } from 'node:path';
import {
  escribirAgentCard,
  firmarAgentCard,
  type AgentCard,
} from './agent_card';

// F5 T0 — genera datos/agent-card/agent-card.json firmado con la clave
// Evidentia del Mediador (misma del keyring público).

const TOOLS = [
  {
    nombre: 'consultar_modelo',
    descripcion:
      'Capacidades, precios, ventana de contexto y procedencia de un modelo de IA.',
  },
  {
    nombre: 'consultar_comando_cli',
    descripcion: 'Comandos/flags de un CLI de agente (con filtro opcional).',
  },
  {
    nombre: 'consultar_ficha',
    descripcion: 'Ficha (resumida) de un CLI o de un proveedor.',
  },
  {
    nombre: 'oficialidad',
    descripcion: 'CLIs oficial vs. comunitario (gobernanza).',
  },
  {
    nombre: 'listar_entidades',
    descripcion: 'CLIs y proveedores disponibles.',
  },
  {
    nombre: 'verificar_evidencia',
    descripcion:
      'Verifica la cadena Evidentia (read-only, fail-closed) con el keyring público.',
  },
  {
    nombre: 'obtener_agent_card',
    descripcion: 'Devuelve esta Agent Card firmada (identidad del servicio).',
  },
  {
    nombre: 'reportar_feedback',
    descripcion: 'Reporta error/mejora/dato desactualizado (contrato de uso).',
  },
];

function main(): void {
  const kid = process.argv[2] ?? 'escrubery-evidentia-001';
  const privPath =
    process.argv[3] ??
    resolve(
      process.env.HOME ?? '',
      '.escrubery/keys/escrubery-evidentia-001.pem',
    );
  const ruta = resolve(
    process.cwd(),
    '..',
    'datos',
    'agent-card',
    'agent-card.json',
  );

  const card: AgentCard = {
    schema: 'escrubery/agent-card/0.1',
    nombre: 'escrubery',
    descripcion:
      'Servicio de inteligencia sobre modelos y CLIs de IA con procedencia verificable (traza Evidentia firmada y sellada).',
    version: '0.2.0',
    transportes: {
      http: 'POST /v0/<operacion> — header X-API-Key requerido; límite de tasa por clave',
      mcp: 'stdio local (ver docs/CONSUMO_INTERNO.md para .mcp.json)',
    },
    tools: TOOLS,
    keyring: 'datos/keys/evidentia-keyring.json',
    generado_en: new Date().toISOString(),
  };
  const firmada = firmarAgentCard(card, kid, privPath);
  escribirAgentCard(firmada, ruta);
  console.log(
    `agent-card firmada: ${ruta} (key ${kid}, ${TOOLS.length} tools, sig ${firmada.firma.sig.slice(0, 24)}...)`,
  );
}

try {
  main();
} catch (err) {
  console.error(
    'error fatal:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
}
