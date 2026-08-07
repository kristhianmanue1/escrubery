import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { resolve } from 'node:path';
import type { Kysely } from 'kysely';
import {
  consultarComandoCli,
  consultarFicha,
  consultarModelo,
  listar,
  oficialidad,
} from '../consultas/modulo';
import type { Database } from '../db/schema';
import { crearKysely } from '../db/kysely';
import { verificarTodo } from '../evidentia/verificar';

let db: Kysely<Database> | null = null;

function getDb(): Kysely<Database> {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL no definida');
    }
    db = crearKysely(url);
  }
  return db;
}

const TOOLS = [
  {
    name: 'consultar_modelo',
    description:
      'Capacidades, precios, ventana de contexto y procedencia de un modelo de IA.',
    inputSchema: {
      type: 'object',
      properties: {
        proveedor: { type: 'string' },
        modelo_id: { type: 'string' },
      },
      required: ['proveedor', 'modelo_id'],
    },
  },
  {
    name: 'consultar_comando_cli',
    description: 'Comandos/flags de un CLI de agente (con filtro opcional).',
    inputSchema: {
      type: 'object',
      properties: { cli: { type: 'string' }, comando: { type: 'string' } },
      required: ['cli'],
    },
  },
  {
    name: 'consultar_ficha',
    description: 'Ficha completa de un CLI o de un proveedor.',
    inputSchema: {
      type: 'object',
      properties: {
        entidad: { type: 'string', enum: ['cli', 'proveedor'] },
        id: { type: 'string' },
      },
      required: ['entidad', 'id'],
    },
  },
  {
    name: 'oficialidad',
    description:
      'Lista los CLIs marcando oficial vs. comunitario (gobernanza).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'listar_entidades',
    description: 'CLIs y proveedores disponibles en el servicio.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'verificar_evidencia',
    description:
      'Verifica la cadena criptográfica Evidentia (read-only, fail-closed) con el keyring público.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function texto(obj: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(obj) }] };
}

function sinDatos(msg: string) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ error: { codigo: 'sin_datos', mensaje: msg } }),
      },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: 'escrubery-mcp', version: '0.2.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: a = {} } = req.params;
  const d = getDb();
  try {
    switch (name) {
      case 'consultar_modelo': {
        const proveedor = String(a.proveedor);
        const modeloId = String(a.modelo_id);
        const r = await consultarModelo(d, proveedor, modeloId);
        return r ? texto(r) : sinDatos(`${proveedor}/${modeloId}`);
      }
      case 'consultar_comando_cli': {
        const cli = String(a.cli);
        const comando = typeof a.comando === 'string' ? a.comando : undefined;
        const r = await consultarComandoCli(d, cli, comando);
        return r ? texto(r) : sinDatos(cli);
      }
      case 'consultar_ficha': {
        const entidad = String(a.entidad);
        const id = String(a.id);
        const r = await consultarFicha(d, entidad, id);
        return r ? texto(r) : sinDatos(`${entidad}/${id}`);
      }
      case 'oficialidad':
        return texto(await oficialidad(d));
      case 'listar_entidades':
        return texto(await listar(d));
      case 'verificar_evidencia': {
        const keyring =
          process.env.EVIDENTIA_KEYRING ??
          resolve(
            process.cwd(),
            '..',
            'datos',
            'keys',
            'evidentia-keyring.json',
          );
        return texto(await verificarTodo(d, keyring));
      }
      default:
        return {
          content: [
            { type: 'text' as const, text: `tool desconocida: ${name}` },
          ],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(
    'error fatal MCP:',
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
