// PWA まわりのテスト（DESIGN.md 11章の「機内モードで完全に動作する」）。
//
// 一番こわいのは「ファイルを1つ増やしたのに sw.js の PRECACHE に足し忘れ、
// 電波の無い所で開いたら真っ白」という事故。
// ここで実際に読み込んで、取りこぼしが無いかを確かめる。
//
// HTTP 経由で開いたときだけ走る（node からは fetch する相手がいないので飛ばす）。

import { test, assert, assertEqual } from './runner.js';

const canRun = typeof fetch === 'function'
  && typeof location !== 'undefined'
  && /^https?:$/.test(location.protocol);

const BASE = canRun ? new URL('./', location.href) : null;

/** アプリのルートから見た './xxx' 形式に揃える。 */
function normalize(spec, from) {
  const url = new URL(spec, from);
  return './' + url.pathname.slice(BASE.pathname.length);
}

async function text(path) {
  const res = await fetch(new URL(path, BASE), { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} が読めない (${res.status})`);
  return res.text();
}

/** sw.js の PRECACHE に並んでいるパスを取り出す。 */
async function precacheList() {
  const src = await text('sw.js');
  const block = /const PRECACHE = \[([\s\S]*?)\];/.exec(src);
  assert(block, 'sw.js の PRECACHE を読み取れない');
  return block[1].match(/'([^']+)'/g).map((s) => s.slice(1, -1));
}

/** js/app.js を起点に import をたどって、実際に使うモジュールを全部集める。 */
async function moduleGraph(entry = './js/app.js') {
  const seen = new Set();
  const queue = [entry];

  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);

    const src = await text(path);
    const from = new URL(path, BASE);
    for (const m of src.matchAll(/(?:^|\n)\s*import[^'"]*['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue; // 外部からの読み込みは無い前提
      queue.push(normalize(spec, from));
    }
  }
  return [...seen];
}

// --- 取りこぼしが無いこと --------------------------------------------------

test('PWA: アプリが使うモジュールが全部 PRECACHE に入っている', async () => {
  if (!canRun) return;

  const precache = new Set(await precacheList());
  const modules = await moduleGraph();

  for (const path of modules) {
    assert(precache.has(path), `sw.js の PRECACHE に足りない: ${path}`);
  }
});

test('PWA: index.html が読むファイルが全部 PRECACHE に入っている', async () => {
  if (!canRun) return;

  const precache = new Set(await precacheList());
  const html = await text('index.html');
  const from = new URL('index.html', BASE);

  const refs = [
    ...html.matchAll(/<link[^>]+href="([^"]+)"/g),
    ...html.matchAll(/<script[^>]+src="([^"]+)"/g)
  ].map((m) => m[1]).filter((s) => s.startsWith('.'));

  assert(refs.length > 0, 'index.html から何も読み取れていない');
  for (const ref of refs) {
    assert(precache.has(normalize(ref, from)), `PRECACHE に足りない: ${ref}`);
  }
});

test('PWA: PRECACHE に並んだファイルが全部実在する', async () => {
  if (!canRun) return;

  for (const path of await precacheList()) {
    const res = await fetch(new URL(path, BASE), { cache: 'no-store' });
    assert(res.ok, `PRECACHE に書いてあるが存在しない: ${path} (${res.status})`);
  }
});

test('PWA: 開発用のページはキャッシュに入れない', async () => {
  if (!canRun) return;

  const precache = await precacheList();
  for (const dev of ['./tests.html', './preview.html', './package.json']) {
    assert(!precache.includes(dev), `開発用のファイルが入っている: ${dev}`);
  }
  assert(
    !precache.some((p) => p.startsWith('./test/') || p.startsWith('./tools/')),
    'test/ か tools/ が入っている'
  );
});

// --- 外部通信ゼロ ----------------------------------------------------------

test('外部通信: アプリのコードが外部の URL を参照していない', async () => {
  if (!canRun) return;

  const modules = await moduleGraph();
  for (const path of modules) {
    const src = withoutComments(await text(path));
    assert(!/https?:\/\//.test(src), `外部の URL がある: ${path}`);
    assert(!/XMLHttpRequest|sendBeacon|EventSource|WebSocket/.test(src), `通信の仕組みがある: ${path}`);
  }
});

test('外部通信: 送信するのは学習量の記録だけで、宛先は同じ配信元に限る', async () => {
  if (!canRun) return;

  // 保護者が学習量を確認するための記録だけは、自宅 PC のサーバーへ送る。
  // それ以外の送信を足していないこと、宛先が相対パスであることを見張る。
  const modules = await moduleGraph();

  for (const path of modules) {
    const src = withoutComments(await text(path));
    const calls = [...src.matchAll(/\bfetch\s*\(\s*([^,)\s]+)/g)].map((m) => m[1]);

    for (const target of calls) {
      assert(
        target === 'LOG_ENDPOINT',
        `想定外の送信先で fetch している: ${path} / ${target}`
      );
    }

    if (src.includes('LOG_ENDPOINT')) {
      const decl = /const LOG_ENDPOINT\s*=\s*'(\.\/[^']*)'/.exec(src);
      assert(decl, `LOG_ENDPOINT が相対パスの定数になっていない: ${path}`);
      assert(!decl[1].includes('//'), `宛先が外部を指している: ${decl[1]}`);
    }
  }
});

test('外部通信: 送るのは 日付 / 学年 / 時間 / 問題数 だけ', async () => {
  if (!canRun) return;

  // 正誤や点数を送り始めていないかを見張る。
  // 学年は、3人が別々の端末で使うので、どの子の分かを分けるために送る。
  const src = withoutComments(await text('./js/app.js'));
  const body = /body:\s*JSON\.stringify\(\{([\s\S]*?)\}\)/.exec(src);
  assert(body, '送信内容を読み取れない');

  const keys = [...body[1].matchAll(/(\w+)\s*:/g)].map((m) => m[1]).sort();
  assert(
    JSON.stringify(keys) === JSON.stringify(['date', 'grade', 'minutes', 'solved']),
    `送信内容が変わっている: ${keys.join(', ')}`
  );
});

test('外部通信: index.html が外部のファイルを読んでいない', async () => {
  if (!canRun) return;

  const html = await text('index.html');
  const refs = [
    ...html.matchAll(/<link[^>]+href="([^"]+)"/g),
    ...html.matchAll(/<script[^>]+src="([^"]+)"/g)
  ].map((m) => m[1]);

  for (const ref of refs) {
    assert(ref.startsWith('.'), `外部から読み込んでいる: ${ref}`);
  }
});

test('外部通信: CSS が外部のフォントや画像を読んでいない', async () => {
  if (!canRun) return;

  const css = await text('css/style.css');
  assert(!/@import/.test(css), 'CSS に @import がある');
  assert(!/url\(\s*['"]?https?:/.test(css), 'CSS が外部の URL を読んでいる');
});

// --- manifest ---------------------------------------------------------------

test('manifest: ホーム画面から全画面で起動する設定になっている', async () => {
  if (!canRun) return;

  const manifest = JSON.parse(await text('manifest.json'));
  assertEqual(manifest.name, 'Enjoy数学');
  assertEqual(manifest.display, 'standalone', '全画面にならない設定になっている');
  assertEqual(manifest.start_url, './', '配信先が変わると壊れる start_url');
  assertEqual(manifest.scope, './');
  assert(manifest.icons.length >= 2, 'アイコンが足りない');
  assert(
    manifest.icons.some((i) => i.purpose === 'maskable'),
    'maskable のアイコンが無い（Android で余白が付く）'
  );
});

test('manifest: アイコンが全部実在する', async () => {
  if (!canRun) return;

  const manifest = JSON.parse(await text('manifest.json'));
  for (const icon of manifest.icons) {
    const res = await fetch(new URL(icon.src, BASE), { cache: 'no-store' });
    assert(res.ok, `アイコンが無い: ${icon.src}`);
    assertEqual(res.headers.get('content-type'), 'image/png', `PNG でない: ${icon.src}`);
  }
});

test('index.html: iOS 用のアイコンとアプリ名の指定がある', async () => {
  if (!canRun) return;

  const html = await text('index.html');
  assert(/rel="apple-touch-icon"/.test(html), 'apple-touch-icon が無い（iOS で既定のアイコンになる）');
  assert(/rel="manifest"/.test(html), 'manifest への link が無い');
  assert(/apple-mobile-web-app-capable/.test(html), '全画面の指定が無い');
  assert(/<title>Enjoy数学<\/title>/.test(html), 'タイトルが違う');
});

// --- 更新の入れ替わり方 ----------------------------------------------------

/** コメントを取り除く。文中で名前に触れているだけのものを拾わないため。 */
function withoutComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

test('Service Worker: 解いている途中で中身が入れ替わらない', async () => {
  if (!canRun) return;

  const src = withoutComments(await text('sw.js'));
  assert(
    !/skipWaiting\s*\(/.test(src),
    'skipWaiting があると、問題を解いている最中に新しい版へ切り替わりうる'
  );
});

test('Service Worker: 古いキャッシュを片付けている', async () => {
  if (!canRun) return;

  const src = await text('sw.js');
  assert(/caches\.delete/.test(src), '古いキャッシュが残り続ける');
});
