// Configuración del programa municipal de colonias felinas: lo que cambia de un municipio a otro
// (nombre del plan, normativa, sede electrónica, nombres de los anexos, textos de los PDF, censo…).
// Se guarda en la clave `programa` de la tabla settings y se edita en Administración → Programa local.
// Módulo puro (solo zod): lo usan las páginas, los tests y scripts/build-local.mjs. Por eso los imports
// internos llevan la extensión .ts.
import { z } from "zod";
import { DEFAULT_TEXTOS, type AnexoTextos } from "./anexos-pdf.ts";
import { isWinAnsi, nonWinAnsiChars } from "./winansi.ts";

const blankToEmpty = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : v);

/** Texto que acaba en un PDF: solo caracteres que admiten sus fuentes. */
const pdfSafe = <T extends z.ZodType<string>>(s: T) =>
  s.refine(isWinAnsi, { error: (i) => `Contiene caracteres que no se pueden escribir en el PDF: ${nonWinAnsiChars(String(i.input)).join(" ")}` });

const texto = (max: number, min = 0) => z.preprocess(blankToEmpty, z.string().min(min, min ? `Mínimo ${min} caracteres` : undefined).max(max, `Máximo ${max} caracteres`));
const url = z.preprocess(
  blankToEmpty,
  z.union([z.literal(""), z.url({ protocol: /^https$/, error: "Debe ser una dirección https://" }).max(500)]),
);

export const CENSO_MOVIMIENTOS = { no: "No se piden", opcional: "Opcionales", obligatorio: "Obligatorios" } as const;

export const programaSchema = z.object({
  plan_nombre: pdfSafe(texto(160, 3)),
  organo: pdfSafe(texto(160, 3)),
  normativa_nombre: pdfSafe(texto(300)),
  normativa_corta: texto(120, 3),
  normativa_cita: pdfSafe(texto(200)),
  normativa_url: url,
  normativa_url_texto: texto(80),
  sede_url: url,
  sede_tramite: texto(160),
  etiqueta_registro: pdfSafe(texto(40)),
  etiqueta_colaborador: pdfSafe(texto(40)),
  etiqueta_pautas: texto(40),
  etiqueta_ficha: texto(40),
  etiqueta_censo: texto(40),
  ref_autorizacion_privado: pdfSafe(texto(300)),
  max_cuidadores: z.coerce.number().int().min(1).max(6),
  pdf_titulo_registro: pdfSafe(texto(160, 3)),
  pdf_titulo_colaborador: pdfSafe(texto(160, 3)),
  pdf_registro_resolucion: pdfSafe(texto(600)),
  pdf_colaborador_manifiesta: z.array(pdfSafe(z.string().trim().min(1).max(300))).max(6, "Máximo 6 puntos"),
  pdf_colaborador_solicita: pdfSafe(texto(400)),
  pdf_rgpd_base: pdfSafe(texto(160, 3)),
  pdf_pie: pdfSafe(texto(300)),
  censo_meses: z.coerce.number().int().min(1).max(24),
  censo_alineado: z.boolean(),
  censo_movimientos: z.enum(["no", "opcional", "obligatorio"]),
  suplemento_titulo: texto(120, 3),
});

export type Programa = z.infer<typeof programaSchema>;
export type ProgramaKey = keyof Programa;

