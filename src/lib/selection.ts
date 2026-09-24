import { shuffle } from "./util";

export type UnitPool = { unitId: number; weight: number; available: number };
export type Difficulty = "baja" | "media" | "alta";
export type Candidate = { id: number; unitId: number; lastSeen: number | null; dificultad?: Difficulty };
export type DifficultyMix = Record<Difficulty, number>;

// Orden de preferencia al repartir restos o desempatar: primero lo más fácil.
const DIFF_ORDER: Difficulty[] = ["baja", "media", "alta"];

/** Número de preguntas de cada dificultad para un total dado (resto mayor; empates hacia lo más fácil). */
export function difficultyTargets(total: number, mix: DifficultyMix): Record<Difficulty, number> {
  const sum = DIFF_ORDER.reduce((a, d) => a + Math.max(0, mix[d]), 0) || 1;
  const exact = DIFF_ORDER.map((d) => ({ d, x: (total * Math.max(0, mix[d])) / sum }));
  const out = { baja: 0, media: 0, alta: 0 } as Record<Difficulty, number>;
  for (const e of exact) out[e.d] = Math.floor(e.x);
  let left = total - DIFF_ORDER.reduce((a, d) => a + out[d], 0);
  const byFrac = [...exact].sort((a, b) => b.x - Math.floor(b.x) - (a.x - Math.floor(a.x)) || DIFF_ORDER.indexOf(a.d) - DIFF_ORDER.indexOf(b.d));
  for (const e of byFrac) {
    if (left === 0) break;
    out[e.d]++;
    left--;
  }
  return out;
}

export type Allocation = { perUnit: Map<number, number>; shortfall: number };

/**
 * Reparte `total` preguntas entre temas proporcionalmente a su peso (método de resto mayor),
 * garantizando `minPerUnit` a cada tema con peso > 0 y sin superar las preguntas disponibles.
 * Si el banco no llega, `shortfall` indica cuántas faltan.
 */
export function allocate(total: number, pools: UnitPool[], minPerUnit = 1): Allocation {
  const perUnit = new Map<number, number>(pools.map((p) => [p.unitId, 0]));
  const eligible = pools.filter((p) => p.weight > 0 && p.available > 0);
  let remaining = total;

  // 1) Mínimo por tema, empezando por los de más peso si no alcanza para todos.
  const byWeight = [...eligible].sort((a, b) => b.weight - a.weight || a.unitId - b.unitId);
  for (let round = 0; round < minPerUnit; round++) {
    for (const p of byWeight) {
      if (remaining === 0) break;
      if (perUnit.get(p.unitId)! < p.available) {
        perUnit.set(p.unitId, perUnit.get(p.unitId)! + 1);
        remaining--;
      }
    }
  }

  // 2) Resto proporcional al peso, redistribuyendo si algún tema se queda sin preguntas.
  while (remaining > 0) {
    const open = eligible.filter((p) => perUnit.get(p.unitId)! < p.available);
    if (open.length === 0) break;
    const wSum = open.reduce((s, p) => s + p.weight, 0);
    const quotas = open.map((p) => {
      const exact = (remaining * p.weight) / wSum;
      const cap = p.available - perUnit.get(p.unitId)!;
      return { p, base: Math.min(Math.floor(exact), cap), frac: exact - Math.floor(exact), cap };
    });
    let assigned = 0;
    for (const q of quotas) {
      perUnit.set(q.p.unitId, perUnit.get(q.p.unitId)! + q.base);
      assigned += q.base;
    }
    let left = remaining - assigned;
    const byFrac = quotas
      .filter((q) => q.base < q.cap)
      .sort((a, b) => b.frac - a.frac || b.p.weight - a.p.weight || a.p.unitId - b.p.unitId);
    for (const q of byFrac) {
      if (left === 0) break;
      perUnit.set(q.p.unitId, perUnit.get(q.p.unitId)! + 1);
      left--;
    }
    if (left === remaining) break; // sin progreso
    remaining = left;
  }

  return { perUnit, shortfall: remaining };
}

/**
 * Elige `n` preguntas priorizando las que el usuario no ha visto nunca y después
 * las vistas hace más tiempo. Los empates se deshacen al azar.
 */
export function pickLeastRecent(candidates: Candidate[], n: number, rand: () => number = Math.random): Candidate[] {
  const shuffled = shuffle(candidates, rand);
  shuffled.sort((a, b) => (a.lastSeen ?? -Infinity) - (b.lastSeen ?? -Infinity));
  return shuffled.slice(0, n);
}

