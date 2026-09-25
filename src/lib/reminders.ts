// Recordatorios automáticos (cron diario): censo pendiente de la colonia y carnet a punto de caducar.
// Llegan como aviso en la aplicación, notificación push y correo. No se repiten mientras siga
// vigente el anterior (30 días para el censo, 45 para el carnet).
import { and, eq, gt, gte, inArray, isNull, lte, max } from "drizzle-orm";
import type { DB } from "./db";
import * as schema from "./db/schema";
import { censusDue } from "./colonies";
import { deliverNotices } from "./notices";
import { noticeFor, type NoticeKind } from "./notice-text";

const DAY = 86_400_000;
export const CARNET_AVISO_DIAS = 30;

type Ctx = { origin: string; ayuntamiento: string };

/** Personas (y páginas) que ya recibieron este tipo de aviso hace menos de `dias`. */
async function yaAvisados(db: DB, tipo: NoticeKind, dias: number, now: Date) {
  const rows = await db
    .select({ userId: schema.notices.userId, url: schema.notices.url })
    .from(schema.notices)
    .where(and(eq(schema.notices.tipo, tipo), gt(schema.notices.createdAt, new Date(now.getTime() - dias * DAY))));
  return new Set(rows.map((r) => `${r.userId}|${r.url}`));
}

export async function runReminders(db: DB, ctx: Ctx, now = new Date()) {
  // --- Censo: a la persona responsable de cada colonia activa con el censo de hace más de seis meses.
  const colonias = await db.select().from(schema.colonies).where(eq(schema.colonies.estado, "activa"));
  const ultimos = colonias.length
    ? await db
        .select({ colonyId: schema.colonyCensuses.colonyId, fecha: max(schema.colonyCensuses.fecha) })
        .from(schema.colonyCensuses)
        .where(inArray(schema.colonyCensuses.colonyId, colonias.map((c) => c.id)))
        .groupBy(schema.colonyCensuses.colonyId)
    : [];
  const pendientes = colonias.filter((c) => censusDue(ultimos.find((u) => u.colonyId === c.id)?.fecha ?? null, now));
  const responsables = pendientes.length
    ? await db
        .select({ colonyId: schema.colonyMembers.colonyId, id: schema.users.id, email: schema.users.email, nombre: schema.users.nombre })
        .from(schema.colonyMembers)
        .innerJoin(schema.users, eq(schema.users.id, schema.colonyMembers.userId))
        .where(and(inArray(schema.colonyMembers.colonyId, pendientes.map((c) => c.id)), eq(schema.colonyMembers.rol, "responsable"), isNull(schema.colonyMembers.until)))
    : [];
  const avisadosCenso = await yaAvisados(db, "colonia_censo", 30, now);
  const censo = responsables.flatMap((r) => {
    const colonia = pendientes.find((c) => c.id === r.colonyId)!;
    const n = noticeFor("colonia_censo", { colonia, rol: "responsable", nombre: r.nombre, fecha: ultimos.find((u) => u.colonyId === colonia.id)?.fecha ?? null });
    return avisadosCenso.has(`${r.id}|${n.url}`) ? [] : [{ user: r, kind: "colonia_censo" as const, n }];
  });

  // --- Carnet: vigente y que caduca en los próximos 30 días.
  const carnets = await db
    .select({ id: schema.users.id, email: schema.users.email, nombre: schema.users.nombre, expiresAt: schema.carnets.expiresAt })
    .from(schema.carnets)
    .innerJoin(schema.users, eq(schema.users.id, schema.carnets.userId))
    .where(and(isNull(schema.carnets.revokedAt), gte(schema.carnets.expiresAt, now), lte(schema.carnets.expiresAt, new Date(now.getTime() + CARNET_AVISO_DIAS * DAY))));
  const avisadosCarnet = await yaAvisados(db, "carnet_caduca", 45, now);
  const carnet = carnets
    .filter((c) => !avisadosCarnet.has(`${c.id}|/carnet`))
    .map((c) => ({ user: c, kind: "carnet_caduca" as const, n: noticeFor("carnet_caduca", { rol: null, nombre: c.nombre, fecha: c.expiresAt }) }));

  await deliverNotices(db, ctx, [...censo, ...carnet]);
  return { censo: censo.length, carnet: carnet.length };
}
