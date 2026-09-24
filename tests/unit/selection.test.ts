import { describe, expect, it } from "vitest";
import { allocate, pickLeastRecent, selectQuestions, type Candidate } from "../../src/lib/selection";

function seeded(seed = 42) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}

const sum = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("allocate", () => {
  it("reparte por igual con pesos iguales (resto mayor)", () => {
    const pools = Array.from({ length: 8 }, (_, i) => ({ unitId: i + 1, weight: 1, available: 30 }));
    const a = allocate(15, pools, 1);
    expect(sum(a.perUnit)).toBe(15);
    expect(a.shortfall).toBe(0);
    for (const n of a.perUnit.values()) expect(n === 1 || n === 2 || n === 3).toBe(true);
    expect(Math.max(...a.perUnit.values()) - Math.min(...a.perUnit.values())).toBeLessThanOrEqual(1);
  });

  it("respeta los pesos", () => {
    const a = allocate(20, [
      { unitId: 1, weight: 3, available: 50 },
      { unitId: 2, weight: 1, available: 50 },
    ], 0);
    expect(a.perUnit.get(1)).toBe(15);
    expect(a.perUnit.get(2)).toBe(5);
  });

  it("garantiza el mínimo por tema aunque el peso sea bajo", () => {
    const a = allocate(10, [
      { unitId: 1, weight: 100, available: 50 },
      { unitId: 2, weight: 1, available: 50 },
      { unitId: 3, weight: 1, available: 50 },
    ], 1);
    expect(a.perUnit.get(2)).toBeGreaterThanOrEqual(1);
    expect(a.perUnit.get(3)).toBeGreaterThanOrEqual(1);
    expect(sum(a.perUnit)).toBe(10);
  });

  it("peso 0 excluye el tema", () => {
    const a = allocate(5, [
      { unitId: 1, weight: 0, available: 50 },
      { unitId: 2, weight: 1, available: 50 },
    ], 1);
    expect(a.perUnit.get(1)).toBe(0);
    expect(a.perUnit.get(2)).toBe(5);
  });

  it("redistribuye cuando un tema no tiene suficientes preguntas", () => {
    const a = allocate(10, [
      { unitId: 1, weight: 1, available: 2 },
      { unitId: 2, weight: 1, available: 50 },
    ], 1);
    expect(a.perUnit.get(1)).toBe(2);
    expect(a.perUnit.get(2)).toBe(8);
    expect(a.shortfall).toBe(0);
  });

  it("informa de la falta de preguntas", () => {
    const a = allocate(10, [
      { unitId: 1, weight: 1, available: 3 },
      { unitId: 2, weight: 1, available: 4 },
    ], 1);
    expect(sum(a.perUnit)).toBe(7);
    expect(a.shortfall).toBe(3);
  });

  it("si el total es menor que el número de temas, prioriza los de más peso", () => {
    const a = allocate(2, [
      { unitId: 1, weight: 1, available: 5 },
      { unitId: 2, weight: 5, available: 5 },
      { unitId: 3, weight: 3, available: 5 },
    ], 1);
    expect(a.perUnit.get(2)).toBe(1);
    expect(a.perUnit.get(3)).toBe(1);
    expect(a.perUnit.get(1)).toBe(0);
  });
});

describe("pickLeastRecent", () => {
  it("prioriza las no vistas y luego las más antiguas", () => {
    const c: Candidate[] = [
      { id: 1, unitId: 1, lastSeen: 300 },
      { id: 2, unitId: 1, lastSeen: null },
      { id: 3, unitId: 1, lastSeen: 100 },
      { id: 4, unitId: 1, lastSeen: null },
      { id: 5, unitId: 1, lastSeen: 200 },
    ];
    const picked = pickLeastRecent(c, 3, seeded()).map((x) => x.id);
    expect(picked.slice(0, 2).sort()).toEqual([2, 4]);
    expect(picked[2]).toBe(3);
  });

  it("rota: dos intentos seguidos no repiten si hay preguntas suficientes", () => {
    const bank: Candidate[] = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, unitId: 1, lastSeen: null }));
    const first = pickLeastRecent(bank, 10, seeded(1)).map((x) => x.id);
    const seen = bank.map((q) => ({ ...q, lastSeen: first.includes(q.id) ? 1000 : null }));
    const second = pickLeastRecent(seen, 10, seeded(2)).map((x) => x.id);
    expect(second.filter((id) => first.includes(id))).toEqual([]);
  });
});

describe("selectQuestions", () => {
  it("devuelve el total pedido sin duplicados", () => {
    const cands: Candidate[] = [];
    for (let u = 1; u <= 8; u++) for (let i = 0; i < 25; i++) cands.push({ id: u * 100 + i, unitId: u, lastSeen: null });
    const pools = Array.from({ length: 8 }, (_, i) => ({ unitId: i + 1, weight: 1 }));
    const { picked, shortfall } = selectQuestions(15, pools, cands, 1, seeded());
    expect(picked).toHaveLength(15);
    expect(new Set(picked.map((p) => p.id)).size).toBe(15);
    expect(new Set(picked.map((p) => p.unitId)).size).toBe(8);
    expect(shortfall).toBe(0);
  });
});
