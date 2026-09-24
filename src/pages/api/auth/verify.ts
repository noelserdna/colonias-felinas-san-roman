import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";
import { consumeMagicToken, createSession, findOrCreateUser } from "../../../lib/auth";

export const POST: APIRoute = async ({ request, cookies, url, redirect }) => {
  const form = await request.formData();
  const token = String(form.get("token") ?? "");
  const next = String(form.get("next") ?? "/");
  const db = getDb();
  const email = token ? await consumeMagicToken(db, token) : null;
  if (!email) return redirect("/login?error=token", 303);
  const userId = await findOrCreateUser(db, email);
  await createSession(db, userId, cookies, url.protocol === "https:");
  return redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/", 303);
};
