// Genera las solicitudes de registro de colonia y de alta como colaborador/a, la autorización de la
// persona propietaria del terreno (en blanco o rellenas) y el censo de una colonia para presentarlo en papel. Los textos que dependen de la normativa de cada
// municipio (nombres de los anexos, órgano, pie…) llegan en `textos` (Administración → Programa local).
// Módulo puro (sin dependencias de Cloudflare): se usa en el navegador, en el servidor y en scripts de Node.
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import { toWinAnsi } from "./winansi.ts";

export type Persona = { nombre?: string; nif?: string; telefono?: string; email?: string };
export type Solicitante = Persona & { direccion?: string };

export type AnexoIData = {
  solicitante: Solicitante;
  cuidadores: Persona[]; // hasta textos.maxCuidadores
  colonia: {
    direccion?: string;
    coordenadas?: string;
    titularidad?: "" | "publico" | "privado";
    hembrasEsterilizadas?: string;
    hembrasSinEsterilizar?: string;
    machosCastrados?: string;
    machosSinCastrar?: string;
    adoptables?: string;
    enfermos?: string;
  };
  lugar?: string;
  fecha?: Date | null;
};

export type AnexoIIData = { solicitante: Solicitante; lugar?: string; fecha?: Date | null };

export type AutorizacionData = {
  propietario: Solicitante & { representa?: string };
  terreno: { direccion?: string; referenciaCatastral?: string; coordenadas?: string };
  responsable: Persona;
  lugar?: string;
  fecha?: Date | null;
};

/** Textos de los formularios que cambian de un municipio a otro. Se resuelven en `textosAnexos` (programa-config). */
export type AnexoTextos = {
  /** Segunda línea de la cabecera (p. ej. «Concejalía con competencias en Bienestar Animal»). */
  organo: string;
  /** Tercera línea de la cabecera: nombre del plan o programa municipal. */
  plan: string;
  /** Pie de las solicitudes (p. ej. la publicación oficial de la ordenanza). Vacío = sin pie. */
  pie: string;
  /** Base legal en el aviso de protección de datos (p. ej. «Ley 7/2023 y ordenanza municipal»). */
  rgpdBase: string;
  /** Nombre oficial de cada formulario (p. ej. «Anexo I»). Vacío = sin nombre oficial. */
  etiquetaRegistro: string;
  etiquetaColaborador: string;
  /** Nombre oficial del censo de la colonia (p. ej. «Anexo V»). Vacío = sin nombre oficial. */
  etiquetaCenso: string;
  tituloRegistro: string;
  tituloColaborador: string;
  /** Párrafo final del registro (qué hará el Ayuntamiento con la solicitud). */
  registroResolucion: string;
  colaboradorManifiesta: string[];
  colaboradorSolicita: string;
  /** Referencia de la norma que exige la autorización en terreno privado (p. ej. «apartado 7.1.4 de la Ordenanza…»). */
  refAutorizacion: string;
  /** Cita de la publicación oficial de la norma (p. ej. «BOP de … n.º …»), para el pie de la autorización. */
  normativaCita: string;
  /** Filas de personas cuidadoras en la solicitud de registro. */
  maxCuidadores: number;
};

/** Textos genéricos, sin referencias a la normativa de ningún municipio. */
export const DEFAULT_TEXTOS: AnexoTextos = {
  organo: "Área municipal con competencias en bienestar animal",
  plan: "Programa municipal de gestión de colonias felinas",
  pie: "",
  rgpdBase: "Ley 7/2023 y normativa municipal",
  etiquetaRegistro: "",
  etiquetaColaborador: "",
  etiquetaCenso: "",
  tituloRegistro: "Solicitud para registrar una nueva colonia de gatos urbanos",
  tituloColaborador: "Solicitud de alta como persona colaboradora del programa de colonias felinas",
  registroResolucion:
    "El Ayuntamiento, conocida la solicitud, la analizará, visitará la ubicación y consultará lo que considere conveniente. Se emitirá un informe justificando la autorización o no de la colonia.",
  colaboradorManifiesta: [
    "Se ofrece voluntario o voluntaria para atender las colonias felinas urbanas que le sean asignadas, como persona colaboradora autorizada.",
    "Se compromete a cumplir el programa municipal de gestión de colonias felinas y a seguir las instrucciones del Ayuntamiento en todo momento.",
    "Se compromete a completar la formación para personas cuidadoras que indique el Ayuntamiento.",
    "Que acompaña la siguiente documentación: fotocopia de DNI.",
  ],
  colaboradorSolicita: "Por todo ello, SOLICITA su alta como persona colaboradora autorizada para la gestión y control de las colonias felinas.",
  refAutorizacion: "",
  normativaCita: "",
  maxCuidadores: 4,
};

