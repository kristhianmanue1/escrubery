const LESS_THAN = -1;
const GREATER_THAN = 1;

export function canonicalize(value: unknown): string {
  return jcs(value);
}

function jcs(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return jcsNumber(value);
  if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort(compareUtf16);
    return `{${keys.map((k) => `${JSON.stringify(k)}:${jcs(obj[k])}`).join(',')}}`;
  }
  return 'null';
}

function jcsNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new Error('JCS: número no finito no permitido (RFC 8785)');
  }
  if (Object.is(n, -0)) return '0';
  return JSON.stringify(n);
}

function compareUtf16(a: string, b: string): number {
  if (a < b) return LESS_THAN;
  if (a > b) return GREATER_THAN;
  return 0;
}
