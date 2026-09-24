// Service worker: red primero para páginas (con copia offline), caché primero para estáticos.
const VERSION = "v5";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const PRECACHE = ["/offline", "/manifest.webmanifest", "/icons/icon.svg", "/icons/icon-mono.svg", "/icons/icon-192.png"];
// Páginas que se guardan para consultarlas sin conexión (el carnet y el temario).
const OFFLINE_PAGES = [/^\/colonia$/, /^\/documentos$/, /^\/carnet$/, /^\/temario$/, /^\/temario\/[^/]+$/, /^\/$/];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, PAGES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_astro/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/img/") || url.pathname.startsWith("/branding/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }

  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    const cacheable = OFFLINE_PAGES.some((re) => re.test(url.pathname));
    e.respondWith(
      fetch(req)
        .then((res) => {
          // Solo se guarda si la respuesta es la página final (no una redirección al login).
          if (cacheable && res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(url.pathname, { cacheName: PAGES })) || caches.match("/offline")),
    );
  }
});

// Al cerrar sesión se borran las páginas guardadas (contienen datos personales).
self.addEventListener("message", (e) => {
  if (e.data === "logout") e.waitUntil(caches.delete(PAGES));
});
