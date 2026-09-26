import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_PROGRAMA,
  docsPdf,
  entreParentesis,
  etiqueta,
  parsePrograma,
  periodoTexto,
  programaSchema,
  renderTemplate,
  textosAnexos,
} from "../../src/lib/programa-config";
import { isWinAnsi, toWinAnsi } from "../../src/lib/winansi";

const sanRoman = JSON.parse(readFileSync("seed/local/san-roman-de-los-montes/programa.json", "utf8"));

describe("plantillas", () => {
  it("sustituye variables y deja tal cual las desconocidas", () => {
    expect(renderTemplate("Hola {{municipio}}, {{nada}}.", { municipio: "Soria" })).toBe("Hola Soria, {{nada}}.");
  });

  it("secciones condicionales con y sin valor", () => {
    const t = "A{{#e}} ({{e}}){{/e}}{{^e}} sin nombre{{/e}}.";
    expect(renderTemplate(t, { e: "Anexo I" })).toBe("A (Anexo I).");
    expect(renderTemplate(t, { e: "" })).toBe("A sin nombre.");
    expect(renderTemplate(t, { e: "  " })).toBe("A sin nombre.");
    expect(renderTemplate("{{#x}}sí{{/x}}", {})).toBe("{{#x}}sí{{/x}}");
  });

  it("secciones anidadas", () => {
    const t = "{{#a}}[{{#b}}b{{/b}}{{^b}}no-b{{/b}}]{{/a}}";
    expect(renderTemplate(t, { a: 1, b: "x" })).toBe("[b]");
    expect(renderTemplate(t, { a: 1, b: "" })).toBe("[no-b]");
    expect(renderTemplate(t, { a: "", b: "x" })).toBe("");
  });

  it("no vuelve a procesar los valores", () => {
    expect(renderTemplate("{{a}}", { a: "{{b}}", b: "mal" })).toBe("{{b}}");
  });
});

describe("periodo del censo", () => {
  it("en letra, detrás de «cada»", () => {
    expect(periodoTexto(6)).toBe("seis meses");
    expect(periodoTexto(1)).toBe("mes");
    expect(periodoTexto(12)).toBe("año");
    expect(periodoTexto(3)).toBe("tres meses");
    expect(periodoTexto(24)).toBe("dos años");
  });
});

describe("configuración del programa", () => {
  it("los valores por defecto son válidos y neutros", () => {
    expect(programaSchema.safeParse(DEFAULT_PROGRAMA).success).toBe(true);
    expect(JSON.stringify(DEFAULT_PROGRAMA)).not.toMatch(/San Román|Anexo|BOP|Toledo|7\.1\.4/);
  });

  it("la precarga de San Román es válida", () => {
    const r = programaSchema.safeParse(sanRoman);
    expect(r.success).toBe(true);
  });

  it("lectura tolerante: un campo inválido toma su valor por defecto sin perder el resto", () => {
    const p = parsePrograma({ ...sanRoman, censo_meses: 99, max_cuidadores: "x", campo_viejo: 1 });
    expect(p.censo_meses).toBe(DEFAULT_PROGRAMA.censo_meses);
    expect(p.max_cuidadores).toBe(DEFAULT_PROGRAMA.max_cuidadores);
    expect(p.etiqueta_registro).toBe("Anexo I");
    expect(parsePrograma(null)).toEqual(DEFAULT_PROGRAMA);
    expect(parsePrograma("basura")).toEqual(DEFAULT_PROGRAMA);
  });

  it("al guardar, rechaza textos del PDF con caracteres que no admite y direcciones no https", () => {
    const r = programaSchema.safeParse({ ...DEFAULT_PROGRAMA, pdf_pie: "Pie ≥ 🐱", sede_url: "http://sede.example" });
    expect(r.success).toBe(false);
    const campos = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(campos).toContain("pdf_pie");
    expect(campos).toContain("sede_url");
    // Los textos que no van al PDF pueden llevar cualquier carácter.
    expect(programaSchema.safeParse({ ...DEFAULT_PROGRAMA, suplemento_titulo: "Lo nuestro 🐱" }).success).toBe(true);
  });

  it("limita las personas cuidadoras y el periodo del censo", () => {
    expect(programaSchema.safeParse({ ...DEFAULT_PROGRAMA, max_cuidadores: 7 }).success).toBe(false);
    expect(programaSchema.safeParse({ ...DEFAULT_PROGRAMA, censo_meses: 0 }).success).toBe(false);
    expect(programaSchema.safeParse({ ...DEFAULT_PROGRAMA, max_cuidadores: "6", censo_meses: "12" }).success).toBe(true);
  });
});

describe("etiquetas y textos de los PDF", () => {
  it("sin nombre oficial no hay paréntesis ni prefijo en los ficheros", () => {
    expect(etiqueta(DEFAULT_PROGRAMA, "registro")).toBe("");
    expect(entreParentesis(DEFAULT_PROGRAMA, "ficha")).toBe("");
    expect(docsPdf(DEFAULT_PROGRAMA)).toEqual({
      registro: "solicitud-registro-colonia.pdf",
      colaborador: "solicitud-alta-colaborador.pdf",
      autorizacion: "autorizacion-propietario-terreno.pdf",
      registroYAutorizacion: "solicitud-registro-y-autorizacion-propietario.pdf",
    });
  });

  it("con los anexos de San Román, los nombres de siempre", () => {
    const p = parsePrograma(sanRoman);
    expect(entreParentesis(p, "ficha")).toBe(" (Anexo IV)");
    expect(docsPdf(p).registro).toBe("anexo-i-solicitud-registro-colonia.pdf");
    expect(docsPdf(p).colaborador).toBe("anexo-ii-solicitud-alta-colaborador.pdf");
    expect(docsPdf(p).registroYAutorizacion).toBe("anexo-i-y-autorizacion-propietario.pdf");
  });

  it("resuelve los marcadores de los textos del PDF", () => {
    const t = textosAnexos(parsePrograma(sanRoman), { municipio: "San Román de los Montes", provincia: "Toledo" });
    expect(t.registroResolucion).toMatch(/^El Ayuntamiento de SAN ROMÁN DE LOS MONTES, conocida/);
    expect(t.pie).toContain("BOP de Toledo n.º 122");
    expect(t.maxCuidadores).toBe(4);
    const n = textosAnexos(DEFAULT_PROGRAMA, { municipio: "Villanueva", provincia: "Soria" });
    expect(JSON.stringify(n)).not.toMatch(/\{\{|San Román|Anexo|BOP/);
  });
});

describe("caracteres de los PDF (WinAnsi)", () => {
  it("admite el español y los signos habituales", () => {
    expect(isWinAnsi("Castilla-La Mancha: «n.º 122», 28 € — año, pingüino, Ñandú")).toBe(true);
    expect(isWinAnsi("≥ 🐱")).toBe(false);
  });
  it("sustituye o quita lo que no admite", () => {
    expect(toWinAnsi("≥ 5 🐱 gatos")).toBe(">= 5  gatos");
  });
});
