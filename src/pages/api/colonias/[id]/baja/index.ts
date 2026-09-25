import type { APIRoute } from "astro";
import { z } from "zod";
import { getDb } from "../../../../../lib/db";
import { evaluateBaja } from "../../../../../lib/baja-service";
import { ColonyError, leaveColony } from "../../../../../lib/colonies";
import { json } from "../../../../../lib/util";
import { notifyColony } from "../../../../../lib/notices";

const input = z.object({ texto: z.string().max(4000) });

export const POST: APIRoute = async ({ params, request, locals, url }) => {
  try {
    const { texto } = input.parse(await request.json());
    const db = getDb();
    // Se vuelve a evaluar en el servidor: no se confía en lo que diga el navegador.
    const ev = await evaluateBaja(db, params.id!, locals.user!.id, texto);
    if (!ev.ok) return json({ ok: false, checks: ev.checks, error: "La explicación todavía no cumple los requisitos." }, 422);
    const promoted = await leaveColony(db, params.id!, locals.user!.id, texto.trim(), {
      checks: ev.checks,
      scores: ev.scores ? { motivo: ev.scores.motivo, relevo: ev.scores.relevo, sinGatos: ev.scores.sinGatos, invalida: ev.scores.invalida, simulado: ev.scores.simulado ?? false } : null,
      gatosCenso: ev.gatosCenso ?? null,
      jevDisponible: ev.jevDisponible,
      requiereRelevo: ev.requiereRelevo,
    });
    // Si al irse pasa otra persona a ser la responsable, se le avisa.
    if (promoted) await notifyColony(db, { origin: url.origin, ayuntamiento: locals.branding.ayuntamiento }, params.id!, [promoted.id], "colonia_responsable");
    return json({ ok: true });
  } catch (e) {
    if (e instanceof ColonyError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: "No se ha podido tramitar la baja. Inténtalo de nuevo." }, 503);
  }
};
