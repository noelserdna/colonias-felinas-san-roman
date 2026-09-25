// Genera los Anexos I y II de la Ordenanza municipal reguladora del plan de control y gestión ética
// de las colonias felinas urbanas (BOP de Toledo n.º 122, de 28/06/2024), en blanco o rellenos.
// Módulo puro (sin dependencias de Cloudflare): se usa en el navegador y en scripts de Node.
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";

export type Persona = { nombre?: string; nif?: string; telefono?: string; email?: string };
export type Solicitante = Persona & { direccion?: string };

export type AnexoIData = {
  solicitante: Solicitante;
  cuidadores: Persona[]; // hasta 4
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

type Ctx = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  municipio: string;
  escudo?: PDFImage;
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
function fit(text: string, font: PDFFont, size: number, width: number): string {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > width) t = t.slice(0, -1);
  return t + "…";
}

/** Parte un texto en líneas que caben en el ancho. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.split(/\s+/);
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
  c.page.drawText(s, { x, y, size, font, color });
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
  text(c, "Concejalía con competencias en Bienestar Animal", tx, top - 23, 9.5, c.font, MUTED);
  text(c, "Plan de Control y Gestión Ética de Colonias Felinas Urbanas", tx, top - 36, 9.5, c.font, MUTED);
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

function proteccionDatos(c: Ctx) {
  const size = 7.5;
  const t =
    `Protección de datos: el responsable del tratamiento es el Ayuntamiento de ${c.municipio}. Los datos se tratan para tramitar esta solicitud y ` +
    "gestionar el registro de colonias felinas y de personas cuidadoras, en ejercicio de las competencias municipales (Ley 7/2023 y ordenanza municipal). " +
    "Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad ante el Ayuntamiento.";
  const lines = wrap(t, c.font, size, W);
  let y = M + lines.length * (size + 2);
  for (const l of lines) {
    text(c, l, M, y, size, c.font, MUTED);
    y -= size + 2;
  }
  text(c, "Anexo de la Ordenanza municipal publicada en el BOP de Toledo n.º 122, de 28 de junio de 2024.", M, M - 16, 7.5, c.font, MUTED);
}

async function newDoc(municipio: string, escudoPng?: Uint8Array, title = "Solicitud") {
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
  const c: Ctx = { doc, page, font, bold, y: 0, municipio, escudo };
  return c;
}

/** Anexo I: Solicitud para registrar una nueva colonia de gatos urbanos. */
export async function anexoI(opts: { municipio: string; escudoPng?: Uint8Array; data?: AnexoIData }): Promise<Uint8Array> {
  const d = opts.data;
  const c = await newDoc(opts.municipio, opts.escudoPng, "Anexo I · Solicitud para registrar una nueva colonia de gatos urbanos");
  header(c, "ANEXO I: SOLICITUD PARA REGISTRAR UNA NUEVA COLONIA DE GATOS URBANOS");

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
  for (let i = 0; i < 4; i++) {
    const p = d?.cuidadores?.[i] ?? {};
    text(c, String(i + 1), M + 2, c.y, 9.5, c.bold);
    const vals = [p.nombre, p.nif, p.telefono, p.email];
    cols.forEach((col, j) => {
      c.page.drawLine({ start: { x: col.x, y: c.y - 2 }, end: { x: col.x + col.w - 6, y: c.y - 2 }, thickness: 0.6, color: LINE });
      const v = vals[j];
      if (v) text(c, fit(v, c.font, 9.5, col.w - 8), col.x + 1, c.y + 0.5, 9.5, c.font, FILL);
    });
    c.y -= 20;
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
  paragraph(
    c,
    `El Ayuntamiento de ${opts.municipio.toUpperCase()}, conocida la solicitud, analizará la misma, visitará la ubicación y consultará lo que considere conveniente para decidir autorizarla. Se emitirá un informe justificando la autorización o no de dicha colonia.`,
    9.5,
  );
  firma(c, d?.lugar, d?.fecha ?? null);
  proteccionDatos(c);
  return c.doc.save();
}

/** Anexo II: Solicitud de alta como colaborador o colaboradora del proyecto CER. */
export async function anexoII(opts: { municipio: string; escudoPng?: Uint8Array; data?: AnexoIIData }): Promise<Uint8Array> {
  const d = opts.data;
  const c = await newDoc(opts.municipio, opts.escudoPng, "Anexo II · Solicitud de alta como colaborador o colaboradora del proyecto CER");
  header(c, "ANEXO II: SOLICITUD DE ALTA COMO COLABORADOR O COLABORADORA DEL PROYECTO CER");
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
  const puntos = [
    "Se ofrece voluntario o voluntaria para gestionar las colonias felinas urbanas que le sean asignadas, siendo colaborador o colaboradora autorizada.",
    "Se compromete a cumplir con el PCFE y a seguir las instrucciones del Ayuntamiento en todo momento.",
    "Se compromete a asistir al curso formativo impartido por el Ayuntamiento.",
    "Que acompaña la siguiente documentación: fotocopia de DNI.",
  ];
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
  paragraph(c, "Por todo ello, SOLICITA su nombramiento como colaborador o colaboradora autorizada para la gestión y control de las colonias felinas.", 10, c.bold);
  c.y -= 6;
  firma(c, d?.lugar, d?.fecha ?? null, "La persona solicitante");
  proteccionDatos(c);
  return c.doc.save();
}
