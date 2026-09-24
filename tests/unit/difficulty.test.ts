import { describe, expect, it } from "vitest";
import { difficultyTargets, selectQuestions, type Candidate, type Difficulty } from "../../src/lib/selection";

function seeded(seed = 7) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}
const MIX = { baja: 50, media: 40, alta: 10 };
const count = (xs: Candidate[]) =>
  xs.reduce((a, c) => ((a[c.dificultad!] = (a[c.dificultad!] ?? 0) + 1), a), {} as Record<Difficulty, number>);

function bank(units: number, per: Record<Difficulty, number>): Candidate[] {
  const out: Candidate[] = [];
  let id = 1;
  for (let u = 1; u <= units; u++)
    for (const d of ["baja", "media", "alta"] as Difficulty[])
      for (let i = 0; i < per[d]; i++) out.push({ id: id++, unitId: u, lastSeen: null, dificultad: d });
  return out;
}

describe("difficultyTargets", () => {
  it("50/40/10 con los tamaños por defecto", () => {
    expect(difficultyTargets(10, MIX)).toEqual({ baja: 5, media: 4, alta: 1 });
    expect(difficultyTargets(15, MIX)).toEqual({ baja: 8, media: 6, alta: 1 });
    expect(difficultyTargets(5, MIX)).toEqual({ baja: 3, media: 2, alta: 0 });
  });
  it("los empates en el resto van hacia lo más fácil", () => {
    expect(difficultyTargets(2, { baja: 50, media: 0, alta: 50 })).toEqual({ baja: 1, media: 0, alta: 1 });
    expect(difficultyTargets(1, { baja: 50, media: 0, alta: 50 })).toEqual({ baja: 1, media: 0, alta: 0 });
  });
  it("suma siempre el total", () => {
    for (let n = 0; n <= 40; n++) {
      const t = difficultyTargets(n, { baja: 33, media: 33, alta: 34 });
      expect(t.baja + t.media + t.alta).toBe(n);
    }
  });
});

describe("selectQuestions con mezcla de dificultad", () => {
  it("test de tema: 5 baja, 4 media, 1 alta", () => {
    const b = bank(1, { baja: 10, media: 10, alta: 5 });
    for (let seed = 1; seed < 20; seed++) {
      const { picked } = selectQuestions(10, [{ unitId: 1, weight: 1 }], b, 0, seeded(seed), MIX);
      expect(count(picked)).toEqual({ baja: 5, media: 4, alta: 1 });
    }
  });

  it("examen final: mezcla global exacta y todos los temas representados", () => {
    const b = bank(8, { baja: 10, media: 10, alta: 5 });
    const pools = Array.from({ length: 8 }, (_, i) => ({ unitId: i + 1, weight: 1 }));
    for (let seed = 1; seed < 20; seed++) {
      const { picked } = selectQuestions(15, pools, b, 1, seeded(seed), MIX);
      expect(picked).toHaveLength(15);
      expect(count(picked)).toEqual({ baja: 8, media: 6, alta: 1 });
      expect(new Set(picked.map((p) => p.unitId)).size).toBe(8);
    }
  });

  it("si falta un nivel, completa con otro sin quedarse corto", () => {
    const b = bank(1, { baja: 2, media: 10, alta: 5 });
    const { picked, shortfall } = selectQuestions(10, [{ unitId: 1, weight: 1 }], b, 0, seeded(), MIX);
    expect(picked).toHaveLength(10);
    expect(shortfall).toBe(0);
    expect(count(picked).baja).toBe(2);
    // El déficit de baja se cubre sobre todo con media, no disparando las altas.
    expect(count(picked).alta).toBeLessThanOrEqual(2);
  });

  it("alta = 0 % no incluye preguntas altas si hay alternativas", () => {
    const b = bank(1, { baja: 10, media: 10, alta: 5 });
    const { picked } = selectQuestions(10, [{ unitId: 1, weight: 1 }], b, 0, seeded(), { baja: 60, media: 40, alta: 0 });
    expect(count(picked).alta ?? 0).toBe(0);
  });
});
