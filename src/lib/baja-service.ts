import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import type { DB } from "./db";
import { schema } from "./db";
import { ColonyError, relevoRequerido } from "./colonies";
import { decideBaja, scoreBaja, type BajaEvaluation } from "./baja";
import { getJevApiKey } from "./secrets";

/** Evalúa la explicación de baja de una persona en una colonia (con JEV si está disponible). */
export async function evaluateBaja(db: DB, colonyId: string, userId: string, texto: string): Promise<BajaEvaluation & { requiereRelevo: boolean; gatosCenso?: number }> {
  const colony = await db.query.colonies.findFirst({ where: eq(schema.colonies.id, colonyId) });
  if (!colony) throw new ColonyError("Colonia no encontrada", 404);
  const member = await db.query.colonyMembers.findFirst({
    where: (m, { and, eq, isNull }) => and(eq(m.colonyId, colonyId), eq(m.userId, userId), isNull(m.until)),
  });
  if (!member) throw new ColonyError("No colaboras en esta colonia.", 403);
  const { requerido, otros } = await relevoRequerido(db, colonyId, userId);
  const last = await db.query.colonyCensuses.findFirst({ where: eq(schema.colonyCensuses.colonyId, colonyId), orderBy: (c, { desc }) => desc(c.fecha) });
  const gatos = last ? last.hembrasEsterilizadas + last.hembrasSinEsterilizar + last.machosCastrados + last.machosSinCastrar : 0;
  // Con el último censo a 0 no queda nadie a quien atender: no hace falta dejar relevo.
  const requiereRelevo = requerido && !(last && gatos === 0);
  const text = texto.slice(0, 4000);
  const base = decideBaja(text, requiereRelevo, null);
  if (!base.ok) return { ...base, jevDisponible: true, requiereRelevo }; // demasiado corta: no se gasta una llamada a JEV
  const { key } = await getJevApiKey(db);
  const scores = await scoreBaja(
    { colonia: colony.nombre, gatos, rol: member.rol, otras_personas_cuidadoras: otros, requiere_relevo: requiereRelevo, explicacion: text },
    { apiKey: key, mock: env.JEV_MOCK === "1" },
  );
  return { ...decideBaja(text, requiereRelevo, scores), requiereRelevo, gatosCenso: gatos };
}
