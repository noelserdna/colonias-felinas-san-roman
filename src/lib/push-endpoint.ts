import { z } from "zod";

/**
 * Servicios de push conocidos. El servidor hace peticiones al endpoint de cada suscripción, así que solo
 * se aceptan estos dominios: evita que alguien use la suscripción para hacer que el servidor llame a
 * cualquier dirección (SSRF).
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

export const subscriptionInput = z.object({
  endpoint: z.string().max(1000).refine(isPushEndpoint, "Servicio de notificaciones no admitido"),
  keys: z.object({ p256dh: z.string().min(80).max(120), auth: z.string().min(16).max(40) }),
});
