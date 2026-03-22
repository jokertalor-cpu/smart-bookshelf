const CACHE_NAME = 'mm-bookshelf-v1';
// Offline မှာ အလုပ်လုပ်စေချင်တဲ့ ဖိုင်စာရင်း
const urlsToCache = [
  '/',
  '/index.html',
  '/authors.html',
  '/library.html',
  '/detail.html',
  '/home.css',
  '/main.css',
  '/mainscript.js',
  '/detailscript.js',
  '/libraryscript.js',
  '/photo_2026-03-20_09-18-40.jpg', // သင့် Logo ဖိုင်အမည်
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://unpkg.com/dexie/dist/dexie.js'
];

// ၁။ Service Worker ကို Install လုပ်ပြီး ဖိုင်များကို Cache ထဲသိမ်းခြင်း
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// ၂။ အင်တာနက်မရှိလျှင် Cache ထဲမှ ဖိုင်များကို ထုတ်ပြခြင်း (Fetch Event)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache ထဲမှာရှိရင် အဲ့ဒါကိုပြမယ်၊ မရှိရင် Network ကနေ ဆွဲမယ်
        return response || fetch(event.request);
      })
  );
});

// ၃။ Version အသစ်တက်လာလျှင် Cache အဟောင်းကို ဖျက်ခြင်း
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});