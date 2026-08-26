const CACHE_NAME = 'portal-absen-v18';
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
  event.respondWith(
    caches.match(event.request).then(response => {
      // Jika ada di cache, gunakan itu, jika tidak fetch dari jaringan
      // Atau bisa pakai network-first approach untuk portal.html/js
      return response || fetch(event.request);
    })
  );
});