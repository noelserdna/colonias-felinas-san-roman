// Elección del proveedor de correo. Módulo puro (sin Cloudflare) para poder probarlo.

export type MailProvider = "simulado" | "resend-panel" | "cloudflare" | "resend-servidor" | null;

/** «Nombre <correo@dominio>» o «correo@dominio» → { email, name? }; null si no es un remitente válido. */
export function parseSender(input: string | null | undefined): { email: string; name?: string } | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  const m = s.match(/^\s*(.*?)\s*<([^<>\s]+)>\s*$/);
  const email = (m ? m[2] : s).trim();
  const name = m?.[1]?.replace(/^"|"$/g, "").trim();
  if (!/^[^@\s<>"]+@[^@\s<>"]+\.[a-z]{2,}$/i.test(email)) return null;
  return name ? { email, name } : { email };
}

/** Formato de las claves de Resend («re_…»). */
export const isResendKey = (k: string) => /^re_[A-Za-z0-9_-]{10,}$/.test(k.trim());

/**
 * Proveedor que se usará, por prioridad:
 * 1. simulado (MAIL_MOCK=1, desarrollo);
 * 2. Resend con la clave guardada en el panel (así se elige sin tocar wrangler.jsonc);
 * 3. Cloudflare Email Service (binding EMAIL);
 * 4. Resend con la clave del servidor (RESEND_API_KEY);
 * 5. ninguno: el enlace se escribe en el registro del servidor.
 * El remitente del panel tiene prioridad sobre MAIL_FROM.
 */
export function chooseProvider(c: {
  mock: boolean;
  panelResendKey: string | null;
  hasCloudflareBinding: boolean;
  envResendKey: string | null;
  panelFrom: string | null;
  envFrom: string | null;
}): { provider: MailProvider; from: string | null } {
  const from = parseSender(c.panelFrom) ? c.panelFrom : parseSender(c.envFrom) ? c.envFrom : null;
  if (c.mock) return { provider: "simulado", from };
  if (!from) return { provider: null, from: null };
  if (c.panelResendKey) return { provider: "resend-panel", from };
  if (c.hasCloudflareBinding) return { provider: "cloudflare", from };
  if (c.envResendKey) return { provider: "resend-servidor", from };
  return { provider: null, from };
}

export const PROVIDER_LABEL: Record<Exclude<MailProvider, null>, string> = {
  simulado: "Simulado (desarrollo): los correos no se envían",
  "resend-panel": "Resend, con la clave guardada en este panel",
  cloudflare: "Cloudflare Email Service",
  "resend-servidor": "Resend, con la clave del servidor (RESEND_API_KEY)",
};
