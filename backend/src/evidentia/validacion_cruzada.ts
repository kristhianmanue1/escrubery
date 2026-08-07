export interface ResultadoCruzado {
  resuelto: boolean;
  estado_verificacion:
    | 'confirmado_por_docs_oficial'
    | 'corroborado_cruzado'
    | 'pendiente_de_verificar';
  detalle: string;
  segunda_fuente: string | null;
}

export async function validarCruzado(
  proveedor: string,
  modeloId: string,
): Promise<ResultadoCruzado> {
  // F2: sin 2ª fuente pública gratuita disponible. El endpoint /models de cada
  // proveedor requiere API key (servicio de pago, fuera de alcance F0-F2 — política §7).
  // La estructura queda lista; se activa cuando se disponga de una 2ª fuente
  // (p. ej. openmodelsrun, o endpoint /models con credencial autorizada).
  return {
    resuelto: false,
    estado_verificacion: 'pendiente_de_verificar',
    detalle: `sin 2ª fuente disponible en F2 para ${proveedor}/${modeloId}`,
    segunda_fuente: null,
  };
}
