// Páginas de texto editables (guía «Mi colonia», pautas, suplemento local): lectura y guardado.
// Definiciones y textos por defecto en pages-config.ts.
import { eq } from "drizzle-orm";
import type { DB } from "./db";
import * as schema from "./db/schema";
import { PAGE_DEFS, PAGE_MAX_CHARS, type PageSlug } from "./pages-config";
import { programaVars, renderTemplate, type Programa } from "./programa-config";

const key = (slug: PageSlug) => `page:${slug}`;

/** Markdown de la página, sin sustituir los marcadores. `custom` indica si es un texto guardado en el panel. */
export async function getPage(db: DB, slug: PageSlug): Promise<{ markdown: string; custom: boolean }> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, key(slug)) });
  const md = typeof row?.value === "string" && row.value.trim() ? row.value : null;
  return { markdown: md ?? PAGE_DEFS[slug].defecto, custom: Boolean(md) };
}

/** Markdown con los marcadores ya sustituidos por los datos del programa y del ayuntamiento. */
export async function getRenderedPage(db: DB, slug: PageSlug, programa: Programa, branding: { municipio: string; provincia: string }) {
  const page = await getPage(db, slug);
  return { ...page, markdown: renderTemplate(page.markdown, programaVars(programa, branding)) };
}

export async function savePage(db: DB, slug: PageSlug, markdown: string) {
  if (!markdown.trim()) return resetPage(db, slug);
  const value = markdown.slice(0, PAGE_MAX_CHARS);
  await db.insert(schema.settings).values({ key: key(slug), value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

/** Vuelve al texto por defecto (en el suplemento local, a no mostrarlo). */
export async function resetPage(db: DB, slug: PageSlug) {
  await db.delete(schema.settings).where(eq(schema.settings.key, key(slug)));
}
