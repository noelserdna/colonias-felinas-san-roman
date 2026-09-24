import type { DB } from "./db";
import { getAttemptForUser, publicItem, reviewItems } from "./exam";
import { getActiveCarnet } from "./carnet";

export async function attemptView(db: DB, attemptId: string, userId: string) {
  const { attempt, items } = await getAttemptForUser(db, attemptId, userId);
  const meta = {
    id: attempt.id,
    kind: attempt.kind,
    unitId: attempt.unitId,
    status: attempt.status,
    passPct: attempt.passPct,
    scorePct: attempt.scorePct,
    correctCount: attempt.correctCount,
    totalCount: attempt.totalCount,
  };
  if (attempt.status === "in_progress") return { ...meta, items: items.map(publicItem) };
  if (attempt.status === "grading") return meta;
  // En los tests de tema se muestran las soluciones para repasar; en el final solo el desglose.
  const review = reviewItems(items, attempt.kind === "unit");
  const carnet = attempt.kind === "final" && attempt.status === "passed" ? await getActiveCarnet(db, userId) : null;
  return { ...meta, review, carnetNumero: carnet?.numero ?? null };
}
