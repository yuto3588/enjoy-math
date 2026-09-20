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

// 学習の記録は学年ごとに分かれている。ここでは中1で測る。
const STORAGE_KEY = 'math-practice:j1';

/**
 * 指定サイズで index.html を読み込み、測ってから片付ける。
 *
 * url を渡さなければ中1で開く。学年を指定しないと初回は学年えらびが出て、
 * ホームや問題画面まで進まないため。
 */
async function measure(width, height, url = './index.html?level=5&grade=j1') {
  const frame = document.createElement('iframe');
  frame.setAttribute('title', 'layout probe');
  frame.style.cssText =
    `position:fixed; left:-10000px; top:0; border:0; width:${width}px; height:${height}px;`;
  document.body.appendChild(frame);

  try {
    await new Promise((resolve, reject) => {
      frame.addEventListener('load', resolve, { once: true });
      frame.addEventListener('error', () => reject(new Error('読み込めない')), { once: true });
      frame.src = url;
    });

    const win = frame.contentWindow;
    const doc = frame.contentDocument;

    // モジュールの読み込みを待つ（テンキーが組み上がるまで）
    for (let i = 0; i < 100 && doc.querySelectorAll('.key').length === 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    // 中1は13キー（マイナスあり）、小5は14キー（小数点と分数の線）
    const keyCount = doc.querySelectorAll('.key').length;
    assert(keyCount === 13 || keyCount === 14, `テンキーが組み上がっていない（${keyCount}キー）`);

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

test('レイアウト: 小5のテンキーも画面内に収まり 48×48px を割らない', async () => {
  if (!canRun) return;

  // 小5 は小数点と分数の線が増えて最下段の並びが変わる。
  // ここを見ていないと、キーが1つだけ極端に小さくなっていても気づけない。
  //
  // Lv5 は文章題で、日本語の文が2行に折り返す。
  // 式1行の問題より縦に場所を取るので、両方を測る。
  const saved = localStorage.getItem('math-practice:e5');
  const kinds = [
    ['計算', './index.html?level=2&grade=e5'],
    ['文章題', './index.html?level=5&grade=e5']
  ];

  try {
    for (const size of SIZES) {
      for (const [kind, url] of kinds) {
        const m = await measure(size.w, size.h, url);
        const spot = `小5 ${kind} / ${size.name}（${size.w}x${size.h}）`;

        assert(
          m.practice.lowestKeyBottom <= m.practice.viewportH + 1,
          `${spot}: テンキーの下が画面から出ている`
        );
        assert(!m.practice.overflowY, `${spot}: 問題画面が縦にスクロールする`);
        assert(!m.practice.overflowX, `${spot}: 問題画面が横にスクロールする`);
      }

      const { practice } = await measure(size.w, size.h, kinds[0][1]);
      const where = `小5 / ${size.name}（${size.w}x${size.h}）`;

      assert(
        practice.lowestKeyBottom <= practice.viewportH + 1,
        `${where}: テンキーの下が画面から出ている`
      );
      assert(
        practice.minKeyHeight >= 47.5,
        `${where}: キーの高さが足りない（${Math.round(practice.minKeyHeight)}px）`
      );
      assert(
        practice.minKeyWidth >= 47.5,
        `${where}: キーの幅が足りない（${Math.round(practice.minKeyWidth)}px）`
      );
      assert(!practice.overflowY, `${where}: 問題画面が縦にスクロールする`);
      assert(!practice.overflowX, `${where}: 問題画面が横にスクロールする`);
    }
  } finally {
    if (saved === null) localStorage.removeItem('math-practice:e5');
    else localStorage.setItem('math-practice:e5', saved);
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

test('レイアウト: 中3の選択肢がどの画面サイズでも収まる', async () => {
  if (!canRun) return;

  // 中3 の展開・因数分解・二次方程式はテンキーではなく選択肢が出る。
  // テンキーとは別の組み方なので、別に測る。
  const saved = localStorage.getItem('math-practice:j3');

  try {
    for (const size of SIZES) {
      const where = `中3 / ${size.name}（${size.w}x${size.h}）`;
      const m = await measureChoices(size.w, size.h);

      assert(m.count === 4, `${where}: 選択肢が4つ出ていない（${m.count}）`);
      assert(m.lowest <= size.h + 1, `${where}: 選択肢が画面から出ている`);
      assert(m.minHeight >= 47.5, `${where}: 選択肢の高さが足りない（${Math.round(m.minHeight)}px）`);
      assert(!m.overflowY, `${where}: 縦にスクロールする`);
      assert(!m.overflowX, `${where}: 横にスクロールする`);
      assert(!m.textClipped, `${where}: 選択肢の式が横にはみ出している`);
    }
  } finally {
    if (saved === null) localStorage.removeItem('math-practice:j3');
    else localStorage.setItem('math-practice:j3', saved);
  }
});

/** 中3 の選択肢の画面を測る。 */
async function measureChoices(width, height) {
  const frame = document.createElement('iframe');
  frame.setAttribute('title', 'choice probe');
  frame.style.cssText =
    `position:fixed; left:-10000px; top:0; border:0; width:${width}px; height:${height}px;`;
  document.body.appendChild(frame);

  try {
    await new Promise((resolve, reject) => {
      frame.addEventListener('load', resolve, { once: true });
      frame.addEventListener('error', () => reject(new Error('読み込めない')), { once: true });
      frame.src = './index.html?level=4&grade=j3';
    });

    const doc = frame.contentDocument;
    for (let i = 0; i < 100 && doc.querySelectorAll('.time').length === 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    doc.querySelector('.time').click();

    for (let i = 0; i < 100 && doc.querySelectorAll('.choice').length === 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }

    const buttons = [...doc.querySelectorAll('.choice')];
    const rects = buttons.map((b) => b.getBoundingClientRect());
    const root = doc.documentElement;

    return {
      count: buttons.length,
      lowest: Math.max(...rects.map((r) => r.bottom)),
      minHeight: Math.min(...rects.map((r) => r.height)),
      // 式が枠に収まっているか（はみ出すと途中で切れて読めなくなる）
      textClipped: buttons.some((b) => b.scrollWidth > b.clientWidth + 1),
      overflowY: root.scrollHeight > root.clientHeight,
      overflowX: root.scrollWidth > root.clientWidth
    };
  } finally {
    frame.remove();
  }
}

test('レイアウト: 学年えらびがどの画面サイズでも収まる', async () => {
  if (!canRun) return;

  // 学年が決まっていない状態（初回起動）を作る。
  // iframe は同じ localStorage を見るので、測ったあと元に戻す。
  const GRADE_KEY = 'math-practice:grade';
  const saved = localStorage.getItem(GRADE_KEY);
  localStorage.removeItem(GRADE_KEY);

  try {
    for (const size of SIZES) {
      const where = `${size.name}（${size.w}x${size.h}）`;
      const m = await measureGradePicker(size.w, size.h);

      assert(m.count === 3, `${where}: 学年のボタンが3つ出ていない（${m.count}）`);
      assert(m.lowest <= size.h + 1, `${where}: 学年のボタンが画面から出ている`);
      assert(m.minHeight >= 47.5, `${where}: 学年のボタンの高さが足りない（${Math.round(m.minHeight)}px）`);
      assert(m.minWidth >= 47.5, `${where}: 学年のボタンの幅が足りない（${Math.round(m.minWidth)}px）`);
      assert(!m.overflowY, `${where}: 学年えらびが縦にスクロールする`);
      assert(!m.overflowX, `${where}: 学年えらびが横にスクロールする`);
    }
  } finally {
    if (saved === null) localStorage.removeItem(GRADE_KEY);
    else localStorage.setItem(GRADE_KEY, saved);
  }
});

/** 学年えらびの画面だけを測る。 */
async function measureGradePicker(width, height) {
  const frame = document.createElement('iframe');
  frame.setAttribute('title', 'grade probe');
  frame.style.cssText =
    `position:fixed; left:-10000px; top:0; border:0; width:${width}px; height:${height}px;`;
  document.body.appendChild(frame);

  try {
    await new Promise((resolve, reject) => {
      frame.addEventListener('load', resolve, { once: true });
      frame.addEventListener('error', () => reject(new Error('読み込めない')), { once: true });
      frame.src = './index.html';
    });

    const doc = frame.contentDocument;
    for (let i = 0; i < 100 && doc.querySelectorAll('.grade').length === 0; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }

    assert(
      doc.getElementById('screen-grade').classList.contains('active'),
      '学年が決まっていないのに学年えらびが出ていない'
    );

    const rects = [...doc.querySelectorAll('.grade')].map((b) => b.getBoundingClientRect());
    const root = doc.documentElement;
    return {
      count: rects.length,
      lowest: Math.max(...rects.map((r) => r.bottom)),
      minHeight: Math.min(...rects.map((r) => r.height)),
      minWidth: Math.min(...rects.map((r) => r.width)),
      overflowY: root.scrollHeight > root.clientHeight,
      overflowX: root.scrollWidth > root.clientWidth
    };
  } finally {
    frame.remove();
  }
}

test('学年: 選び直しても、他の学年の記録に触らない', async () => {
  if (!canRun) return;

  // 上の子が使っている端末で下の子が触っても、記録が混ざらないこと。
  const KEY_J3 = 'math-practice:j3';
  const savedJ1 = localStorage.getItem(STORAGE_KEY);
  const savedJ3 = localStorage.getItem(KEY_J3);
  const GRADE_KEY = 'math-practice:grade';
  const savedGrade = localStorage.getItem(GRADE_KEY);

  const marker = {
    version: 1, level: 5, sinceJudge: 4,
    history: [], carryOver: [{ pattern: 'order_of_ops', level: 5, misses: 2 }],
    sessions: [{ date: '2026-09-17', minutes: 30, solved: 12 }]
  };

  try {
    localStorage.setItem(KEY_J3, JSON.stringify(marker));
    await measure(375, 555); // 中1で一通り動かす

    assert(
      localStorage.getItem(KEY_J3) === JSON.stringify(marker),
      '中1で動かしたのに、中3の記録が書き換わった'
    );
  } finally {
    for (const [k, v] of [[STORAGE_KEY, savedJ1], [KEY_J3, savedJ3], [GRADE_KEY, savedGrade]]) {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    }
  }
});

test('学年: ?grade= で覗いても、この端末の学年を書き換えない', async () => {
  if (!canRun) return;

  const GRADE_KEY = 'math-practice:grade';
  const saved = localStorage.getItem(GRADE_KEY);

  try {
    localStorage.removeItem(GRADE_KEY);
    await measure(375, 555); // ?grade=j1 で開く
    assert(
      localStorage.getItem(GRADE_KEY) === null,
      '開発用に開いただけで、学年が覚えられてしまった'
    );
  } finally {
    if (saved === null) localStorage.removeItem(GRADE_KEY);
    else localStorage.setItem(GRADE_KEY, saved);
  }
});

test('テストがアプリを動かしても、学習量の記録を汚さない', async () => {
  if (!canRun) return;

  // このテストは iframe でアプリを何度も動かす。
  // そのたびに記録が送られると、保護者が見る study-log.csv が
  // テストの分で埋まって使いものにならなくなる。
  const src = await fetch('./js/app.js', { cache: 'no-store' }).then((r) => r.text());
  assert(
    src.indexOf('window.top !== window.self') >= 0,
    'iframe で動いているときに記録を止める guard が無い'
  );
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
