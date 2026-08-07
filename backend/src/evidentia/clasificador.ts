import type { CategoriaSeveridad } from './schema';

interface Regla {
  cat: CategoriaSeveridad;
  patrones: RegExp[];
  confianza: number;
}

const REGLAS: Regla[] = [
  {
    cat: 'fix_seguridad',
    confianza: 0.9,
    patrones: [
      /\b(security|cve-|vulnerab|exploit|exfiltra|injection|xss|csrf|ssrf|backdoor|malware|unauthorized|privilege escalation|sandbox escape)\b/i,
    ],
  },
  {
    cat: 'deprecacion',
    confianza: 0.7,
    patrones: [
      /\b(deprecat|legacy|sunset|end.of.life|will be removed|stabilized)\b/i,
    ],
  },
  {
    cat: 'breaking_change',
    confianza: 0.9,
    patrones: [
      /\b(breaking|removed|incompatible|no longer (support|available)|migration required|must update|drop(ped)? support)\b/i,
    ],
  },
  {
    cat: 'cambio_precio',
    confianza: 0.75,
    patrones: [/\b(price|pricing|cost (change|update)|tariff|new rate)\b/i],
  },
  {
    cat: 'cambio_limite',
    confianza: 0.75,
    patrones: [
      /\b(rate limit|context window|token limit|quota|throttl|context length|max tokens)\b/i,
    ],
  },
  {
    cat: 'funcion_nueva',
    confianza: 0.7,
    patrones: [
      /\b(add(ed)?|new|introduc|now support|feature|enables?|release[sd]?)\b/i,
    ],
  },
];

export interface Clasificacion {
  categoria: CategoriaSeveridad;
  confianza: number;
}

export function clasificar(texto: string): Clasificacion {
  const t = texto ?? '';
  for (const r of REGLAS) {
    if (r.patrones.some((p) => p.test(t))) {
      return { categoria: r.cat, confianza: r.confianza };
    }
  }
  return { categoria: 'ruido_irrelevante', confianza: 0.3 };
}

export function esAltaSeveridad(c: CategoriaSeveridad): boolean {
  return c === 'fix_seguridad' || c === 'breaking_change';
}
