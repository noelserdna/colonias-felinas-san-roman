import type { JevResult } from "./jev";

export function isWrittenCorrect(r: Pick<JevResult, "score" | "flag">, passScore: number, flagThreshold: number): boolean {
  if (r.flag >= flagThreshold) return false;
  return r.score >= passScore;
}

/** Corrige una pregunta tipo test. `shownIndex` es la posición que marcó el alumno en pantalla. */
export function gradeMc(shownIndex: number | null | undefined, optionOrder: number[], correctIndex: number): { original: number | null; correct: boolean } {
  if (shownIndex == null || !Number.isInteger(shownIndex) || shownIndex < 0 || shownIndex >= optionOrder.length) {
    return { original: null, correct: false };
  }
  const original = optionOrder[shownIndex];
  return { original, correct: original === correctIndex };
}

export function computeScore(items: { isCorrect: boolean | null }[], passPct: number) {
  const total = items.length;
  const correct = items.filter((i) => i.isCorrect === true).length;
  const pct = total ? Math.round((correct / total) * 10000) / 100 : 0;
  return { correct, total, pct, passed: pct >= passPct };
}

/**
 * Corrige una pregunta de varias correctas. `shown` son las posiciones marcadas en pantalla.
 * Solo es correcta si se marcan exactamente todas las correctas y ninguna incorrecta.
 */
export function gradeMulti(
  shown: unknown,
  optionOrder: number[],
  correctIndexes: number[],
): { original: number[]; correct: boolean } {
  const picks = Array.isArray(shown) ? shown : [];
  const original = [
    ...new Set(
      picks
        .filter((x): x is number => Number.isInteger(x) && x >= 0 && x < optionOrder.length)
        .map((x) => optionOrder[x]),
    ),
  ].sort((a, b) => a - b);
  const want = [...new Set(correctIndexes)].sort((a, b) => a - b);
  const correct = original.length === want.length && original.every((v, i) => v === want[i]);
  return { original, correct };
}
