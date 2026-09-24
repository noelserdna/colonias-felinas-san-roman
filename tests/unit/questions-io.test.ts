import { describe, expect, it } from "vitest";
import { csvToInputs, inputsToCsv, parseCsv, questionInput } from "../../src/lib/questions-io";

describe("CSV", () => {
  it("parsea comillas, separador ; y saltos de línea", () => {
    const rows = parseCsv('a;b\n"x;1";"di ""hola""\notra"\n');
    expect(rows).toEqual([["a", "b"], ["x;1", 'di "hola"\notra']]);
  });

  it("ida y vuelta export → import", () => {
    const items = [
      { tema: "legislacion", tipo: "mc" as const, enunciado: "¿Pregunta; con separador?", opciones: ["A", "B", "C"], correcta: 2, explicacion: "Porque sí", activo: true },
      { tema: "legislacion", tipo: "written" as const, enunciado: "Explica algo", respuesta_referencia: "Ref", puntos_clave: ["uno", "dos"], activo: false },
    ];
    const back = csvToInputs(inputsToCsv(items));
    expect(back[0]).toMatchObject({ tipo: "mc", opciones: ["A", "B", "C"], correcta: 2, enunciado: "¿Pregunta; con separador?" });
    expect(back[1]).toMatchObject({ tipo: "written", puntos_clave: ["uno", "dos"], activo: false });
    for (const b of back) expect(questionInput.safeParse(b).success).toBe(true);
  });

  it("valida la opción correcta", () => {
    expect(questionInput.safeParse({ tema: 1, tipo: "mc", enunciado: "Enunciado", opciones: ["a", "b"], correcta: 2 }).success).toBe(false);
    expect(questionInput.safeParse({ tema: 1, tipo: "written", enunciado: "Enunciado" }).success).toBe(false);
  });
});
