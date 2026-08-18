import { crearKysely } from './db/kysely';
import {
  consultarComandoCli,
  consultarFicha,
  consultarModelo,
  listar,
  oficialidad,
} from './consultas/modulo';
import {
  paramsResolverValidos,
  resolverIdentidadModelo,
} from './consultas/resolver';
import {
  reportarFeedback,
  feedbackInputValido,
  type FeedbackInput,
} from './feedback/modulo';

function usage(): never {
  console.error(
    JSON.stringify({
      error: {
        codigo: 'parametros_invalidos',
        mensaje:
          'uso:\n  consultar listar\n  consultar modelo <proveedor> <modelo_id>\n  consultar comando <cli_id> [filtro]\n  consultar ficha cli <id> | consultar ficha proveedor <id>\n  consultar oficialidad\n  consultar resolver <issuer_id> | consultar resolver <modelo_id> <endpoint>\n  consultar feedback <params_json>',
      },
    }),
  );
  process.exit(2);
}

function fatal(err: unknown): never {
  console.error(
    JSON.stringify({
      error: {
        codigo: 'fuente_no_disponible',
        mensaje: `error fatal: ${err instanceof Error ? err.message : String(err)}`,
      },
    }),
  );
  process.exit(3);
}

function out(obj: unknown): void {
  console.log(JSON.stringify(obj));
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida (ver backend/.env)');
    process.exit(2);
  }
  const [, , op, ...rest] = process.argv;
  if (!op) usage();
  const db = crearKysely(url);
  try {
    switch (op) {
      case 'listar': {
        out(await listar(db));
        break;
      }
      case 'modelo': {
        const [proveedor, modeloId] = rest;
        if (!proveedor || !modeloId) usage();
        const r = await consultarModelo(db, proveedor, modeloId);
        if (!r) {
          out({
            error: {
              codigo: 'sin_datos',
              mensaje: `${proveedor}/${modeloId} no encontrado`,
            },
          });
          process.exitCode = 1;
        } else {
          out(r);
        }
        break;
      }
      case 'comando': {
        const [cli, filtro] = rest;
        if (!cli) usage();
        const r = await consultarComandoCli(db, cli, filtro);
        if (!r) {
          out({
            error: { codigo: 'sin_datos', mensaje: `${cli} no encontrado` },
          });
          process.exitCode = 1;
        } else {
          out(r);
        }
        break;
      }
      case 'ficha': {
        const [entidad, id] = rest;
        if (!entidad || !id) usage();
        const r = await consultarFicha(db, entidad, id);
        if (!r) {
          out({
            error: {
              codigo: 'sin_datos',
              mensaje: `${entidad}/${id} no encontrado`,
            },
          });
          process.exitCode = 1;
        } else {
          out(r);
        }
        break;
      }
      case 'oficialidad': {
        out(await oficialidad(db));
        break;
      }
      case 'resolver': {
        // dos formas (contrato §3.9): 1 arg = issuer_id; 2 args = modelo+endpoint;
        // cualquier otra cantidad (0 o 3+) es uso inválido (exit 2), sin descartar extras en silencio
        if (rest.length !== 1 && rest.length !== 2) usage();
        const [a, b] = rest;
        const params =
          b === undefined ? { issuer_id: a } : { modelo_id: a, endpoint: b };
        if (!paramsResolverValidos(params)) usage();
        const r = await resolverIdentidadModelo(db, params);
        if (!r) {
          out({
            error: {
              codigo: 'sin_datos',
              mensaje: `identidad no resoluble: ${JSON.stringify(params)} (sin dato curado que la respalde; nunca se adivina)`,
            },
          });
          process.exitCode = 1;
        } else {
          out(r);
        }
        break;
      }
      case 'feedback': {
        const [json] = rest;
        if (!json) usage();
        let input: FeedbackInput;
        try {
          input = JSON.parse(json) as FeedbackInput;
        } catch {
          usage();
        }
        if (!feedbackInputValido(input)) usage();
        out(await reportarFeedback(db, input));
        break;
      }
      default:
        usage();
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err) => fatal(err));
