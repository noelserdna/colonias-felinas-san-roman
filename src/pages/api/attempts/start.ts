import type { APIRoute } from "astro";
import { z } from "zod";
import { getDb } from "../../../lib/db";
import { startFinalExam, startUnitQuiz } from "../../../lib/exam";
import { handleErrors } from "../../../lib/api";
import { json } from "../../../lib/util";

const input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unit"), unitId: z.number().int() }),
  z.object({ kind: z.literal("final") }),
]);

export const POST: APIRoute = ({ request, locals }) =>
  handleErrors(async () => {
    const body = input.parse(await request.json());
    const db = getDb();
    const user = locals.user!;
    const attemptId = body.kind === "unit" ? await startUnitQuiz(db, user.id, body.unitId) : await startFinalExam(db, user);
    return json({ attemptId });
  });
