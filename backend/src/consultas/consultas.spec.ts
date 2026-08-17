import {
  cerrarDbTest,
  getDbTest,
  SKIP_DB,
} from '../evidentia/fixtures/test_db';
import {
  consultarComandoCli,
  consultarFicha,
  consultarModelo,
  listar,
  oficialidad,
} from './modulo';
import { reportarFeedback, feedbackInputValido } from '../feedback/modulo';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema';

// T1b — goldens del shape implementado post-errata T4a: un cambio de shape
// rompe estos tests. REQUIERE PostgreSQL (BD de test `escrubery_test`).
// Exclusión local sin BD: ESCRUBERY_SKIP_DB_SPECS=1 npm test.
// La conformidad contrato ↔ implementación la garantiza T4a (errata); estos
// goldens fosilizan el shape vigente.

const d = SKIP_DB ? describe.skip : describe;

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const FECHA = new Date('2026-08-01T10:00:00.000Z');

const PROC_COMANDO = {
  fuente_url: 'https://github.com/xai-org/grok-build',
  fuente_tipo: 'changelog_repo',
  fecha_obtencion: '2026-08-01T10:00:00.000Z',
  hash_sha256_contenido_original: HASH_A,
  estado_verificacion: 'confirmado_por_docs_oficial',
  firma_ed25519: null,
};

async function sembrar(db: Kysely<Database>): Promise<void> {
  // reset determinista del estado visible para los goldens
  await db.deleteFrom('feedback').execute();
  await db.deleteFrom('eventos_changelog').execute();
  await db.deleteFrom('modelos').execute();
  await db.deleteFrom('cli_productos').execute(); // cascada a cli_comandos

  await db
    .insertInto('cli_productos')
    .values([
      {
        nombre: 'grok-build',
        nombre_display: 'Grok Build',
        proveedor: 'xai',
        tipo: 'oficial',
        repo_url: 'https://github.com/xai-org/grok-build',
        version_actual: '1.2.3',
      },
      {
        nombre: 'grok-cli-community',
        nombre_display: 'Grok CLI',
        proveedor: 'superagent-ai',
        tipo: 'comunitario',
        repo_url: 'https://github.com/superagent-ai/grok-cli',
        version_actual: null,
      },
    ])
    .execute();

  const cli = await db
    .selectFrom('cli_productos')
    .select('id')
    .where('nombre', '=', 'grok-build')
    .executeTakeFirstOrThrow();

  await db
    .insertInto('cli_comandos')
    .values([
      {
        cli_producto_id: cli.id,
        comando: 'build',
        flags_json: null,
        descripcion: 'Compila el proyecto',
        fuente_url: PROC_COMANDO.fuente_url,
        fuente_tipo: 'changelog_repo',
        fecha_obtencion: FECHA,
        hash_sha256_contenido_original: HASH_A,
        estado_verificacion: 'confirmado_por_docs_oficial',
      },
      {
        cli_producto_id: cli.id,
        comando: 'deploy',
        flags_json: { salida: 'deploy --help (salida cruda)' },
        descripcion: null,
        fuente_url: PROC_COMANDO.fuente_url,
        fuente_tipo: 'ejecucion_local_supervisada',
        fecha_obtencion: FECHA,
        hash_sha256_contenido_original: HASH_B,
        estado_verificacion: 'confirmado_por_prueba_propia',
      },
    ])
    .execute();

  await db
    .insertInto('modelos')
    .values({
      proveedor: 'zhipu',
      modelo_id: 'glm-5.2',
      nombre_display: 'GLM 5.2',
      ventana_contexto_max: 131072,
      soporta_vision: false,
      soporta_tool_use: true,
      soporta_caching: true,
      soporta_batch: null,
      soporta_computer_use: false,
      precio_input_por_millon: '0.11',
      precio_output_por_millon: '0.42',
      fuente_url:
        'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json',
      fuente_tipo: 'litellm_json',
      fecha_obtencion: FECHA,
      hash_sha256_contenido_original: HASH_B,
      estado_verificacion: 'confirmado_por_docs_oficial',
    })
    .execute();
}

