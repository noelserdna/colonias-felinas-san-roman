import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "./db";
import { schema } from "./db";
import { uuid } from "./util";

export const TIPOS = {
  queja: "Queja sobre la accesibilidad",
  solicitud: "Solicitud de información en formato accesible",
  sugerencia: "Consulta o sugerencia de mejora",
} as const;
export const ESTADOS = { nueva: "Nueva", en_tramite: "En trámite", resuelta: "Resuelta" } as const;

const blankToUndefined = (v: unknown) => (typeof v === "string" ? v.trim() || undefined : v);

export const reportInput = z.object({
  tipo: z.enum(["queja", "solicitud", "sugerencia"]),
  pagina: z.preprocess(blankToUndefined, z.string().max(300).optional()),
  descripcion: z.string().trim().min(10, "Describe el problema con al menos 10 caracteres").max(4000),
  nombre: z.preprocess(blankToUndefined, z.string().max(120).optional()),
  email: z.preprocess(blankToUndefined, z.email("El correo no es válido").max(254).optional()),
});

export async function createReport(db: DB, input: unknown) {
  const r = reportInput.parse(input);
  const row = {
    id: uuid(),
    tipo: r.tipo,
    pagina: r.pagina ?? null,
    descripcion: r.descripcion,
    nombre: r.nombre ?? null,
    email: r.email ?? null,
    estado: "nueva" as const,
    createdAt: new Date(),
  };
  await db.insert(schema.accessibilityReports).values(row);
  return row;
}

export async function listReports(db: DB) {
  return db.query.accessibilityReports.findMany({ orderBy: desc(schema.accessibilityReports.createdAt) });
}

export async function updateReport(db: DB, id: string, estado: keyof typeof ESTADOS, respuesta: string | null) {
  await db
    .update(schema.accessibilityReports)
    .set({ estado, respuesta, updatedAt: new Date() })
    .where(eq(schema.accessibilityReports.id, id));
}
