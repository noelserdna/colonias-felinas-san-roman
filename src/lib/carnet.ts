import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { DB } from "./db";
import { schema } from "./db";
import type { Settings } from "./settings";
import { uuid } from "./util";

export function carnetNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

export async function getActiveCarnet(db: DB, userId: string, now = new Date()) {
  return db.query.carnets.findFirst({
    where: and(eq(schema.carnets.userId, userId), isNull(schema.carnets.revokedAt), gt(schema.carnets.expiresAt, now)),
    orderBy: desc(schema.carnets.issuedAt),
  });
}

export async function getLatestCarnet(db: DB, userId: string) {
  return db.query.carnets.findFirst({ where: eq(schema.carnets.userId, userId), orderBy: desc(schema.carnets.issuedAt) });
}

async function nextSeq(db: DB, key: string): Promise<number> {
  const rows = await db.all<{ value: number }>(
    sql`INSERT INTO counters (key, value) VALUES (${key}, 1) ON CONFLICT(key) DO UPDATE SET value = value + 1 RETURNING value`,
  );
  return rows[0].value;
}

export async function issueCarnet(db: DB, userId: string, attemptId: string | null, s: Settings) {
  const active = await getActiveCarnet(db, userId);
  if (active) return active;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user?.nombre || !user.apellidos) throw new Error("Perfil incompleto");
  const now = new Date();
  const year = now.getFullYear();
  const seq = await nextSeq(db, `carnet-${year}`);
  const row = {
    id: uuid(),
    numero: carnetNumber(s.carnet_prefix, year, seq),
    userId,
    nombre: user.nombre,
    apellidos: user.apellidos,
    issuedAt: now,
    expiresAt: addMonths(now, s.carnet_validity_months),
    attemptId,
  };
  await db.insert(schema.carnets).values(row);
  return { ...row, revokedAt: null };
}

export function carnetStatus(c: { revokedAt: Date | null; expiresAt: Date }, now = new Date()): "vigente" | "caducado" | "revocado" {
  if (c.revokedAt) return "revocado";
  return c.expiresAt.getTime() > now.getTime() ? "vigente" : "caducado";
}
