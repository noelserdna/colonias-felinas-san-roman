import type { APIRoute } from "astro";
import { getDb } from "../../lib/db";
import { getEscudo } from "../../lib/branding";

export const GET: APIRoute = async ({ url }) => {
  const escudo = await getEscudo(getDb());
  if (!escudo) return Response.redirect(new URL("/img/escudo.png", url), 302);
  const bytes = Uint8Array.from(atob(escudo.dataB64), (c) => c.charCodeAt(0));
  const versioned = url.searchParams.get("v") === escudo.version;
  return new Response(bytes, {
    headers: {
      "content-type": escudo.contentType,
      "x-content-type-options": "nosniff",
      // La URL lleva la versión: si el escudo cambia, cambia la URL.
      "cache-control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300",
    },
  });
};
