// F5 T2 — rate limit (token bucket en memoria, por clave). Pensado para
// consumo automatizado: default 60 req/min, configurable con
// ESCRUBERY_RATE_LIMIT_RPM. Single-instance (alpha interna): si el servicio
// escala a múltiples procesos, esto migra a almacenamiento compartido.

interface Bucket {
  tokens: number;
  ultimoMs: number;
}

const buckets = new Map<string, Bucket>();

function rpmConfigurado(): number {
  const n = Number(process.env.ESCRUBERY_RATE_LIMIT_RPM ?? '60');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60;
}

export function consumirToken(
  identificador: string,
): { ok: true; rpm: number } | { ok: false; rpm: number; retryAfterS: number } {
  const rpm = rpmConfigurado();
  const ahora = Date.now();
  const b = buckets.get(identificador) ?? { tokens: rpm, ultimoMs: ahora };
  // reposición proporcional al tiempo transcurrido
  const transcurridoMin = (ahora - b.ultimoMs) / 60000;
  b.tokens = Math.min(rpm, b.tokens + transcurridoMin * rpm);
  b.ultimoMs = ahora;
  if (b.tokens < 1) {
    const esperaTokens = 1 - b.tokens;
    const retryAfterS = Math.max(1, Math.ceil((esperaTokens / rpm) * 60));
    buckets.set(identificador, b);
    return { ok: false, rpm, retryAfterS };
  }
  b.tokens -= 1;
  buckets.set(identificador, b);
  return { ok: true, rpm };
}

/** Solo para specs: reset del estado en memoria. */
export function reiniciarRateLimit(): void {
  buckets.clear();
}