d('goldens del shape v0 (post-errata T4a)', () => {
  beforeAll(async () => {
    const db = await getDbTest();
    await sembrar(db);
  });

  afterAll(async () => {
    await cerrarDbTest();
  });

  it('listar — {clis, proveedores} (índice sin procedencia)', async () => {
    const db = await getDbTest();
    expect(await listar(db)).toEqual({
      clis: ['grok-build', 'grok-cli-community'],
      proveedores: ['zhipu'],
    });
  });

  it('consultar_modelo — shape §3.1 completo con procedencia', async () => {
    const db = await getDbTest();
    expect(await consultarModelo(db, 'zhipu', 'glm-5.2')).toEqual({
      proveedor: 'zhipu',
      modelo_id: 'glm-5.2',
      nombre_display: 'GLM 5.2',
      ventana_contexto_max: 131072,
      capacidades: {
        soporta_vision: false,
        soporta_tool_use: true,
        soporta_caching: true,
        soporta_batch: null,
        soporta_computer_use: false,
      },
      precios: { input_por_millon: 0.11, output_por_millon: 0.42 },
      vigente_hasta: null,
      procedencia: {
        fuente_url:
          'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json',
        fuente_tipo: 'litellm_json',
        fecha_obtencion: '2026-08-01T10:00:00.000Z',
        hash_sha256_contenido_original: HASH_B,
        estado_verificacion: 'confirmado_por_docs_oficial',
        firma_ed25519: null,
      },
    });
  });

  it('consultar_modelo sin datos → null (sin_datos es primera clase)', async () => {
    const db = await getDbTest();
    expect(await consultarModelo(db, 'zhipu', 'inexistente')).toBeNull();
  });

  it('consultar_comando_cli — shape §3.2: comandos[], tipo siempre, flags crudos', async () => {
    const db = await getDbTest();
    expect(await consultarComandoCli(db, 'grok-build')).toEqual({
      cli_producto: {
        nombre: 'grok-build',
        nombre_display: 'Grok Build',
        proveedor: 'xai',
        tipo: 'oficial',
        version_actual: '1.2.3',
      },
      comandos: [
        {
          comando: 'build',
          descripcion: 'Compila el proyecto',
          flags: null,
          procedencia: PROC_COMANDO,
        },
        {
          comando: 'deploy',
          descripcion: null,
          flags: { salida: 'deploy --help (salida cruda)' },
          procedencia: {
            ...PROC_COMANDO,
            fuente_tipo: 'ejecucion_local_supervisada',
            hash_sha256_contenido_original: HASH_B,
            estado_verificacion: 'confirmado_por_prueba_propia',
          },
        },
      ],
    });
  });

  it('consultar_comando_cli con filtro → subconjunto', async () => {
    const db = await getDbTest();
    const r = await consultarComandoCli(db, 'grok-build', 'bui');
    expect(r?.comandos).toHaveLength(1);
    expect(r?.comandos[0].comando).toBe('build');
  });

  it('consultar_comando_cli en CLI comunitario → tipo comunitario (gobernanza)', async () => {
    const db = await getDbTest();
    const r = await consultarComandoCli(db, 'grok-cli-community');
    expect(r?.cli_producto.tipo).toBe('comunitario');
    expect(r?.cli_producto.proveedor).toBe('superagent-ai');
    expect(r?.comandos).toEqual([]);
  });

  it('consultar_ficha cli — shape §3.3', async () => {
    const db = await getDbTest();
    expect(await consultarFicha(db, 'cli', 'grok-build')).toEqual({
      entidad: 'cli',
      cli_producto: {
        nombre: 'grok-build',
        nombre_display: 'Grok Build',
        proveedor: 'xai',
        tipo: 'oficial',
        repo_url: 'https://github.com/xai-org/grok-build',
      },
      comandos: [
        {
          comando: 'build',
          descripcion: 'Compila el proyecto',
          procedencia: PROC_COMANDO,
        },
        {
          comando: 'deploy',
          descripcion: null,
          procedencia: {
            ...PROC_COMANDO,
            fuente_tipo: 'ejecucion_local_supervisada',
            hash_sha256_contenido_original: HASH_B,
            estado_verificacion: 'confirmado_por_prueba_propia',
          },
        },
      ],
    });
  });

  it('consultar_ficha proveedor — shape §3.3 con procedencia representativa', async () => {
    const db = await getDbTest();
    expect(await consultarFicha(db, 'proveedor', 'zhipu')).toEqual({
      entidad: 'proveedor',
      proveedor: 'zhipu',
      total_modelos: 1,
      modelos: [
        {
          modelo_id: 'glm-5.2',
          ventana_contexto_max: 131072,
          precios: { input_por_millon: 0.11, output_por_millon: 0.42 },
        },
      ],
      procedencia: {
        fuente_url:
          'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json',
        fuente_tipo: 'litellm_json',
        fecha_obtencion: '2026-08-01T10:00:00.000Z',
        hash_sha256_contenido_original: HASH_B,
        estado_verificacion: 'confirmado_por_docs_oficial',
        firma_ed25519: null,
      },
    });
  });

  it('oficialidad — shape §3.8 con nota de gobernanza', async () => {
    const db = await getDbTest();
    expect(await oficialidad(db)).toEqual({
      clis: [
        {
          id: 'grok-build',
          nombre: 'Grok Build',
          proveedor: 'xai',
          tipo: 'oficial',
        },
        {
          id: 'grok-cli-community',
          nombre: 'Grok CLI',
          proveedor: 'superagent-ai',
          tipo: 'comunitario',
        },
      ],
      nota: 'grok-cli-community (comunitario) y grok-build (oficial) son productos DISTINTOS; no mezclarlos',
    });
  });

  it('reportar_feedback — nuevo y deduplicado (shape §3.6)', async () => {
    const db = await getDbTest();
    const input = {
      tipo: 'error' as const,
      descripcion: 'precio desactualizado de glm-5.2',
      agente_reportante: { id: 'spec-agente/1' },
    };
    const primero = await reportarFeedback(db, input);
    const version = process.env.npm_package_version ?? null;
    expect(primero.estado).toBe('nuevo');
    expect(primero.deduplicado_de).toBeNull();
    expect(primero.feedback_id).toMatch(/^fb_\d+$/);
    expect(primero.registrado_en).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(primero.procedencia).toEqual({
      agente_reportante: 'spec-agente/1',
      version_servicio: version,
    });

    const dup = await reportarFeedback(db, { ...input });
    expect(dup.estado).toBe('duplicado');
    expect(dup.deduplicado_de).toBe(primero.feedback_id);
  });
});

