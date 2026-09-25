import { describe, expect, it } from "vitest";
import { chooseProvider, isResendKey, parseSender } from "../../src/lib/mail-provider";

const base = { mock: false, panelResendKey: null, hasCloudflareBinding: false, envResendKey: null, panelFrom: null, envFrom: "Colonias <no-reply@avisos.ejemplo.es>" };

describe("remitente", () => {
  it("acepta «Nombre <correo>» y correo suelto", () => {
    expect(parseSender("Colonias Felinas · Pueblo <no-reply@avisos.ejemplo.es>")).toEqual({ email: "no-reply@avisos.ejemplo.es", name: "Colonias Felinas · Pueblo" });
    expect(parseSender("no-reply@ejemplo.es")).toEqual({ email: "no-reply@ejemplo.es" });
  });
  it("rechaza lo que no es un correo", () => {
    for (const s of ["", "Colonias", "Colonias <sin-arroba>", "a@b", "x <a@b.es> y"]) expect(parseSender(s), s).toBeNull();
  });
  it("claves de Resend", () => {
    expect(isResendKey("re_123456789abcdef")).toBe(true);
    expect(isResendKey("apikey_123456789")).toBe(false);
  });
});

describe("proveedor de correo", () => {
  it("la clave de Resend del panel manda sobre Cloudflare Email", () => {
    expect(chooseProvider({ ...base, hasCloudflareBinding: true, panelResendKey: "re_x" }).provider).toBe("resend-panel");
  });
  it("sin clave en el panel: Cloudflare Email y, si no, Resend del servidor", () => {
    expect(chooseProvider({ ...base, hasCloudflareBinding: true, envResendKey: "re_y" }).provider).toBe("cloudflare");
    expect(chooseProvider({ ...base, envResendKey: "re_y" }).provider).toBe("resend-servidor");
    expect(chooseProvider(base).provider).toBeNull();
  });
  it("el remitente del panel tiene prioridad; sin remitente válido no se envía", () => {
    expect(chooseProvider({ ...base, panelResendKey: "re_x", panelFrom: "Pueblo <avisos@pueblo.es>" }).from).toBe("Pueblo <avisos@pueblo.es>");
    expect(chooseProvider({ ...base, panelResendKey: "re_x", envFrom: null }).provider).toBeNull();
  });
  it("en desarrollo (MAIL_MOCK) siempre simulado", () => {
    expect(chooseProvider({ ...base, mock: true, panelResendKey: "re_x", hasCloudflareBinding: true }).provider).toBe("simulado");
  });
});
