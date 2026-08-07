export type CategoriaSeveridad =
  | 'funcion_nueva'
  | 'breaking_change'
  | 'fix_seguridad'
  | 'deprecacion'
  | 'cambio_precio'
  | 'cambio_limite'
  | 'ruido_irrelevante';

export interface Signature {
  key_id: string;
  sig: string;
  alg: 'ed25519';
  key_cert_ref?: string | null;
}

export interface EventoBase {
  record_id: string;
  cli_producto_id: number;
  categoria: CategoriaSeveridad;
  resumen: string;
  fuente_url: string;
  fuente_tipo: string;
  fecha_publicacion: string | null;
  confianza_clasificador: number | null;
  prev_hash: string;
}

export interface EventRecord extends EventoBase {
  firmas: Signature[];
}

export interface KeyringEntry {
  kid: string;
  type: 'ed25519-public';
  key_b64: string;
  role?: string;
  parent_kid?: string | null;
  validity_window?: { not_before: string; not_after?: string | null };
  status?: 'active' | 'revoked';
  successor_kid?: string | null;
  note?: string;
}

export interface Keyring {
  schema: 'cagf-keyring/0.2';
  keys: Record<string, KeyringEntry>;
}
