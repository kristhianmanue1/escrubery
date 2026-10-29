import { sql, type Kysely } from 'kysely';
import {
  cerrarDbTest,
  getDbTest,
  SKIP_DB,
} from '../evidentia/fixtures/test_db';
import type { Database } from '../db/schema';
import { paramsResolverValidos, resolverIdentidadModelo } from './resolver';

// T4b-T1 (H5) — specs del módulo resolver. REQUIERE PostgreSQL (BD de test).
// Exclusión local sin BD: ESCRUBERY_SKIP_DB_SPECS=1 npm test.
// Semillas deterministas propias (proveedor 'otro': valor del enum del contrato §2.2) (no dependen de la ingesta real): la semilla
// de producción vive en datos/fichas/curaduria/identidad_modelos.json.

const d = SKIP_DB ? describe.skip : describe;

const HASH_C = 'c'.repeat(64);
const FECHA = new Date('2026-08-18T00:00:00.000Z');

const PROC_CURADURIA = {
  fuente_url: null,
  fuente_tipo: 'curaduria_propia',
  fecha_obtencion: FECHA,
  hash_sha256_contenido_original: HASH_C,
  estado_verificacion: 'pendiente_de_verificar',
};

async function sembrar(db: Kysely<Database>): Promise<void> {
  await db
    .insertInto('modelos')
    .values({
      proveedor: 'otro',
      modelo_id: 'modelo-alpha',
      nombre_display: null,
      ventana_contexto_max: 100000,
      soporta_vision: null,
      soporta_tool_use: true,
      soporta_caching: null,
      soporta_batch: null,
      soporta_computer_use: null,
      precio_input_por_millon: null,
      precio_output_por_millon: null,
      familia_arquitectura: 'specfam',
      pesos_abiertos: false,
      curaduria_json: { esquema: 'spec', procedencia: PROC_CURADURIA },
      fuente_url: 'https://spec.example/modelos',
      fuente_tipo: 'curaduria_propia',
      fecha_obtencion: FECHA,
      hash_sha256_contenido_original: HASH_C,
      estado_verificacion: 'pendiente_de_verificar',
    })
    .execute();
  await db
    .insertInto('identidad_alias')
    .values({
      issuer_id: 'modelo-alpha-harness',
      proveedor: 'otro',
      modelo_id: 'modelo-alpha',
      notas: 'sufijo de harness (semilla de spec)',
      ...PROC_CURADURIA,
    })
    .execute();
  await db
    .insertInto('identidad_endpoints')
    .values({
      endpoint: 'https://api.spec.example',
      proveedor: 'otro',
      notas: null,
      ...PROC_CURADURIA,
    })
    .execute();
}

async function limpiar(db: Kysely<Database>): Promise<void> {
  await db
    .deleteFrom('identidad_alias')
    .where('issuer_id', '=', 'modelo-alpha-harness')
    .execute();
  await db
    .deleteFrom('identidad_endpoints')
    .where('endpoint', '=', 'https://api.spec.example')
    .execute();
  await db
    .deleteFrom('modelos')
    .where('proveedor', '=', 'otro')
    .where('modelo_id', '=', 'modelo-alpha')
    .execute();
}

d('resolver_identidad_modelo — módulo (T4b)', () => {
  let db: Kysely<Database>;

  beforeAll(async () => {
    db = await getDbTest();
    await sembrar(db);
  });

  afterAll(async () => {
    await limpiar(db);
    await cerrarDbTest();
  });

  it('alias curado conocido → identidad canónica + fingerprint + advertencias', async () => {
    const r = await resolverIdentidadModelo(db, {
      issuer_id: 'modelo-alpha-harness',
    });
    expect(r).not.toBeNull();
    expect(r?.resuelto).toBe(true);
    expect(r?.identidad_canonica).toEqual({
      proveedor: 'otro',
      modelo_id: 'modelo-alpha',
      familia_arquitectura: 'specfam',
      pesos_abiertos: false,
    });
    expect(r?.configuration_fingerprint_sugerido).toMatch(
      /^sha256:[0-9a-f]{64}$/,
    );
    // la nota del alias (harness) y el aviso de curaduría están presentes
    expect(r?.advertencias.some((a) => a.includes('harness'))).toBe(true);
    expect(r?.advertencias.some((a) => a.includes('curaduría propia'))).toBe(
      true,
    );
    expect(r?.procedencia.fuente_tipo).toBe('curaduria_propia');
  });

  it('fingerprint determinista (misma identidad → mismo fingerprint)', async () => {
    const r1 = await resolverIdentidadModelo(db, {
      issuer_id: 'modelo-alpha-harness',
    });
    const r2 = await resolverIdentidadModelo(db, {
      issuer_id: 'modelo-alpha-harness',
    });
    expect(r1?.configuration_fingerprint_sugerido).toBe(
      r2?.configuration_fingerprint_sugerido,
    );
  });

  it('alias desconocido → null (nunca se adivina)', async () => {
    const r = await resolverIdentidadModelo(db, {
      issuer_id: 'identificador-inventado',
    });
    expect(r).toBeNull();
  });

  it('modelo + endpoint conocidos → resuelve vía endpoint curado', async () => {
    const r = await resolverIdentidadModelo(db, {
      modelo_id: 'modelo-alpha',
      endpoint: 'https://api.spec.example',
    });
    expect(r?.resuelto).toBe(true);
    expect(r?.identidad_canonica.proveedor).toBe('otro');
    expect(r?.identidad_canonica.familia_arquitectura).toBe('specfam');
    expect(r?.procedencia.fuente_tipo).toBe('curaduria_propia');
  });

  it('endpoint conocido + modelo fuera de catálogo → null (fail-closed)', async () => {
    const r = await resolverIdentidadModelo(db, {
      modelo_id: 'modelo-que-no-existe',
      endpoint: 'https://api.spec.example',
    });
    expect(r).toBeNull();
  });

  it('endpoint desconocido → null', async () => {
    const r = await resolverIdentidadModelo(db, {
      modelo_id: 'modelo-alpha',
      endpoint: 'https://endpoint-no-curado.example',
    });
    expect(r).toBeNull();
  });

  it('las consultas quedan en consultas_log (señal implícita de demanda)', async () => {
    const n = await db
      .selectFrom('consultas_log')
      .select(sql<number>`count(*)`.as('c'))
      .where(sql`consulta::text`, 'like', '%resolver_identidad_modelo%')
      .executeTakeFirstOrThrow();
    expect(Number(n.c)).toBeGreaterThanOrEqual(6);
  });
});

