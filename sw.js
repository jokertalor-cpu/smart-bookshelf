const CACHE_NAME = 'mm-books-v1';
const assets = ['/', '/index.html', '/main.css', '/mainscript.js', '/library.html', '/authors.html'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener('fetch', (e) => {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});