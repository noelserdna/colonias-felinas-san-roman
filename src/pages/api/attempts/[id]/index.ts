import type { APIRoute } from "astro";
import { getDb } from "../../../../lib/db";
import { handleErrors } from "../../../../lib/api";
import { attemptView } from "../../../../lib/attempt-view";
import { json } from "../../../../lib/util";

export const GET: APIRoute = ({ params, locals }) =>
  handleErrors(async () => json(await attemptView(getDb(), params.id!, locals.user!.id)));