/** Valores por defecto neutros: ningún municipio, ninguna ordenanza concreta. */
export const DEFAULT_PROGRAMA: Programa = {
  plan_nombre: DEFAULT_TEXTOS.plan,
  organo: DEFAULT_TEXTOS.organo,
  normativa_nombre: "",
  normativa_corta: "la normativa municipal",
  normativa_cita: "",
  normativa_url: "",
  normativa_url_texto: "",
  sede_url: "",
  sede_tramite: "",
  etiqueta_registro: "",
  etiqueta_colaborador: "",
  etiqueta_pautas: "",
  etiqueta_ficha: "",
  etiqueta_censo: "",
  ref_autorizacion_privado: "",
  max_cuidadores: DEFAULT_TEXTOS.maxCuidadores,
  pdf_titulo_registro: DEFAULT_TEXTOS.tituloRegistro,
  pdf_titulo_colaborador: DEFAULT_TEXTOS.tituloColaborador,
  pdf_registro_resolucion: DEFAULT_TEXTOS.registroResolucion,
  pdf_colaborador_manifiesta: DEFAULT_TEXTOS.colaboradorManifiesta,
  pdf_colaborador_solicita: DEFAULT_TEXTOS.colaboradorSolicita,
  pdf_rgpd_base: DEFAULT_TEXTOS.rgpdBase,
  pdf_pie: "",
  censo_meses: 6,
  censo_alineado: false,
  censo_movimientos: "opcional",
  suplemento_titulo: "Normativa y programa de tu municipio",
};

type Campo = { label: string; help?: string; tipo: "texto" | "largo" | "url" | "numero" | "si_no" | "lista" | "opciones" };

export const PROGRAMA_CAMPOS: Record<ProgramaKey, Campo> = {
  plan_nombre: { label: "Nombre del plan o programa municipal", tipo: "texto", help: "Aparece en la cabecera de los PDF y en la guía «Mi colonia»." },
  organo: { label: "Órgano al que se dirigen las solicitudes", tipo: "texto", help: "Por ejemplo, «Concejalía con competencias en Bienestar Animal». Segunda línea de la cabecera de los PDF." },
  normativa_nombre: { label: "Título completo de la ordenanza o norma municipal", tipo: "largo", help: "Opcional. Se cita en la política de privacidad y en la guía. Vacío si el municipio no tiene ordenanza propia." },
  normativa_corta: { label: "Forma breve de referirse a la norma", tipo: "texto", help: "Con artículo, para las frases «Según …» o «que exige …». Por ejemplo, «la ordenanza municipal»." },
  normativa_cita: { label: "Publicación oficial", tipo: "texto", help: "Opcional. Por ejemplo, «BOP de … n.º …, de …»." },
  normativa_url: { label: "Enlace al texto oficial", tipo: "url", help: "Opcional. Se enlaza desde las solicitudes." },
  normativa_url_texto: { label: "Texto del enlace al texto oficial", tipo: "texto", help: "Por ejemplo, «BOP de la provincia». Vacío = «texto oficial»." },
  sede_url: { label: "Enlace al trámite de la sede electrónica", tipo: "url", help: "Opcional. Donde se presentan las solicitudes por internet (p. ej. la Instancia General)." },
  sede_tramite: { label: "Nombre del trámite", tipo: "texto", help: "Con artículo. Por ejemplo, «la Instancia General de la sede electrónica». Vacío = «la sede electrónica del Ayuntamiento»." },
  etiqueta_registro: { label: "Nombre oficial de la solicitud de registro", tipo: "texto", help: "Por ejemplo, «Anexo I». Vacío = sin nombre oficial." },
  etiqueta_colaborador: { label: "Nombre oficial de la solicitud de alta como colaborador/a", tipo: "texto", help: "Por ejemplo, «Anexo II»." },
  etiqueta_pautas: { label: "Nombre oficial de las pautas básicas de la colonia", tipo: "texto", help: "Por ejemplo, «Anexo III»." },
  etiqueta_ficha: { label: "Nombre oficial de la ficha de cada gato", tipo: "texto", help: "Por ejemplo, «Anexo IV»." },
  etiqueta_censo: { label: "Nombre oficial del censo de la colonia", tipo: "texto", help: "Por ejemplo, «Anexo V»." },
  ref_autorizacion_privado: { label: "Norma que exige la autorización en terreno privado", tipo: "largo", help: "Sigue a «conforme al…». Por ejemplo, «artículo 12 de la Ordenanza de …». Vacío = sin referencia." },
  max_cuidadores: { label: "Máximo de personas cuidadoras en la solicitud de registro (1–6)", tipo: "numero" },
  pdf_titulo_registro: { label: "Título de la solicitud de registro", tipo: "texto" },
  pdf_titulo_colaborador: { label: "Título de la solicitud de alta como colaborador/a", tipo: "texto" },
  pdf_registro_resolucion: { label: "Párrafo final de la solicitud de registro", tipo: "largo", help: "Qué hará el Ayuntamiento con la solicitud. Admite {{ayuntamiento}} y {{municipio_mayusculas}}." },
  pdf_colaborador_manifiesta: { label: "Puntos que manifiesta la persona colaboradora (uno por línea, máximo 6)", tipo: "lista" },
  pdf_colaborador_solicita: { label: "Frase final de la solicitud de alta como colaborador/a", tipo: "largo" },
  pdf_rgpd_base: { label: "Base legal del aviso de protección de datos", tipo: "texto", help: "Por ejemplo, «Ley 7/2023 y ordenanza municipal»." },
  pdf_pie: { label: "Pie de las solicitudes", tipo: "largo", help: "Opcional. Por ejemplo, dónde se publicó la ordenanza." },
  censo_meses: { label: "El censo se actualiza cada (meses, 1–24)", tipo: "numero" },
  censo_alineado: {
    label: "Censo por periodos naturales",
    tipo: "si_no",
    help: "Si se marca, toca actualizarlo al empezar cada periodo (con 6 meses: enero–junio y julio–diciembre) en lugar de contar desde el último censo.",
  },
  censo_movimientos: { label: "Movimientos del censo (nacidos, nuevos, fallecidos, adopciones…)", tipo: "opciones" },
  suplemento_titulo: { label: "Título del suplemento local del temario", tipo: "texto", help: "El contenido se escribe en Textos → Suplemento local. Si está vacío, no se muestra." },
};