d(
  'resolver_identidad_modelo — casos reales del tráfico (golden, consultas_log 2026-10)',
  () => {
    // Réplicas fieles de filas del catálogo real y de la curaduría de identidad
    // (identidad_modelos.json), observadas en consultas_log: tráfico del primer
    // consumidor real (adrc-mini, fb_12) y probes de la propia operación.
    // Hermético como el resto de la suite (BD de test aislada; semillas
    // deterministas): si el drift del upstream cambia el catálogo real, estos
    // goldens no mienten — replican lo OBSERVADO y se actualizan a conciencia.
    let db: Kysely<Database>;

    const FECHA_REAL = new Date('2026-10-14T19:07:44.000Z');

    async function sembrarReales(db: Kysely<Database>): Promise<void> {
      const modelosReales = [
        {
          proveedor: 'anthropic',
          modelo_id: 'claude-sonnet-5',
          familia_arquitectura: 'claude',
        },
        {
          proveedor: 'zhipu',
          modelo_id: 'glm-5.3',
          familia_arquitectura: 'glm',
        },
        {
          proveedor: 'qwen',
          modelo_id: 'qwen3.8-max',
          familia_arquitectura: 'qwen3',
        },
      ];
      for (const m of modelosReales) {
        await db
          .insertInto('modelos')
          .values({
            ...m,
            nombre_display: null,
            ventana_contexto_max: 100000,
            soporta_vision: null,
            soporta_tool_use: null,
            soporta_caching: null,
            soporta_batch: null,
            soporta_computer_use: null,
            precio_input_por_millon: null,
            precio_output_por_millon: null,
            pesos_abiertos: false,
            curaduria_json: { esquema: 'spec', procedencia: PROC_CURADURIA },
            fuente_url: 'https://spec.example/modelos',
            fuente_tipo: 'curaduria_propia',
            fecha_obtencion: FECHA_REAL,
            hash_sha256_contenido_original: HASH_C,
            estado_verificacion: 'pendiente_de_verificar',
          })
          .execute();
      }
      await db
        .insertInto('identidad_alias')
        .values([
          {
            issuer_id: 'claude-sonnet-5-cowork',
            proveedor: 'anthropic',
            modelo_id: 'claude-sonnet-5',
            notas:
              "Sufijo '-cowork' de harness: el identificador declarado por el agente incluye el harness; la identidad del modelo es la de la API subyacente. Caso canónico del shape original de resolver_identidad_modelo (contrato, git d43c134^).",
            fuente_url: null,
            fuente_tipo: 'curaduria_propia',
            fecha_obtencion: FECHA_REAL,
            hash_sha256_contenido_original: HASH_C,
            estado_verificacion: 'pendiente_de_verificar',
          },
          {
            issuer_id: 'zai-coding-plan/glm-5.3',
            proveedor: 'zhipu',
            modelo_id: 'glm-5.3',
            notas:
              'Prefijo de harness del Coding Plan de Z.AI; identidad canónica = modelo del catálogo. Solicitud del consumidor adrc-mini (fb_10/fb_11, 2026-10-27).',
            fuente_url: null,
            fuente_tipo: 'curaduria_propia',
            fecha_obtencion: FECHA_REAL,
            hash_sha256_contenido_original: HASH_C,
            estado_verificacion: 'pendiente_de_verificar',
          },
        ])
        .execute();
      await db
        .insertInto('identidad_endpoints')
        .values([
          {
            endpoint: 'https://dashscope.aliyuncs.com',
            proveedor: 'qwen',
            notas: null,
            fuente_url: null,
            fuente_tipo: 'curaduria_propia',
            fecha_obtencion: FECHA_REAL,
            hash_sha256_contenido_original: HASH_C,
            estado_verificacion: 'pendiente_de_verificar',
          },
          {
            endpoint: 'https://api.moonshot.cn/v1',
            proveedor: 'moonshot',
            notas: null,
            fuente_url: null,
            fuente_tipo: 'curaduria_propia',
            fecha_obtencion: FECHA_REAL,
            hash_sha256_contenido_original: HASH_C,
            estado_verificacion: 'pendiente_de_verificar',
          },
        ])
        .execute();
    }

    async function limpiarReales(db: Kysely<Database>): Promise<void> {
      await db
        .deleteFrom('identidad_alias')
        .where('issuer_id', 'in', [
          'claude-sonnet-5-cowork',
          'zai-coding-plan/glm-5.3',
        ])
        .execute();
      await db
        .deleteFrom('identidad_endpoints')
        .where('endpoint', 'in', [
          'https://dashscope.aliyuncs.com',
          'https://api.moonshot.cn/v1',
        ])
        .execute();
      await db
        .deleteFrom('modelos')
        .where('proveedor', 'in', ['anthropic', 'zhipu', 'qwen'])
        .where('modelo_id', 'in', ['claude-sonnet-5', 'glm-5.3', 'qwen3.8-max'])
        .execute();
    }

    beforeAll(async () => {
      db = await getDbTest();
      await sembrarReales(db);
    });

    afterAll(async () => {
      await limpiarReales(db);
      await cerrarDbTest();
    });

    it('issuer con sufijo de harness -cowork → identidad subyacente + advertencia (tráfico real)', async () => {
      const r = await resolverIdentidadModelo(db, {
        issuer_id: 'claude-sonnet-5-cowork',
      });
      expect(r?.resuelto).toBe(true);
      expect(r?.identidad_canonica).toEqual({
        proveedor: 'anthropic',
        modelo_id: 'claude-sonnet-5',
        familia_arquitectura: 'claude',
        pesos_abiertos: false,
      });
      expect(r?.advertencias.some((a) => a.includes('-cowork'))).toBe(true);
    });

    it('alias de harness del consumidor adrc-mini → identidad canónica (tráfico real)', async () => {
      const r = await resolverIdentidadModelo(db, {
        issuer_id: 'zai-coding-plan/glm-5.3',
      });
      expect(r?.resuelto).toBe(true);
      expect(r?.identidad_canonica.proveedor).toBe('zhipu');
      expect(r?.identidad_canonica.modelo_id).toBe('glm-5.3');
    });

    it('modelo + endpoint curado (qwen3.8-max + dashscope) → resuelto vía endpoint (tráfico real)', async () => {
      const r = await resolverIdentidadModelo(db, {
        modelo_id: 'qwen3.8-max',
        endpoint: 'https://dashscope.aliyuncs.com',
      });
      expect(r?.resuelto).toBe(true);
      expect(r?.identidad_canonica.proveedor).toBe('qwen');
      expect(r?.identidad_canonica.modelo_id).toBe('qwen3.8-max');
    });

    it('modelo retirado por drift del upstream (kimi-k2-0905-preview, ejemplo del contrato hasta la errata 12) → null fail-closed aunque el endpoint esté curado', async () => {
      const r = await resolverIdentidadModelo(db, {
        modelo_id: 'kimi-k2-0905-preview',
        endpoint: 'https://api.moonshot.cn/v1',
      });
      expect(r).toBeNull();
    });

    it('issuer con forma de flag (--foo) → dato literal, null; nunca se interpreta como opción', async () => {
      const r = await resolverIdentidadModelo(db, { issuer_id: '--foo' });
      expect(r).toBeNull();
    });
  },
);

describe('paramsResolverValidos — validación total', () => {
  it('formas válidas', () => {
    expect(paramsResolverValidos({ issuer_id: 'x' })).toBe(true);
    expect(
      paramsResolverValidos({ modelo_id: 'm', endpoint: 'https://e' }),
    ).toBe(true);
  });

  it('formas inválidas (vacías, mezcladas, ausentes, tipos)', () => {
    expect(paramsResolverValidos(null)).toBe(false);
    expect(paramsResolverValidos({})).toBe(false);
    expect(paramsResolverValidos({ issuer_id: '' })).toBe(false);
    expect(paramsResolverValidos({ issuer_id: '   ' })).toBe(false);
    expect(paramsResolverValidos({ modelo_id: 'm' })).toBe(false);
    expect(paramsResolverValidos({ endpoint: 'https://e' })).toBe(false);
    expect(
      paramsResolverValidos({ issuer_id: 'x', modelo_id: 'm', endpoint: 'e' }),
    ).toBe(false);
    expect(paramsResolverValidos({ issuer_id: 42 })).toBe(false);
  });
});