/** «Anexo I: Título» o solo «Título», según haya nombre oficial. */
const conEtiqueta = (etiqueta: string, titulo: string, sep = ": ") => (etiqueta.trim() ? `${etiqueta.trim()}${sep}${titulo}` : titulo);

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  municipio: string;
  escudo?: PDFImage;
  t: AnexoTextos;
};

const A4: [number, number] = [595.28, 841.89];
const M = 50; // margen
const W = A4[0] - 2 * M;
const INK = rgb(0.1, 0.12, 0.11);
const MUTED = rgb(0.35, 0.39, 0.37);
const LINE = rgb(0.55, 0.58, 0.56);
const FILL = rgb(0.05, 0.25, 0.45); // texto rellenado, en azul oscuro como si fuera a mano

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Recorta el texto para que quepa en el ancho indicado. */
function fit(raw: string, font: PDFFont, size: number, width: number): string {
  const text = toWinAnsi(raw);
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > width) t = t.slice(0, -1);
  return t + "…";
}

/** Parte un texto en líneas que caben en el ancho. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = toWinAnsi(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function text(c: Ctx, s: string, x: number, y: number, size = 10, font = c.font, color = INK) {
  // Las fuentes estándar solo admiten WinAnsi: un emoji o un «≥» no deben romper el PDF.
  c.page.drawText(toWinAnsi(s), { x, y, size, font, color });
}

function paragraph(c: Ctx, s: string, size = 10, font = c.font, gap = 4) {
  for (const line of wrap(s, font, size, W)) {
    text(c, line, M, c.y, size, font);
    c.y -= size + gap;
  }
}

function heading(c: Ctx, s: string) {
  c.y -= 8;
  c.page.drawRectangle({ x: M, y: c.y - 4, width: W, height: 18, color: rgb(0.9, 0.94, 0.92) });
  text(c, s, M + 6, c.y + 1, 10, c.bold, rgb(0.14, 0.34, 0.25));
  c.y -= 26;
}

/** Campo «Etiqueta: ____ valor» en una línea, de ancho `width` desde `x`. */
function field(c: Ctx, label: string, value: string | undefined, x = M, width = W, y = c.y) {
  const lw = c.bold.widthOfTextAtSize(label, 9.5) + 6;
  text(c, label, x, y, 9.5, c.bold);
  c.page.drawLine({ start: { x: x + lw, y: y - 2 }, end: { x: x + width, y: y - 2 }, thickness: 0.6, color: LINE });
  if (value) text(c, fit(value, c.font, 10.5, width - lw - 4), x + lw + 3, y + 0.5, 10.5, c.font, FILL);
}

function header(c: Ctx, titulo: string) {
  const top = A4[1] - M;
  if (c.escudo) {
    const h = 58;
    const w = (c.escudo.width / c.escudo.height) * h;
    c.page.drawImage(c.escudo, { x: M, y: top - h + 6, width: w, height: h });
  }
  const tx = M + 60;
  text(c, `AYUNTAMIENTO DE ${c.municipio.toUpperCase()}`, tx, top - 8, 11, c.bold);
  text(c, fit(c.t.organo, c.font, 9.5, A4[0] - M - tx), tx, top - 23, 9.5, c.font, MUTED);
  text(c, fit(c.t.plan, c.font, 9.5, A4[0] - M - tx), tx, top - 36, 9.5, c.font, MUTED);
  c.page.drawLine({ start: { x: M, y: top - 60 }, end: { x: A4[0] - M, y: top - 60 }, thickness: 1, color: rgb(0.18, 0.42, 0.31) });
  c.y = top - 84;
  for (const line of wrap(titulo, c.bold, 12.5, W)) {
    text(c, line, M, c.y, 12.5, c.bold);
    c.y -= 17;
  }
  c.y -= 2;
}

