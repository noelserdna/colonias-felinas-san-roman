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
// Movimiento del censo: vacío = no declarado (null).
const movimiento = z.preprocess((v) => (v == null || (typeof v === "string" && v.trim() === "") ? null : v), count.nullable());

/** Movimientos desde el censo anterior, por sexo (como el censo en papel de algunas ordenanzas). */
export const MOVIMIENTOS = {
  nacidos: { label: "Nacidos en la colonia", entrada: true },
  nuevos: { label: "Llegados de fuera", entrada: true },
  fallecidos: { label: "Fallecidos", entrada: false },
  adoptados: { label: "Dados en adopción", entrada: false },
  devueltos: { label: "Devueltos a su responsable legal", entrada: false },
  otrasSalidas: { label: "Otras salidas (desaparecidos, trasladados)", entrada: false },
} as const;
export type Movimiento = keyof typeof MOVIMIENTOS;
export const MOVIMIENTO_KEYS = Object.keys(MOVIMIENTOS) as Movimiento[];
/** Campos del censo: nacidosHembras, nacidosMachos… */
export const MOVIMIENTO_CAMPOS = MOVIMIENTO_KEYS.flatMap((m) => [`${m}Hembras`, `${m}Machos`] as const);
export type MovimientoCampo = `${Movimiento}Hembras` | `${Movimiento}Machos`;

export const censusInput = z.object({
  hembrasEsterilizadas: count,
  hembrasSinEsterilizar: count,
  machosCastrados: count,
  machosSinCastrar: count,
  adoptables: count,
  enfermos: count,
  observaciones: z.preprocess(blank, z.string().max(2000).optional()),
  ...(Object.fromEntries(MOVIMIENTO_CAMPOS.map((k) => [k, movimiento])) as Record<MovimientoCampo, typeof movimiento>),
});
export type CensusInput = z.infer<typeof censusInput>;
export type CensoMovimientos = "no" | "opcional" | "obligatorio";

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
  estado: z.enum(["en_colonia", "adoptado", "fallecido", "desaparecido", "trasladado", "devuelto"]),
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
  devuelto: "Devuelto a su responsable legal",
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

export type CensoPeriodo = { meses: number; alineado: boolean };

/** Número del periodo natural al que pertenece la fecha (con 6 meses: enero–junio, julio–diciembre…). */
const periodo = (d: Date, meses: number) => Math.floor((d.getFullYear() * 12 + d.getMonth()) / meses);

/** Primer día del periodo natural en curso. */
export function censusPeriodStart(now: Date, meses: number): Date {
  const m = periodo(now, meses) * meses;
  return new Date(Math.floor(m / 12), m % 12, 1);
}

/**
 * ¿Toca actualizar el censo? Cada `meses` desde el último censo o, si `alineado`, en cuanto empieza un
 * periodo natural nuevo (con 6 meses, un censo por semestre). Ver `censo_meses` en el programa local.
 */
export function censusDue(last: Date | null, now = new Date(), p: CensoPeriodo = { meses: 6, alineado: false }): boolean {
  if (!last) return true;
  if (p.alineado) return periodo(now, p.meses) > periodo(last, p.meses);
  const due = new Date(last);
  due.setMonth(due.getMonth() + p.meses);
  return now >= due;
}

type Recuento = Pick<CensusInput, "hembrasEsterilizadas" | "hembrasSinEsterilizar" | "machosCastrados" | "machosSinCastrar">;
type ConMovimientos = Partial<Record<MovimientoCampo, number | null>>;

/** ¿Declara algún movimiento? */
export function hasMovements(c: ConMovimientos): boolean {
  return MOVIMIENTO_CAMPOS.some((k) => c[k] != null);
}

/**
 * Cuadre por sexo: censo anterior + entradas − salidas, frente a lo contado ahora.
 * Los movimientos no declarados cuentan como 0.
 */
export function censusBalance(prev: Recuento, c: Recuento & ConMovimientos) {
  const sexo = (s: "Hembras" | "Machos") => {
    const antes = s === "Hembras" ? prev.hembrasEsterilizadas + prev.hembrasSinEsterilizar : prev.machosCastrados + prev.machosSinCastrar;
    const ahora = s === "Hembras" ? c.hembrasEsterilizadas + c.hembrasSinEsterilizar : c.machosCastrados + c.machosSinCastrar;
    let entradas = 0;
    let salidas = 0;
    for (const m of MOVIMIENTO_KEYS) {
      const v = c[`${m}${s}`] ?? 0;
      if (MOVIMIENTOS[m].entrada) entradas += v;
      else salidas += v;
    }
    const esperado = antes + entradas - salidas;
    return { antes, entradas, salidas, esperado, ahora, cuadra: esperado === ahora };
  };
  return { hembras: sexo("Hembras"), machos: sexo("Machos") };
}

/**
 * Comprueba un censo nuevo. `errores` impiden guardarlo; `avisos` (el censo no cuadra con el anterior y
 * los movimientos) se muestran para revisarlo, pero se puede guardar igualmente.
 */
