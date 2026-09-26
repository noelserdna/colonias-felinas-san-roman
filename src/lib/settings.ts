import { z } from "zod";
import type { DB } from "./db";
import * as schema from "./db/schema";

export const settingsSchema = z
  .object({
    unit_quiz_size: z.number().int().min(1).max(100),
    unit_pass_pct: z.number().min(0).max(100),
    final_mc_count: z.number().int().min(0).max(200),
    final_written_count: z.number().int().min(0).max(50),
    final_pass_pct: z.number().min(0).max(100),
    // Umbral en la escala Score de JEV (0 = incorrecta … 3 = completa).
    jev_pass_score: z.number().min(0).max(3),
    // Probabilidad a partir de la cual se considera que la respuesta no contesta o intenta manipular.
    jev_flag_threshold: z.number().min(0).max(1),
    // Meses de validez del carnet. 0 = indefinido (vale mientras se colabora; se retira al revocarlo).
    carnet_validity_months: z.number().int().min(0).max(240),
    carnet_prefix: z.string().trim().min(1).max(20),
    // Días de antelación del aviso de caducidad del carnet (se repite 15 días después si sigue sin renovar).
    // No se usa con carnets indefinidos.
    carnet_aviso_dias: z.number().int().min(1).max(180),
    magic_link_ttl_min: z.number().int().min(5).max(1440),
    final_min_per_unit: z.number().int().min(0).max(10),
    // Reparto de dificultad en cada test/examen (porcentajes que suman 100).
    mix_baja: z.number().min(0).max(100),
    mix_media: z.number().min(0).max(100),
    mix_alta: z.number().min(0).max(100),
  })
  .refine((s) => s.final_mc_count + s.final_written_count > 0, {
    message: "El examen final debe tener al menos una pregunta",
  })
  .refine((s) => Math.abs(s.mix_baja + s.mix_media + s.mix_alta - 100) < 0.01, {
    message: "Los porcentajes de dificultad (baja + media + alta) deben sumar 100",
    path: ["mix_baja"],
  });

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  unit_quiz_size: 10,
  unit_pass_pct: 70,
  final_mc_count: 15,
  final_written_count: 5,
  final_pass_pct: 70,
  jev_pass_score: 2,
  jev_flag_threshold: 0.7,
  carnet_validity_months: 0,
  carnet_prefix: "CF",
  carnet_aviso_dias: 30,
  magic_link_ttl_min: 15,
  final_min_per_unit: 1,
  mix_baja: 50,
  mix_media: 40,
  mix_alta: 10,
};

export const SETTINGS_LABELS: Record<keyof Settings, string> = {
  unit_quiz_size: "Preguntas por test de tema",
  unit_pass_pct: "Aprobado en test de tema (%)",
  final_mc_count: "Preguntas tipo test en el examen final",
  final_written_count: "Preguntas escritas en el examen final",
  final_pass_pct: "Aprobado en examen final (%)",
  jev_pass_score: "Puntuación JEV mínima para dar por buena una respuesta escrita (0–3)",
  jev_flag_threshold: "Umbral JEV de respuesta no válida / manipulación (0–1)",
  carnet_validity_months: "Validez del carnet (meses; vacío = indefinido)",
  carnet_prefix: "Prefijo del número de carnet",
  carnet_aviso_dias: "Aviso de caducidad del carnet (días antes)",
  magic_link_ttl_min: "Caducidad del enlace de acceso (minutos)",
  final_min_per_unit: "Mínimo de preguntas por tema en el examen final",
  mix_baja: "Preguntas de dificultad baja (%)",
  mix_media: "Preguntas de dificultad media (%)",
  mix_alta: "Preguntas de dificultad alta (%)",
};

export function difficultyMix(s: Settings) {
  return { baja: s.mix_baja, media: s.mix_media, alta: s.mix_alta };
}

export async function getSettings(db: DB): Promise<Settings> {
  const rows = await db.select().from(schema.settings);
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) merged[r.key] = r.value;
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(db: DB, input: unknown): Promise<Settings> {
  const s = settingsSchema.parse(input);
  await db.batch(
    Object.entries(s).map(([key, value]) =>
      db.insert(schema.settings).values({ key, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } }),
    ) as [any, ...any[]],
  );
  return s;
}

/**
 * Composición efectiva del examen final. Sin corrector de respuestas escritas (JEV) disponible,
 * las escritas se sustituyen por preguntas objetivas para mantener el mismo número de preguntas.
 */
export function finalComposition(s: Settings, jevAvailable: boolean) {
  if (jevAvailable) return { objective: s.final_mc_count, written: s.final_written_count, jevAvailable };
  return { objective: s.final_mc_count + s.final_written_count, written: 0, jevAvailable };
}
