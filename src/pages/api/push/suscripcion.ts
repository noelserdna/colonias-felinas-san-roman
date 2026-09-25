import type { APIRoute } from "astro";
import { z } from "zod";
import { getDb } from "../../../lib/db";
import { deleteSubscription, saveSubscription, vapidConfig } from "../../../lib/push";
import { subscriptionInput } from "../../../lib/push-endpoint";
import { json } from "../../../lib/util";

/** Guarda la suscripción push de este dispositivo para la persona con sesión. */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!vapidConfig()) return json({ error: "Las notificaciones no están configuradas" }, 503);
  const parsed = subscriptionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Suscripción no válida" }, 400);
  const { endpoint, keys } = parsed.data;
  await saveSubscription(getDb(), locals.user!.id, { endpoint, ...keys }, request.headers.get("user-agent"));
  return json({ ok: true });
};

/** Deja de enviar notificaciones a este dispositivo. */
export const DELETE: APIRoute = async ({ request, locals }) => {
  const parsed = z.object({ endpoint: z.string().max(1000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Petición no válida" }, 400);
  await deleteSubscription(getDb(), locals.user!.id, parsed.data.endpoint);
  return json({ ok: true });
};
