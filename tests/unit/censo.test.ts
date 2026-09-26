import { describe, expect, it } from "vitest";
import { censusBalance, censusDue, censusInput, censusMovementsFromCats, censusPeriodStart, hasMovements, validateCensus } from "../../src/lib/colonies";

const base = { hembrasEsterilizadas: 3, hembrasSinEsterilizar: 2, machosCastrados: 1, machosSinCastrar: 1, adoptables: 0, enfermos: 0 };
const censo = (x: Record<string, unknown> = {}) => censusInput.parse({ ...base, ...x });
const ceros = Object.fromEntries(["nacidos", "nuevos", "fallecidos", "adoptados", "devueltos", "otrasSalidas"].flatMap((m) => [[`${m}Hembras`, 0], [`${m}Machos`, 0]]));

describe("cuándo toca el censo", () => {
  it("cada N meses desde el último", () => {
    const d = new Date(2026, 0, 10);
    expect(censusDue(null)).toBe(true);
    expect(censusDue(d, new Date(2026, 4, 1), { meses: 6, alineado: false })).toBe(false);
    expect(censusDue(d, new Date(2026, 6, 11), { meses: 6, alineado: false })).toBe(true);
    expect(censusDue(d, new Date(2026, 3, 11), { meses: 3, alineado: false })).toBe(true);
  });

  it("por periodos naturales: al empezar cada semestre", () => {
    const p = { meses: 6, alineado: true };
    expect(censusDue(new Date(2026, 5, 30), new Date(2026, 6, 1), p)).toBe(true); // 30 de junio → 1 de julio
    expect(censusDue(new Date(2026, 6, 1), new Date(2026, 11, 31), p)).toBe(false);
    expect(censusDue(new Date(2026, 1, 1), new Date(2026, 5, 29), p)).toBe(false);
    expect(censusDue(new Date(2025, 11, 20), new Date(2026, 0, 2), p)).toBe(true);
  });

  it("inicio del periodo en curso", () => {
    expect(censusPeriodStart(new Date(2026, 8, 26), 6)).toEqual(new Date(2026, 6, 1));
    expect(censusPeriodStart(new Date(2026, 2, 5), 3)).toEqual(new Date(2026, 0, 1));
    expect(censusPeriodStart(new Date(2026, 2, 5), 12)).toEqual(new Date(2026, 0, 1));
  });
});

describe("movimientos del censo", () => {
  it("vacíos = no declarados", () => {
    const c = censo({ nacidosHembras: "", fallecidosMachos: "2" });
    expect(c.nacidosHembras).toBeNull();
    expect(c.fallecidosMachos).toBe(2);
    expect(c.nuevosMachos).toBeNull();
    expect(hasMovements(c)).toBe(true);
    expect(hasMovements(censo())).toBe(false);
    expect(censusInput.safeParse({ ...base, nacidosHembras: -1 }).success).toBe(false);
  });

  it("cuadre por sexo: anterior + entradas − salidas", () => {
    const b = censusBalance(base, censo({ hembrasEsterilizadas: 4, nacidosHembras: 2, adoptadosHembras: 1, machosSinCastrar: 0, fallecidosMachos: 1 }));
    expect(b.hembras).toMatchObject({ antes: 5, entradas: 2, salidas: 1, esperado: 6, ahora: 6, cuadra: true });
    expect(b.machos).toMatchObject({ antes: 2, salidas: 1, esperado: 1, ahora: 1, cuadra: true });
  });

  it("un descuadre es un aviso, no un error", () => {
    const v = validateCensus(censo({ ...ceros, hembrasEsterilizadas: 5 }), base, "obligatorio");
    expect(v.errores).toEqual([]);
    expect(v.avisos).toHaveLength(1);
    expect(v.avisos[0]).toMatch(/hembras no cuadran.*tenía 5.*deberían ser 5.*has contado 7/);
  });

  it("obligatorios: faltan movimientos → error; con 0 y cuadrando → nada", () => {
    expect(validateCensus(censo(), base, "obligatorio").errores).toHaveLength(1);
    expect(validateCensus(censo(ceros), base, "obligatorio")).toEqual({ errores: [], avisos: [] });
  });

  it("opcionales sin declarar, sin censo anterior o sin movimientos en el municipio: no se comprueba el cuadre", () => {
    const distinto = censo({ hembrasEsterilizadas: 9 });
    expect(validateCensus(distinto, base, "opcional")).toEqual({ errores: [], avisos: [] });
    expect(validateCensus(censo({ ...ceros, hembrasEsterilizadas: 9 }), null, "obligatorio")).toEqual({ errores: [], avisos: [] });
    expect(validateCensus(censo({ ...ceros, hembrasEsterilizadas: 9 }), base, "no")).toEqual({ errores: [], avisos: [] });
  });

  it("adoptables o enfermos por encima del total → error", () => {
    expect(validateCensus(censo({ adoptables: 50 }), null, "no").errores).toHaveLength(1);
  });
});

describe("movimientos a partir de las fichas", () => {
  const desde = new Date(2026, 0, 1);
  const antes = new Date(2025, 5, 1);
  const despues = new Date(2026, 2, 1);
  it("fichas nuevas como entradas y cambios de situación posteriores como salidas", () => {
    const m = censusMovementsFromCats(
      [
        { sexo: "hembra", estado: "en_colonia", edad: "Cachorra", createdAt: despues, estadoDesde: despues },
        { sexo: "macho", estado: "en_colonia", edad: "2 años", createdAt: despues, estadoDesde: despues },
        { sexo: "hembra", estado: "adoptado", createdAt: antes, estadoDesde: despues },
        { sexo: "macho", estado: "devuelto", createdAt: antes, estadoDesde: despues },
        { sexo: "macho", estado: "desaparecido", createdAt: antes, estadoDesde: despues },
        { sexo: "hembra", estado: "fallecido", createdAt: antes, estadoDesde: antes }, // ya no estaba en el censo anterior
        { sexo: "desconocido", estado: "en_colonia", createdAt: despues, estadoDesde: despues },
        { sexo: "hembra", estado: "adoptado", createdAt: despues, estadoDesde: despues }, // llegó y se fue
      ],
      desde,
    );
    expect(m).toMatchObject({ nacidosHembras: 1, nuevosMachos: 1, adoptadosHembras: 1, devueltosMachos: 1, otrasSalidasMachos: 1, fallecidosHembras: 0, nuevosHembras: 0 });
  });
});
