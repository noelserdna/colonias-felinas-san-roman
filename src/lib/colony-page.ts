import type { APIContext, AstroGlobal } from "astro";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { assertCanManage, ColonyError } from "./colonies";

/** Carga la colonia de la URL comprobando que la persona la cuida (o es del ayuntamiento). Sirve en páginas y endpoints. */
export async function loadColony(Astro: AstroGlobal | APIContext) {
  const db = getDb();
  const colony = await db.query.colonies.findFirst({ where: eq(schema.colonies.id, Astro.params.id!) });
  if (!colony) return { db, colony: null, error: new Response("No encontrada", { status: 404 }) };
  try {
    await assertCanManage(db, colony.id, Astro.locals.user!);
  } catch (e) {
    if (e instanceof ColonyError) return { db, colony: null, error: Astro.redirect("/colonia") };
    throw e;
  }
  return { db, colony, error: null };
}
