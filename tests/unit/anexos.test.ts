import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { anexoI, anexoII } from "../../src/lib/anexos-pdf";
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

  it("genera el Anexo II con título y idioma", async () => {
    const doc = await PDFDocument.load(await anexoII({ municipio: "San Román de los Montes", data: { solicitante: { nombre: "Ana" } } }));
    expect(doc.getTitle()).toMatch(/Anexo II/);
    expect(doc.getPageCount()).toBe(1);
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
