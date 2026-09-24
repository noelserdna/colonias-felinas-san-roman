import { and, eq, gt, isNull } from "drizzle-orm";
import { env } from "cloudflare:workers";
import type { AstroCookies } from "astro";
import type { DB } from "./db";
import { schema } from "./db";
import { randomToken, sha256, uuid } from "./util";

export const SESSION_COOKIE = "sid";
const SESSION_DAYS = 90;

export type SessionUser = {
  id: string;
  email: string;
  nombre: string | null;
  apellidos: string | null;
  role: "user" | "admin";
  consentAt: Date | null;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function adminEmails(): Set<string> {
  return new Set((env.ADMIN_EMAILS ?? "").split(",").map(normalizeEmail).filter(Boolean));
}

/** Crea un token de acceso de un solo uso. Devuelve el token en claro (solo va en el enlace). */
export async function createMagicToken(db: DB, email: string, ttlMin: number, now = Date.now()): Promise<string> {
  const token = randomToken(32);
  await db.insert(schema.magicTokens).values({
    tokenHash: await sha256(token),
    email,
    expiresAt: new Date(now + ttlMin * 60_000),
  });
  return token;
}

/** Consume el token de forma atómica. Devuelve el email o null si no es válido, caducó o ya se usó. */
export async function consumeMagicToken(db: DB, token: string, now = Date.now()): Promise<string | null> {
  const hash = await sha256(token);
  const rows = await db
    .update(schema.magicTokens)
    .set({ usedAt: new Date(now) })
    .where(
      and(
        eq(schema.magicTokens.tokenHash, hash),
        isNull(schema.magicTokens.usedAt),
        gt(schema.magicTokens.expiresAt, new Date(now)),
      ),
    )
    .returning({ email: schema.magicTokens.email });
  return rows[0]?.email ?? null;
}

export async function findOrCreateUser(db: DB, email: string): Promise<string> {
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  const shouldBeAdmin = adminEmails().has(email);
  if (existing) {
    if (shouldBeAdmin && existing.role !== "admin") {
      await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, existing.id));
    }
    return existing.id;
  }
  const id = uuid();
  await db.insert(schema.users).values({ id, email, role: shouldBeAdmin ? "admin" : "user", createdAt: new Date() });
  return id;
}

export async function createSession(db: DB, userId: string, cookies: AstroCookies, secure: boolean): Promise<void> {
  const sid = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(schema.sessions).values({ idHash: await sha256(sid), userId, expiresAt });
  cookies.set(SESSION_COOKIE, sid, { httpOnly: true, secure, sameSite: "lax", path: "/", expires: expiresAt });
}

export async function getSessionUser(db: DB, sid: string | undefined): Promise<SessionUser | null> {
  if (!sid) return null;
  const hash = await sha256(sid);
  const rows = await db
    .select({ user: schema.users, expiresAt: schema.sessions.expiresAt })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.idHash, hash))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  const u = row.user;
  return { id: u.id, email: u.email, nombre: u.nombre, apellidos: u.apellidos, role: u.role, consentAt: u.consentAt };
}

export async function destroySession(db: DB, cookies: AstroCookies): Promise<void> {
  const sid = cookies.get(SESSION_COOKIE)?.value;
  if (sid) await db.delete(schema.sessions).where(eq(schema.sessions.idHash, await sha256(sid)));
  cookies.delete(SESSION_COOKIE, { path: "/" });
}

export function profileComplete(u: SessionUser): boolean {
  return Boolean(u.nombre?.trim() && u.apellidos?.trim() && u.consentAt);
}