function firma(c: Ctx, lugar?: string, fecha?: Date | null, quien = "El/La solicitante") {
  c.y -= 10;
  const d = fecha ?? null;
  const y = c.y;
  field(c, "En", lugar, M, 190, y);
  field(c, ", a", d ? String(d.getDate()) : undefined, M + 195, 55, y);
  field(c, "de", d ? MESES[d.getMonth()] : undefined, M + 255, 120, y);
  field(c, "de", d ? String(d.getFullYear()) : undefined, M + 380, W - 380, y);
  c.y = Math.max(c.y - 58, M + 64); // la línea de firma nunca pisa el pie de protección de datos
  c.page.drawLine({ start: { x: M + W - 200, y: c.y }, end: { x: M + W, y: c.y }, thickness: 0.6, color: LINE });
  text(c, `Fdo.: ${quien}`, M + W - 200, c.y - 12, 9.5, c.font, MUTED);
  c.y -= 30;
}

function proteccionDatos(c: Ctx, pie = c.t.pie, finalidad = "tramitar esta solicitud y gestionar el registro de colonias felinas y de personas cuidadoras") {
  const size = 7.5;
  const t =
    `Protección de datos: el responsable del tratamiento es el Ayuntamiento de ${c.municipio}. Los datos se tratan para ${finalidad}, ` +
    `en ejercicio de las competencias municipales (${c.t.rgpdBase}). ` +
    "Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad ante el Ayuntamiento.";
  const lines = wrap(t, c.font, size, W);
  let y = M + lines.length * (size + 2);
  for (const l of lines) {
    text(c, l, M, y, size, c.font, MUTED);
    y -= size + 2;
  }
  let py = M - 16;
  for (const l of wrap(pie, c.font, 7.5, W)) {
    text(c, l, M, py, 7.5, c.font, MUTED);
    py -= 9.5;
  }
}

async function newDoc(municipio: string, escudoPng: Uint8Array | undefined, title: string, textos?: Partial<AnexoTextos>) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setLanguage("es-ES");
  doc.setCreator("Cuidadores de Colonias Felinas");
  const page = doc.addPage(A4);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let escudo: PDFImage | undefined;
  if (escudoPng) {
    try {
      escudo = await doc.embedPng(escudoPng);
    } catch {
      try {
        escudo = await doc.embedJpg(escudoPng);
      } catch {
        escudo = undefined;
      }
    }
  }
  const c: Ctx = { doc, page, font, bold, y: 0, municipio, escudo, t: { ...DEFAULT_TEXTOS, ...textos } };
  return c;
}

type Opts<D> = { municipio: string; escudoPng?: Uint8Array; data?: D; textos?: Partial<AnexoTextos> };

