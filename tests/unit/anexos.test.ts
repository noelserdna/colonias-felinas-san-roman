import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { anexoI, anexoII, autorizacionPropietario, censoPdf, DEFAULT_TEXTOS, diaEnEspana, tituloCenso, unirPdfs } from "../../src/lib/anexos-pdf";
import { censoPdfDatos } from "../../src/lib/colonies";
import { readFileSync } from "node:fs";
import { censoPdfNombre, parsePrograma, textosAnexos } from "../../src/lib/programa-config";

const textosSanRoman = textosAnexos(parsePrograma(JSON.parse(readFileSync("seed/local/san-roman-de-los-montes/programa.json", "utf8"))), {
  municipio: "San Román de los Montes",
  provincia: "Toledo",
});
import { documentInput } from "../../src/lib/documents";

describe("anexos en PDF", () => {
  it("genera el Anexo I en blanco y relleno, en una página A4", async () => {
    for (const data of [
      undefined,
      {
        solicitante: { nombre: "María Pérez Gómez", nif: "12345678Z", email: "maria@example.com" },
        cuidadores: [{ nombre: "María Pérez Gómez" }, { nombre: "Íñigo Muñoz", telefono: "600000000" }],
        colonia: { direccion: "C/ Real, 1", coordenadas: "40.07, -4.40", titularidad: "publico" as const, enfermos: "Uno con ".repeat(40) },
        lugar: "San Román de los Montes",
        fecha: new Date(2026, 8, 25),
      },
    ]) {
      const bytes = await anexoI({ municipio: "San Román de los Montes", data });
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
      expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
    }
  });

  it("con los textos de San Román, el título lleva el nombre del anexo", async () => {
    const doc = await PDFDocument.load(await anexoII({ municipio: "San Román de los Montes", textos: textosSanRoman, data: { solicitante: { nombre: "Ana" } } }));
    expect(doc.getTitle()).toMatch(/^Anexo II · /);
    expect(doc.getPageCount()).toBe(1);
    const i = await PDFDocument.load(await anexoI({ municipio: "San Román de los Montes", textos: textosSanRoman }));
    expect(i.getTitle()).toBe("Anexo I · Solicitud para registrar una nueva colonia de gatos urbanos");
  });

  it("sin textos (valores neutros), sin nombre de anexo", async () => {
    const doc = await PDFDocument.load(await anexoII({ municipio: "Villanueva" }));
    expect(doc.getTitle()).toBe(DEFAULT_TEXTOS.tituloColaborador);
    const i = await PDFDocument.load(await anexoI({ municipio: "Villanueva" }));
    expect(i.getTitle()).not.toMatch(/Anexo/);
  });

  it("hasta 6 personas cuidadoras en una sola página", async () => {
    const cuidadores = Array.from({ length: 6 }, (_, i) => ({ nombre: `Persona ${i + 1}`, nif: "12345678Z", telefono: "600000000", email: `p${i}@example.org` }));
    const doc = await PDFDocument.load(
      await anexoI({ municipio: "Villanueva", textos: { maxCuidadores: 6 }, data: { solicitante: {}, cuidadores, colonia: {}, lugar: "Villanueva", fecha: new Date(2026, 0, 1) } }),
    );
    expect(doc.getPageCount()).toBe(1);
  });

  it("los caracteres que no admiten las fuentes del PDF no lo rompen", async () => {
    const raro = "Gata ≥ 2 años 🐱 «Nube»";
    for (const bytes of [
      await anexoI({ municipio: "Villanueva 🐾", textos: { organo: "Área ≥ 🐱", pie: "Pie ✓" }, data: { solicitante: { nombre: raro }, cuidadores: [{ nombre: raro }], colonia: { enfermos: raro } } }),
      await anexoII({ municipio: "Villanueva", data: { solicitante: { direccion: raro } } }),
      await autorizacionPropietario({ municipio: "Villanueva", data: { propietario: { representa: raro }, terreno: {}, responsable: {} } }),
    ]) {
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    }
  });
});

describe("autorización de la persona propietaria", () => {
  it("cabe en una página, en blanco y rellena", async () => {
    for (const data of [
      undefined,
      {
        propietario: { nombre: "Luis Gómez", nif: "00000000T", representa: "Comunidad de propietarios C/ Real 3" },
        terreno: { direccion: "Solar C/ Real 3", referenciaCatastral: "1234567VK1234N0001AB", coordenadas: "40.07, -4.40" },
        responsable: { nombre: "María Pérez Gómez", nif: "12345678Z" },
        lugar: "San Román de los Montes",
        fecha: new Date(2026, 8, 25),
      },
    ]) {
      const doc = await PDFDocument.load(await autorizacionPropietario({ municipio: "San Román de los Montes", data }));
      expect(doc.getPageCount()).toBe(1);
      expect(doc.getTitle()).toMatch(/Autorización/);
    }
  });

  it("se une al Anexo I en un único PDF de dos páginas", async () => {
    const municipio = "San Román de los Montes";
    const bytes = await unirPdfs([await anexoI({ municipio }), await autorizacionPropietario({ municipio })], "Anexo I y autorización");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getTitle()).toBe("Anexo I y autorización");
  });
});

