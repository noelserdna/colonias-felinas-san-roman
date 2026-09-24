import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";
import { destroySession } from "../../../lib/auth";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  await destroySession(getDb(), cookies);
  return redirect("/login", 303);
};
