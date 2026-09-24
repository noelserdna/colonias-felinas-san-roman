// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";

// Dependencias declaradas de antemano para que Vite no las reoptimice en caliente durante el
// desarrollo (eso recargaba el Worker a mitad de una petición y daba errores 500 intermitentes).
const SSR_DEPS = ["marked", "zod", "drizzle-orm", "drizzle-orm/d1", "drizzle-orm/sqlite-core", "react", "react-dom", "react-dom/server"];
// (React lo gestiona @astrojs/react; añadir aquí sus runtimes provocaba «_jsxDEV is not a function».)
const CLIENT_DEPS = [
  "astro/virtual-modules/transitions-events.js",
  "astro/virtual-modules/transitions-router.js",
  "astro/virtual-modules/transitions-swap-functions.js",
  "astro/virtual-modules/transitions-types.js",
];

export default defineConfig({
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  integrations: [react()],
  session: false,
  security: { checkOrigin: true },
  // La barra de herramientas de desarrollo flota sobre la barra de pestañas del móvil.
  devToolbar: { enabled: false },
  vite: {
    optimizeDeps: { include: CLIENT_DEPS },
    environments: { ssr: { optimizeDeps: { include: SSR_DEPS } } },
  },
});