describe("enlaces de documentos", () => {
  const base = { titulo: "Anexo I", categoria: "formulario" };
  it("admite https y rutas de esta web", () => {
    expect(documentInput.safeParse({ ...base, url: "https://bop.diputoledo.es/x" }).success).toBe(true);
    expect(documentInput.safeParse({ ...base, url: "/docs/anexo-i.pdf" }).success).toBe(true);
  });
  it("rechaza esquemas peligrosos y URLs sin protocolo", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,x", "//evil.example/x", "ftp://x/y", "docs/x.pdf"])
      expect(documentInput.safeParse({ ...base, url }).success, url).toBe(false);
  });
});

describe("censo en PDF", () => {
  const recuento = { hembrasEsterilizadas: 3, hembrasSinEsterilizar: 2, machosCastrados: 1, machosSinCastrar: 1, adoptables: 1, enfermos: 0 };
  const sinMov = { fecha: new Date(2026, 0, 10), observaciones: null, ...recuento };
  const conMov = {
    ...recuento,
    fecha: new Date(2026, 5, 30),
    hembrasEsterilizadas: 4,
    observaciones: "Una camada nueva junto al contenedor.",
    nacidosHembras: 1, nacidosMachos: 0, nuevosHembras: 0, nuevosMachos: 0, fallecidosHembras: 0, fallecidosMachos: 0,
    adoptadosHembras: 0, adoptadosMachos: 0, devueltosHembras: 0, devueltosMachos: 0, otrasSalidasHembras: 0, otrasSalidasMachos: 0,
  };
  const extra = { colonia: { numero: 3, nombre: "Parque", direccion: "C/ Real, 1" }, persona: "María Pérez", lugar: "Villanueva" };

  it("los datos salen del censo y del anterior; sin movimientos, vacíos", () => {
    const d = censoPdfDatos(conMov, sinMov, extra);
    expect(d.anterior).toEqual({ machos: 2, hembras: 5 });
    expect(d.actual).toEqual({ machos: 2, hembras: 6 });
    expect(d.esterilizadosAnterior).toEqual({ machos: 1, hembras: 3 });
    expect(d.esterilizadosActual).toEqual({ machos: 1, hembras: 4 });
    expect(d.movimientos[0]).toMatchObject({ label: "Nacidos en la colonia", entrada: true, hembras: 1, machos: 0 });
    expect(d.fechaAnterior).toEqual(sinMov.fecha);
    const primero = censoPdfDatos(sinMov, null, extra);
    expect(primero.anterior).toBeNull();
    expect(primero.movimientos).toHaveLength(6);
    expect(primero.movimientos.every((m) => m.machos === null && m.hembras === null)).toBe(true);
  });

  it("una página A4, con el nombre oficial en el título si lo hay", async () => {
    const doc = await PDFDocument.load(await censoPdf({ municipio: "San Román de los Montes", textos: textosSanRoman, data: censoPdfDatos(conMov, sinMov, extra) }));
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toMatch(/^Anexo V · Censo de gatos de la colonia n\.º 3 · 30\/06\/2026$/);
    const neutro = await PDFDocument.load(await censoPdf({ municipio: "Villanueva", data: censoPdfDatos(sinMov, null, extra) }));
    expect(neutro.getTitle()).not.toMatch(/Anexo/);
    expect(tituloCenso("")).toBe("Censo de gatos de la colonia");
    expect(tituloCenso("Anexo V")).toBe("Anexo V: Censo de gatos de la colonia");
  });

  it("observaciones largas y caracteres raros no lo sacan de una página", async () => {
    const data = censoPdfDatos({ ...conMov, observaciones: "Gata ≥ 2 años 🐱 «Nube».\n".repeat(80) }, sinMov, { ...extra, persona: "Íñigo 🐾" });
    expect((await PDFDocument.load(await censoPdf({ municipio: "Villanueva", data }))).getPageCount()).toBe(1);
  });

  it("nombre del archivo y día en España", () => {
    const p = parsePrograma(JSON.parse(readFileSync("seed/local/san-roman-de-los-montes/programa.json", "utf8")));
    expect(censoPdfNombre(p, 3, new Date(2026, 5, 30, 12))).toBe("anexo-v-censo-colonia-3-2026-06-30.pdf");
    expect(censoPdfNombre(parsePrograma({}), 3, new Date(2026, 5, 30, 12))).toBe("censo-colonia-3-2026-06-30.pdf");
    // 23:30 UTC del 30 de junio ya es 1 de julio en Madrid.
    expect(diaEnEspana(new Date(Date.UTC(2026, 5, 30, 23, 30)))).toEqual(new Date(2026, 6, 1));
  });
});
