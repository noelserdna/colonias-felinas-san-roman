import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "./db";
import * as schema from "./db/schema";
import { uuid } from "./util";

export class ColonyError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const blank = (v: unknown) => (typeof v === "string" ? v.trim() || undefined : v);
const count = z.coerce.number().int().min(0, "Los recuentos no pueden ser negativos").max(999);

export const censusInput = z.object({
  hembrasEsterilizadas: count,
  hembrasSinEsterilizar: count,
  machosCastrados: count,
  machosSinCastrar: count,
  adoptables: count,
  enfermos: count,
  observaciones: z.preprocess(blank, z.string().max(2000).optional()),
});
export type CensusInput = z.infer<typeof censusInput>;

export const colonyInput = z.object({
  nombre: z.string().trim().min(2, "El nombre de la colonia es obligatorio").max(120),
  direccion: z.string().trim().min(3, "La dirección es obligatoria").max(300),
  coordenadas: z.preprocess(blank, z.string().max(80).optional()),
  titularidad: z.enum(["publico", "privado"]),
  notas: z.preprocess(blank, z.string().max(4000).optional()),
});

export const catInput = z.object({
  nombre: z.string().trim().min(1, "Pon un nombre o apodo al gato").max(80),
  sexo: z.enum(["hembra", "macho", "desconocido"]),
  edad: z.preprocess(blank, z.string().max(60).optional()),
  descripcion: z.preprocess(blank, z.string().max(500).optional()),
  esterilizado: z.boolean(),
  marcaOreja: z.boolean(),
  microchip: z.preprocess(blank, z.string().max(40).optional()),
  estado: z.enum(["en_colonia", "adoptado", "fallecido", "desaparecido", "trasladado"]),
  observaciones: z.preprocess(blank, z.string().max(2000).optional()),
});

export const interventionInput = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
  motivo: z.enum(["esterilizacion", "enfermedad", "vacunacion", "desparasitacion", "revision", "otro"]),
  clinica: z.preprocess(blank, z.string().max(160).optional()),
  notas: z.preprocess(blank, z.string().max(2000).optional()),
});

export const CAT_ESTADOS = {
  en_colonia: "En la colonia",
  adoptado: "Adoptado",
  fallecido: "Fallecido",
  desaparecido: "Desaparecido",
  trasladado: "Trasladado",
} as const;
export const MOTIVOS = {
  esterilizacion: "Esterilización (CER)",
  enfermedad: "Enfermedad o herida",
  vacunacion: "Vacunación",
  desparasitacion: "Desparasitación",
  revision: "Revisión veterinaria",
  otro: "Otro",
} as const;
export const SEXOS = { hembra: "Hembra", macho: "Macho", desconocido: "Sin determinar" } as const;

/** Total de gatos declarados en un censo (hembras + machos; adoptables y enfermos van incluidos). */
export function censusTotal(c: Pick<CensusInput, "hembrasEsterilizadas" | "hembrasSinEsterilizar" | "machosCastrados" | "machosSinCastrar">) {
  return c.hembrasEsterilizadas + c.hembrasSinEsterilizar + c.machosCastrados + c.machosSinCastrar;
}

/** El censo se actualiza cada seis meses (apartado 11 de la ordenanza). */
export const CENSUS_MONTHS = 6;
export function censusDue(last: Date | null, now = new Date()): boolean {
  if (!last) return true;
  const due = new Date(last);
  due.setMonth(due.getMonth() + CENSUS_MONTHS);
  return now >= due;
}

/** Recuento automático a partir de las fichas de los gatos que siguen en la colonia. */
export function censusFromCats(cats: { sexo: string; esterilizado: boolean; estado: string }[]) {
  const c = { hembrasEsterilizadas: 0, hembrasSinEsterilizar: 0, machosCastrados: 0, machosSinCastrar: 0 };
  for (const cat of cats) {
    if (cat.estado !== "en_colonia") continue;
    if (cat.sexo === "hembra") cat.esterilizado ? c.hembrasEsterilizadas++ : c.hembrasSinEsterilizar++;
    else if (cat.sexo === "macho") cat.esterilizado ? c.machosCastrados++ : c.machosSinCastrar++;
  }
  return c;
}