/** Solicitud para registrar una nueva colonia de gatos urbanos (en San Román, el Anexo I de la ordenanza). */
export async function anexoI(opts: Opts<AnexoIData>): Promise<Uint8Array> {
  const d = opts.data;
  const t = { ...DEFAULT_TEXTOS, ...opts.textos };
  const c = await newDoc(opts.municipio, opts.escudoPng, conEtiqueta(t.etiquetaRegistro, t.tituloRegistro, " · "), t);
  header(c, conEtiqueta(t.etiquetaRegistro, t.tituloRegistro).toUpperCase());

  heading(c, "DATOS DE LA PERSONA SOLICITANTE");
  const s = d?.solicitante ?? {};
  field(c, "NIF:", s.nif, M, 180);
  c.y -= 22;
  field(c, "Nombre y apellidos:", s.nombre);
  c.y -= 22;
  field(c, "Dirección:", s.direccion);
  c.y -= 22;
  field(c, "Teléfono:", s.telefono, M, 180);
  field(c, "Correo electrónico:", s.email, M + 195, W - 195);
  c.y -= 14;

  heading(c, "DATOS DE LAS PERSONAS QUE DESEAN SER CUIDADORES/AS DE LA COLONIA");
  const cols = [
    { t: "NOMBRE Y APELLIDOS", x: M + 18, w: 190 },
    { t: "NIF", x: M + 214, w: 75 },
    { t: "TELÉFONO", x: M + 295, w: 75 },
    { t: "E-MAIL", x: M + 376, w: W - 376 },
  ];
  for (const col of cols) text(c, col.t, col.x, c.y, 8, c.bold, MUTED);
  c.y -= 16;
  // Hasta 4 filas con el espaciado normal; con más, se apretan para que todo quepa en una página.
  const filas = Math.min(6, Math.max(1, Math.round(t.maxCuidadores)));
  const alto = filas <= 4 ? 20 : Math.max(14, Math.floor(88 / filas));
  for (let i = 0; i < filas; i++) {
    const p = d?.cuidadores?.[i] ?? {};
    text(c, String(i + 1), M + 2, c.y, 9.5, c.bold);
    const vals = [p.nombre, p.nif, p.telefono, p.email];
    cols.forEach((col, j) => {
      c.page.drawLine({ start: { x: col.x, y: c.y - 2 }, end: { x: col.x + col.w - 6, y: c.y - 2 }, thickness: 0.6, color: LINE });
      const v = vals[j];
      if (v) text(c, fit(v, c.font, 9.5, col.w - 8), col.x + 1, c.y + 0.5, 9.5, c.font, FILL);
    });
    c.y -= alto;
  }
  c.y -= 2;

  heading(c, "DATOS DE LA POSIBLE COLONIA");
  const col = d?.colonia ?? {};
  field(c, "Dirección exacta:", col.direccion);
  c.y -= 22;
  field(c, "Coordenadas:", col.coordenadas, M, 250);
  const tit = col.titularidad === "publico" ? "Público" : col.titularidad === "privado" ? "Privado" : undefined;
  field(c, "Solar privado o público:", tit, M + 265, W - 265);
  c.y -= 24;
  text(c, "Número de gatos:", M, c.y, 9.5, c.bold);
  c.y -= 18;
  field(c, "– Hembras:  Esterilizadas:", col.hembrasEsterilizadas, M + 10, 200);
  field(c, "Sin esterilizar:", col.hembrasSinEsterilizar, M + 225, 130);
  c.y -= 20;
  field(c, "– Machos:  Castrados:", col.machosCastrados, M + 10, 200);
  field(c, "Sin castrar:", col.machosSinCastrar, M + 225, 130);
  c.y -= 21;
  field(c, "Gatos domésticos abandonados o recién nacidos que pudieran ser adoptados:", col.adoptables);
  c.y -= 21;
  text(c, "Presencia de gatos enfermos (en caso afirmativo, describa síntomas):", M, c.y, 9.5, c.bold);
  c.y -= 16;
  const enfermos = col.enfermos ? wrap(col.enfermos, c.font, 10.5, W - 4) : [];
  for (let i = 0; i < 2; i++) {
    c.page.drawLine({ start: { x: M, y: c.y - 2 }, end: { x: M + W, y: c.y - 2 }, thickness: 0.6, color: LINE });
    if (enfermos[i]) text(c, i === 1 && enfermos.length > 2 ? fit(enfermos.slice(1).join(" "), c.font, 10.5, W - 4) : enfermos[i], M + 3, c.y + 0.5, 10.5, c.font, FILL);
    c.y -= 18;
  }
  c.y -= 6;
  if (t.registroResolucion.trim()) paragraph(c, t.registroResolucion, 9.5);
  firma(c, d?.lugar, d?.fecha ?? null);
  proteccionDatos(c);
  return c.doc.save();
}

