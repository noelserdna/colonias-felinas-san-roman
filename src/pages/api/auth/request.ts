import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db";
import { createMagicToken, isValidEmail, normalizeEmail } from "../../../lib/auth";
import { sendMagicLink } from "../../../lib/email";
import { getSettings } from "../../../lib/settings";

export const POST: APIRoute = async ({ request, url, clientAddress, redirect, locals }) => {
  const form = await request.formData();
  const email = normalizeEmail(String(form.get("email") ?? ""));
  const next = String(form.get("next") ?? "/");
  if (!isValidEmail(email)) return redirect(`/login?error=email`, 303);

  const { success } = (await env.LOGIN_LIMITER?.limit({ key: `${clientAddress}:${email}` })) ?? { success: true };
  if (!success) return redirect(`/login?error=rate`, 303);

  const db = getDb();
  const s = await getSettings(db);
  const token = await createMagicToken(db, email, s.magic_link_ttl_min);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const link = `${url.origin}/auth/verify?token=${encodeURIComponent(token)}&next=${encodeURIComponent(safeNext)}`;
  let mocked = false;
  try {
    mocked = await sendMagicLink(email, link, s.magic_link_ttl_min, locals.branding.ayuntamiento);
  } catch (e) {
    console.error(e);
    return redirect(`/login?error=send`, 303);
  }
  // Solo en desarrollo local con correo simulado se muestra el enlace en pantalla.
  if (mocked && import.meta.env.DEV) return redirect(`/login?sent=1&dev_link=${encodeURIComponent(link)}`, 303);
  return redirect(`/login?sent=1`, 303);
};
