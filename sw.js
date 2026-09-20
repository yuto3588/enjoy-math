// Service Worker。
//
// 目的はただ一つ、機内モードでも普通に開けるようにすること。
// 外部との通信は一切しない。CDN も分析も広告も無い。
//
// 方針:
//   - インストール時に必要なファイルを全部キャッシュする
//   - 取り出しはキャッシュ優先。ネットワークはキャッシュに無いときだけ
//   - 新しい版はタブを全部閉じたあと（＝次にアプリを開いたとき）に入れ替わる
//     解いている途中で中身が入れ替わらないよう、skipWaiting() は使わない
//
// ファイルを増やしたら PRECACHE にも足すこと。
// test/pwa.test.js が、追加し忘れていないかを見張っている。

const VERSION = 'v6';
const CACHE_NAME = `enjoy-math-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/keypad.js',
  './js/recovery.js',
  './js/explain.js',
  './js/carryover.js',
  './js/timer.js',
  './js/level.js',
  './js/storage.js',
  './js/profile.js',
  './js/courses.js',
  './js/lib/rng.js',
  './js/lib/problem.js',
  './js/lib/num.js',
  './js/generators/index.js',
  './js/generators/addsub.js',
  './js/generators/muldiv.js',
  './js/generators/power.js',
  './js/generators/mixed.js',
  './js/generators/e5/index.js',
  './js/generators/e5/decimal.js',
  './js/generators/e5/fraction.js',
  './js/generators/e5/word.js',
  './js/generators/j3/index.js',
  './js/generators/j3/poly.js',
  './js/generators/j3/sqrt.js',
  './js/generators/j3/expand.js',
  './js/generators/j3/quadratic.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // GET 以外と、自分の配信元以外は素通しする
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;

      return fetch(request)
        .then((response) => {
          // 取れたものは次回のために取っておく
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // オフラインで、キャッシュにも無いとき。
          // 画面遷移の要求なら、とにかくアプリを開く（起動失敗を作らない）。
          if (request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
    })
  );
});
