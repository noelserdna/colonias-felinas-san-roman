import { eq } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "./db";
import { schema } from "./db";
import { sha256, sniffImageType, toBase64 } from "./util";
export { sniffImageType };

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

export const brandingSchema = z.object({
  municipio: z.string().trim().min(2).max(80),
  provincia: z.string().trim().min(2).max(60),
  // Contacto de la unidad responsable de accesibilidad (declaración de accesibilidad).
  accesibilidad_email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || undefined : v),
    z.email("El correo de accesibilidad no es válido").max(254).optional(),
  ),
  accesibilidad_telefono: optionalText(40),
  // Autoría del temario, que se cita en el pie de todas las páginas (p. ej. el colegio de veterinarios).
  credito_formativo: optionalText(160),
});

export type Branding = z.infer<typeof brandingSchema> & {
  /** "Ayuntamiento de …" */
  ayuntamiento: string;
  escudo: { src: string; srcset?: string; custom: boolean };
};

export const DEFAULT_BRANDING: z.infer<typeof brandingSchema> = { municipio: "San Román de los Montes", provincia: "Toledo" };
const DEFAULT_ESCUDO = { src: "/img/escudo.png", srcset: "/img/escudo.png 1x, /img/escudo@2x.png 2x", custom: false };
const ESCUDO_KEY = "escudo";
export const ESCUDO_MAX_BYTES = 1_000_000;

export async function getBranding(db: DB): Promise<Branding> {
  const [row, escudo] = await Promise.all([
    db.query.settings.findFirst({ where: eq(schema.settings.key, "branding") }),
    db.select({ version: schema.assets.version }).from(schema.assets).where(eq(schema.assets.key, ESCUDO_KEY)).limit(1),
  ]);
  const parsed = brandingSchema.safeParse(row?.value);
  const b = parsed.success ? parsed.data : DEFAULT_BRANDING;
  return {
    ...b,
    ayuntamiento: `Ayuntamiento de ${b.municipio}`,
    escudo: escudo[0] ? { src: `/branding/escudo?v=${escudo[0].version}`, custom: true } : DEFAULT_ESCUDO,
  };
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
