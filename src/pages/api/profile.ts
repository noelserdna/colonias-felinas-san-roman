import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../../lib/db";

const input = z.object({
  nombre: z.string().trim().min(1).max(80),
  apellidos: z.string().trim().min(1).max(120),
  consent: z.literal("on"),
});

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = Object.fromEntries(await request.formData());
  const parsed = input.safeParse(form);
  if (!parsed.success) return redirect("/perfil?error=1", 303);
  const db = getDb();
  await db
    .update(schema.users)
    .set({ nombre: parsed.data.nombre, apellidos: parsed.data.apellidos, consentAt: locals.user!.consentAt ?? new Date() })
    .where(eq(schema.users.id, locals.user!.id));
  return redirect("/perfil?ok=1", 303);
};
