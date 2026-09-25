/// <reference types="astro/client" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    PHOTOS: R2Bucket;
    LOGIN_LIMITER: RateLimit;
    APP_NAME: string;
    MAIL_FROM: string;
    ADMIN_EMAILS: string;
    JEV_MOCK: string;
    MAIL_MOCK: string;
    /** "1" en la instancia de pruebas y demostración. */
    DEMO?: string;
    TYPESAFE_API_KEY?: string;
    /** Clave para cifrar los secretos guardados desde el panel (mín. 16 caracteres). */
    APP_SECRET?: string;
    RESEND_API_KEY?: string;
  }
}

declare module "cloudflare:workers" {
  export const env: Cloudflare.Env;
}

declare namespace App {
  interface Locals {
    user: import("./lib/auth").SessionUser | null;
    branding: import("./lib/branding").Branding;
    /** El usuario tiene un carnet vigente: modo «consulta» (sin tests ni examen). */
    hasCarnet: boolean;
  }
}
