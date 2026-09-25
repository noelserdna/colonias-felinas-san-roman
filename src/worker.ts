import { handle } from "@astrojs/cloudflare/handler";
import { getDb } from "./lib/db";
import { retryPendingGrading } from "./lib/exam";

/** Cron de la instancia demo que la devuelve a su estado inicial (ver wrangler.jsonc, env.demo). */
const DEMO_RESET_CRON = "0 3 * * *";

export default {
  fetch: handle,
  async scheduled(controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    const db = getDb(env.DB);
    if (controller.cron === DEMO_RESET_CRON && env.DEMO === "1") {
      const [{ resetDemo }, { getBranding }] = await Promise.all([import("./lib/demo-data"), import("./lib/branding")]);
      const b = await getBranding(db);
      ctx.waitUntil(resetDemo(db, { origin: "https://demo.colonia.dev", ayuntamiento: b.ayuntamiento }).then(() => console.log("Demo reiniciada")));
      return;
    }
    ctx.waitUntil(retryPendingGrading(db).then((n) => n && console.log(`Reintentada corrección de ${n} intentos`)));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
