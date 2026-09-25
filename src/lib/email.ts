import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import type { DB } from "./db";
import * as schema from "./db/schema";
import { chooseProvider, parseSender } from "./mail-provider";

type Mail = { to: string; subject: string; text: string; html?: string };

/** «Nombre <correo@dominio>» → { name, email } (formato del remitente de Cloudflare Email). */
export function parseFrom(from: string): { email: string; name?: string } {
  return parseSender(from) ?? { email: from.trim() };
}

const MAIL_FROM_KEY = "mail_from";
type CloudflareEmail = { send: (m: Record<string, unknown>) => Promise<unknown> };
const binding = () => (env as Cloudflare.Env & { EMAIL?: CloudflareEmail }).EMAIL;

/** Configuración efectiva del correo (panel + servidor), sin revelar claves. */
export async function getMailConfig(db?: DB) {
  const d = db ?? (await import("./db")).getDb();
  const [{ getSecret, secretStatus }, row] = await Promise.all([
    import("./secrets"),
    d.query.settings.findFirst({ where: eq(schema.settings.key, MAIL_FROM_KEY) }),
  ]);
  const panelFrom = typeof row?.value === "string" ? row.value : null;
  const panelResendKey = await getSecret(d, "resend_api_key");
  const chosen = chooseProvider({
    mock: env.MAIL_MOCK === "1",
    panelResendKey,
    hasCloudflareBinding: Boolean(binding()),
    envResendKey: env.RESEND_API_KEY ?? null,
    panelFrom,
    envFrom: env.MAIL_FROM ?? null,
  });
  return {
    ...chosen,
    resendKey: chosen.provider === "resend-panel" ? panelResendKey : chosen.provider === "resend-servidor" ? (env.RESEND_API_KEY ?? null) : null,
    panelFrom,
    envFrom: env.MAIL_FROM ?? null,
    panelKey: await secretStatus(d, "resend_api_key"),
  };
}

