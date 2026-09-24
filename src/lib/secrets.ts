import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import type { DB } from "./db";
import { schema } from "./db";

// Secretos configurables desde el panel, cifrados con AES-GCM con una clave derivada de APP_SECRET.
type Stored = { iv: string; ct: string; last4: string; updatedAt: number };

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function canStoreSecrets(): boolean {
  return Boolean(env.APP_SECRET && env.APP_SECRET.length >= 16);
}

async function key(): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`colonias:v1:${env.APP_SECRET}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function setSecret(db: DB, name: string, value: string) {
  if (!canStoreSecrets()) throw new Error("Falta APP_SECRET en el servidor: no se pueden guardar claves desde el panel.");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(value)));
  const stored: Stored = { iv: b64(iv), ct: b64(ct), last4: value.slice(-4), updatedAt: Date.now() };
  await db
    .insert(schema.settings)
    .values({ key: `secret:${name}`, value: stored })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: stored } });
}

export async function deleteSecret(db: DB, name: string) {
  await db.delete(schema.settings).where(eq(schema.settings.key, `secret:${name}`));
}

async function readStored(db: DB, name: string): Promise<Stored | null> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, `secret:${name}`) });
  return (row?.value as Stored) ?? null;
}

export async function getSecret(db: DB, name: string): Promise<string | null> {
  const s = await readStored(db, name);
  if (!s || !canStoreSecrets()) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(s.iv) }, await key(), unb64(s.ct));
    return new TextDecoder().decode(pt);
  } catch {
    console.error(`No se pudo descifrar el secreto ${name} (¿cambió APP_SECRET?)`);
    return null;
  }
}

/** Estado para mostrar en el panel, sin revelar la clave. */
export async function secretStatus(db: DB, name: string) {
  const s = await readStored(db, name);
  return s ? { stored: true as const, last4: s.last4, updatedAt: new Date(s.updatedAt) } : { stored: false as const };
}

/** Clave de JEV: la del panel si existe; si no, la variable de entorno del servidor. */
export async function getJevApiKey(db: DB): Promise<{ key: string | null; source: "panel" | "servidor" | null }> {
  const fromPanel = await getSecret(db, "typesafe_api_key");
  if (fromPanel) return { key: fromPanel, source: "panel" };
  if (env.TYPESAFE_API_KEY) return { key: env.TYPESAFE_API_KEY, source: "servidor" };
  return { key: null, source: null };
}

/** ¿Se pueden corregir respuestas escritas? (hay clave de JEV o el corrector simulado de desarrollo). */
export async function jevAvailable(db: DB): Promise<boolean> {
  if (env.JEV_MOCK === "1") return true;
  return Boolean((await getJevApiKey(db)).key);
}
