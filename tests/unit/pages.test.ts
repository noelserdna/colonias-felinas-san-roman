import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_COLONIA_GUIDE, DEFAULT_PAUTAS, isPageSlug, PAGE_DEFS, splitSteps } from "../../src/lib/pages-config";
import { DEFAULT_PROGRAMA, parsePrograma, programaVars, renderTemplate } from "../../src/lib/programa-config";

const neutro = programaVars(DEFAULT_PROGRAMA, { municipio: "Villanueva", provincia: "Soria" });
const sanRoman = programaVars(parsePrograma(JSON.parse(readFileSync("seed/local/san-roman-de-los-montes/programa.json", "utf8"))), {
  municipio: "San Román de los Montes",
  provincia: "Toledo",
});

describe("guía Mi colonia", () => {
  it("separa introducción y pasos", () => {
    const { intro, steps } = splitSteps("Intro **x**\n\n## Uno\nA\n\n## Dos\n- b\n");
    expect(intro).toBe("Intro **x**");
    expect(steps).toEqual([{ title: "Uno", body: "A" }, { title: "Dos", body: "- b" }]);
  });

  it("la guía por defecto tiene 6 pasos y empieza por la acreditación, con datos neutros o de un municipio", () => {
    for (const vars of [neutro, sanRoman]) {
      const { steps } = splitSteps(renderTemplate(DEFAULT_COLONIA_GUIDE, vars));
      expect(steps).toHaveLength(6);
      expect(steps[0].title).toBe("Consigue tu acreditación");
    }
  });

  it("con valores neutros no quedan marcadores ni referencias a San Román, a anexos ni al BOP", () => {
    for (const md of [DEFAULT_COLONIA_GUIDE, DEFAULT_PAUTAS]) {
      const r = renderTemplate(md, neutro);
      expect(r).not.toMatch(/\{\{/);
      expect(r).not.toMatch(/San Román|Anexo|BOP|Toledo|sedelectronica/);
    }
    // Sin sede electrónica no hay botón que lleve a ninguna parte.
    expect(renderTemplate(DEFAULT_COLONIA_GUIDE, neutro)).not.toContain('href=""');
  });

  it("con los datos de San Román aparecen sus anexos, la sede y el periodo del censo", () => {
    const r = renderTemplate(DEFAULT_COLONIA_GUIDE, sanRoman);
    expect(r).toContain("**Anexo II**");
    expect(r).toContain("(**Anexo I**)");
    expect(r).toContain("sanromandelosmontes.sedelectronica.es");
    expect(r).toContain("cada seis meses");
    expect(r).toContain("/docs/anexo-i-solicitud-registro-colonia.pdf");
    expect(r).toContain("BOP de Toledo n.º 122");
  });

  it("la precarga de San Román conserva la guía y las 8 pautas", () => {
    const guia = readFileSync("seed/local/san-roman-de-los-montes/mi-colonia.md", "utf8");
    expect(splitSteps(guia).steps).toHaveLength(6);
    expect(guia).toContain("Instancia General");
    const pautas = readFileSync("seed/local/san-roman-de-los-montes/pautas-colonia.md", "utf8");
    expect(pautas.trim().split("\n").filter((l) => l.startsWith("- "))).toHaveLength(8);
  });
});

describe("páginas editables", () => {
  it("reconoce solo las páginas definidas", () => {
    expect(isPageSlug("mi-colonia")).toBe(true);
    expect(isPageSlug("programa-local")).toBe(true);
    expect(isPageSlug("toString")).toBe(false);
    expect(isPageSlug("../settings")).toBe(false);
    expect(isPageSlug(undefined)).toBe(false);
  });

  it("el suplemento local está vacío por defecto (no se muestra)", () => {
    expect(PAGE_DEFS["programa-local"].defecto).toBe("");
    expect(PAGE_DEFS["programa-local"].opcional).toBe(true);
  });
});
