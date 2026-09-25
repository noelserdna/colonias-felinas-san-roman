import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DB } from "./db";
import * as schema from "./db/schema";
import { noticeFor, type NoticeKind, type NoticeText } from "./notice-text";

export { noticeFor, type NoticeKind } from "./notice-text";

type Ctx = { origin: string; ayuntamiento: string };

const uuid = () => crypto.randomUUID();

type Destinatario = { id: string; email: string };

/**
 * Entrega avisos: los guarda en la aplicación y los envía por correo y como notificación push a los
 * dispositivos en los que la persona las ha activado. Un fallo del correo o del push no deshace el aviso.
 */
export async function deliverNotices(db: DB, ctx: Ctx, items: { user: Destinatario; kind: NoticeKind; n: NoticeText }[]) {
  if (items.length === 0) return;
  const now = new Date();
  await db.batch(
    items.map(({ user, kind, n }) =>
      db.insert(schema.notices).values({ id: uuid(), userId: user.id, tipo: kind, titulo: n.titulo, texto: n.parrafos.join(" "), url: n.url, createdAt: now }),
    ) as [any, ...any[]],
  );
  const [{ sendNoticeEmail }, { pushToUsers, unreadNoticeCount }] = await Promise.all([import("./email"), import("./push")]);
  const badges = new Map(await Promise.all(items.map(async ({ user }) => [user.id, await unreadNoticeCount(db, user.id)] as const)));
  const [mails] = await Promise.all([
    Promise.allSettled(
      items.map(({ user, n }) =>
        sendNoticeEmail(user.email, {
          ayuntamiento: ctx.ayuntamiento,
          titulo: n.titulo,
          parrafos: [n.saludo, ...n.parrafos],
          boton: n.url ? { url: new URL(n.url, ctx.origin).href, texto: n.boton } : undefined,
        }),
      ),
    ),
    pushToUsers(
      db,
      items.map(({ user, kind, n }) => ({
        userId: user.id,
        message: { title: n.titulo, body: n.parrafos[0], url: n.url ?? "/", tag: kind, badge: badges.get(user.id) },
      })),
    ),
  ]);
  mails.forEach((r, i) => r.status === "rejected" && console.error(`Aviso por correo a ${items[i].user.id} no enviado:`, r.reason));
}

/** Avisa a una o varias personas de un cambio en una colonia. */
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
  await deliverNotices(
    db,
    ctx,
    users.map((u) => {
      const rol = members.find((m) => m.userId === u.id)?.rol ?? null;
      return { user: u, kind, n: noticeFor(kind, { colonia: colony, rol, nombre: u.nombre, motivo: extra.motivo ?? null }) };
    }),
  );
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
