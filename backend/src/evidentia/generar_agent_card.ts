import { resolve } from 'node:path';
import {
  escribirAgentCard,
  firmarAgentCard,
  type AgentCard,
} from './agent_card';
import { TOOLS_CATALOGO } from '../mcp/tools';

// F5 T0 — genera datos/agent-card/agent-card.json firmado con la clave
// Evidentia del Mediador (misma del keyring público).
// HF5-T2: las tools vienen del catálogo único (src/mcp/tools.ts); el spec
// src/mcp/tools.spec.ts verifica que la card firmada no derive de él.

const TOOLS = TOOLS_CATALOGO;

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
