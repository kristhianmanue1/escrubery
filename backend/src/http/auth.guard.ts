import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { consumirToken, reiniciarRateLimit } from './rate_limit';

// F5 T1/T2 — auth por API key + rate limit para /v0 (contrato §1/§4).
// Claves: ESCRUBERY_API_KEYS = SHA-256 hex separados por coma (nunca la
// clave en claro en config/logs; regla §7 de secretos). Fail-closed: sin
// claves configuradas, TODO /v0 responde 401 con mensaje explícito.

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function clavesConfiguradas(): Set<string> {
  const raw = process.env.ESCRUBERY_API_KEYS ?? '';
  return new Set(
    raw
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length === 64 && /^[0-9a-f]+$/.test(k)),
  );
}

export interface EstadoAuth {
  clave: string | null;
  identificador: string;
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const key = req.header('x-api-key') ?? null;
    const configuradas = clavesConfiguradas();

    if (!key) {
      throw new HttpException(
        {
          error: {
            codigo: 'no_autorizado',
            mensaje: 'header X-API-Key requerido',
          },
        },
        401,
      );
    }
    if (configuradas.size === 0) {
      throw new HttpException(
        {
          error: {
            codigo: 'no_autorizado',
            mensaje:
              'servicio sin claves configuradas (ESCRUBERY_API_KEYS vacío): configure al menos una clave SHA-256',
          },
        },
        401,
      );
    }
    const hash = sha256Hex(key);
    if (!configuradas.has(hash)) {
      throw new HttpException(
        {
          error: {
            codigo: 'no_autorizado',
            mensaje: 'clave inválida',
          },
        },
        401,
      );
    }

    // rate limit por clave (hash como identificador, nunca la clave en claro)
    const r = consumirToken(hash);
    if (!r.ok) {
      const res = ctx
        .switchToHttp()
        .getResponse<{ setHeader: (k: string, v: string) => void }>();
      res.setHeader('Retry-After', `${r.retryAfterS}`);
      throw new HttpException(
        {
          error: {
            codigo: 'limite_de_tasa',
            mensaje: `límite de ${r.rpm} req/min alcanzado; reintente en ${r.retryAfterS}s`,
          },
        },
        429,
      );
    }
    return true;
  }
}

export { reiniciarRateLimit };
