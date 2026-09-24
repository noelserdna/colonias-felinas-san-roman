import { handle } from "@astrojs/cloudflare/handler";
import { getDb } from "./lib/db";
import { retryPendingGrading } from "./lib/exam";

export default {
  fetch: handle,
  async scheduled(_controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    ctx.waitUntil(retryPendingGrading(getDb(env.DB)).then((n) => n && console.log(`Reintentada corrección de ${n} intentos`)));
  },
} satisfies ExportedHandler<Cloudflare.Env>;
