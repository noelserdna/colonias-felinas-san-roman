import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";
import { markNoticesRead } from "../../../lib/notices";

/** Marca un aviso como leído y vuelve a la página de origen (solo rutas de esta web). */
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const f = await request.formData();
  const id = String(f.get("id") ?? "");
  const next = String(f.get("next") ?? "/");
  if (id) await markNoticesRead(getDb(), locals.user!.id, { id });
  return redirect(/^\/(?!\/)/.test(next) ? next : "/", 303);
};
