// HF5-T2 (hardening H4) — fuente ÚNICA del catálogo de tools MCP/Agent Card.
// Antes: las descripciones vivían triplicadas (server.ts, generar_agent_card.ts,
// docs) y ya habían derivado (5 de 8 distintas). La descripción canónica es la
// de la Agent Card FIRMADA (datos/agent-card/agent-card.json): cambiarla exige
// regenerar y re-firmar la card. El spec src/mcp/tools.spec.ts bloquea el drift
// card↔catálogo; server y generador consumen de aquí por construcción.

export interface ToolDef {
  nombre: string;
  descripcion: string;
}

export const TOOLS_CATALOGO: ToolDef[] = [
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
  {
    nombre: 'resolver_identidad_modelo',
    descripcion:
      'Resuelve un identificador declarado por agente/harness a la identidad canónica verificada (registro externo, nunca adivina).',
  },
];