/** Solicitud de alta como persona colaboradora (en San Román, el Anexo II de la ordenanza). */
export async function anexoII(opts: Opts<AnexoIIData>): Promise<Uint8Array> {
  const d = opts.data;
  const t = { ...DEFAULT_TEXTOS, ...opts.textos };
  const c = await newDoc(opts.municipio, opts.escudoPng, conEtiqueta(t.etiquetaColaborador, t.tituloColaborador, " · "), t);
  header(c, conEtiqueta(t.etiquetaColaborador, t.tituloColaborador).toUpperCase());
  heading(c, "DATOS DE LA PERSONA SOLICITANTE");
  const s = d?.solicitante ?? {};
  field(c, "NIF:", s.nif, M, 180);
  c.y -= 22;
  field(c, "Nombre y apellidos:", s.nombre);
  c.y -= 22;
  field(c, "Dirección:", s.direccion);
  c.y -= 22;
  field(c, "Teléfono:", s.telefono, M, 180);
  field(c, "Correo electrónico:", s.email, M + 195, W - 195);
  c.y -= 30;
  text(c, "Manifiesta que:", M, c.y, 10.5, c.bold);
  c.y -= 18;
  const puntos = t.colaboradorManifiesta.filter((p) => p.trim());
  puntos.forEach((p, i) => {
    const lines = wrap(p, c.font, 10, W - 18);
    text(c, `${i + 1}.`, M, c.y, 10, c.bold);
    for (const l of lines) {
      text(c, l, M + 18, c.y, 10);
      c.y -= 14;
    }
    c.y -= 4;
  });
  c.y -= 6;
  if (t.colaboradorSolicita.trim()) paragraph(c, t.colaboradorSolicita, 10, c.bold);
  c.y -= 6;
  firma(c, d?.lugar, d?.fecha ?? null, "La persona solicitante");
  proteccionDatos(c);
  return c.doc.save();
}

/**
 * Modelo de autorización expresa de la persona propietaria de un terreno privado para ubicar en él una
 * colonia (en San Román la exige el apartado 7.1.4 de la ordenanza). No es un anexo oficial: es un modelo orientativo.
 */
export async function autorizacionPropietario(opts: Opts<AutorizacionData>): Promise<Uint8Array> {
  const d = opts.data;
  const t = { ...DEFAULT_TEXTOS, ...opts.textos };
  const c = await newDoc(opts.municipio, opts.escudoPng, "Autorización de la persona propietaria del terreno para ubicar una colonia felina", t);
  header(c, "AUTORIZACIÓN DE LA PERSONA PROPIETARIA DEL TERRENO PARA UBICAR UNA COLONIA FELINA");

  heading(c, "DATOS DE LA PERSONA PROPIETARIA");
  const p = d?.propietario ?? {};
  field(c, "NIF:", p.nif, M, 180);
  c.y -= 22;
  field(c, "Nombre y apellidos:", p.nombre);
  c.y -= 22;
  field(c, "Dirección:", p.direccion);
  c.y -= 22;
  field(c, "Teléfono:", p.telefono, M, 180);
  field(c, "Correo electrónico:", p.email, M + 195, W - 195);
  c.y -= 22;
  field(c, "En representación de (si actúa por una empresa, comunidad u otra persona):", p.representa);
  c.y -= 14;

  heading(c, "DATOS DEL TERRENO");
  const terreno = d?.terreno ?? {};
  field(c, "Dirección o ubicación:", terreno.direccion);
  c.y -= 22;
  field(c, "Referencia catastral:", terreno.referenciaCatastral, M, 240);
  field(c, "Coordenadas:", terreno.coordenadas, M + 255, W - 255);
  c.y -= 14;

  heading(c, "PERSONA CUIDADORA RESPONSABLE DE LA COLONIA");
  const r = d?.responsable ?? {};
  field(c, "Nombre y apellidos:", r.nombre, M, 300);
  field(c, "NIF:", r.nif, M + 315, W - 315);
  c.y -= 26;

  const ref = t.refAutorizacion.trim();
  paragraph(
    c,
    `AUTORIZA expresamente${ref ? `, conforme al ${ref},` : ""} la ubicación en este terreno de una colonia felina incluida en el ${t.plan} y, en consecuencia:`,
    9.5,
    c.bold,
  );
  c.y -= 2;
  const puntos = [
    "Permite el acceso a la persona cuidadora responsable y a las personas colaboradoras con carné para alimentar a los gatos, darles agua, limpiar y observar su estado.",
    "Permite instalar los puntos de alimentación, cobijo y eliminación de excrementos y el cartel identificativo que autorice el Ayuntamiento.",
    "Permite el acceso del personal del Ayuntamiento y de los servicios veterinarios designados para visitar la colonia y realizar las capturas del método CER.",
    "Declara ser la persona propietaria del terreno o tener capacidad suficiente para autorizar su uso.",
  ];
  puntos.forEach((txt, i) => {
    text(c, `${i + 1}.`, M, c.y, 9.5, c.bold);
    for (const l of wrap(txt, c.font, 9.5, W - 18)) {
      text(c, l, M + 18, c.y, 9.5);
      c.y -= 13;
    }
    c.y -= 3;
  });
  c.y -= 2;
  paragraph(c, "Esta autorización se mantiene mientras no se revoque por escrito ante el Ayuntamiento. Se acompaña fotocopia del DNI de la persona propietaria.", 9.5);
  firma(c, d?.lugar, d?.fecha ?? null, "La persona propietaria");
  const cita = t.normativaCita.trim();
  proteccionDatos(
    c,
    `Modelo orientativo de la autorización expresa de la persona propietaria${ref ? ` que exige el ${ref}` : ""}${cita ? ` (${cita})` : ""}. No es un formulario oficial.`,
  );
  return c.doc.save();
}

