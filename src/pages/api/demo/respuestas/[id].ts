import type { APIRoute } from "astro";
import { getDb } from "../../../../lib/db";
import { isDemo } from "../../../../lib/demo";
import { getAttemptForUser } from "../../../../lib/exam";
import { exampleAnswers } from "../../../../lib/demo-personas";
import { json } from "../../../../lib/util";

/** Atajo de la demo: respuestas de ejemplo para un intento en curso de la persona (casi todas bien). */
export const GET: APIRoute = async ({ params, locals }) => {
  if (!isDemo()) return json({ error: "No encontrado" }, 404);
  try {
    const { attempt, items } = await getAttemptForUser(getDb(), params.id!, locals.user!.id);
    if (attempt.status !== "in_progress") return json({ error: "Este intento ya se ha enviado" }, 409);
    return json({ answers: exampleAnswers(items) });
  } catch {
    return json({ error: "Intento no encontrado" }, 404);
  }
};
