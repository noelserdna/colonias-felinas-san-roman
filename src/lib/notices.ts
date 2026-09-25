import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DB } from "./db";
import * as schema from "./db/schema";
import { noticeFor, type NoticeKind } from "./notice-text";

export { noticeFor, type NoticeKind } from "./notice-text";

type Ctx = { origin: string; ayuntamiento: string };

const uuid = () => crypto.randomUUID();

/**
 * Avisa a una o varias personas de un cambio en una colonia: lo guarda como aviso en la aplicación
 * y envía un correo. Un fallo del correo no deshace el cambio ni el aviso (se registra en el log).
 */
export async function notifyColony(db: DB, ctx: Ctx, colonyId: string, userIds: string[], kind: NoticeKind, extra: { motivo?: string | null } = {}) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return;
  const [colony, users, members] = await Promise.all([
    db.query.colonies.findFirst({ where: eq(schema.colonies.id, colonyId) }),
    db.select({ id: schema.users.id, email: schema.users.email, nombre: schema.users.nombre }).from(schema.users).where(inArray(schema.users.id, ids)),
    db
      .select({ userId: schema.colonyMembers.userId, rol: schema.colonyMembers.rol })
      .from(schema.colonyMembers)
      .where(and(eq(schema.colonyMembers.colonyId, colonyId), isNull(schema.colonyMembers.until))),
  ]);
  if (!colony) return;
  const now = new Date();
  const items = users.map((u) => {
    const rol = members.find((m) => m.userId === u.id)?.rol ?? null;
    return { u, n: noticeFor(kind, { colonia: colony, rol, nombre: u.nombre, motivo: extra.motivo ?? null }) };
  });
  await db.batch(
    items.map(({ u, n }) =>
      db.insert(schema.notices).values({ id: uuid(), userId: u.id, tipo: kind, titulo: n.titulo, texto: n.parrafos.join(" "), url: n.url, createdAt: now }),
    ) as [any, ...any[]],
  );
  const { sendNoticeEmail } = await import("./email");
  const results = await Promise.allSettled(
    items.map(({ u, n }) =>
      sendNoticeEmail(u.email, {
        ayuntamiento: ctx.ayuntamiento,
        titulo: n.titulo,
        parrafos: [n.saludo, ...n.parrafos],
        boton: n.url ? { url: new URL(n.url, ctx.origin).href, texto: n.boton } : undefined,
      }),
    ),
  );
  results.forEach((r, i) => r.status === "rejected" && console.error(`Aviso por correo a ${items[i].u.id} no enviado:`, r.reason));
}

export async function listUnreadNotices(db: DB, userId: string) {
  return db
    .select()
    .from(schema.notices)
    .where(and(eq(schema.notices.userId, userId), isNull(schema.notices.readAt)))
    .orderBy(desc(schema.notices.createdAt))
    .limit(5);
}

/** Marca como leídos los avisos de la persona: uno concreto, o todos los que llevan a una página. */
export async function markNoticesRead(db: DB, userId: string, by: { id?: string; url?: string }) {
  const cond = by.id ? eq(schema.notices.id, by.id) : by.url ? eq(schema.notices.url, by.url) : undefined;
  if (!cond) return;
  await db
    .update(schema.notices)
    .set({ readAt: new Date() })
    .where(and(eq(schema.notices.userId, userId), isNull(schema.notices.readAt), cond));
}
