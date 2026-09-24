import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import type { DB } from "./db";
import { schema } from "./db";
import { questionInput, type QuestionInput } from "./questions-io";
import { finalComposition, getSettings } from "./settings";
import { jevAvailable } from "./secrets";

type Unit = typeof schema.units.$inferSelect;

export function resolveUnit(units: Unit[], tema: string | number): Unit | undefined {
  return typeof tema === "number" ? units.find((u) => u.orden === tema) : units.find((u) => u.slug === tema || String(u.orden) === tema);
}

function toRow(q: QuestionInput, unitId: number) {
  return {
    unitId,
    type: q.tipo,
    dificultad: q.dificultad ?? "media",
    enunciado: q.enunciado,
    options: q.tipo === "written" ? null : q.opciones!,
    correctIndex: q.tipo === "mc" ? q.correcta! : null,
    correctIndexes: q.tipo === "multi" ? [...new Set(q.correctas!)].sort((a, b) => a - b) : null,
    explicacion: q.explicacion ?? null,
    referenceAnswer: q.tipo === "written" ? q.respuesta_referencia! : null,
    keyPoints: q.tipo === "written" ? (q.puntos_clave ?? []) : null,
    activo: q.activo ?? true,
  };
}

export async function createQuestion(db: DB, input: unknown) {
  const q = questionInput.parse(input);
  const units = await db.query.units.findMany();
  const unit = resolveUnit(units, q.tema);
  if (!unit) throw new Error(`Tema desconocido: ${q.tema}`);
  const [row] = await db.insert(schema.questions).values(toRow(q, unit.id)).returning({ id: schema.questions.id });
  return row.id;
}

/** Edita una pregunta. Los intentos antiguos no cambian porque guardan una copia. */
export async function updateQuestion(db: DB, id: number, input: unknown) {
  const q = questionInput.parse(input);
  const units = await db.query.units.findMany();
  const unit = resolveUnit(units, q.tema);
  if (!unit) throw new Error(`Tema desconocido: ${q.tema}`);
  await db
    .update(schema.questions)
    .set({ ...toRow(q, unit.id), version: sql`${schema.questions.version} + 1` })
    .where(eq(schema.questions.id, id));
}

export async function importQuestions(db: DB, raw: unknown[]) {
  const units = await db.query.units.findMany();
  const errors: { fila: number; error: string }[] = [];
  const rows: ReturnType<typeof toRow>[] = [];
  raw.forEach((r, i) => {
    const parsed = questionInput.safeParse(r);
    if (!parsed.success) {
      errors.push({ fila: i + 1, error: parsed.error.issues.map((x) => x.message).join("; ") });
      return;
    }
    const unit = resolveUnit(units, parsed.data.tema);
    if (!unit) {
      errors.push({ fila: i + 1, error: `Tema desconocido: ${parsed.data.tema}` });
      return;
    }
    rows.push(toRow(parsed.data, unit.id));
  });
  // Si hay errores no se importa nada, para no dejar el banco a medias.
  if (errors.length === 0 && rows.length) {
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      await db.batch(chunk.map((r) => db.insert(schema.questions).values(r)) as [any, ...any[]]);
    }
  }
  return { imported: errors.length ? 0 : rows.length, errors };
}

export async function exportQuestions(db: DB): Promise<QuestionInput[]> {
  const units = await db.query.units.findMany();
  const bySlug = new Map(units.map((u) => [u.id, u.slug]));
  const qs = await db.query.questions.findMany({ orderBy: [asc(schema.questions.unitId), asc(schema.questions.id)] });
  return qs.map((q) => ({
    tema: bySlug.get(q.unitId)!,
    tipo: q.type,
    dificultad: q.dificultad,
    enunciado: q.enunciado,
    opciones: q.options ?? undefined,
    correcta: q.correctIndex ?? undefined,
    correctas: q.correctIndexes ?? undefined,
    explicacion: q.explicacion,
    respuesta_referencia: q.referenceAnswer,
    puntos_clave: q.keyPoints,
    activo: q.activo,
  }));
}

