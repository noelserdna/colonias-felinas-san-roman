import { describe, expect, it } from "vitest";
import { interleave } from "../../src/lib/selection";

function seeded(seed = 3) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}
const mcs = (n: number) => Array.from({ length: n }, (_, i) => `m${i}`);
const wrs = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`);
const isW = (x: string) => x.startsWith("w");

describe("interleave", () => {
  it("15 test + 5 escritas: una escrita por cada tramo de 4, ninguna primera ni dos seguidas", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const out = interleave(mcs(15), wrs(5), seeded(seed));
      expect(out).toHaveLength(20);
      expect(new Set(out).size).toBe(20);
      expect(isW(out[0])).toBe(false);
      for (let k = 0; k < 5; k++) expect(out.slice(k * 4, k * 4 + 4).filter(isW)).toHaveLength(1);
      for (let p = 1; p < 20; p++) expect(isW(out[p - 1]) && isW(out[p])).toBe(false);
      // Se conserva el orden relativo de cada grupo.
      expect(out.filter(isW)).toEqual(wrs(5));
    }
  });

  it("varía las posiciones entre exámenes", () => {
    const layouts = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) layouts.add(interleave(mcs(15), wrs(5), seeded(seed)).map((x) => (isW(x) ? "W" : "m")).join(""));
    expect(layouts.size).toBeGreaterThan(10);
  });

  it("casos límite", () => {
    expect(interleave(mcs(3), [])).toEqual(mcs(3));
    expect(interleave([], wrs(2))).toEqual(wrs(2));
    for (let seed = 1; seed <= 100; seed++) {
      const out = interleave(mcs(2), wrs(3), seeded(seed));
      expect(out).toHaveLength(5);
      expect(new Set(out).size).toBe(5);
      expect(isW(out[0])).toBe(false);
    }
    for (let seed = 1; seed <= 100; seed++) {
      const out = interleave(mcs(10), wrs(10), seeded(seed));
      expect(out).toHaveLength(20);
      expect(new Set(out).size).toBe(20);
    }
  });
});