export function validateCensus(c: CensusInput, prev: Recuento | null, modo: CensoMovimientos): { errores: string[]; avisos: string[] } {
  const errores: string[] = [];
  const avisos: string[] = [];
  if (c.adoptables > censusTotal(c) || c.enfermos > censusTotal(c)) {
    errores.push("Los gatos adoptables y enfermos se cuentan dentro del total: no pueden ser más que el total de gatos.");
  }
  if (!prev || modo === "no") return { errores, avisos };
  if (modo === "obligatorio" && MOVIMIENTO_CAMPOS.some((k) => c[k] == null)) {
    errores.push("Indica los movimientos desde el censo anterior (pon 0 donde no haya habido ninguno).");
  }
  if (!hasMovements(c)) return { errores, avisos };
  const b = censusBalance(prev, c);
  for (const [nombre, x] of [["hembras", b.hembras], ["machos", b.machos]] as const) {
    if (x.cuadra) continue;
    avisos.push(
      `Las ${nombre} no cuadran: el censo anterior tenía ${x.antes}, con ${x.entradas} ${x.entradas === 1 ? "entrada" : "entradas"} y ${x.salidas} ${x.salidas === 1 ? "salida" : "salidas"} deberían ser ${x.esperado}, pero has contado ${x.ahora}.`,
    );
  }
  return { errores, avisos };
}

/**
 * Movimientos desde `desde` (fecha del censo anterior) según las fichas: fichas nuevas como entradas y
 * cambios de situación posteriores como salidas. Solo gatos con sexo conocido. Es una propuesta: la persona
 * cuidadora la revisa antes de guardar.
 */
export function censusMovementsFromCats(
  cats: { sexo: string; estado: string; edad?: string | null; createdAt: Date; estadoDesde: Date | null }[],
  desde: Date,
): Record<MovimientoCampo, number> {
  const out = Object.fromEntries(MOVIMIENTO_CAMPOS.map((k) => [k, 0])) as Record<MovimientoCampo, number>;
  const SALIDA: Record<string, Movimiento> = { fallecido: "fallecidos", adoptado: "adoptados", devuelto: "devueltos", desaparecido: "otrasSalidas", trasladado: "otrasSalidas" };
  for (const cat of cats) {
    const s = cat.sexo === "hembra" ? "Hembras" : cat.sexo === "macho" ? "Machos" : null;
    if (!s) continue;
    const nuevo = cat.createdAt > desde;
    const cambio = cat.estadoDesde ?? cat.createdAt;
    const salida = SALIDA[cat.estado];
    // Un gato que llegó y se fue en el mismo periodo no aparece en ninguno de los dos recuentos.
    if (nuevo && salida && cambio > desde) continue;
    // Las fichas nuevas de cachorros cuentan como nacidos en la colonia; el resto, como llegados de fuera.
    if (nuevo && cat.estado === "en_colonia") out[`${/cachorr|gatit|reci[eé]n nacid/i.test(cat.edad ?? "") ? "nacidos" : "nuevos"}${s}`]++;
    else if (!nuevo && salida && cambio > desde) out[`${salida}${s}`]++;
  }
  return out;
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
  input: { colony: unknown; responsableId: string; colaboradores: string[]; census: unknown; etiquetaRegistro?: string },
) {
  const c = colonyInput.parse(input.colony);
  // El primer censo (el de la solicitud) no tiene movimientos: no hay censo anterior.
  const census = censusInput.parse({ ...(input.census as object), ...Object.fromEntries(MOVIMIENTO_CAMPOS.map((k) => [k, null])) });
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
    db.insert(schema.colonyCensuses).values({ id: uuid(), colonyId: id, userId: null, fecha: now, ...census, observaciones: census.observaciones ?? `Datos de la solicitud de registro${input.etiquetaRegistro ? ` (${input.etiquetaRegistro})` : ""}.` }),
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

/**
 * Guarda un censo. Si no cuadra con el anterior y los movimientos, no se guarda y devuelve los avisos,
 * salvo que se confirme («Guardar igualmente»).
 */
export async function addCensus(
  db: DB,
  colonyId: string,
  userId: string,
  input: unknown,
  opts: { modo: CensoMovimientos; confirmar?: boolean } = { modo: "opcional" },
): Promise<{ guardado: boolean; avisos: string[] }> {
  const parsed = censusInput.parse(input);
  const prev = await db.query.colonyCensuses.findFirst({ where: eq(schema.colonyCensuses.colonyId, colonyId), orderBy: desc(schema.colonyCensuses.fecha) });
  // Sin censo anterior o sin movimientos en este municipio, no se guardan.
  const c = !prev || opts.modo === "no" ? { ...parsed, ...Object.fromEntries(MOVIMIENTO_CAMPOS.map((k) => [k, null])) } : parsed;
  const { errores, avisos } = validateCensus(c, prev ?? null, opts.modo);
  if (errores.length) throw new ColonyError(errores.join(" "));
  if (avisos.length && !opts.confirmar) return { guardado: false, avisos };
  await db.insert(schema.colonyCensuses).values({ id: uuid(), colonyId, userId, fecha: new Date(), ...c, observaciones: c.observaciones ?? null });
  return { guardado: true, avisos };
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
  const now = new Date();
  const row = { ...c, edad: c.edad ?? null, descripcion: c.descripcion ?? null, microchip: c.microchip ?? null, observaciones: c.observaciones ?? null, updatedAt: now };
  if (!catId) {
    await db.insert(schema.colonyCats).values({ id: uuid(), colonyId, ...row, estadoDesde: now, createdAt: now });
    return;
  }
  const where = and(eq(schema.colonyCats.id, catId), eq(schema.colonyCats.colonyId, colonyId));
  const before = await db.query.colonyCats.findFirst({ where });
  // La fecha de la situación solo cambia cuando cambia la situación.
  await db.update(schema.colonyCats).set({ ...row, ...(before && before.estado !== c.estado ? { estadoDesde: now } : {}) }).where(where);
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
