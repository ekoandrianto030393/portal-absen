const CACHE_NAME = 'biometrik-v17';
const urlsToCache = [
  '/',
  '/index.html',
  '/scan.html',
  '/dashboard.html',
  '/rekap.html',
  '/admin.html',
  '/monitor.html',
  '/manifest.json',
  '/App.js',
  '/index.js',
  '/scan.js',
  '/dashboard.js',
  '/rekap.js',
  '/admin.js',
  '/monitoring.js',
  '/karyawan.js',
  '/absensi.js',
  '/rekap_api.js'
];

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Fetch Event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Jaringan gagal & tidak ada cache — kembalikan respons fallback
          if (event.request.headers.get('accept')?.includes('application/json') ||
              event.request.url.includes('/verify') ||
              event.request.url.includes('/api/')) {
            // API request: kembalikan JSON error
            return new Response(
              JSON.stringify({ error: true, message: 'Offline - jaringan tidak tersedia' }),
              { status: 503, headers: { 'Content-Type': 'application/json' } }
            );
          }
          // Request lainnya: kembalikan halaman offline sederhana
          return new Response('Offline - halaman tidak tersedia', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});

// Activate Event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});