/** Preguntas activas por tema y tipo, con aviso si no alcanzan para los tests configurados. */
export async function bankCoverage(db: DB) {
  const s = await getSettings(db);
  const comp = finalComposition(s, await jevAvailable(db));
  const units = await db.query.units.findMany({ orderBy: asc(schema.units.orden) });
  const counts = await db
    .select({ unitId: schema.questions.unitId, type: schema.questions.type, dificultad: schema.questions.dificultad, n: count() })
    .from(schema.questions)
    .where(eq(schema.questions.activo, true))
    .groupBy(schema.questions.unitId, schema.questions.type, schema.questions.dificultad);
  const get = (u: number, t: string, d?: string) =>
    counts.filter((c) => c.unitId === u && c.type === t && (!d || c.dificultad === d)).reduce((a, c) => a + c.n, 0);
  const active = units.filter((u) => u.activo);
  const rows = units.map((u) => {
    const obj = (d?: string) => get(u.id, "mc", d) + get(u.id, "multi", d);
    const mc = obj();
    const multi = get(u.id, "multi");
    const written = get(u.id, "written");
    const warnings: string[] = [];
    if (u.activo && mc < s.unit_quiz_size) warnings.push(`Menos preguntas tipo test (${mc}) que el tamaño del test (${s.unit_quiz_size})`);
    else if (u.activo && mc < s.unit_quiz_size * 2) warnings.push("Pocas preguntas tipo test para rotar entre intentos");
    if (u.activo && written === 0 && comp.written > 0) warnings.push("Sin preguntas escritas");
    const porDificultad = { baja: obj("baja"), media: obj("media"), alta: obj("alta") };
    if (u.activo && s.mix_alta > 0 && porDificultad.alta === 0) warnings.push("Sin preguntas tipo test de dificultad alta");
    if (u.activo && s.mix_baja > 0 && porDificultad.baja < Math.ceil((s.unit_quiz_size * s.mix_baja) / 100)) warnings.push("Pocas preguntas tipo test de dificultad baja");
    return { unit: u, mc, multi, written, porDificultad, warnings };
  });
  const totalMc = active.reduce((a, u) => a + get(u.id, "mc") + get(u.id, "multi"), 0);
  const totalWritten = active.reduce((a, u) => a + get(u.id, "written"), 0);
  const global: string[] = [];
  if (totalMc < comp.objective) global.push(`Faltan preguntas tipo test para el examen final (${totalMc}/${comp.objective}).`);
  if (totalWritten < comp.written) global.push(`Faltan preguntas escritas para el examen final (${totalWritten}/${comp.written}).`);
  return { rows, global, settings: s, comp };
}

export async function stats(db: DB) {
  const [users] = await db.select({ n: count() }).from(schema.users);
  const [carnets] = await db
    .select({ n: count() })
    .from(schema.carnets)
    .where(and(sql`${schema.carnets.revokedAt} IS NULL`, sql`${schema.carnets.expiresAt} > ${Date.now()}`));
  const [finals] = await db.select({ n: count() }).from(schema.attempts).where(eq(schema.attempts.kind, "final"));
  const [grading] = await db.select({ n: count() }).from(schema.attempts).where(eq(schema.attempts.status, "grading"));
  return { users: users.n, carnets: carnets.n, finals: finals.n, grading: grading.n };
}

export async function listUsers(db: DB) {
  const users = await db.query.users.findMany({ orderBy: desc(schema.users.createdAt) });
  const passed = await db
    .select({ userId: schema.attempts.userId, n: sql<number>`count(distinct ${schema.attempts.unitId})` })
    .from(schema.attempts)
    .where(and(eq(schema.attempts.kind, "unit"), eq(schema.attempts.status, "passed")))
    .groupBy(schema.attempts.userId);
  const carnets = await db.query.carnets.findMany({ orderBy: desc(schema.carnets.issuedAt) });
  return users.map((u) => ({
    ...u,
    unitsPassed: passed.find((p) => p.userId === u.id)?.n ?? 0,
    carnet: carnets.find((c) => c.userId === u.id) ?? null,
  }));
}
