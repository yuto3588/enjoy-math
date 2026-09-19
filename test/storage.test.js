// localStorage ラッパの単体テスト（DESIGN.md 9章）。
//
// 「localStorage を手で壊しても起動する」が受け入れ条件なので、
// 壊し方をひととおり試して、どれでも例外が出ないことを見る。

import { test, assert, assertEqual, assertDeepEqual } from './runner.js';
import { sanitize, defaultState, load, save, clear, STORAGE_KEY, CURRENT_VERSION } from '../js/storage.js';

/** メモリ上の localStorage もどき。 */
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _dump: () => Object.fromEntries(map)
  };
}

/** 何をしても例外を投げる localStorage もどき（プライベートブラウズ等）。 */
function throwingStorage() {
  const boom = () => { throw new Error('storage は使えません'); };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

const validState = () => ({
  version: CURRENT_VERSION,
  level: 2,
  sinceJudge: 3,
  history: [{ pattern: 'sub_negative', correct: false, at: 1758000000000 }],
  carryOver: [{ pattern: 'sub_negative', level: 2, misses: 1 }],
  sessions: [{ date: '2026-09-18', minutes: 10, solved: 7 }]
});

// --- 正常系 ----------------------------------------------------------------

test('保存: 正常な内容はそのまま往復する', () => {
  const s = memoryStorage();
  const original = validState();
  assertEqual(save(original, s), true);
  assertDeepEqual(load(s), original);
});

test('保存: 何も入っていなければ初期状態を返す', () => {
  assertDeepEqual(load(memoryStorage()), defaultState());
});

test('保存: clear で消える', () => {
  const s = memoryStorage();
  save(validState(), s);
  clear(s);
  assertDeepEqual(load(s), defaultState());
});

// --- 壊れたデータ ----------------------------------------------------------

test('破損: JSON として読めないときは初期状態で起動する', () => {
  for (const junk of ['', '{', 'これは JSON ではない', '<html>', '{"a":']) {
    const s = memoryStorage({ [STORAGE_KEY]: junk });
    assertDeepEqual(load(s), defaultState(), `落ちるか壊れた: ${junk}`);
  }
});

test('破損: JSON だがオブジェクトでないときは初期状態で起動する', () => {
  for (const junk of ['null', '123', '"文字列"', '[1,2,3]', 'true']) {
    const s = memoryStorage({ [STORAGE_KEY]: junk });
    assertDeepEqual(load(s), defaultState(), `落ちるか壊れた: ${junk}`);
  }
});

test('破損: 1項目だけ壊れていても、他の項目は生き残る', () => {
  const broken = { ...validState(), level: 'あ' };
  const s = memoryStorage({ [STORAGE_KEY]: JSON.stringify(broken) });
  const loaded = load(s);

  assertEqual(loaded.level, defaultState().level, 'level が既定値に戻っていない');
  assertEqual(loaded.carryOver.length, 1, 'carryOver まで巻き添えで消えた');
  assertEqual(loaded.sessions.length, 1, 'sessions まで巻き添えで消えた');
});

test('破損: history が配列でなくても他は残る', () => {
  const broken = { ...validState(), history: 'こわれた' };
  const s = memoryStorage({ [STORAGE_KEY]: JSON.stringify(broken) });
  const loaded = load(s);
  assertDeepEqual(loaded.history, []);
  assertEqual(loaded.carryOver.length, 1);
});

test('破損: 配列の中の1件だけ壊れていても、その1件だけ捨てる', () => {
  const broken = {
    ...validState(),
    history: [
      { pattern: 'a', correct: true, at: 1 },
      null,
      { pattern: '', correct: true, at: 2 },
      { pattern: 'b', correct: 'はい', at: 3 },
      { pattern: 'c', correct: false, at: 4 }
    ]
  };
  const s = memoryStorage({ [STORAGE_KEY]: JSON.stringify(broken) });
  assertDeepEqual(load(s).history.map((h) => h.pattern), ['a', 'c']);
});

test('破損: どんな値を sanitize に渡しても例外を投げない', () => {
  const junk = [
    undefined, null, 0, 1, '', 'x', true, false, [], [1, 2], {},
    { version: 1 }, { version: 'x' }, { level: {} }, { history: 5 },
    { carryOver: [{}] }, { sessions: [{ date: 'いつか' }] },
    { version: 1, level: 99, history: [[]], carryOver: null, sessions: undefined }
  ];
  for (const raw of junk) {
    const out = sanitize(raw);
    assertEqual(out.version, CURRENT_VERSION, `version が壊れた: ${JSON.stringify(raw)}`);
    assert(Number.isInteger(out.level) && out.level >= 1 && out.level <= 5, `level が不正: ${out.level}`);
    assert(Array.isArray(out.history) && Array.isArray(out.carryOver) && Array.isArray(out.sessions));
  }
});

// --- バージョン ------------------------------------------------------------

test('バージョン違い: マイグレーションせず level だけ引き継ぐ', () => {
  const old = { ...validState(), version: 99 };
  const s = memoryStorage({ [STORAGE_KEY]: JSON.stringify(old) });
  const loaded = load(s);

  assertEqual(loaded.version, CURRENT_VERSION);
  assertEqual(loaded.level, 2, 'level が引き継がれていない');
  assertDeepEqual(loaded.history, []);
  assertDeepEqual(loaded.carryOver, []);
  assertDeepEqual(loaded.sessions, []);
});

test('バージョン違い: level も壊れていれば既定値になる', () => {
  const old = { version: 99, level: -3 };
  const s = memoryStorage({ [STORAGE_KEY]: JSON.stringify(old) });
  assertEqual(load(s).level, defaultState().level);
});

// --- 件数の上限 ------------------------------------------------------------

test('上限: history は直近30件までしか残らない', () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ pattern: `p${i}`, correct: true, at: i }));
  const out = sanitize({ ...validState(), history: many });
  assertEqual(out.history.length, 30);
  assertEqual(out.history[29].pattern, 'p99', '新しい方が残っていない');
});

test('上限: sessions は直近30件までしか残らない', () => {
  const many = Array.from({ length: 50 }, () => ({ date: '2026-09-18', minutes: 10, solved: 3 }));
  assertEqual(sanitize({ ...validState(), sessions: many }).sessions.length, 30);
});

test('上限: carryOver の pattern が重複していたら1件にまとめる', () => {
  const dup = [
    { pattern: 'x', level: 2, misses: 1 },
    { pattern: 'x', level: 1, misses: 3 },
    { pattern: 'y', level: 1, misses: 1 }
  ];
  assertDeepEqual(sanitize({ ...validState(), carryOver: dup }).carryOver.map((c) => c.pattern), ['x', 'y']);
});

// --- localStorage が使えない環境 -------------------------------------------

test('localStorage が例外を投げても、読み込みは初期状態を返す', () => {
  assertDeepEqual(load(throwingStorage()), defaultState());
});

test('localStorage が例外を投げても、保存は false を返すだけで落ちない', () => {
  assertEqual(save(validState(), throwingStorage()), false);
});

test('localStorage が無くても落ちない', () => {
  assertDeepEqual(load(null), defaultState());
  assertEqual(save(validState(), null), false);
  clear(null); // 例外が出なければよい
});

test('保存できる量を超えても落ちない', () => {
  const s = memoryStorage();
  s.setItem = () => { throw new Error('QuotaExceededError'); };
  assertEqual(save(validState(), s), false);
});
