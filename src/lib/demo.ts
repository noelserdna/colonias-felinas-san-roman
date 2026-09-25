import { env } from "cloudflare:workers";

/** Instancia de pruebas y demostración (variable DEMO=1): se marca en toda la web y en los carnets. */
export const isDemo = () => env.DEMO === "1";
