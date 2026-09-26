import { describe, expect, it } from "vitest";
import { computeScore, gradeMc, isWrittenCorrect } from "../../src/lib/grading";

describe("gradeMc", () => {
  it("traduce la posición mostrada al índice original", () => {
    // Se mostró [C, A, D, B]; la correcta original es A (0).
    const order = [2, 0, 3, 1];
    expect(gradeMc(1, order, 0)).toEqual({ original: 0, correct: true });
    expect(gradeMc(0, order, 0)).toEqual({ original: 2, correct: false });
  });
  it("respuestas vacías o fuera de rango son incorrectas", () => {
    expect(gradeMc(null, [0, 1], 0).correct).toBe(false);
    expect(gradeMc(5, [0, 1], 0).correct).toBe(false);
    expect(gradeMc(-1, [0, 1], 0).correct).toBe(false);
    expect(gradeMc(1.5, [0, 1], 0).correct).toBe(false);
  });
});

describe("isWrittenCorrect", () => {
  it("aplica el umbral de puntuación", () => {
    expect(isWrittenCorrect({ score: 2.85, flag: 0.03 }, 2, 0.7)).toBe(true);
    expect(isWrittenCorrect({ score: 1.01, flag: 0.05 }, 2, 0.7)).toBe(false);
    expect(isWrittenCorrect({ score: 2, flag: 0 }, 2, 0.7)).toBe(true);
  });
  it("anula la respuesta si JEV detecta manipulación", () => {
    expect(isWrittenCorrect({ score: 3, flag: 0.98 }, 2, 0.7)).toBe(false);
  });
});

describe("computeScore", () => {
  const items = (n: number, ok: number) => Array.from({ length: n }, (_, i) => ({ isCorrect: i < ok }));
  it("14/20 = 70% aprueba con 70%", () => {
    expect(computeScore(items(20, 14), 70)).toEqual({ correct: 14, total: 20, pct: 70, passed: true });
  });
  it("13/20 suspende", () => {
    expect(computeScore(items(20, 13), 70).passed).toBe(false);
  });
  it("7/10 aprueba y null cuenta como fallo", () => {
    expect(computeScore([...items(7, 7), { isCorrect: null }, ...items(2, 0)], 70).passed).toBe(true);
  });
});

import { gradeMulti } from "../../src/lib/grading";

describe("gradeMulti", () => {
  // Se mostró [D, A, C, B, E]; correctas originales A (0) y C (2) → posiciones mostradas 1 y 2.
  const order = [3, 0, 2, 1, 4];
  it("exactamente las correctas", () => {
    expect(gradeMulti([2, 1], order, [0, 2])).toEqual({ original: [0, 2], correct: true });
  });
  it("falta una o sobra una → incorrecta", () => {
    expect(gradeMulti([1], order, [0, 2]).correct).toBe(false);
    expect(gradeMulti([1, 2, 0], order, [0, 2]).correct).toBe(false);
  });
  it("marcarlo todo o nada → incorrecta", () => {
    expect(gradeMulti([0, 1, 2, 3, 4], order, [0, 2]).correct).toBe(false);
    expect(gradeMulti([], order, [0, 2]).correct).toBe(false);
    expect(gradeMulti(null, order, [0, 2]).correct).toBe(false);
  });
  it("ignora valores inválidos y duplicados", () => {
    expect(gradeMulti([1, 1, 2, 99, -1, "x"], order, [0, 2])).toEqual({ original: [0, 2], correct: true });
  });
});

import { DEFAULT_SETTINGS, finalComposition } from "../../src/lib/settings";

describe("finalComposition", () => {
  it("con JEV: 15 test + 5 escritas", () => {
    expect(finalComposition(DEFAULT_SETTINGS, true)).toEqual({ objective: 15, written: 5, jevAvailable: true });
  });
  it("sin JEV: las escritas se sustituyen por tipo test (mismo total)", () => {
    expect(finalComposition(DEFAULT_SETTINGS, false)).toEqual({ objective: 20, written: 0, jevAvailable: false });
  });
});
