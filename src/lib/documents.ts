import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "./db";
import * as schema from "./db/schema";
import { DOC_CATEGORIAS, type DocCategoria } from "./db/schema";

const blank = (v: unknown) => (typeof v === "string" ? v.trim() || undefined : v);

export const documentInput = z.object({
  titulo: z.string().trim().min(3, "El título es obligatorio").max(250),
  categoria: z.enum(Object.keys(DOC_CATEGORIAS) as [DocCategoria, ...DocCategoria[]]),
  descripcion: z.preprocess(blank, z.string().max(1000).optional()),
  // Solo enlaces http(s): evita javascript:, data:, etc.
  url: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.url({ protocol: /^https?$/, error: "La dirección debe ser un enlace que empiece por https:// o http://" }).max(2000),
  ),
  fecha: z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida").optional()),
  orden: z.coerce.number().int().min(0).max(9999).default(0),
  activo: z.boolean().default(true),
});

export async function listDocuments(db: DB, onlyActive = true) {
  return db.query.documents.findMany({
    where: onlyActive ? eq(schema.documents.activo, true) : undefined,
    orderBy: [asc(schema.documents.categoria), asc(schema.documents.orden), asc(schema.documents.titulo)],
  });
}

/** Agrupa en el orden de categorías definido (ordenanzas, formularios, normativa…). */
export function groupByCategory<T extends { categoria: DocCategoria }>(docs: T[]) {
  return (Object.keys(DOC_CATEGORIAS) as DocCategoria[])
    .map((c) => ({ categoria: c, titulo: DOC_CATEGORIAS[c], docs: docs.filter((d) => d.categoria === c) }))
    .filter((g) => g.docs.length > 0);
}

export async function saveDocument(db: DB, id: number | null, input: unknown) {
  const d = documentInput.parse(input);
  const row = { ...d, descripcion: d.descripcion ?? null, fecha: d.fecha ?? null, updatedAt: new Date() };
  if (id == null) {
    const [r] = await db.insert(schema.documents).values(row).returning({ id: schema.documents.id });
    return r.id;
  }
  await db.update(schema.documents).set(row).where(eq(schema.documents.id, id));
  return id;
}

export async function deleteDocument(db: DB, id: number) {
  await db.delete(schema.documents).where(eq(schema.documents.id, id));
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
