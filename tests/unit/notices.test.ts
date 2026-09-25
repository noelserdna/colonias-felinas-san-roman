import { describe, expect, it } from "vitest";
import { noticeFor } from "../../src/lib/notice-text";

const colonia = { id: "c1", numero: 7, nombre: "Polideportivo" };

describe("textos de los avisos de colonias", () => {
  it("alta: rol, número y enlace a la colonia", () => {
    const n = noticeFor("colonia_alta", { colonia, rol: "responsable", nombre: "Rosa" });
    expect(n.titulo).toBe("Tu colonia ya está registrada");
    expect(n.saludo).toBe("Hola, Rosa:");
    expect(n.parrafos[0]).toContain("«Polideportivo» (n.º 7)");
    expect(n.parrafos[0]).toContain("persona cuidadora responsable");
    expect(n.url).toBe("/colonia/c1");
  });

  it("colaborador/a: sin tareas de la persona responsable", () => {
    const n = noticeFor("colonia_miembro", { colonia, rol: "colaborador" });
    expect(n.saludo).toBe("Hola:");
    expect(n.parrafos.join(" ")).toContain("persona colaboradora");
    expect(n.parrafos.join(" ")).not.toContain("contacto con el Ayuntamiento");
  });

  it("baja: incluye el motivo y no enlaza a la colonia", () => {
    const n = noticeFor("colonia_baja", { colonia, rol: null, motivo: "Se ha mudado" });
    expect(n.url).toBeNull();
    expect(n.parrafos).toContain("Motivo: Se ha mudado");
  });
});
