self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('local-one-v1').then((cache) =>
      cache.addAll(['/', '/manifest.webmanifest', '/pwa-icon.svg'])
    )
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/events')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