export async function saveMailFrom(db: DB, from: string | null) {
  if (!from) return void (await db.delete(schema.settings).where(eq(schema.settings.key, MAIL_FROM_KEY)));
  if (!parseSender(from)) throw new Error("El remitente no es válido. Escríbelo como «Nombre <no-reply@tu-dominio.es>».");
  const value = from.trim();
  await db.insert(schema.settings).values({ key: MAIL_FROM_KEY, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

async function sendResend(key: string, from: string, mail: Mail) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(`Resend respondió ${res.status}${body?.message ? `: ${body.message}` : ""}`);
  }
}

/**
 * Envía un correo con el proveedor configurado (ver `chooseProvider`): Resend con la clave del panel,
 * Cloudflare Email Service o Resend con la clave del servidor. Sin proveedor (o con `MAIL_MOCK=1`), o si el
 * envío falla, el correo se escribe en el log del Worker (`wrangler tail`): así se puede entrar la primera vez
 * como administración para configurar el correo desde el panel.
 * Devuelve true si el correo no se ha enviado de verdad (simulado).
 */
async function deliver(mail: Mail): Promise<boolean> {
  if (env.DEMO === "1") {
    // En la demo no sale ningún correo: se guarda en la bandeja para enseñarlo en /demo/correos.
    const { getDb, schema } = await import("./db");
    await getDb()
      .insert(schema.demoOutbox)
      .values({ id: crypto.randomUUID(), to: mail.to, subject: mail.subject, text: mail.text, html: mail.html ?? null, createdAt: new Date() });
    return true;
  }
  const cfg = await getMailConfig();
  const log = (why: string) => console.log(`[MAIL_MOCK] ${why} · Para ${mail.to} · ${mail.subject}\n${mail.text}`);
  if (cfg.provider === null || cfg.provider === "simulado" || !cfg.from) {
    log(cfg.provider === "simulado" ? "Simulado" : "Sin proveedor de correo");
    return true;
  }
  try {
    if (cfg.provider === "cloudflare") {
      await binding()!.send({ to: mail.to, from: parseFrom(cfg.from), subject: mail.subject, text: mail.text, ...(mail.html ? { html: mail.html } : {}) });
    } else {
      await sendResend(cfg.resendKey!, cfg.from, mail);
    }
    return false;
  } catch (e) {
    log(`No enviado (${cfg.provider}: ${e instanceof Error ? e.message : e})`);
    throw e;
  }
}

/** Correo de prueba desde Administración → Ajustes → Correo. */
export async function sendTestEmail(to: string, ayuntamiento: string, origin: string) {
  const { text, html } = mailTemplate({
    ayuntamiento,
    titulo: "Correo de prueba",
    parrafos: ["Si lees esto, el correo de la plataforma de cuidadores de colonias felinas funciona correctamente.", "Los enlaces de acceso y los avisos llegarán con este mismo remitente."],
    boton: { url: origin, texto: "Abrir la plataforma" },
    motivo: `Recibes este correo porque se ha pedido una prueba desde el panel de administración para ${to}.`,
  });
  return deliver({ to, subject: "Correo de prueba · Colonias Felinas", text, html });
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Plantilla común de los correos. Documento HTML completo, en español, con el enlace también visible
 * como texto y un pie que explica quién envía el correo y por qué: ayuda a que no acaben en spam.
 */
export function mailTemplate(opts: { ayuntamiento: string; titulo: string; parrafos: string[]; boton?: { url: string; texto: string }; nota?: string; motivo: string }) {
  const { ayuntamiento, titulo, parrafos, boton, nota, motivo } = opts;
  const pie = `${motivo} Este correo lo envía automáticamente la plataforma de cuidadores de colonias felinas del ${ayuntamiento}; no respondas a esta dirección.`;
  const text = [
    titulo,
    "",
    ...parrafos.flatMap((p) => [p, ""]),
    ...(boton ? [`${boton.texto}: ${boton.url}`, ""] : []),
    ...(nota ? [nota, ""] : []),
    "--",
    pie,
  ].join("\n");
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c2420">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px">
<tr><td>
<p style="margin:0 0 4px;font-size:13px;color:#5a645f">${esc(ayuntamiento)}</p>
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${esc(titulo)}</h1>
${parrafos.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5">${esc(p)}</p>`).join("\n")}
${
  boton
    ? `<p style="margin:22px 0"><a href="${esc(boton.url)}" style="display:inline-block;padding:12px 22px;background:#2f6b4f;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px">${esc(boton.texto)}</a></p>
<p style="margin:0 0 14px;font-size:13px;color:#5a645f;word-break:break-all">Si el botón no funciona, copia esta dirección en el navegador:<br>${esc(boton.url)}</p>`
    : ""
}
${nota ? `<p style="margin:0 0 14px;font-size:14px;color:#5a645f">${esc(nota)}</p>` : ""}
<hr style="border:0;border-top:1px solid #e3e0d8;margin:22px 0 14px">
<p style="margin:0;font-size:12px;line-height:1.5;color:#6b746f">${esc(pie)}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;
  return { text, html };
}

/** Devuelve true si el correo se simuló (desarrollo o sin proveedor) en lugar de enviarse. */
export async function sendMagicLink(to: string, link: string, ttlMin: number, ayuntamiento: string): Promise<boolean> {
  const subject = "Tu enlace para entrar · Cuidadores de Colonias Felinas";
  const { text, html } = mailTemplate({
    ayuntamiento,
    titulo: "Tu enlace para entrar",
    parrafos: [`Has pedido entrar en la plataforma de formación y acreditación de cuidadores de colonias felinas del ${ayuntamiento}.`],
    boton: { url: link, texto: "Entrar en la plataforma" },
    nota: `El enlace caduca en ${ttlMin} minutos y solo se puede usar una vez. Si no lo has pedido tú, ignora este correo: nadie podrá entrar sin él.`,
    motivo: `Recibes este correo porque se ha pedido un enlace de acceso para ${to}.`,
  });
  return deliver({ to, subject, text, html });
}

/** Aviso a una persona usuaria (colonias, cambios de rol…), con enlace a la aplicación. */
export async function sendNoticeEmail(
  to: string,
  opts: { ayuntamiento: string; titulo: string; parrafos: string[]; boton?: { url: string; texto: string } },
): Promise<boolean> {
  const { text, html } = mailTemplate({
    ...opts,
    motivo: "Recibes este correo porque colaboras como persona cuidadora de colonias felinas acreditada.",
  });
  return deliver({ to, subject: `${opts.titulo} · Colonias Felinas`, text, html });
}

/** Correo de texto genérico (avisos internos). */
export async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  await deliver({ to, subject, text });
}
