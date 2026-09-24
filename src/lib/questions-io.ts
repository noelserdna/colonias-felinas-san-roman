import { z } from "zod";

/** Formato de intercambio de preguntas (importación/exportación y semilla). */
export const questionInput = z
  .object({
    tema: z.union([z.string().trim().min(1), z.number().int()]), // slug u orden del tema
    tipo: z.enum(["mc", "multi", "written"]),
    dificultad: z.enum(["baja", "media", "alta"]).optional(),
    enunciado: z.string().trim().min(5).max(1000),
    opciones: z.array(z.string().trim().min(1).max(500)).optional(),
    correcta: z.number().int().min(0).optional(), // índice 0-based (tipo test)
    correctas: z.array(z.number().int().min(0)).optional(), // índices 0-based (varias correctas)
    explicacion: z.string().trim().max(1000).optional().nullable(),
    respuesta_referencia: z.string().trim().max(2000).optional().nullable(),
    puntos_clave: z.array(z.string().trim().min(1).max(300)).optional().nullable(),
    activo: z.boolean().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.tipo === "mc") {
      if (!q.opciones || q.opciones.length < 2) ctx.addIssue({ code: "custom", message: "Una pregunta tipo test necesita al menos 2 opciones" });
      else if (q.correcta == null || q.correcta >= q.opciones.length)
        ctx.addIssue({ code: "custom", message: "La opción correcta no es válida" });
    } else if (q.tipo === "multi") {
      const n = q.opciones?.length ?? 0;
      const c = [...new Set(q.correctas ?? [])];
      if (n < 3) ctx.addIssue({ code: "custom", message: "Una pregunta de varias correctas necesita al menos 3 opciones" });
      else if (c.length === 0) ctx.addIssue({ code: "custom", message: "Indica al menos una opción correcta" });
      else if (c.some((i) => i >= n)) ctx.addIssue({ code: "custom", message: "Alguna opción correcta no existe" });
      else if (c.length === n) ctx.addIssue({ code: "custom", message: "No pueden ser correctas todas las opciones" });
    } else if (!q.respuesta_referencia) {
      ctx.addIssue({ code: "custom", message: "Una pregunta escrita necesita respuesta de referencia" });
    }
  });

export type QuestionInput = z.infer<typeof questionInput>;

// ---------- CSV ----------

export const CSV_HEADERS = [
  "tema",
  "tipo",
  "dificultad",
  "enunciado",
  "opcion1",
  "opcion2",
  "opcion3",
  "opcion4",
  "opcion5",
  "opcion6",
  "correcta",
  "explicacion",
  "respuesta_referencia",
  "puntos_clave",
  "activo",
];

export function parseCsv(text: string, sep?: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delim = sep ?? (src.split("\n")[0].split(";").length > src.split("\n")[0].split(",").length ? ";" : ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Convierte filas CSV (con cabecera) al formato de intercambio. `correcta` en CSV es 1-based. */
export function csvToInputs(text: string): unknown[] {
  const [header, ...rows] = parseCsv(text);
  const idx = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const get = (r: string[], name: string) => {
    const i = idx(name);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  return rows.map((r) => {
    const t = get(r, "tipo").toLowerCase();
    const tipo = t === "escrita" ? "written" : t === "test" ? "mc" : t === "varias" ? "multi" : t;
    const tema = get(r, "tema");
    const opciones = ["opcion1", "opcion2", "opcion3", "opcion4", "opcion5", "opcion6"].map((k) => get(r, k)).filter(Boolean);
    const correcta = get(r, "correcta");
    const activo = get(r, "activo");
    const dif = get(r, "dificultad").toLowerCase();
    return {
      tema: /^\d+$/.test(tema) ? Number(tema) : tema,
      tipo,
      dificultad: dif || undefined,
      enunciado: get(r, "enunciado"),
      opciones: tipo === "mc" || tipo === "multi" ? opciones : undefined,
      correcta: tipo === "mc" && correcta ? Number(correcta) - 1 : undefined,
      // En CSV las correctas de "varias" van separadas por | (1-based): "1|3"
      correctas: tipo === "multi" && correcta ? correcta.split(/[|,]/).map((x) => Number(x.trim()) - 1).filter((x) => Number.isInteger(x)) : undefined,
      explicacion: get(r, "explicacion") || null,
      respuesta_referencia: get(r, "respuesta_referencia") || null,
      puntos_clave: get(r, "puntos_clave") ? get(r, "puntos_clave").split("|").map((s) => s.trim()).filter(Boolean) : null,
      activo: activo ? !/^(0|no|false)$/i.test(activo) : undefined,
    };
  });
}

export function inputsToCsv(items: QuestionInput[]): string {
  const lines = [CSV_HEADERS.join(";")];
  for (const q of items) {
    const opts = q.opciones ?? [];
    lines.push(
      [
        q.tema,
        q.tipo === "mc" ? "test" : q.tipo === "multi" ? "varias" : "escrita",
        q.dificultad ?? "media",
        q.enunciado,
        opts[0],
        opts[1],
        opts[2],
        opts[3],
        opts[4],
        opts[5],
        q.tipo === "mc" && q.correcta != null ? q.correcta + 1 : q.tipo === "multi" ? (q.correctas ?? []).map((i) => i + 1).join("|") : "",
        q.explicacion,
        q.respuesta_referencia,
        (q.puntos_clave ?? []).join(" | "),
        q.activo === false ? "no" : "si",
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  return "﻿" + lines.join("\r\n");
}
