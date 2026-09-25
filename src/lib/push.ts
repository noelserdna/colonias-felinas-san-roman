// Suscripciones y envío de notificaciones push (ver webpush.ts para el protocolo).
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { env } from "cloudflare:workers";
import type { DB } from "./db";
import * as schema from "./db/schema";
import { sendPush, type Vapid } from "./webpush";

export type PushMessage = { title: string; body: string; url?: string | null; tag?: string; badge?: number };

/** Claves VAPID del servidor: pública en `VAPID_PUBLIC_KEY` y privada (JWK) en el secreto `VAPID_PRIVATE_KEY`. */
export function vapidConfig(): Vapid | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  try {
    return { publicKey: env.VAPID_PUBLIC_KEY, privateJwk: JSON.parse(env.VAPID_PRIVATE_KEY), subject: env.APP_ORIGIN ?? "https://sanroman.colonia.dev" };
  } catch {
    return null;
  }
}

export async function saveSubscription(db: DB, userId: string, sub: { endpoint: string; p256dh: string; auth: string }, userAgent: string | null) {
  const row = { userId, p256dh: sub.p256dh, auth: sub.auth, userAgent: userAgent?.slice(0, 300) ?? null };
  // El mismo navegador puede pasar a otra persona (otra sesión en el mismo móvil): el endpoint manda.
  await db
    .insert(schema.pushSubscriptions)
    .values({ id: crypto.randomUUID(), endpoint: sub.endpoint, createdAt: new Date(), ...row })
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: row });
}

export async function deleteSubscription(db: DB, userId: string, endpoint: string) {
  await db.delete(schema.pushSubscriptions).where(and(eq(schema.pushSubscriptions.userId, userId), eq(schema.pushSubscriptions.endpoint, endpoint)));
}

export async function unreadNoticeCount(db: DB, userId: string) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.notices)
    .where(and(eq(schema.notices.userId, userId), isNull(schema.notices.readAt)));
  return n;
}

/**
 * Envía un push a todos los dispositivos de cada persona. Borra las suscripciones que el servicio da por
 * caducadas (404/410). Nunca lanza: un fallo de push no debe deshacer el aviso ni el correo.
 */
export async function pushToUsers(db: DB, messages: { userId: string; message: PushMessage }[]): Promise<{ sent: number; failed: number }> {
  const vapid = vapidConfig();
  if (!vapid || messages.length === 0) return { sent: 0, failed: 0 };
  const subs = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(inArray(schema.pushSubscriptions.userId, [...new Set(messages.map((m) => m.userId))]));
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      const m = messages.find((x) => x.userId === s.userId)!.message;
      try {
        const r = await sendPush(s, m, vapid, { topic: m.tag });
        if (r.ok) {
          sent++;
          await db.update(schema.pushSubscriptions).set({ lastOkAt: new Date() }).where(eq(schema.pushSubscriptions.id, s.id));
        } else {
          failed++;
          if (r.gone) await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id));
          else console.error(`Push ${r.status} a ${new URL(s.endpoint).host}`);
        }
      } catch (e) {
        failed++;
        console.error("Push no enviado:", e);
      }
    }),
  );
  return { sent, failed };
}
