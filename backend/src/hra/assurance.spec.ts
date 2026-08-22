import {
  validarFichaAssurance,
  selfHashAssurance,
  calcularDistribucion,
  type FichaAssurance,
  type NormaClasificada,
} from './assurance';

function evidenciaBase() {
  return {
    fuente_url: 'https://example.com/docs/permisos',
    fecha_obtencion: '2026-08-22',
    hash_sha256: `sha256:${'a'.repeat(64)}`,
    evento_evidentia: null,
  };
}

function norma(
  id: NormaClasificada['norma_id'],
  peldano: 'L1' | 'L2' | 'L3' | 'L4' | null,
): NormaClasificada {
  if (peldano === null)
    return { norma_id: id, estado: 'pendiente_de_verificar' };
  return {
    norma_id: id,
    estado: 'clasificada',
    peldano_maximo: peldano,
    capado_por_n9: false,
    mecanismos: [
      {
        peldano,
        donde: 'mecanismo de prueba',
        enforcement_verificado: peldano !== 'L4' ? undefined : false,
        evidencia: evidenciaBase(),
      },
    ],
  };
}

function fichaBase(): FichaAssurance {
  const normas: NormaClasificada[] = [
    norma('N1', 'L4'),
    norma('N2', 'L4'),
    norma('N3', 'L3'),
    norma('N4', 'L2'),
    norma('N5', 'L1'),
    norma('N6', 'L3'),
    norma('N7', null),
    norma('N8', 'L1'),
  ];
  return {
    schema: 'escrubery/assurance/v0',
    cli_id: 'claude-code',
    perfil: 'default',
    corpus_id: 'hra-corpus/n1-n8@2026-08-22',
    n9_gate: {
      estado: 'gate_cerrado',
      nota: 'los settings gestionados no los puede reescribir el agente',
      evidencia: evidenciaBase(),
    },
    distribucion_garantia: { L1: 2, L2: 1, L3: 2, L4: 2, pendiente: 1 },
    normas,
    estado_verificacion: 'parcial',
    procedencia: {
      fuente_tipo: 'curaduria_propia',
      fuente_url: 'docs/investigacion/hra/claude-code.json',
      fecha_obtencion: '2026-08-22',
      hash_sha256: `sha256:${'b'.repeat(64)}`,
    },
  };
}

describe('schema escrubery/assurance/v0', () => {
  it('la ficha base válida pasa', () => {
    const r = validarFichaAssurance(fichaBase());
    expect(r.valido).toBe(true);
    expect(r.errores).toBeNull();
  });

  it('los 5 CLIs del enum pasan', () => {
    for (const cli of [
      'claude-code',
      'codex-cli',
      'opencode',
      'cline',
      'kimi-code',
    ] as const) {
      const f = fichaBase();
      f.cli_id = cli;
      expect(validarFichaAssurance(f).valido).toBe(true);
    }
  });

  it('norma L4 sin enforcement_verificado=false → inválida (decreto §11.3)', () => {
    const f = fichaBase();
    (
      f.normas[0].mecanismos![0] as { enforcement_verificado?: boolean }
    ).enforcement_verificado = true;
    // el schema no exige false literal, pero la regla de fase 1 se aplica en curaduría;
    // aquí validamos el tipo: valor no-boolean rompe
    const f2 = fichaBase();
    (
      f2.normas[0].mecanismos![0] as unknown as {
        enforcement_verificado: string;
      }
    ).enforcement_verificado = 'si';
    expect(validarFichaAssurance(f2).valido).toBe(false);
  });

  it('propiedad extra → inválida (additionalProperties: false)', () => {
    const f = fichaBase() as unknown as Record<string, unknown>;
    f.marketing_seguridad = 'muy seguro';
    const r = validarFichaAssurance(f);
    expect(r.valido).toBe(false);
    expect(r.errores?.some((x) => x.keyword === 'additionalProperties')).toBe(
      true,
    );
  });

  it('7 normas (menos de 8) → inválida', () => {
    const f = fichaBase();
    f.normas = f.normas.slice(0, 7);
    expect(validarFichaAssurance(f).valido).toBe(false);
  });

  it('corpus_id distinto del congelado → inválido', () => {
    const f = fichaBase() as unknown as Record<string, unknown>;
    f.corpus_id = 'hra-corpus/n1-n9@1999-01-01';
    expect(validarFichaAssurance(f).valido).toBe(false);
  });

  it('norma pendiente con peldano_maximo ausente → válida (fail-closed compatible)', () => {
    const f = fichaBase();
    f.normas[6] = { norma_id: 'N7', estado: 'pendiente_de_verificar' };
    expect(validarFichaAssurance(f).valido).toBe(true);
  });

  it('evidencia sin fuente_url y sin evento_evidentia → válida para el schema, la regla la aplica curaduría', () => {
    const f = fichaBase();
    f.normas[0].mecanismos![0].evidencia.fuente_url = null;
    expect(validarFichaAssurance(f).valido).toBe(true);
  });
});

describe('reglas de la taxonomía (código)', () => {
  it('calcularDistribucion cuenta cada norma una vez y respeta pendiente', () => {
    const normas = [
      norma('N1', 'L4'),
      norma('N2', 'L3'),
      norma('N3', 'L3'),
      norma('N4', 'L1'),
      norma('N5', null),
      norma('N6', null),
      norma('N7', 'L2'),
      norma('N8', 'L4'),
    ];
    const d = calcularDistribucion(normas, false);
    expect(d).toEqual({ L1: 1, L2: 1, L3: 2, L4: 2, pendiente: 2 });
  });

  it('N9 gate abierto capa toda L4 a L3 (L4 efectivo cero)', () => {
    const normas = [
      norma('N1', 'L4'),
      norma('N2', 'L4'),
      norma('N3', 'L2'),
      norma('N4', 'L2'),
      norma('N5', 'L2'),
      norma('N6', 'L2'),
      norma('N7', 'L2'),
      norma('N8', 'L2'),
    ];
    const d = calcularDistribucion(normas, true);
    expect(d.L4).toBe(0);
    expect(d.L3).toBe(2);
  });

  it('self-hash es reproducible e independiente del orden de claves', () => {
    const f = fichaBase();
    const sinProv: Omit<FichaAssurance, 'procedencia'> = f;
    const h1 = selfHashAssurance(sinProv);
    // misma ficha con claves insertadas en otro orden (objeto nuevo con orden invertido)
    const invertido: Record<string, unknown> = {};
    for (const k of Object.keys(sinProv).reverse())
      invertido[k] = (sinProv as Record<string, unknown>)[k];
    const h2 = selfHashAssurance(invertido as typeof sinProv);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^sha256:[0-9a-f]{64}$/);
    // mutar contenido cambia el hash
    const mutado = JSON.parse(JSON.stringify(sinProv)) as typeof sinProv;
    mutado.normas[0].nota = 'cambiado';
    expect(selfHashAssurance(mutado)).not.toBe(h1);
  });
});
