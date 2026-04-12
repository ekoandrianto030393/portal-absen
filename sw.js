const CACHE_NAME = 'biometrik-v1';
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
  '/rekap_api.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&display=swap',
  'https://cdn.babylonjs.com/babylon.js',
  'https://cdn.babylonjs.com/loaders/babylonjs.loaders.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.7.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.js'
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
        return fetch(event.request);
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