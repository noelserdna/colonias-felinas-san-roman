import { handle } from "@astrojs/cloudflare/handler";
import { getDb } from "./lib/db";
import { retryPendingGrading } from "./lib/exam";

/** Crons (ver wrangler.jsonc): reinicio de la demo y recordatorios diarios. El resto, cada 5 minutos: JEV. */
const DEMO_RESET_CRON = "0 3 * * *";
const REMINDERS_CRON = "0 8 * * *";

export default {
  fetch: handle,
  async scheduled(controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    const db = getDb(env.DB);
    const origin = env.APP_ORIGIN ?? "https://sanroman.colonia.dev";
    if (controller.cron === DEMO_RESET_CRON) {
      if (env.DEMO !== "1") return;
      const [{ resetDemo }, { getBranding }] = await Promise.all([import("./lib/demo-data"), import("./lib/branding")]);
      const b = await getBranding(db);
      ctx.waitUntil(resetDemo(db, { origin, ayuntamiento: b.ayuntamiento }).then(() => console.log("Demo reiniciada")));
      return;
    }
    if (controller.cron === REMINDERS_CRON) {
      const [{ runReminders }, { getBranding }] = await Promise.all([import("./lib/reminders"), import("./lib/branding")]);
      const b = await getBranding(db);
      ctx.waitUntil(runReminders(db, { origin, ayuntamiento: b.ayuntamiento }).then((r) => console.log(`Recordatorios: ${r.censo} de censo, ${r.carnet} de carnet`)));
      return;
    }
    ctx.waitUntil(retryPendingGrading(db).then((n) => n && console.log(`Reintentada corrección de ${n} intentos`)));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
