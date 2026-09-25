import { isDemo } from "../lib/demo";
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ locals }) => {
  const b = locals.branding;
  const manifest = {
    name: `Cuidadores de Colonias Felinas · ${b.municipio}${isDemo() ? " (demo)" : ""}`,
    short_name: isDemo() ? "Colonias (demo)" : "Colonias Felinas",
    description: `Formación, examen y carnet de cuidador de colonias felinas del ${b.ayuntamiento}.`,
    // Identidad estable de la app instalada aunque cambie start_url.
    id: "/",
    lang: "es",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    // Al abrir un enlace o un acceso directo con la app ya abierta, se reutiliza esa ventana.
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    categories: ["education", "government"],
    prefer_related_applications: false,
    background_color: "#f6f4ef",
    theme_color: "#2f6b4f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    // Accesos directos al mantener pulsado el icono (Android y escritorio).
    shortcuts: [
      { name: "Mi carnet", short_name: "Carnet", url: "/carnet", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Mi colonia", short_name: "Colonia", url: "/colonia", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Temario", short_name: "Temario", url: "/temario", icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] },
    ],
    // Capturas del diálogo de instalación de Android/Chrome (datos ficticios de la demo).
    screenshots: [
      { src: "/screenshots/carnet.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Carnet digital de cuidador/a con la hora en directo" },
      { src: "/screenshots/temario.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Temario por temas con test para desbloquear el siguiente" },
      { src: "/screenshots/colonia.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Gestión de la colonia: aviso de alta y censo" },
      { src: "/screenshots/ficha-gato.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Ficha de cada gato con foto e intervenciones" },
      { src: "/screenshots/solicitud.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Solicitud de registro de colonia en PDF" },
      { src: "/screenshots/carnet-escritorio.png", sizes: "1280x800", type: "image/png", form_factor: "wide", label: "Carnet digital en el ordenador" },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { "content-type": "application/manifest+json; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
};