/** Recuento por sexo; null = no declarado (se imprime «—»). */
export type PorSexo = { machos: number | null; hembras: number | null };

export type CensoPdfData = {
  colonia: { numero: number; nombre: string; direccion?: string };
  /** Fecha de este censo y del anterior (null si es el primero). */
  fecha: Date;
  fechaAnterior: Date | null;
  /** Persona que hizo el censo (firma). */
  persona?: string;
  /** Gatos en el censo anterior (null si es el primero). */
  anterior: PorSexo | null;
  /** Movimientos desde el censo anterior, en el orden en que se imprimen. */
  movimientos: (PorSexo & { label: string; entrada: boolean })[];
  actual: { machos: number; hembras: number };
  esterilizadosAnterior: PorSexo | null;
  esterilizadosActual: { machos: number; hembras: number };
  adoptables: number;
  enfermos: number;
  observaciones?: string | null;
  lugar?: string;
};

/**
 * El día de España al que corresponde un instante, como fecha local (el Worker va en UTC: un censo
 * guardado a las 00:30 en Madrid es del día anterior en UTC).
 */
export function diaEnEspana(d: Date): Date {
  const [y, m, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(d)
    .split("-")
    .map(Number);
  return new Date(y, m - 1, day);
}

const fechaCorta = (instante: Date) => {
  const d = diaEnEspana(instante);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

/** Título del censo: «Anexo V: Censo de gatos de la colonia» o solo el título, según haya nombre oficial. */
export function tituloCenso(etiquetaCenso: string) {
  return conEtiqueta(etiquetaCenso, "Censo de gatos de la colonia");
}

/**
 * Censo de una colonia en una página, como el censo en papel de algunas ordenanzas (en San Román, el
 * Anexo V): periodo, recuento por sexo con altas y bajas desde el censo anterior, esterilizados,
 * adoptables, enfermos, observaciones y firma. Lo que no se declaró sale como «—».
 */
export async function censoPdf(opts: Opts<CensoPdfData> & { data: CensoPdfData }): Promise<Uint8Array> {
  const d = opts.data;
  const t = { ...DEFAULT_TEXTOS, ...opts.textos };
  const titulo = tituloCenso(t.etiquetaCenso);
  const c = await newDoc(opts.municipio, opts.escudoPng, `${conEtiqueta(t.etiquetaCenso, "Censo de gatos de la colonia", " · ")} n.º ${d.colonia.numero} · ${fechaCorta(d.fecha)}`, t);
  header(c, titulo.toUpperCase());

  heading(c, "DATOS DE LA COLONIA");
  field(c, "N.º de colonia:", String(d.colonia.numero), M, 150);
  field(c, "Nombre:", d.colonia.nombre, M + 165, W - 165);
  c.y -= 22;
  field(c, "Dirección:", d.colonia.direccion);
  c.y -= 22;
  const periodo = d.fechaAnterior ? `Del ${fechaCorta(d.fechaAnterior)} al ${fechaCorta(d.fecha)}` : `Primer censo de la colonia (${fechaCorta(d.fecha)})`;
  field(c, "Periodo:", periodo, M, 300);
  field(c, "Fecha del censo:", fechaCorta(d.fecha), M + 315, W - 315);
  c.y -= 22;
  field(c, "Censo realizado por:", d.persona);
  c.y -= 14;

  heading(c, "NÚMERO DE GATOS POR SEXO");
  const num = (n: number | null | undefined) => (n == null ? "—" : String(n));
  const suma = (x: PorSexo | null) => (x && x.machos != null && x.hembras != null ? x.machos + x.hembras : null);
  const cw = 72; // ancho de cada columna numérica
  const cols = [M + W - 3 * cw, M + W - 2 * cw, M + W - cw];
  const celdas = (vals: string[], y: number, font = c.font) =>
    vals.forEach((v, i) => {
      const s = toWinAnsi(v);
      text(c, s, cols[i] + cw - 10 - font.widthOfTextAtSize(s, 10), y, 10, font);
    });
  (["MACHOS", "HEMBRAS", "TOTAL"] as const).forEach((h, i) => text(c, h, cols[i] + cw - 10 - c.bold.widthOfTextAtSize(h, 8), c.y, 8, c.bold, MUTED));
  c.y -= 16;
  const fila = (label: string, x: PorSexo | null, opts: { bold?: boolean; raya?: boolean } = {}) => {
    const font = opts.bold ? c.bold : c.font;
    if (opts.raya) c.page.drawLine({ start: { x: M, y: c.y + 12 }, end: { x: M + W, y: c.y + 12 }, thickness: 0.8, color: LINE });
    text(c, fit(label, font, 10, cols[0] - M - 8), M + 4, c.y, 10, font);
    celdas([num(x?.machos), num(x?.hembras), num(suma(x))], c.y, font);
    c.page.drawLine({ start: { x: M, y: c.y - 5 }, end: { x: M + W, y: c.y - 5 }, thickness: 0.4, color: rgb(0.8, 0.82, 0.81) });
    c.y -= 17;
  };
  fila(d.fechaAnterior ? `Censo anterior (${fechaCorta(d.fechaAnterior)})` : "Censo anterior", d.anterior, { bold: true });
  for (const m of d.movimientos) fila(`${m.entrada ? "(+)" : "(-)"} ${m.label}`, m);
  fila(`Total en este censo (${fechaCorta(d.fecha)})`, d.actual, { bold: true, raya: true });
  c.y -= 6;
  fila("Esterilizados/castrados en el censo anterior", d.esterilizadosAnterior);
  fila("Esterilizados/castrados en este censo", d.esterilizadosActual);
  c.y -= 4;

  heading(c, "OTROS DATOS");
  field(c, "Gatos adoptables (abandonados o cachorros):", String(d.adoptables), M, 270);
  field(c, "Gatos enfermos:", String(d.enfermos), M + 285, W - 285);
  c.y -= 24;
  text(c, "Observaciones:", M, c.y, 9.5, c.bold);
  c.y -= 16;
  // Hueco fijo de 5 líneas: si no cabe todo, se corta con «…» para que el censo quepa en una página.
  const obs = d.observaciones?.trim() ? d.observaciones.trim().split(/\n+/).flatMap((p) => wrap(p, c.font, 10, W - 4)) : [];
  for (let i = 0; i < 5; i++) {
    c.page.drawLine({ start: { x: M, y: c.y - 2 }, end: { x: M + W, y: c.y - 2 }, thickness: 0.6, color: LINE });
    const linea = i === 4 && obs.length > 5 ? fit(obs.slice(4).join(" "), c.font, 10, W - 4) : obs[i];
    if (linea) text(c, linea, M + 3, c.y + 0.5, 10, c.font, FILL);
    c.y -= 17;
  }
  firma(c, d.lugar, diaEnEspana(d.fecha), d.persona?.trim() || "La persona responsable de la colonia");
  proteccionDatos(c, t.pie, "gestionar el registro de colonias felinas y su censo");
  return c.doc.save();
}

/** Une varios PDF en uno (por ejemplo, el Anexo I y la autorización de la persona propietaria). */
export async function unirPdfs(pdfs: Uint8Array[], title?: string): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  if (title) out.setTitle(title);
  out.setLanguage("es-ES");
  for (const bytes of pdfs) {
    const src = await PDFDocument.load(bytes);
    for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
  }
  return out.save();
}
