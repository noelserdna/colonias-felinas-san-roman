import { eq } from "drizzle-orm";
import { z } from "zod";
import { brandingSchema, DEFAULT_BRANDING } from "./branding-schema";
import type { DB } from "./db";
import { schema } from "./db";
import { sha256, sniffImageType, toBase64 } from "./util";
export { sniffImageType, brandingSchema, DEFAULT_BRANDING };

export type Branding = z.infer<typeof brandingSchema> & {
  /** "Ayuntamiento de …" */
  ayuntamiento: string;
  escudo: { src: string; srcset?: string; custom: boolean };
};

const DEFAULT_ESCUDO = { src: "/img/escudo.png", srcset: "/img/escudo.png 1x, /img/escudo@2x.png 2x", custom: false };
export const ESCUDO_KEY = "escudo";
export const ESCUDO_MAX_BYTES = 1_000_000;

/** Branding a partir del valor guardado y de la versión del escudo propio (null = escudo por defecto). */
export function brandingFrom(value: unknown, escudoVersion: string | null): Branding {
  const parsed = brandingSchema.safeParse(value);
  const b = parsed.success ? parsed.data : DEFAULT_BRANDING;
  return {
    ...b,
    ayuntamiento: `Ayuntamiento de ${b.municipio}`,
    escudo: escudoVersion ? { src: `/branding/escudo?v=${escudoVersion}`, custom: true } : DEFAULT_ESCUDO,
  };
}

export async function getBranding(db: DB): Promise<Branding> {
  const [row, escudo] = await Promise.all([
    db.query.settings.findFirst({ where: eq(schema.settings.key, "branding") }),
    db.select({ version: schema.assets.version }).from(schema.assets).where(eq(schema.assets.key, ESCUDO_KEY)).limit(1),
  ]);
  return brandingFrom(row?.value, escudo[0]?.version ?? null);
}

export async function saveBranding(db: DB, input: unknown) {
  const value = brandingSchema.parse(input);
  await db.insert(schema.settings).values({ key: "branding", value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

/** Valida el fichero del escudo sin guardarlo. */
export async function readEscudo(file: File): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (file.size > ESCUDO_MAX_BYTES) throw new Error("El escudo no puede superar 1 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) throw new Error("El escudo debe ser una imagen PNG, JPG o WebP.");
  return { bytes, contentType };
}

export async function saveEscudo(db: DB, file: File): Promise<void> {
  const { bytes, contentType } = await readEscudo(file);
  const dataB64 = toBase64(bytes);
  const version = (await sha256(dataB64)).slice(0, 12);
  const row = { key: ESCUDO_KEY, contentType, dataB64, version, updatedAt: new Date() };
  await db.insert(schema.assets).values(row).onConflictDoUpdate({ target: schema.assets.key, set: row });
}

export async function deleteEscudo(db: DB) {
  await db.delete(schema.assets).where(eq(schema.assets.key, ESCUDO_KEY));
}

export async function getEscudo(db: DB) {
  return db.query.assets.findFirst({ where: eq(schema.assets.key, ESCUDO_KEY) });
}

/**
 * Escudo para incrustar en los PDF generados en el servidor: el propio si es PNG o JPG; `fallback` (el
 * escudo por defecto) si no hay uno propio. Un escudo WebP no se puede incrustar: los PDF salen sin escudo.
 */
export async function loadEscudoBytes(db: DB, fallback?: Uint8Array): Promise<{ bytes?: Uint8Array; version: string; webp: boolean }> {
  const e = await getEscudo(db);
  if (!e) return { bytes: fallback, version: "defecto", webp: false };
  if (e.contentType === "image/webp") return { bytes: undefined, version: e.version, webp: true };
  return { bytes: Uint8Array.from(atob(e.dataB64), (c) => c.charCodeAt(0)), version: e.version, webp: false };
}
