// Vigencia del carnet. Cada ayuntamiento decide cuánto dura; si no configura nada, el carnet es
// indefinido: vale mientras la persona colabora y se retira al causar baja (revocación).
// «Sin caducidad» se guarda como una fecha centinela lejana: así todas las consultas de carnet vigente
// (`expiresAt > ahora`) siguen funcionando y no hace falta cambiar la columna.
// Módulo puro: lo importan los tests.

/** Fecha centinela de los carnets sin caducidad (31/12/9999). */
export const SIN_CADUCIDAD = new Date(Date.UTC(9999, 11, 31));

/** ¿Es un carnet sin caducidad? Cualquier fecha a partir del año 9999 cuenta como indefinida. */
export function esIndefinido(expiresAt: Date | number): boolean {
  return new Date(expiresAt).getTime() >= Date.UTC(9999, 0, 1);
}

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

/** Caducidad de un carnet emitido (o renovado) en `desde` con `meses` de validez; 0 o vacío = indefinido. */
export function caducidad(desde: Date, meses: number | null | undefined): Date {
  return meses && meses > 0 ? addMonths(desde, meses) : SIN_CADUCIDAD;
}

export function carnetStatus(c: { revokedAt: Date | null; expiresAt: Date }, now = new Date()): "vigente" | "caducado" | "revocado" {
  if (c.revokedAt) return "revocado";
  return c.expiresAt.getTime() > now.getTime() ? "vigente" : "caducado";
}

/** Texto de la validez de un carnet: la fecha, o «Sin caducidad». `fmt` da formato a la fecha. */
export function textoCaducidad(expiresAt: Date, fmt: (d: Date) => string): string {
  return esIndefinido(expiresAt) ? "Sin caducidad" : fmt(expiresAt);
}

export type CambioVigencia = { id: string; antes: Date; despues: Date; quedaCaducado: boolean };

/**
 * Qué pasa si se aplica la vigencia de los ajustes a los carnets vigentes (no revocados y sin caducar):
 * la caducidad se recalcula desde la fecha de emisión, como si se hubieran emitido con el ajuste actual.
 * Con un plazo más corto, algunos pueden quedar caducados (`quedaCaducado`). Solo devuelve los que cambian.
 */
export function planVigencia(
  carnets: { id: string; issuedAt: Date; expiresAt: Date; revokedAt: Date | null }[],
  meses: number | null | undefined,
  now = new Date(),
): CambioVigencia[] {
  return carnets
    .filter((c) => carnetStatus(c, now) === "vigente")
    .map((c) => {
      const despues = caducidad(c.issuedAt, meses);
      return { id: c.id, antes: c.expiresAt, despues, quedaCaducado: despues.getTime() <= now.getTime() };
    })
    .filter((c) => c.antes.getTime() !== c.despues.getTime());
}
