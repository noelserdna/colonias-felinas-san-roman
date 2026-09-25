import { isDemo } from "../lib/demo";
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ locals }) => {
  const b = locals.branding;
  const manifest = {
    name: `Cuidadores de Colonias Felinas · ${b.municipio}${isDemo() ? " (demo)" : ""}`,
    short_name: isDemo() ? "Colonias (demo)" : "Colonias Felinas",
    description: `Formación, examen y carnet de cuidador de colonias felinas del ${b.ayuntamiento}.`,
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#2f6b4f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
};
