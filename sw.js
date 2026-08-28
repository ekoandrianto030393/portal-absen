const CACHE_NAME = 'portal-absen-v52';
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
  // Selalu utamakan mengambil dari jaringan (Network-First) agar terhindar dari cache bandel di APK
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Jika berhasil ambil dari internet, simpan/perbarui ke cache
        if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
            });
        }
        return response;
      })
      .catch(() => {
        // Jika offline atau jaringan gagal, BARU ambil dari cache
        return caches.match(event.request);
      })
  );
});
