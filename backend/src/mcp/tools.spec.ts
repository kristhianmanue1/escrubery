import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { TOOLS_CATALOGO } from './tools';
import type { AgentCardFirmada } from '../evidentia/agent_card';

// HF5-T2 (hardening H4) — spec anti-drift: la Agent Card FIRMADA (artefacto
// commiteado) debe coincidir exactamente con el catálogo único de tools.
// El servidor MCP y el generador consumen el catálogo por construcción, así
// que este check cierra el triángulo card↔catálogo.

const CARD = JSON.parse(
  readFileSync(
    join(process.cwd(), '..', 'datos', 'agent-card', 'agent-card.json'),
    'utf8',
  ),
) as AgentCardFirmada;

describe('catálogo de tools — single source (HF5-T2)', () => {
  it('nombres únicos y sin duplicados', () => {
    const nombres = TOOLS_CATALOGO.map((t) => t.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
    expect(nombres.length).toBe(9); // 8 de F5 + resolver_identidad_modelo (T4b)
  });

  it('la card firmada expone exactamente el catálogo (nombres)', () => {
    const deCard = CARD.card.tools.map((t) => t.nombre).sort();
    const deCatalogo = TOOLS_CATALOGO.map((t) => t.nombre).sort();
    expect(deCard).toEqual(deCatalogo);
  });

  it('la card firmada expone exactamente el catálogo (descripciones)', () => {
    const porNombre = new Map(
      TOOLS_CATALOGO.map((t) => [t.nombre, t.descripcion]),
    );
    for (const t of CARD.card.tools) {
      expect({ nombre: t.nombre, descripcion: t.descripcion }).toEqual({
        nombre: t.nombre,
        descripcion: porNombre.get(t.nombre),
      });
    }
  });
});
