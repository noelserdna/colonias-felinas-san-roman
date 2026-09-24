import { env } from "cloudflare:workers";

type Mail = { to: string; subject: string; text: string; html?: string };

/**
 * Envía un correo con el primer proveedor disponible:
 * 1. Cloudflare Email Service (binding `EMAIL`, dominio dado de alta en Email Sending);
 * 2. Resend (secreto `RESEND_API_KEY`);
 * 3. si no hay ninguno (o `MAIL_MOCK=1`), lo escribe en el log del Worker (`wrangler tail`).
 * Devuelve true si el correo no se ha enviado de verdad (simulado).
 */
async function deliver(mail: Mail): Promise<boolean> {
  const e = env as Cloudflare.Env & { EMAIL?: { send: (m: Record<string, unknown>) => Promise<unknown> } };
  if (env.MAIL_MOCK !== "1" && e.EMAIL && env.MAIL_FROM) {
    await e.EMAIL.send({ to: mail.to, from: env.MAIL_FROM, subject: mail.subject, text: mail.text, ...(mail.html ? { html: mail.html } : {}) });
    return false;
  }
  if (env.MAIL_MOCK !== "1" && env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return false;
  }
  console.log(`[MAIL_MOCK] Para ${mail.to} · ${mail.subject}\n${mail.text}`);
  return true;
}

/** Devuelve true si el correo se simuló (desarrollo o sin proveedor) en lugar de enviarse. */
export async function sendMagicLink(to: string, link: string, ttlMin: number, ayuntamiento: string): Promise<boolean> {
  const subject = "Tu enlace de acceso · Cuidadores de Colonias Felinas";
  const text = `Hola:\n\nPulsa este enlace para entrar en la plataforma de formación de cuidadores de colonias felinas del ${ayuntamiento}:\n\n${link}\n\nEl enlace caduca en ${ttlMin} minutos y solo se puede usar una vez. Si no lo has pedido tú, ignora este correo.`;
  const html = `<p>Hola:</p><p>Pulsa el botón para entrar en la plataforma de formación de cuidadores de colonias felinas del ${ayuntamiento}.</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#2f6b4f;color:#fff;border-radius:8px;text-decoration:none">Entrar</a></p><p style="color:#666;font-size:13px">El enlace caduca en ${ttlMin} minutos y solo se puede usar una vez. Si no lo has pedido tú, ignora este correo.</p>`;
  return deliver({ to, subject, text, html });
}

/** Correo de texto genérico (avisos internos). */
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  await deliver({ to, subject, text });
}
