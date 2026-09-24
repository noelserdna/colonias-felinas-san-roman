import type { APIRoute } from "astro";
import { z } from "zod";
import { getDb } from "../../../../lib/db";
import { submitAttempt } from "../../../../lib/exam";
import { handleErrors } from "../../../../lib/api";
import { attemptView } from "../../../../lib/attempt-view";
import { json } from "../../../../lib/util";

const input = z.object({ answers: z.record(z.string(), z.union([z.number(), z.string(), z.array(z.number()).max(20), z.null()])) });

export const POST: APIRoute = ({ params, request, locals }) =>
  handleErrors(async () => {
    const { answers } = input.parse(await request.json());
    const db = getDb();
    await submitAttempt(db, params.id!, locals.user!.id, answers);
    return json(await attemptView(db, params.id!, locals.user!.id));
  });
