import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';
import { canonicalize } from '../evidentia/jcs';
import { registrarConsulta } from './log';

// T4b (H5) — resolver_identidad_modelo: registro externo, NO autodeclarado
// (contrato §5, ADR-0002, necesidad de expertoGobernanza). Resuelve un
// identificador declarado por un agente/harness a la identidad canónica:
//   (a) issuer_id → alias curado → (proveedor, modelo_id)
//   (b) {modelo_id, endpoint} → endpoint curado → proveedor → fila del catálogo
// Nunca adivina: sin dato curado que lo respalde devuelve null (las superficies
// lo sirven como sin_datos). `familia_arquitectura` es la base de decorrelación
// real de un quórum multi-proveedor (dos CLIs sobre el mismo modelo no
// decorrelacionan; dos modelos de la misma familia, tampoco del todo).

export interface ResolverParams {
  issuer_id?: unknown;
  modelo_id?: unknown;
  endpoint?: unknown;
}

export interface RespuestaResolver {
  resuelto: boolean;
  identidad_canonica: {
    proveedor: string;
    modelo_id: string;
    familia_arquitectura: string | null;
    pesos_abiertos: boolean | null;
  };
  advertencias: string[];
  configuration_fingerprint_sugerido: string;
  procedencia: {
    fuente_url: string | null;
    fuente_tipo: string | null;
    fecha_obtencion: string | null;
    hash_sha256_contenido_original: string | null;
    estado_verificacion: string | null;
    firma_ed25519: null;
  };
}

interface FilaProcedente {
  fuente_url: string | null;
  fuente_tipo: string | null;
  fecha_obtencion: Date | null;
  hash_sha256_contenido_original: string | null;
  estado_verificacion: string | null;
}

/** Exactamente UNA de las dos formas del contrato (sin mezclar, sin vacías). */
export function paramsResolverValidos(p: ResolverParams | null): boolean {
  if (!p || typeof p !== 'object') return false;
  const porAlias =
    typeof p.issuer_id === 'string' && p.issuer_id.trim().length > 0;
  const porEndpoint =
    typeof p.modelo_id === 'string' &&
    p.modelo_id.trim().length > 0 &&
    typeof p.endpoint === 'string' &&
    p.endpoint.trim().length > 0;
  return (porAlias || porEndpoint) && !(porAlias && porEndpoint);
}

function fingerprint(proveedor: string, modeloId: string): string {
  const canon = canonicalize({ proveedor, modelo_id: modeloId });
  return `sha256:${createHash('sha256').update(canon, 'utf8').digest('hex')}`;
}

function proc(f: FilaProcedente): RespuestaResolver['procedencia'] {
  return {
    fuente_url: f.fuente_url,
    fuente_tipo: f.fuente_tipo,
    fecha_obtencion: f.fecha_obtencion ? f.fecha_obtencion.toISOString() : null,
    hash_sha256_contenido_original: f.hash_sha256_contenido_original,
    estado_verificacion: f.estado_verificacion,
    firma_ed25519: null,
  };
}

function construir(
  proveedor: string,
  modeloId: string,
  filaModelo:
    | {
        familia_arquitectura: string | null;
        pesos_abiertos: boolean | null;
        curaduria_json: unknown;
      }
    | undefined,
  advertencias: string[],
  procedencia: RespuestaResolver['procedencia'],
): RespuestaResolver {
  const avisos = [...advertencias];
  if (!filaModelo) {
    avisos.push(
      'el modelo resuelto no está en el catálogo del servicio: familia_arquitectura y pesos_abiertos quedan null (nunca se infieren)',
    );
  } else if (filaModelo.curaduria_json) {
    avisos.push(
      'familia_arquitectura/pesos_abiertos provienen de curaduría propia (procedencia en curaduria_json de la fila)',
    );
  }
  return {
    resuelto: true,
    identidad_canonica: {
      proveedor,
      modelo_id: modeloId,
      familia_arquitectura: filaModelo?.familia_arquitectura ?? null,
      pesos_abiertos: filaModelo?.pesos_abiertos ?? null,
    },
    advertencias: avisos,
    configuration_fingerprint_sugerido: fingerprint(proveedor, modeloId),
    procedencia,
  };
}

export async function resolverIdentidadModelo(
  db: Kysely<Database>,
  params: ResolverParams,
): Promise<RespuestaResolver | null> {
  const t0 = Date.now();
  const consulta = { operacion: 'resolver_identidad_modelo', params };

  if (typeof params.issuer_id === 'string' && params.issuer_id.trim()) {
    const alias = await db
      .selectFrom('identidad_alias')
      .selectAll()
      .where('issuer_id', '=', params.issuer_id)
      .executeTakeFirst();
    if (!alias) {
      await registrarConsulta(db, consulta, 'sin_datos', Date.now() - t0);
      return null;
    }
    const fila = await db
      .selectFrom('modelos')
      .select([
        'familia_arquitectura',
        'pesos_abiertos',
        'curaduria_json',
        'proveedor',
        'modelo_id',
      ])
      .where('proveedor', '=', alias.proveedor)
      .where('modelo_id', '=', alias.modelo_id)
      .executeTakeFirst();
    const advertencias = alias.notas ? [alias.notas] : [];
    const r = construir(
      alias.proveedor,
      alias.modelo_id,
      fila,
      advertencias,
      proc(alias),
    );
    await registrarConsulta(db, consulta, 'bd', Date.now() - t0);
    return r;
  }

  const modeloId = String(params.modelo_id);
  const endpoint = String(params.endpoint);
  const ep = await db
    .selectFrom('identidad_endpoints')
    .selectAll()
    .where('endpoint', '=', endpoint)
    .executeTakeFirst();
  if (!ep) {
    await registrarConsulta(db, consulta, 'sin_datos', Date.now() - t0);
    return null;
  }
  const fila = await db
    .selectFrom('modelos')
    .select([
      'familia_arquitectura',
      'pesos_abiertos',
      'curaduria_json',
      'proveedor',
      'modelo_id',
    ])
    .where('proveedor', '=', ep.proveedor)
    .where('modelo_id', '=', modeloId)
    .executeTakeFirst();
  if (!fila) {
    // fail-closed: el endpoint resuelve al proveedor, pero el modelo no se
    // puede confirmar en el catálogo → identidad incompleta = sin datos.
    await registrarConsulta(db, consulta, 'sin_datos', Date.now() - t0);
    return null;
  }
  const advertencias = ep.notas ? [ep.notas] : [];
  const r = construir(ep.proveedor, modeloId, fila, advertencias, proc(ep));
  await registrarConsulta(db, consulta, 'bd', Date.now() - t0);
  return r;
}
