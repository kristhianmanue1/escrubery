// Comparación de versiones semver mínima, casera (sin dependencia nueva;
// mismo criterio que JCS en H1-T2). Nace del incidente cline 2026-08-28:
// el tag desktop-v0.0.17 (otro artefacto) contaminó cli_productos.version_actual
// porque el eslabón escribía "si difiere", sin dirección. Todo camino
// indecidible es fail-closed: nunca se afirma que una versión es mayor.

export interface VersionParseada {
  nucleos: number[];
  // null = release final; array = identificadores de prerelease (semver §11)
  pre: string[] | null;
}

const RE_VERSION = /^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z][0-9A-Za-z.-]*))?$/;

export function parsearVersion(s: string): VersionParseada | null {
  const m = s.trim().match(RE_VERSION);
  if (!m) {
    return null;
  }
  const nucleos = m[1].split('.').map(Number);
  if (nucleos.length === 0 || nucleos.some((n) => !Number.isFinite(n))) {
    return null;
  }
  return { nucleos, pre: m[2] ? m[2].split('.') : null };
}

// -1 | 0 | 1 según orden semver; null si alguna no es parseable (indecidible).
export function compararVersiones(a: string, b: string): number | null {
  const va = parsearVersion(a);
  const vb = parsearVersion(b);
  if (!va || !vb) {
    return null;
  }
  const n = Math.max(va.nucleos.length, vb.nucleos.length);
  for (let i = 0; i < n; i++) {
    const x = va.nucleos[i] ?? 0;
    const y = vb.nucleos[i] ?? 0;
    if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  // Núcleo igual: release final > prerelease (semver §11.3)
  if (va.pre === null && vb.pre === null) {
    return 0;
  }
  if (va.pre === null) {
    return 1;
  }
  if (vb.pre === null) {
    return -1;
  }
  // §11.4: identificadores izquierda→derecha; numéricos < alfanuméricos;
  // el que se queda sin identificadores primero es el menor.
  const m = Math.max(va.pre.length, vb.pre.length);
  for (let i = 0; i < m; i++) {
    const x = va.pre[i] as string | undefined;
    const y = vb.pre[i] as string | undefined;
    if (x === undefined) {
      return -1;
    }
    if (y === undefined) {
      return 1;
    }
    const esNumX = /^\d+$/.test(x);
    const esNumY = /^\d+$/.test(y);
    if (esNumX && esNumY) {
      const nx = Number(x);
      const ny = Number(y);
      if (nx !== ny) {
        return nx < ny ? -1 : 1;
      }
    } else if (esNumX) {
      return -1;
    } else if (esNumY) {
      return 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

// ¿candidata es semver-Mayor que base? Indecidible (alguna no parseable) o
// igualdad → false: el que decide con duda, no decide.
export function versionMayor(candidata: string, base: string): boolean {
  const c = compararVersiones(candidata, base);
  return c !== null && c > 0;
}
