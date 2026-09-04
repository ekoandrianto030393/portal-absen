const CACHE_NAME = 'portal-absen-v57';
const urlsToCache = [
  '/portal.html',
  '/portal.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
                  .map(cacheName => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Hanya tangani GET request — Cache API tidak mendukung HEAD/POST/dll
  if (event.request.method !== 'GET') {
    return; // Biarkan browser tangani langsung tanpa service worker
  }
  
  // JANGAN PERNAH CACHE API CALLS
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ success: false, message: "Koneksi terputus. Anda sedang offline." }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Network-First untuk file selain API (HTML, JS, CSS)
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Hanya cache jika response valid dan method adalah GET
        if (response && response.status === 200 && response.type === 'basic' && event.request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