export const PROGRAMA_LABELS = Object.fromEntries(Object.entries(PROGRAMA_CAMPOS).map(([k, v]) => [k, v.label])) as Record<ProgramaKey, string>;

export const PROGRAMA_GROUPS: [string, ProgramaKey[]][] = [
  ["Programa y normativa", ["plan_nombre", "organo", "normativa_nombre", "normativa_corta", "normativa_cita", "normativa_url", "normativa_url_texto"]],
  ["Sede electrónica", ["sede_url", "sede_tramite"]],
  ["Nombres oficiales de los formularios", ["etiqueta_registro", "etiqueta_colaborador", "etiqueta_pautas", "etiqueta_ficha", "etiqueta_censo", "ref_autorizacion_privado"]],
  [
    "Solicitudes en PDF",
    ["max_cuidadores", "pdf_titulo_registro", "pdf_titulo_colaborador", "pdf_registro_resolucion", "pdf_colaborador_manifiesta", "pdf_colaborador_solicita", "pdf_rgpd_base", "pdf_pie"],
  ],
  ["Censo de las colonias", ["censo_meses", "censo_alineado", "censo_movimientos"]],
  ["Suplemento local del temario", ["suplemento_titulo"]],
];

/**
 * Lectura tolerante: cada campo que falte o no sea válido toma su valor por defecto, sin perder el resto
 * (p. ej. al añadir campos nuevos o si una versión anterior guardó algo que ya no se admite).
 */
export function parsePrograma(value: unknown): Programa {
  const v = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const [k, schema] of Object.entries(programaSchema.shape)) {
    const r = v[k] === undefined ? null : (schema as z.ZodType).safeParse(v[k]);
    out[k] = r?.success ? r.data : DEFAULT_PROGRAMA[k as ProgramaKey];
  }
  return out as Programa;
}

// ---------- Plantillas ----------

/**
 * Sustituye los marcadores de un texto: `{{var}}` por su valor, `{{#var}}…{{/var}}` solo si la variable
 * tiene valor y `{{^var}}…{{/var}}` solo si no lo tiene. Los marcadores desconocidos se dejan tal cual y
 * los valores no se vuelven a procesar (un valor con «{{…}}» no ejecuta nada).
 */
