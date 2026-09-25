import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";
import { pushToUsers, unreadNoticeCount } from "../../../lib/push";
import { noticeFor } from "../../../lib/notice-text";
import { json } from "../../../lib/util";

/** Envía una notificación de prueba a los dispositivos de la persona (no se guarda como aviso). */
export const POST: APIRoute = async ({ locals }) => {
  const user = locals.user!;
  const db = getDb();
  const n = noticeFor("prueba", { rol: null, nombre: user.nombre });
  const r = await pushToUsers(db, [
    { userId: user.id, message: { title: n.titulo, body: n.parrafos[0], url: n.url, tag: "prueba", badge: await unreadNoticeCount(db, user.id) } },
  ]);
  return json(r, r.sent > 0 ? 200 : 502);
};
