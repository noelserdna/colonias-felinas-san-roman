import { describe, expect, it } from "vitest";
import { addMonths, caducidad, carnetStatus, esIndefinido, planVigencia, SIN_CADUCIDAD, textoCaducidad } from "../../src/lib/carnet-vigencia";
import { DEFAULT_SETTINGS, settingsSchema } from "../../src/lib/settings";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

describe("vigencia del carnet", () => {
  it("por defecto el carnet es indefinido", () => {
    expect(DEFAULT_SETTINGS.carnet_validity_months).toBe(0);
    expect(esIndefinido(caducidad(new Date(), DEFAULT_SETTINGS.carnet_validity_months))).toBe(true);
  });

  it("0 (campo vacío) es válido en los ajustes; negativo no", () => {
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, carnet_validity_months: 0 }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, carnet_validity_months: Number("") }).success).toBe(true);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, carnet_validity_months: -1 }).success).toBe(false);
  });

  it("con meses, caduca; sin meses, fecha centinela", () => {
    const d = new Date(2026, 0, 15);
    expect(caducidad(d, 24)).toEqual(addMonths(d, 24));
    expect(caducidad(d, 0)).toBe(SIN_CADUCIDAD);
    expect(caducidad(d, null)).toBe(SIN_CADUCIDAD);
    expect(esIndefinido(addMonths(d, 240))).toBe(false);
    expect(esIndefinido(SIN_CADUCIDAD.getTime())).toBe(true);
  });

  it("un carnet indefinido está siempre vigente salvo revocado", () => {
    const lejos = new Date(Date.UTC(9000, 0, 1));
    expect(carnetStatus({ revokedAt: null, expiresAt: SIN_CADUCIDAD }, lejos)).toBe("vigente");
    expect(carnetStatus({ revokedAt: new Date(), expiresAt: SIN_CADUCIDAD })).toBe("revocado");
  });

  it("muestra «Sin caducidad» en vez de la fecha", () => {
    expect(textoCaducidad(SIN_CADUCIDAD, fmt)).toBe("Sin caducidad");
    expect(textoCaducidad(new Date(Date.UTC(2028, 5, 1)), fmt)).toBe("2028-06-01");
  });
});

describe("aplicar la vigencia a los carnets vigentes", () => {
  const now = new Date(2026, 8, 26);
  const carnets = [
    { id: "a", issuedAt: new Date(2025, 0, 1), expiresAt: new Date(2027, 0, 1), revokedAt: null }, // vigente, 24 meses
    { id: "b", issuedAt: new Date(2024, 0, 1), expiresAt: new Date(2026, 0, 1), revokedAt: null }, // caducado
    { id: "c", issuedAt: new Date(2025, 5, 1), expiresAt: new Date(2027, 5, 1), revokedAt: new Date(2026, 1, 1) }, // revocado
    { id: "d", issuedAt: new Date(2026, 5, 1), expiresAt: SIN_CADUCIDAD, revokedAt: null }, // ya indefinido
  ];

  it("indefinido: solo los vigentes con fecha pasan a sin caducidad", () => {
    const plan = planVigencia(carnets, 0, now);
    expect(plan.map((c) => c.id)).toEqual(["a"]);
    expect(plan[0].despues).toBe(SIN_CADUCIDAD);
    expect(plan[0].quedaCaducado).toBe(false);
  });

  it("con meses: se recalcula desde la emisión y avisa de los que quedarían caducados", () => {
    const plan = planVigencia(carnets, 12, now);
    expect(plan.map((c) => c.id)).toEqual(["a", "d"]);
    expect(plan.find((c) => c.id === "a")).toMatchObject({ despues: new Date(2026, 0, 1), quedaCaducado: true });
    expect(plan.find((c) => c.id === "d")).toMatchObject({ despues: new Date(2027, 5, 1), quedaCaducado: false });
  });

  it("si ya tienen esa vigencia, no cambia nada", () => {
    expect(planVigencia(carnets.slice(0, 3), 24, now)).toEqual([]);
  });
});