// ---------- Personas cuidadoras ----------

/** Personas con carnet vigente: las únicas que pueden cuidar una colonia. */
export async function listCaretakers(db: DB) {
  const now = new Date();
  const rows = await db
    .select({ id: schema.users.id, nombre: schema.carnets.nombre, apellidos: schema.carnets.apellidos, email: schema.users.email, numero: schema.carnets.numero })
    .from(schema.carnets)
    .innerJoin(schema.users, eq(schema.users.id, schema.carnets.userId))
    .where(and(isNull(schema.carnets.revokedAt), gt(schema.carnets.expiresAt, now)))
    .orderBy(asc(schema.carnets.apellidos), asc(schema.carnets.nombre));
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

async function assertCaretakers(db: DB, userIds: string[]) {
  const valid = new Set((await listCaretakers(db)).map((c) => c.id));
  const bad = userIds.filter((u) => !valid.has(u));
  if (bad.length) throw new ColonyError("Solo se pueden asignar personas con el carnet de cuidador/a vigente.");
}

async function nextNumero(db: DB): Promise<number> {
  const rows = await db.all<{ value: number }>(
    sql`INSERT INTO counters (key, value) VALUES ('colonia', 1) ON CONFLICT(key) DO UPDATE SET value = value + 1 RETURNING value`,
  );
  return rows[0].value;
}

// ---------- Altas y gestión (ayuntamiento) ----------

export async function createColony(
  db: DB,
  input: { colony: unknown; responsableId: string; colaboradores: string[]; census: unknown },
) {
  const c = colonyInput.parse(input.colony);
  const census = censusInput.parse(input.census);
  if (!input.responsableId) throw new ColonyError("Elige la persona cuidadora responsable.");
  const colaboradores = [...new Set(input.colaboradores.filter((u) => u && u !== input.responsableId))];
  await assertCaretakers(db, [input.responsableId, ...colaboradores]);
  const now = new Date();
  const id = uuid();
  const numero = await nextNumero(db);
  await db.batch([
    db.insert(schema.colonies).values({ id, numero, ...c, coordenadas: c.coordenadas ?? null, notas: c.notas ?? null, estado: "activa", createdAt: now, updatedAt: now }),
    db.insert(schema.colonyMembers).values({ id: uuid(), colonyId: id, userId: input.responsableId, rol: "responsable", since: now }),
    ...colaboradores.map((u) => db.insert(schema.colonyMembers).values({ id: uuid(), colonyId: id, userId: u, rol: "colaborador", since: now })),
    db.insert(schema.colonyCensuses).values({ id: uuid(), colonyId: id, userId: null, fecha: now, ...census, observaciones: census.observaciones ?? "Datos de la solicitud de registro (Anexo I)." }),
  ]);
  return { id, numero };
}

export async function updateColony(db: DB, id: string, input: unknown, estado?: "activa" | "sin_cuidadores" | "baja") {
  const c = colonyInput.parse(input);
  await db
    .update(schema.colonies)
    .set({ ...c, coordenadas: c.coordenadas ?? null, notas: c.notas ?? null, ...(estado ? { estado } : {}), updatedAt: new Date() })
    .where(eq(schema.colonies.id, id));
}

export async function activeMembers(db: DB, colonyId: string) {
  return db
    .select({ member: schema.colonyMembers, user: { id: schema.users.id, email: schema.users.email, nombre: schema.users.nombre, apellidos: schema.users.apellidos } })
    .from(schema.colonyMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.colonyMembers.userId))
    .where(and(eq(schema.colonyMembers.colonyId, colonyId), isNull(schema.colonyMembers.until)))
    .orderBy(asc(schema.colonyMembers.since));
}

/**
 * Mantiene la colonia coherente: estado según queden cuidadores y siempre una persona responsable.
 * Si la responsable se va y quedan colaboradores, pasa a serlo quien lleve más tiempo en la colonia.
 * Devuelve a quién se ha nombrado responsable, si ha habido cambio.
 */
