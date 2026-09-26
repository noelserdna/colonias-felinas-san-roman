// Lectura y guardado de la configuración del programa municipal (clave `programa` de settings).
// La parte pura (esquema, valores por defecto, plantillas) está en programa-config.ts.
import { eq, inArray } from "drizzle-orm";
import type { DB } from "./db";
import * as schema from "./db/schema";
import { brandingFrom, ESCUDO_KEY, type Branding } from "./branding";
import { parsePrograma, programaSchema, type Programa } from "./programa-config";

const KEY = "programa";

export async function getPrograma(db: DB): Promise<Programa> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, KEY) });
  return parsePrograma(row?.value);
}

/** Valida todo (estricto) antes de guardar. Lanza ZodError con los campos que no son válidos. */
export async function savePrograma(db: DB, input: unknown): Promise<Programa> {
  const value = programaSchema.parse(input);
  await db.insert(schema.settings).values({ key: KEY, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });
  return value;
}

/** Identidad del ayuntamiento (branding y escudo) y programa local en un solo viaje a la base de datos. */
export async function getIdentidad(db: DB): Promise<{ branding: Branding; programa: Programa }> {
  const [rows, escudo] = await db.batch([
    db.select().from(schema.settings).where(inArray(schema.settings.key, ["branding", KEY])),
    db.select({ version: schema.assets.version }).from(schema.assets).where(eq(schema.assets.key, ESCUDO_KEY)).limit(1),
  ]);
  const value = (k: string) => rows.find((r) => r.key === k)?.value;
  return { branding: brandingFrom(value("branding"), escudo[0]?.version ?? null), programa: parsePrograma(value(KEY)) };
}
