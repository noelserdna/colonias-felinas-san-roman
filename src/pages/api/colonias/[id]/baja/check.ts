import type { APIRoute } from "astro";
import { z } from "zod";
import { getDb } from "../../../../../lib/db";
import { evaluateBaja } from "../../../../../lib/baja-service";
import { ColonyError } from "../../../../../lib/colonies";
import { json } from "../../../../../lib/util";

const input = z.object({ texto: z.string().max(4000) });

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const { texto } = input.parse(await request.json());
    const ev = await evaluateBaja(getDb(), params.id!, locals.user!.id, texto);
    // No se devuelven las puntuaciones en bruto al navegador: solo qué se cumple y qué falta.
    return json({ ok: ev.ok, checks: ev.checks, jevDisponible: ev.jevDisponible, requiereRelevo: ev.requiereRelevo });
  } catch (e) {
    if (e instanceof ColonyError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "No se ha podido comprobar la explicación. Inténtalo de nuevo en unos segundos." }, 503);
  }
};
