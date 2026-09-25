import { env } from "cloudflare:workers";

type Mail = { to: string; subject: string; text: string; html?: string };

/** «Nombre <correo@dominio>» → { name, email } (formato del remitente de Cloudflare Email). */
export function parseFrom(from: string): { email: string; name?: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { email: m[2].trim(), ...(m[1] ? { name: m[1].replace(/^"|"$/g, "") } : {}) } : { email: from.trim() };
}

/**
 * Envía un correo con el primer proveedor disponible:
 * 1. Cloudflare Email Service (binding `EMAIL`, dominio dado de alta en Email Sending);
 * 2. Resend (secreto `RESEND_API_KEY`);
 * 3. si no hay ninguno (o `MAIL_MOCK=1`), lo escribe en el log del Worker (`wrangler tail`).
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
  const e = env as Cloudflare.Env & { EMAIL?: { send: (m: Record<string, unknown>) => Promise<unknown> } };
  if (env.MAIL_MOCK !== "1" && e.EMAIL && env.MAIL_FROM) {
    await e.EMAIL.send({ to: mail.to, from: parseFrom(env.MAIL_FROM), subject: mail.subject, text: mail.text, ...(mail.html ? { html: mail.html } : {}) });
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