export function renderTemplate(texto: string, vars: Record<string, string | number | boolean | null | undefined>): string {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(vars, k);
  const truthy = (k: string) => {
    const v = vars[k];
    return v !== null && v !== undefined && v !== false && String(v).trim() !== "" && v !== 0;
  };
  let t = texto;
  // Secciones: de dentro afuera, hasta que no quede ninguna conocida (admite secciones anidadas).
  for (let i = 0; i < 10; i++) {
    const next = t.replace(/\{\{([#^])(\w+)\}\}((?:(?!\{\{[#^]\2\}\})[\s\S])*?)\{\{\/\2\}\}/g, (m, tipo: string, k: string, body: string) => {
      if (!has(k)) return m;
      return (tipo === "#") === truthy(k) ? body : "";
    });
    if (next === t) break;
    t = next;
  }
  return t.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (has(k) ? String(vars[k] ?? "") : m));
}

const NUMEROS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce",
  "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés", "veinticuatro"];

/** Número en letra (hasta 24), para los textos. */
export function enLetra(n: number): string {
  return NUMEROS[n] ?? String(n);
}

/** «seis meses», «mes», «año», «dos años»: se usa detrás de «cada». */
export function periodoTexto(meses: number): string {
  if (meses === 1) return "mes";
  if (meses === 12) return "año";
  if (meses === 24) return "dos años";
  return `${enLetra(meses)} meses`;
}

/** Periodicidad del censo, para `censusDue`. */
export function censoPeriodo(p: Programa) {
  return { meses: p.censo_meses, alineado: p.censo_alineado };
}

export type EtiquetaClave = "registro" | "colaborador" | "pautas" | "ficha" | "censo";

/** Nombre oficial de un formulario (p. ej. «Anexo I»), o cadena vacía si el municipio no lo usa. */
export function etiqueta(p: Programa, clave: EtiquetaClave): string {
  return p[`etiqueta_${clave}`].trim();
}

/** « (Anexo I)» o nada: para añadir detrás de un texto. */
export function entreParentesis(p: Programa, clave: EtiquetaClave): string {
  const e = etiqueta(p, clave);
  return e ? ` (${e})` : "";
}

type BrandingBasico = { municipio: string; provincia: string };

/** Variables disponibles en las páginas editables y en los textos de los PDF. */
export function programaVars(p: Programa, b: BrandingBasico) {
  return {
    municipio: b.municipio,
    municipio_mayusculas: b.municipio.toUpperCase(),
    provincia: b.provincia,
    ayuntamiento: `Ayuntamiento de ${b.municipio}`,
    plan_nombre: p.plan_nombre,
    organo: p.organo,
    normativa_nombre: p.normativa_nombre,
    normativa_corta: p.normativa_corta,
    normativa_cita: p.normativa_cita,
    normativa_url: p.normativa_url,
    normativa_url_texto: p.normativa_url_texto || "texto oficial",
    sede_url: p.sede_url,
    sede_tramite: p.sede_tramite || "la sede electrónica del Ayuntamiento",
    etiqueta_registro: p.etiqueta_registro,
    etiqueta_colaborador: p.etiqueta_colaborador,
    etiqueta_pautas: p.etiqueta_pautas,
    etiqueta_ficha: p.etiqueta_ficha,
    etiqueta_censo: p.etiqueta_censo,
    ref_autorizacion_privado: p.ref_autorizacion_privado,
    max_cuidadores: p.max_cuidadores,
    max_cuidadores_letra: enLetra(p.max_cuidadores),
    censo_periodo: periodoTexto(p.censo_meses),
    suplemento_titulo: p.suplemento_titulo,
    // Nombres de los PDF en blanco (ver `docsPdf`).
    pdf_registro: `/docs/${docsPdf(p).registro}`,
    pdf_colaborador: `/docs/${docsPdf(p).colaborador}`,
    pdf_autorizacion: `/docs/${docsPdf(p).autorizacion}`,
  };
}

/** Descripción de cada marcador para el editor de textos. */
export const MARCADORES: Record<keyof ReturnType<typeof programaVars>, string> = {
  municipio: "Nombre del municipio",
  municipio_mayusculas: "Nombre del municipio en mayúsculas",
  provincia: "Provincia",
  ayuntamiento: "«Ayuntamiento de …»",
  plan_nombre: "Nombre del plan o programa",
  organo: "Órgano al que se dirigen las solicitudes",
  normativa_nombre: "Título completo de la norma (puede estar vacío)",
  normativa_corta: "Forma breve de la norma, con artículo",
  normativa_cita: "Publicación oficial (puede estar vacía)",
  normativa_url: "Enlace al texto oficial (puede estar vacío)",
  normativa_url_texto: "Texto del enlace al texto oficial",
  sede_url: "Enlace al trámite de la sede electrónica (puede estar vacío)",
  sede_tramite: "Nombre del trámite, con artículo",
  etiqueta_registro: "Nombre oficial de la solicitud de registro (p. ej. Anexo I)",
  etiqueta_colaborador: "Nombre oficial de la solicitud de alta como colaborador/a",
  etiqueta_pautas: "Nombre oficial de las pautas",
  etiqueta_ficha: "Nombre oficial de la ficha del gato",
  etiqueta_censo: "Nombre oficial del censo",
  ref_autorizacion_privado: "Norma que exige la autorización en terreno privado",
  max_cuidadores: "Máximo de personas cuidadoras (número)",
  max_cuidadores_letra: "Máximo de personas cuidadoras (en letra)",
  censo_periodo: "Periodo del censo, detrás de «cada» (p. ej. «seis meses»)",
  suplemento_titulo: "Título del suplemento local",
  pdf_registro: "Enlace al PDF en blanco de la solicitud de registro",
  pdf_colaborador: "Enlace al PDF en blanco de la solicitud de alta como colaborador/a",
  pdf_autorizacion: "Enlace al PDF en blanco de la autorización de la persona propietaria",
};

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Nombres de los PDF en blanco y de los rellenos. Con nombre oficial llevan su prefijo
 * («anexo-i-solicitud-registro-colonia.pdf»); sin él, el nombre genérico.
 */
export function docsPdf(p: Programa) {
  const pre = (clave: EtiquetaClave) => (etiqueta(p, clave) ? `${slug(etiqueta(p, clave))}-` : "");
  return {
    registro: `${pre("registro")}solicitud-registro-colonia.pdf`,
    colaborador: `${pre("colaborador")}solicitud-alta-colaborador.pdf`,
    autorizacion: "autorizacion-propietario-terreno.pdf",
    registroYAutorizacion: `${pre("registro") || "solicitud-registro-"}y-autorizacion-propietario.pdf`,
  };
}

/** Textos de los PDF de las solicitudes, ya resueltos para este municipio. */
export function textosAnexos(p: Programa, b: BrandingBasico): AnexoTextos {
  const vars = programaVars(p, b);
  return {
    organo: p.organo,
    plan: p.plan_nombre,
    pie: renderTemplate(p.pdf_pie, vars),
    rgpdBase: p.pdf_rgpd_base,
    etiquetaRegistro: p.etiqueta_registro,
    etiquetaColaborador: p.etiqueta_colaborador,
    tituloRegistro: p.pdf_titulo_registro,
    tituloColaborador: p.pdf_titulo_colaborador,
    registroResolucion: renderTemplate(p.pdf_registro_resolucion, vars),
    colaboradorManifiesta: p.pdf_colaborador_manifiesta.map((x) => renderTemplate(x, vars)),
    colaboradorSolicita: renderTemplate(p.pdf_colaborador_solicita, vars),
    refAutorizacion: p.ref_autorizacion_privado,
    normativaCita: p.normativa_cita,
    maxCuidadores: p.max_cuidadores,
  };
}
