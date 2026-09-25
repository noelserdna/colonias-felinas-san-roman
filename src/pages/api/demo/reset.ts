import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getDb } from "../../../lib/db";
import { isDemo } from "../../../lib/demo";
import { resetDemo } from "../../../lib/demo-data";
import { sha256 } from "../../../lib/util";

/**
 * Reinicia la demo a su estado inicial (lo mismo que el cron de cada noche).
 * Solo con el token: `curl -X POST -H "Origin: https://demo.colonia.dev" -H "Authorization: Bearer $DEMO_RESET_TOKEN" https://demo.colonia.dev/api/demo/reset`
 */
export const POST: APIRoute = async ({ request, url, locals }) => {
  if (!isDemo() || !env.DEMO_RESET_TOKEN) return new Response("No encontrado", { status: 404 });
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  // Comparación de resúmenes para no filtrar el token por tiempos.
  if ((await sha256(auth)) !== (await sha256(env.DEMO_RESET_TOKEN))) return new Response("No autorizado", { status: 401 });
  const started = Date.now();
  await resetDemo(getDb(), { origin: url.origin, ayuntamiento: locals.branding.ayuntamiento });
  return new Response(`Demo reiniciada en ${Date.now() - started} ms\n`);
};
