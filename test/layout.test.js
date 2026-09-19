// 画面レイアウトのテスト。
//
// DESIGN.md 11章:
//   「10分を選び、一度もスクロールせずに最後まで解ける」
//   「タップ領域は最低 48×48px」
//
// 実際に index.html を小さな iframe に読み込んで、各サイズで
//   - テンキーの下の段が画面外に切れていないか（「決定」が押せなくなる）
//   - キーが 48px を割っていないか
//   - 縦にも横にもスクロールが出ていないか
// を測る。
//
// 一度この不具合を出しているので（iPhone SE サイズと横向きで下2段が切れていた）、
// 目視に頼らず毎回ここで見張る。

import { test, assert } from './runner.js';

const canRun = typeof document !== 'undefined'
  && typeof location !== 'undefined'
  && /^https?:$/.test(location.protocol);

// 実機で使う代表的な大きさ。縦は Safari のツールバーが出ている前提の低い値も含む。
const SIZES = [
  { name: 'iPhone SE 相当（ツールバーあり）', w: 320, h: 454 },
  { name: 'iPhone SE', w: 375, h: 555 },
  { name: 'iPhone 14（ツールバーあり）', w: 390, h: 664 },
  { name: 'iPhone 15 Pro Max', w: 430, h: 932 },
  { name: '横向き（低い）', w: 667, h: 300 },
  { name: '横向き', w: 844, h: 390 }
];

const STORAGE_KEY = 'math-practice';

/** 指定サイズで index.html を読み込み、測ってから片付ける。 */
async function measure(width, height) {
  const frame = document.createElement('iframe');
  frame.setAttribute('title', 'layout probe');
  frame.style.cssText =
    `position:fixed; left:-10000px; top:0; border:0; width:${width}px; height:${height}px;`;
  document.body.appendChild(frame);

  try {
    await new Promise((resolve, reject) => {
      frame.addEventListener('load', resolve, { once: true });
      frame.addEventListener('error', () => reject(new Error('読み込めない')), { once: true });
      frame.src = './index.html?level=5';
    });

    const win = frame.contentWindow;
    const doc = frame.contentDocument;

    // モジュールの読み込みを待つ（テンキーが組み上がるまで）
    for (let i = 0; i < 100 && doc.querySelectorAll('.key').length === 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    assert(doc.querySelectorAll('.key').length === 13, 'テンキーが組み上がっていない');

    const result = { home: snapshot(win, doc) };

    // 10分を選んで問題画面へ
    doc.querySelector('.time').click();
    await new Promise((r) => setTimeout(r, 50));
    result.practice = snapshot(win, doc);

    return result;
  } finally {
    frame.remove();
  }
}

function snapshot(win, doc) {
  const keys = [...doc.querySelectorAll('.key')].map((b) => b.getBoundingClientRect());
  const root = doc.documentElement;
  return {
    lowestKeyBottom: Math.max(...keys.map((k) => k.bottom)),
    rightmostKey: Math.max(...keys.map((k) => k.right)),
    minKeyHeight: Math.min(...keys.map((k) => k.height)),
    minKeyWidth: Math.min(...keys.map((k) => k.width)),
    viewportW: win.innerWidth,
    viewportH: win.innerHeight,
    overflowY: root.scrollHeight > root.clientHeight,
    overflowX: root.scrollWidth > root.clientWidth
  };
}

test('レイアウト: どの画面サイズでもテンキーが画面内に収まる', async () => {
  if (!canRun) return;

  // 念のため、保存内容を触らずに戻す
  const saved = localStorage.getItem(STORAGE_KEY);

  try {
    for (const size of SIZES) {
      const { practice } = await measure(size.w, size.h);
      const where = `${size.name}（${size.w}x${size.h}）`;

      assert(
        practice.lowestKeyBottom <= practice.viewportH + 1,
        `${where}: テンキーの下が画面から出ている（${Math.round(practice.lowestKeyBottom)} > ${practice.viewportH}）`
      );
      assert(
        practice.rightmostKey <= practice.viewportW + 1,
        `${where}: テンキーの右が画面から出ている`
      );
    }
  } finally {
    if (saved === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, saved);
  }
});

test('レイアウト: どの画面サイズでもキーが 48×48px を割らない', async () => {
  if (!canRun) return;

  const saved = localStorage.getItem(STORAGE_KEY);
  try {
    for (const size of SIZES) {
      const { practice } = await measure(size.w, size.h);
      const where = `${size.name}（${size.w}x${size.h}）`;

      assert(
        practice.minKeyHeight >= 47.5,
        `${where}: キーの高さが足りない（${Math.round(practice.minKeyHeight)}px）`
      );
      assert(
        practice.minKeyWidth >= 47.5,
        `${where}: キーの幅が足りない（${Math.round(practice.minKeyWidth)}px）`
      );
    }
  } finally {
    if (saved === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, saved);
  }
});

test('レイアウト: どの画面サイズでもスクロールが出ない', async () => {
  if (!canRun) return;

  const saved = localStorage.getItem(STORAGE_KEY);
  try {
    for (const size of SIZES) {
      const { home, practice } = await measure(size.w, size.h);
      const where = `${size.name}（${size.w}x${size.h}）`;

      assert(!home.overflowY, `${where}: ホーム画面が縦にスクロールする`);
      assert(!home.overflowX, `${where}: ホーム画面が横にスクロールする`);
      assert(!practice.overflowY, `${where}: 問題画面が縦にスクロールする`);
      assert(!practice.overflowX, `${where}: 問題画面が横にスクロールする`);
    }
  } finally {
    if (saved === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, saved);
  }
});

test('開発用の ?level= で開いても、保存された学習の記録を壊さない', async () => {
  if (!canRun) return;

  // measure() は ?level=5 でアプリを開く。
  // 覗いただけで、本来のレベルや持ち越しが書き換わってはいけない。
  const marker = {
    version: 1, level: 3, sinceJudge: 2,
    history: [{ pattern: 'sub_negative', correct: false, at: 1758000000000 }],
    carryOver: [{ pattern: 'sub_negative', level: 2, misses: 1 }],
    sessions: [{ date: '2026-09-17', minutes: 10, solved: 5 }]
  };
  const saved = localStorage.getItem(STORAGE_KEY);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(marker));
    await measure(375, 555);

    const after = JSON.parse(localStorage.getItem(STORAGE_KEY));
    assert(after, '保存内容が消えた');
    assert(after.level === marker.level, `レベルが書き換わった（${marker.level} → ${after.level}）`);
    assert(after.sinceJudge === marker.sinceJudge, '判定までの数え方が書き換わった');
    assert(
      JSON.stringify(after.carryOver) === JSON.stringify(marker.carryOver),
      '持ち越しが書き換わった'
    );
    assert(
      JSON.stringify(after.history) === JSON.stringify(marker.history),
      '成績の履歴が書き換わった'
    );
    assert(
      JSON.stringify(after.sessions) === JSON.stringify(marker.sessions),
      'セッションの記録が書き換わった'
    );
  } finally {
    if (saved === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, saved);
  }
});