/**
 * Selección completa: reparte por tema y, dentro de ese reparto, ajusta la mezcla de dificultades
 * lo más cerca posible de `mix` para el conjunto del test. Devuelve en orden aleatorio.
 */
export function selectQuestions(
  total: number,
  pools: { unitId: number; weight: number }[],
  candidates: Candidate[],
  minPerUnit: number,
  rand: () => number = Math.random,
  mix?: DifficultyMix,
): { picked: Candidate[]; shortfall: number } {
  const byUnit = new Map<number, Candidate[]>();
  for (const c of candidates) {
    if (!byUnit.has(c.unitId)) byUnit.set(c.unitId, []);
    byUnit.get(c.unitId)!.push(c);
  }
  const alloc = allocate(
    total,
    pools.map((p) => ({ ...p, available: byUnit.get(p.unitId)?.length ?? 0 })),
    minPerUnit,
  );

  if (!mix) {
    const picked: Candidate[] = [];
    for (const [unitId, n] of alloc.perUnit) {
      if (n > 0) picked.push(...pickLeastRecent(byUnit.get(unitId) ?? [], n, rand));
    }
    return { picked: shuffle(picked, rand), shortfall: alloc.shortfall };
  }

  // Huecos por tema, en orden aleatorio; a cada hueco se le asigna la dificultad con más déficit
  // respecto al objetivo global de entre las que ese tema todavía tiene disponibles.
  const assignedTotal = total - alloc.shortfall;
  const target = difficultyTargets(assignedTotal, mix);
  const got: Record<Difficulty, number> = { baja: 0, media: 0, alta: 0 };
  const remaining = new Map<number, Map<Difficulty, Candidate[]>>();
  for (const [unitId, list] of byUnit) {
    const m = new Map<Difficulty, Candidate[]>(DIFF_ORDER.map((d) => [d, []]));
    for (const c of list) m.get(c.dificultad ?? "media")!.push(c);
    remaining.set(unitId, m);
  }
  const slots = shuffle(
    [...alloc.perUnit].flatMap(([unitId, n]) => Array.from({ length: n }, () => unitId)),
    rand,
  );
  const plan = new Map<string, number>(); // "unit|dif" → cuántas
  for (const unitId of slots) {
    const m = remaining.get(unitId)!;
    const options = DIFF_ORDER.filter((d) => m.get(d)!.length - (plan.get(`${unitId}|${d}`) ?? 0) > 0);
    options.sort((a, b) => target[b] - got[b] - (target[a] - got[a]) || DIFF_ORDER.indexOf(a) - DIFF_ORDER.indexOf(b));
    const d = options[0];
    got[d]++;
    plan.set(`${unitId}|${d}`, (plan.get(`${unitId}|${d}`) ?? 0) + 1);
  }
  const picked: Candidate[] = [];
  for (const [key, n] of plan) {
    const [unitId, d] = key.split("|");
    picked.push(...pickLeastRecent(remaining.get(Number(unitId))!.get(d as Difficulty)!, n, rand));
  }
  return { picked: shuffle(picked, rand), shortfall: alloc.shortfall };
}

/**
 * Intercala las preguntas escritas entre las de tipo test: divide el examen en tantos tramos como
 * escritas y coloca una en una posición aleatoria de cada tramo. La primera pregunta es siempre de
 * tipo test y, si hay espacio suficiente, nunca quedan dos escritas seguidas.
 */
export function interleave<T>(mc: T[], written: T[], rand: () => number = Math.random): T[] {
  if (written.length === 0) return [...mc];
  if (mc.length === 0) return [...written];
  const n = mc.length + written.length;
  const seg = n / written.length;
  const positions = new Set<number>();
  for (let k = 0; k < written.length; k++) {
    let start = Math.floor(k * seg);
    let end = Math.floor((k + 1) * seg) - 1;
    if (k === 0) start = Math.max(start, 1); // empezar siempre con una de tipo test
    // Sin tocar el final del tramo, para que no quede pegada a la escrita del tramo siguiente.
    if (end - start >= 2 && k < written.length - 1) end -= 1;
    end = Math.max(end, start);
    let pos = start + Math.floor(rand() * (end - start + 1));
    while (positions.has(pos)) pos++;
    positions.add(pos);
  }
  const out: T[] = [];
  let i = 0;
  let j = 0;
  for (let p = 0; p < n; p++) out.push(positions.has(p) && j < written.length ? written[j++] : mc[i++] ?? written[j++]);
  return out;
}
