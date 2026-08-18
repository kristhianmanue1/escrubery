import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { consumirToken, reiniciarRateLimit } from './rate_limit';

// F5 T1/T2 — auth por API key + rate limit para /v0 (contrato §1/§4).
// Claves: ESCRUBERY_API_KEYS = SHA-256 hex separados por coma (nunca la
// clave en claro en config/logs; regla §7 de secretos). Fail-closed: sin
// claves configuradas, TODO /v0 responde 401 con mensaje explícito.

export function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function clavesConfiguradas(): string[] {
  const raw = process.env.ESCRUBERY_API_KEYS ?? '';
  return raw
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length === 64 && /^[0-9a-f]+$/.test(k));
}

// Comparación timing-safe (LOW F5, hardening H4): se compara el SHA-256 de la
// clave recibida contra los hashes configurados, nunca el texto crudo. Ambos
// lados son hex de 64 chars (longitud constante → timingSafeEqual no revela
// prefijos); el reduce recorre TODAS las claves sin early-exit.
export function hashCoincidente(
  hashRecibido: string,
  configuradas: string[],
): boolean {
  const a = Buffer.from(hashRecibido, 'utf8');
  return configuradas.reduce((acc, c) => {
    const b = Buffer.from(c, 'utf8');
    const eq = a.length === b.length && timingSafeEqual(a, b);
    return acc || eq;
  }, false);
}

export interface EstadoAuth {
  clave: string | null;
  identificador: string;
}

// HF5-T3 (hardening H4) — límite de intentos fallidos por IP (mitigación de
// fuerza bruta sobre /v0). Default 20/min, configurable con
// ESCRUBERY_AUTH_LIMIT_RPM. In-memory single-instance, igual que el límite
// por clave (documentado en docs/CONSUMO_INTERNO.md).
function rpmFallosAuth(): number {
  const n = Number(process.env.ESCRUBERY_AUTH_LIMIT_RPM ?? '20');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20;
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const key = req.header('x-api-key') ?? null;
    const configuradas = clavesConfiguradas();

    if (!key) {
      this.falloAuth(ctx, req, 'header X-API-Key requerido');
    }
    if (configuradas.length === 0) {
      this.falloAuth(
        ctx,
        req,
        'servicio sin claves configuradas (ESCRUBERY_API_KEYS vacío): configure al menos una clave SHA-256',
      );
    }
    const hash = sha256Hex(key);
    if (!hashCoincidente(hash, configuradas)) {
      this.falloAuth(ctx, req, 'clave inválida');
    }

    // rate limit por clave (hash como identificador, nunca la clave en claro)
    const r = consumirToken(hash);
    if (!r.ok) {
      throw limiteDeTasa(
        ctx,
        `límite de ${r.rpm} req/min alcanzado; reintente en ${r.retryAfterS}s`,
        r.retryAfterS,
      );
    }
    return true;
  }

  // Intento fallido de auth: consume del bucket por IP; si se agota, 429.
  // Las peticiones con clave VÁLIDA nunca tocan este bucket.
  private falloAuth(
    ctx: ExecutionContext,
    req: Request,
    mensaje: string,
  ): never {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'desconocida';
    const r = consumirToken(`ip:${ip}`, rpmFallosAuth());
    if (!r.ok) {
      throw limiteDeTasa(
        ctx,
        `límite de ${r.rpm} intentos fallidos/min por IP alcanzado; reintente en ${r.retryAfterS}s`,
        r.retryAfterS,
      );
    }
    throw new HttpException(
      { error: { codigo: 'no_autorizado', mensaje } },
      401,
    );
  }
}

function limiteDeTasa(
  ctx: ExecutionContext,
  mensaje: string,
  retryAfterS: number,
): HttpException {
  const res = ctx
    .switchToHttp()
    .getResponse<{ setHeader: (k: string, v: string) => void }>();
  res.setHeader('Retry-After', `${retryAfterS}`);
  return new HttpException(
    { error: { codigo: 'limite_de_tasa', mensaje } },
    429,
  );
}

export { reiniciarRateLimit };