async function refreshColonyState(db: DB, colonyId: string): Promise<{ id: string; nombre: string } | null> {
  const col = await db.query.colonies.findFirst({ where: eq(schema.colonies.id, colonyId) });
  if (!col) return null;
  const members = await activeMembers(db, colonyId);
  let promoted: { id: string; nombre: string } | null = null;
  if (members.length > 0 && !members.some((m) => m.member.rol === "responsable")) {
    const next = members[0]; // ordenados por antigüedad
    await db.update(schema.colonyMembers).set({ rol: "responsable" }).where(eq(schema.colonyMembers.id, next.member.id));
    promoted = { id: next.user.id, nombre: [next.user.nombre, next.user.apellidos].filter(Boolean).join(" ") || next.user.email };
  }
  if (col.estado !== "baja") {
    const estado = members.length === 0 ? "sin_cuidadores" : "activa";
    if (estado !== col.estado) await db.update(schema.colonies).set({ estado, updatedAt: new Date() }).where(eq(schema.colonies.id, colonyId));
  }
  return promoted;
}

/** Quién pasaría a ser responsable si esta persona se va (para avisarle antes de confirmar). */
export async function sucesorSiSeVa(db: DB, colonyId: string, userId: string) {
  const members = await activeMembers(db, colonyId);
  const me = members.find((m) => m.user.id === userId);
  if (!me || me.member.rol !== "responsable") return null;
  const next = members.find((m) => m.user.id !== userId);
  return next ? [next.user.nombre, next.user.apellidos].filter(Boolean).join(" ") || next.user.email : null;
}

export async function addMember(db: DB, colonyId: string, userId: string, rol: "responsable" | "colaborador") {
  await assertCaretakers(db, [userId]);
  const existing = (await activeMembers(db, colonyId)).find((m) => m.user.id === userId);
  if (existing) throw new ColonyError("Esa persona ya cuida esta colonia.");
  if (rol === "responsable") await demoteResponsables(db, colonyId);
  await db.insert(schema.colonyMembers).values({ id: uuid(), colonyId, userId, rol, since: new Date() });
  await refreshColonyState(db, colonyId);
}

async function demoteResponsables(db: DB, colonyId: string) {
  await db
    .update(schema.colonyMembers)
    .set({ rol: "colaborador" })
    .where(and(eq(schema.colonyMembers.colonyId, colonyId), isNull(schema.colonyMembers.until), eq(schema.colonyMembers.rol, "responsable")));
}

export async function setResponsable(db: DB, colonyId: string, memberId: string) {
  await demoteResponsables(db, colonyId);
  await db.update(schema.colonyMembers).set({ rol: "responsable" }).where(and(eq(schema.colonyMembers.id, memberId), eq(schema.colonyMembers.colonyId, colonyId)));
}

/** Baja de una persona decidida por el ayuntamiento. */
export async function removeMemberByAdmin(db: DB, colonyId: string, memberId: string, motivo: string | null) {
  await db
    .update(schema.colonyMembers)
    .set({ until: new Date(), bajaPor: "ayuntamiento", bajaMotivo: motivo })
    .where(and(eq(schema.colonyMembers.id, memberId), eq(schema.colonyMembers.colonyId, colonyId), isNull(schema.colonyMembers.until)));
  return refreshColonyState(db, colonyId);
}

export async function listColoniesAdmin(db: DB) {
  const cols = await db.query.colonies.findMany({ orderBy: asc(schema.colonies.numero) });
  if (cols.length === 0) return [];
  const ids = cols.map((c) => c.id);
  const members = await db
    .select({ colonyId: schema.colonyMembers.colonyId, rol: schema.colonyMembers.rol, nombre: schema.users.nombre, apellidos: schema.users.apellidos, email: schema.users.email })
    .from(schema.colonyMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.colonyMembers.userId))
    .where(and(inArray(schema.colonyMembers.colonyId, ids), isNull(schema.colonyMembers.until)));
  const censuses = await db.query.colonyCensuses.findMany({ where: inArray(schema.colonyCensuses.colonyId, ids), orderBy: desc(schema.colonyCensuses.fecha) });
  return cols.map((c) => {
    const last = censuses.find((x) => x.colonyId === c.id) ?? null;
    const ms = members.filter((m) => m.colonyId === c.id);
    return { ...c, members: ms, lastCensus: last, total: last ? censusTotal(last) : 0, sinResponsable: ms.length > 0 && !ms.some((m) => m.rol === "responsable") };
  });
}

