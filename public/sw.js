// Service worker de Recipi.
// Estrategia v1 (solo lectura offline del plan activo):
// - Assets estáticos (_next/static, iconos, uploads): cache-first.
// - Navegaciones y GET de API: network-first con fallback a la última copia
//   cacheada — al volver a abrir sin conexión se ve la última sincronización.
// - Escrituras (POST/PATCH/DELETE) nunca se cachean ni se encolan (v1).

const VERSION = 'recipi-v1';
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Nunca cachear auth.
  if (url.pathname.startsWith('/api/auth')) return;

  const isStatic =
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/iconos') ||
    url.pathname.startsWith('/uploads');

  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  // Navegaciones y datos: network-first, fallback a cache.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(PAGES_CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