// T4c — feedbackInputValido debe ser total: nunca lanzar, siempre boolean
// (input null/escalar/parcial → false, no TypeError). Spec pura.
describe('feedbackInputValido — totalidad', () => {
  it('input null → false (no TypeError)', () => {
    expect(feedbackInputValido(null as never)).toBe(false);
  });
  it('input undefined → false', () => {
    expect(feedbackInputValido(undefined as never)).toBe(false);
  });
  it('input escalar (string) → false', () => {
    expect(feedbackInputValido('error' as never)).toBe(false);
  });
  it('objeto vacío → false', () => {
    expect(feedbackInputValido({} as never)).toBe(false);
  });
  it('tipo fuera del enum → false', () => {
    expect(
      feedbackInputValido({
        tipo: 'otro',
        descripcion: 'x',
        agente_reportante: { id: 'a' },
      }),
    ).toBe(false);
  });
  it('id vacío → false', () => {
    expect(
      feedbackInputValido({
        tipo: 'error',
        descripcion: 'x',
        agente_reportante: { id: '' },
      }),
    ).toBe(false);
  });
  it('input válido → true', () => {
    expect(
      feedbackInputValido({
        tipo: 'error',
        descripcion: 'x',
        agente_reportante: { id: 'a' },
      }),
    ).toBe(true);
  });
});