/** Bajas de personas cuidadoras recientes (para revisión del ayuntamiento). */
export async function recentBajas(db: DB, limit = 20) {
  return db
    .select({ member: schema.colonyMembers, colony: { id: schema.colonies.id, numero: schema.colonies.numero, nombre: schema.colonies.nombre }, user: { email: schema.users.email, nombre: schema.users.nombre, apellidos: schema.users.apellidos } })
    .from(schema.colonyMembers)
    .innerJoin(schema.colonies, eq(schema.colonies.id, schema.colonyMembers.colonyId))
    .innerJoin(schema.users, eq(schema.users.id, schema.colonyMembers.userId))
    .where(sql`${schema.colonyMembers.until} IS NOT NULL`)
    .orderBy(desc(schema.colonyMembers.until))
    .limit(limit);
}

// ---------- Vista de la persona cuidadora ----------

export async function getUserColonies(db: DB, userId: string) {
  const rows = await db
    .select({ member: schema.colonyMembers, colony: schema.colonies })
    .from(schema.colonyMembers)
    .innerJoin(schema.colonies, eq(schema.colonies.id, schema.colonyMembers.colonyId))
    .where(and(eq(schema.colonyMembers.userId, userId), isNull(schema.colonyMembers.until)))
    .orderBy(asc(schema.colonies.numero));
  const out = [];
  for (const r of rows.filter((x) => x.colony.estado !== "baja")) {
    const last = await db.query.colonyCensuses.findFirst({ where: eq(schema.colonyCensuses.colonyId, r.colony.id), orderBy: desc(schema.colonyCensuses.fecha) });
    out.push({ ...r, lastCensus: last ?? null, total: last ? censusTotal(last) : 0 });
  }
  return out;
}

/** Comprueba que la persona cuida la colonia (o es del ayuntamiento). */
export async function assertCanManage(db: DB, colonyId: string, user: { id: string; role: string }) {
  if (user.role === "admin") return;
  const m = await db.query.colonyMembers.findFirst({
    where: and(eq(schema.colonyMembers.colonyId, colonyId), eq(schema.colonyMembers.userId, user.id), isNull(schema.colonyMembers.until)),
  });
  if (!m) throw new ColonyError("No colaboras en esta colonia.", 403);
}

export async function addCensus(db: DB, colonyId: string, userId: string, input: unknown) {
  const c = censusInput.parse(input);
  if (c.adoptables > censusTotal(c) || c.enfermos > censusTotal(c)) {
    throw new ColonyError("Los gatos adoptables y enfermos se cuentan dentro del total: no pueden ser más que el total de gatos.");
  }
  await db.insert(schema.colonyCensuses).values({ id: uuid(), colonyId, userId, fecha: new Date(), ...c, observaciones: c.observaciones ?? null });
}

export async function listCensuses(db: DB, colonyId: string) {
  return db.query.colonyCensuses.findMany({ where: eq(schema.colonyCensuses.colonyId, colonyId), orderBy: desc(schema.colonyCensuses.fecha) });
}

export async function listCats(db: DB, colonyId: string) {
  const cats = await db.query.colonyCats.findMany({ where: eq(schema.colonyCats.colonyId, colonyId), orderBy: [asc(schema.colonyCats.estado), asc(schema.colonyCats.nombre)] });
  if (cats.length === 0) return [];
  const ints = await db.query.catInterventions.findMany({
    where: inArray(schema.catInterventions.catId, cats.map((c) => c.id)),
    orderBy: desc(schema.catInterventions.fecha),
  });
  return cats.map((c) => ({ ...c, interventions: ints.filter((i) => i.catId === c.id) }));
}

