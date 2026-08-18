import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Kysely } from 'kysely';
import {
  consultarComandoCli,
  consultarFicha,
  consultarModelo,
  listar,
  oficialidad,
} from '../consultas/modulo';
import {
  feedbackInputValido,
  reportarFeedback,
  type FeedbackInput,
} from '../feedback/modulo';
import { crearKysely } from '../db/kysely';
import type { Database } from '../db/schema';
import {
  paramsResolverValidos,
  resolverIdentidadModelo,
} from '../consultas/resolver';
import { AuthRateLimitGuard } from './auth.guard';

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

/** Solo para specs (HF5-T4): destruye el pool cacheado — sin esto Jest
 * queda con un handle abierto de pg y no termina tras la suite. */
export async function cerrarDbV0(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
}

function err(codigo: string, mensaje: string, status: number): never {
  const ctor = status === 404 ? NotFoundException : BadRequestException;
  throw new ctor({ error: { codigo, mensaje } });
}

@Controller('v0')
@UseGuards(AuthRateLimitGuard)
export class V0Controller {
  @HttpCode(200)
  @Post('listar')
  async listar() {
    return listar(getDb());
  }

  @HttpCode(200)
  @Post('consultar_modelo')
  async modelo(@Body() b: { proveedor?: string; modelo_id?: string }) {
    if (!b?.proveedor || !b?.modelo_id) {
      err('parametros_invalidos', 'proveedor y modelo_id requeridos', 400);
    }
    const r = await consultarModelo(getDb(), b.proveedor, b.modelo_id);
    if (!r) {
      err('sin_datos', `${b.proveedor}/${b.modelo_id} no encontrado`, 404);
    }
    return r;
  }

  @HttpCode(200)
  @Post('consultar_comando_cli')
  async comando(@Body() b: { cli?: string; comando?: string }) {
    if (!b?.cli) {
      err('parametros_invalidos', 'cli requerido', 400);
    }
    const r = await consultarComandoCli(getDb(), b.cli, b.comando);
    if (!r) {
      err('sin_datos', `${b.cli} no encontrado`, 404);
    }
    return r;
  }

  @HttpCode(200)
  @Post('consultar_ficha')
  async ficha(@Body() b: { entidad?: string; id?: string }) {
    if (!b?.entidad || !b?.id) {
      err('parametros_invalidos', 'entidad e id requeridos', 400);
    }
    const r = await consultarFicha(getDb(), b.entidad, b.id);
    if (!r) {
      err('sin_datos', `${b.entidad}/${b.id} no encontrado`, 404);
    }
    return r;
  }

  @HttpCode(200)
  @Post('oficialidad')
  async oficialidad() {
    return oficialidad(getDb());
  }

  @HttpCode(200)
  @Post('resolver_identidad_modelo')
  async resolver(
    @Body() b: { issuer_id?: string; modelo_id?: string; endpoint?: string },
  ) {
    if (!paramsResolverValidos(b)) {
      err(
        'parametros_invalidos',
        'issuer_id, o bien modelo_id + endpoint (exactamente una forma)',
        400,
      );
    }
    const r = await resolverIdentidadModelo(getDb(), b);
    if (!r) {
      err(
        'sin_datos',
        'identidad no resoluble (sin dato curado que la respalde; nunca se adivina)',
        404,
      );
    }
    return r;
  }

  @HttpCode(200)
  @Post('reportar_feedback')
  async feedback(@Body() b: FeedbackInput) {
    if (!feedbackInputValido(b)) {
      err(
        'parametros_invalidos',
        'tipo (error|mejora|dato_desactualizado), descripcion y agente_reportante.id requeridos',
        400,
      );
    }
    return reportarFeedback(getDb(), b);
  }
}
