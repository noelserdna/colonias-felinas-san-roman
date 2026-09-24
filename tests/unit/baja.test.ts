import { describe, expect, it } from "vitest";
import { decideBaja, mockBajaScores, MIN_BAJA_CHARS } from "../../src/lib/baja";
import { censusDue, censusFromCats, censusTotal } from "../../src/lib/colonies";

const long = "Me mudo a Madrid el mes que viene por un cambio de trabajo y no podré venir a la colonia.";

describe("decideBaja", () => {
  it("texto corto: no habilita", () => {
    const r = decideBaja("no puedo", false, null);
    expect(r.ok).toBe(false);
    expect(r.checks[0].hint).toContain(String(MIN_BAJA_CHARS));
  });
  it("sin JEV: basta con la longitud", () => {
    expect(decideBaja(long, true, null)).toMatchObject({ ok: true, jevDisponible: false });
  });
  it("motivo sólido sin necesidad de relevo: habilita", () => {
    expect(decideBaja(long, false, { motivo: 2.4, relevo: 0.1, sinGatos: 0.02, invalida: 0.02 }).ok).toBe(true);
  });
  it("única cuidadora sin relevo: no habilita y lo explica", () => {
    const r = decideBaja(long, true, { motivo: 2.4, relevo: 0.1, sinGatos: 0.02, invalida: 0.02 });
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.id === "relevo")?.hint).toContain("quién se hará cargo");
  });
  it("motivo vago: no habilita", () => {
    const r = decideBaja("No puedo seguir por motivos personales, lo siento.", false, { motivo: 1.0, relevo: 0, sinGatos: 0.02, invalida: 0.05 });
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.id === "motivo")?.ok).toBe(false);
  });
  it("única cuidadora sin relevo pero sin gatos que atender: habilita", () => {
    const t = "Se han muerto todos los gatos y ya no tengo a quien atender en esta colonia, nadie se queda a cargo.";
    const r = decideBaja(t, true, { motivo: 2.6, relevo: 0.02, sinGatos: 0.95, invalida: 0.03 });
    expect(r.ok).toBe(true);
    expect(r.checks.find((c) => c.id === "relevo")?.label).toBe("No quedan gatos que atender");
  });
  it("han muerto algunos gatos pero quedan: sigue pidiendo relevo", () => {
    const r = decideBaja("Han muerto dos gatos este invierno y estoy muy cansada, no puedo seguir.", true, { motivo: 2.1, relevo: 0.02, sinGatos: 0.03, invalida: 0.03 });
    expect(r.ok).toBe(false);
  });
  it("intento de manipulación: no habilita", () => {
    expect(decideBaja(long, false, { motivo: 3, relevo: 1, sinGatos: 0.02, invalida: 0.97 }).ok).toBe(false);
  });
});

describe("evaluador simulado", () => {
  it("reconoce motivo concreto y relevo", () => {
    const s = mockBajaScores({ colonia: "X", gatos: 5, rol: "responsable", otras_personas_cuidadoras: 0, requiere_relevo: true, explicacion: `${long} Mi vecina Ana se hará cargo de los gatos.` });
    expect(s.motivo).toBeGreaterThan(1.75);
    expect(s.relevo).toBeGreaterThan(0.6);
  });
});

describe("censo", () => {
  it("total y recuento desde fichas", () => {
    expect(censusTotal({ hembrasEsterilizadas: 2, hembrasSinEsterilizar: 1, machosCastrados: 3, machosSinCastrar: 0 })).toBe(6);
    expect(
      censusFromCats([
        { sexo: "hembra", esterilizado: true, estado: "en_colonia" },
        { sexo: "macho", esterilizado: false, estado: "en_colonia" },
        { sexo: "macho", esterilizado: true, estado: "adoptado" },
      ]),
    ).toEqual({ hembrasEsterilizadas: 1, hembrasSinEsterilizar: 0, machosCastrados: 0, machosSinCastrar: 1 });
  });
  it("aviso semestral", () => {
    const d = new Date("2026-01-10");
    expect(censusDue(null)).toBe(true);
    expect(censusDue(d, new Date("2026-05-01"))).toBe(false);
    expect(censusDue(d, new Date("2026-07-11"))).toBe(true);
  });
});