export async function saveCat(db: DB, colonyId: string, catId: string | null, input: unknown) {
  const c = catInput.parse(input);
  const row = { ...c, edad: c.edad ?? null, descripcion: c.descripcion ?? null, microchip: c.microchip ?? null, observaciones: c.observaciones ?? null, updatedAt: new Date() };
  if (!catId) {
    await db.insert(schema.colonyCats).values({ id: uuid(), colonyId, ...row, createdAt: new Date() });
    return;
  }
  await db.update(schema.colonyCats).set(row).where(and(eq(schema.colonyCats.id, catId), eq(schema.colonyCats.colonyId, colonyId)));
}

export async function addIntervention(db: DB, colonyId: string, catId: string, userId: string, input: unknown) {
  const i = interventionInput.parse(input);
  const cat = await db.query.colonyCats.findFirst({ where: and(eq(schema.colonyCats.id, catId), eq(schema.colonyCats.colonyId, colonyId)) });
  if (!cat) throw new ColonyError("Ese gato no pertenece a esta colonia.", 404);
  await db.insert(schema.catInterventions).values({ id: uuid(), catId, userId, ...i, clinica: i.clinica ?? null, notas: i.notas ?? null, createdAt: new Date() });
  // Una esterilización registrada actualiza la ficha.
  if (i.motivo === "esterilizacion" && !cat.esterilizado) {
    await db.update(schema.colonyCats).set({ esterilizado: true, marcaOreja: true, updatedAt: new Date() }).where(eq(schema.colonyCats.id, catId));
  }
}

// ---------- Dejar de colaborar ----------

/** ¿Hace falta dejar a alguien a cargo? Sí, si la persona es la única cuidadora que queda. */
export async function relevoRequerido(db: DB, colonyId: string, userId: string) {
  const others = (await activeMembers(db, colonyId)).filter((m) => m.user.id !== userId);
  return { requerido: others.length === 0, otros: others.length };
}

export async function leaveColony(db: DB, colonyId: string, userId: string, motivo: string, evaluacion: unknown) {
  const res = await db
    .update(schema.colonyMembers)
    .set({ until: new Date(), bajaPor: "cuidador", bajaMotivo: motivo, bajaJev: evaluacion })
    .where(and(eq(schema.colonyMembers.colonyId, colonyId), eq(schema.colonyMembers.userId, userId), isNull(schema.colonyMembers.until)))
    .returning({ id: schema.colonyMembers.id });
  if (res.length === 0) throw new ColonyError("No colaboras en esta colonia.", 403);
  const promoted = await refreshColonyState(db, colonyId);
  if (promoted) {
    // Queda constancia en la baja de quién ha pasado a ser responsable.
    await db
      .update(schema.colonyMembers)
      .set({ bajaJev: { ...(evaluacion as object), nuevaResponsable: promoted.nombre } })
      .where(eq(schema.colonyMembers.id, res[0].id));
  }
  return promoted;
}

// ---------- Fotos y observaciones de seguimiento ----------

export async function listCatNotes(db: DB, catId: string) {
  const notes = await db
    .select({ note: schema.catNotes, autor: { nombre: schema.users.nombre, apellidos: schema.users.apellidos, email: schema.users.email } })
    .from(schema.catNotes)
    .leftJoin(schema.users, eq(schema.users.id, schema.catNotes.userId))
    .where(eq(schema.catNotes.catId, catId))
    .orderBy(desc(schema.catNotes.createdAt));
  if (notes.length === 0) return [];
  const fotos = await db
    .select({ id: schema.photos.id, noteId: schema.photos.noteId })
    .from(schema.photos)
    .where(inArray(schema.photos.noteId, notes.map((n) => n.note.id)));
  return notes.map((n) => ({ ...n, fotos: fotos.filter((f) => f.noteId === n.note.id).map((f) => f.id) }));
}
