import { describe, expect, it } from "vitest";
import { exampleAnswers, personaEmail, personaOf, RESPUESTA_FLOJA } from "../../src/lib/demo-personas";

const mc = (position: number, correctIndex: number, optionOrder: number[]) => ({
  position,
  optionOrder,
  snapshot: { type: "mc" as const, options: ["a", "b", "c", "d"], correctIndex },
});

describe("perfiles de la demo", () => {
  it("reconoce el perfil por el correo y no confunde correos reales", () => {
    expect(personaOf(personaEmail("responsable", "k3x9"))).toBe("responsable");
    expect(personaOf("base.carmen@personas.demo")).toBeNull();
    expect(personaOf("alguien@gmail.com")).toBeNull();
    expect(personaOf("hackeo.1@personas.demo")).toBeNull();
  });
});

describe("respuestas de ejemplo", () => {
  it("marca la opción correcta tal como se muestra (opciones barajadas)", () => {
    // optionOrder[i] = índice original mostrado en i → la correcta (2) se muestra en la posición 0.
    const a = exampleAnswers([mc(1, 2, [2, 0, 3, 1])], false);
    expect(a["1"]).toBe(0);
  });

  it("varias respuestas: todas las correctas en posiciones mostradas", () => {
    const a = exampleAnswers([{ position: 1, optionOrder: [3, 2, 1, 0], snapshot: { type: "multi", options: ["a", "b", "c", "d"], correctIndexes: [0, 2] } }], false);
    expect(a["1"]).toEqual([1, 3]);
  });

  it("con fallos: una de test mal y una escrita floja; el resto bien", () => {
    const items = [
      mc(1, 0, [0, 1, 2, 3]),
      mc(2, 1, [0, 1, 2, 3]),
      mc(3, 2, [0, 1, 2, 3]),
      mc(4, 3, [0, 1, 2, 3]),
      { position: 5, optionOrder: null, snapshot: { type: "written" as const, referenceAnswer: "Captura, esterilización y retorno." } },
      { position: 6, optionOrder: null, snapshot: { type: "written" as const, referenceAnswer: "Pienso seco y agua limpia." } },
    ];
    const a = exampleAnswers(items);
    expect([a["1"], a["2"], a["3"]]).toEqual([0, 1, 2]);
    expect(a["4"]).not.toBe(3);
    expect(a["5"]).toBe("Captura, esterilización y retorno.");
    expect(a["6"]).toBe(RESPUESTA_FLOJA);
  });
});
