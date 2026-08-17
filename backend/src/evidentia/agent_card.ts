import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { canonicalize } from './jcs';
import type { Keyring } from './schema';

// F5 T0 — Agent Card firmado (plan v2 §8, D4=interno): identidad del
// servicio para consumidores del ecosistema. La firma Ed25519 usa la MISMA
// clave de Evidentia (keyring público commiteado): un agente verifica a
// quién consulta con el keyring que ya tiene.

export interface AgentCard {
  schema: 'escrubery/agent-card/0.1';
  nombre: string;
  descripcion: string;
  version: string;
  transportes: {
    http: string;
    mcp: string;
  };
  tools: { nombre: string; descripcion: string }[];
  keyring: string;
  generado_en: string;
}

export interface AgentCardFirmada {
  card: AgentCard;
  firma: { key_id: string; alg: 'ed25519'; sig: string };
}

export function firmarAgentCard(
  card: AgentCard,
  kid: string,
  privPath: string,
): AgentCardFirmada {
  const priv = createPrivateKey(readFileSync(privPath, 'utf8'));
  const firmado = canonicalize(card);
  const sig = `ed25519:${sign(null, Buffer.from(firmado), priv).toString('base64')}`;
  return { card, firma: { key_id: kid, alg: 'ed25519', sig } };
}

export function verificarAgentCard(
  firmada: AgentCardFirmada,
  keyring: Keyring,
): { ok: boolean; detalle: string } {
  const entry = keyring.keys[firmada.firma?.key_id ?? ''];
  if (!entry)
    return {
      ok: false,
      detalle: `key_id ${firmada.firma?.key_id} no en keyring`,
    };
  if (
    firmada.firma?.alg !== 'ed25519' ||
    !firmada.firma.sig?.startsWith('ed25519:')
  ) {
    return { ok: false, detalle: 'firma sin formato ed25519:' };
  }
  const pub = createPublicKey({
    key: Buffer.from(entry.key_b64, 'base64'),
    format: 'der',
    type: 'spki',
  });
  const sigBytes = Buffer.from(
    firmada.firma.sig.slice('ed25519:'.length),
    'base64',
  );
  const ok = verify(
    null,
    Buffer.from(canonicalize(firmada.card)),
    pub,
    sigBytes,
  );
  return {
    ok,
    detalle: ok
      ? 'firma verificada'
      : 'firma Ed25519 inválida (card alterada o clave incorrecta)',
  };
}

export function escribirAgentCard(
  firmada: AgentCardFirmada,
  ruta: string,
): void {
  writeFileSync(ruta, `${JSON.stringify(firmada, null, 2)}\n`);
}

export function leerAgentCard(ruta: string): AgentCardFirmada {
  return JSON.parse(readFileSync(ruta, 'utf8')) as AgentCardFirmada;
}
