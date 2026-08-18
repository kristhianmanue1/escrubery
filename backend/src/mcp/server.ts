import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
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
import { reportarFeedback, TIPOS_FEEDBACK } from '../feedback/modulo';
import { verificarTodo } from '../evidentia/verificar';
import {
  paramsResolverValidos,
  resolverIdentidadModelo,
} from '../consultas/resolver';
import { TOOLS_CATALOGO } from './tools';

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

// inputSchema por tool (solo MCP; la Agent Card declara nombre+descripcion).
// Los metadatos name/description vienen del catálogo único (src/mcp/tools.ts).
const INPUT_SCHEMAS: Record<string, object> = {
  consultar_modelo: {
    type: 'object',
    properties: {
      proveedor: { type: 'string' },
      modelo_id: { type: 'string' },
    },
    required: ['proveedor', 'modelo_id'],
  },
  consultar_comando_cli: {
    type: 'object',
    properties: { cli: { type: 'string' }, comando: { type: 'string' } },
    required: ['cli'],
  },
  consultar_ficha: {
    type: 'object',
    properties: {
      entidad: { type: 'string', enum: ['cli', 'proveedor'] },
      id: { type: 'string' },
    },
    required: ['entidad', 'id'],
  },
  reportar_feedback: {
    type: 'object',
    properties: {
      tipo: {
        type: 'string',
        enum: ['error', 'mejora', 'dato_desactualizado'],
      },
      descripcion: { type: 'string' },
      consulta_origen: { type: 'object' },
      agente_reportante: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          configuration_fingerprint: { type: 'string' },
        },
        required: ['id'],
      },
    },
    required: ['tipo', 'descripcion', 'agente_reportante'],
  },
  resolver_identidad_modelo: {
    type: 'object',
    properties: {
      issuer_id: { type: 'string' },
      modelo_id: { type: 'string' },
      endpoint: { type: 'string' },
    },
  },
};

const SIN_PARAMS = { type: 'object', properties: {} };

const TOOLS = TOOLS_CATALOGO.map((t) => ({
  name: t.nombre,
  description: t.descripcion,
  inputSchema: INPUT_SCHEMAS[t.nombre] ?? SIN_PARAMS,
}));

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
  try {
    const d = getDb();
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
      case 'reportar_feedback': {
        const ar = a.agente_reportante as
          | {
              id?: unknown;
              configuration_fingerprint?: unknown;
            }
          | undefined;
        if (
          typeof ar?.id !== 'string' ||
          ar.id.length === 0 ||
          !(TIPOS_FEEDBACK as readonly string[]).includes(String(a.tipo)) ||
          typeof a.descripcion !== 'string' ||
          a.descripcion.length === 0
        ) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  error: {
                    codigo: 'parametros_invalidos',
                    mensaje:
                      'tipo (error|mejora|dato_desactualizado), descripcion y agente_reportante.id requeridos',
                  },
                }),
              },
            ],
            isError: true,
          };
        }
        const input = {
          tipo: String(a.tipo),
          descripcion: String(a.descripcion),
          consulta_origen: a.consulta_origen ?? undefined,
          agente_reportante: {
            id: ar.id,
            configuration_fingerprint:
              typeof ar?.configuration_fingerprint === 'string'
                ? ar.configuration_fingerprint
                : undefined,
          },
        };
        return texto(await reportarFeedback(d, input));
      }
      case 'obtener_agent_card': {
        const rutaCard = resolve(
          process.cwd(),
          '..',
          'datos',
          'agent-card',
          'agent-card.json',
        );
        return texto(JSON.parse(readFileSync(rutaCard, 'utf8')));
      }
      case 'resolver_identidad_modelo': {
        const params = {
          issuer_id: a.issuer_id,
          modelo_id: a.modelo_id,
          endpoint: a.endpoint,
        };
        if (!paramsResolverValidos(params)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  error: {
                    codigo: 'parametros_invalidos',
                    mensaje:
                      'issuer_id, o bien modelo_id + endpoint (exactamente una forma)',
                  },
                }),
              },
            ],
            isError: true,
          };
        }
        const r = await resolverIdentidadModelo(d, params);
        return r
          ? texto(r)
          : sinDatos(
              'identidad no resoluble (sin dato curado; nunca se adivina)',
            );
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
