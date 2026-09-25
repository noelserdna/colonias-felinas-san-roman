import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db";
import { isDemo } from "../../../lib/demo";
import { createSession, destroySession } from "../../../lib/auth";
import { createPersona } from "../../../lib/demo-data";
import { PERSONAS, PERSONA_KEYS, type PersonaKey } from "../../../lib/demo-personas";

/** Entra en la demo con una copia nueva del perfil elegido (sin correo). */
export const POST: APIRoute = async ({ request, cookies, url, redirect, locals, clientAddress }) => {
  if (!isDemo()) return new Response("No encontrado", { status: 404 });
  const f = await request.formData();
  const key = String(f.get("persona") ?? "") as PersonaKey;
  if (!PERSONA_KEYS.includes(key)) return redirect("/demo", 303);
  const { success } = (await env.LOGIN_LIMITER?.limit({ key: `demo:${clientAddress ?? "?"}` })) ?? { success: true };
  if (!success) return redirect("/demo?espera=1", 303);
  const db = getDb();
  await destroySession(db, cookies);
  try {
    const userId = await createPersona(db, key, { origin: url.origin, ayuntamiento: locals.branding.ayuntamiento });
    await createSession(db, userId, cookies, url.protocol === "https:");
  } catch (e) {
    console.error("Demo: no se ha podido crear el perfil", e);
    return redirect("/demo?error=1", 303);
  }
  return redirect(PERSONAS[key].inicio, 303);
};
