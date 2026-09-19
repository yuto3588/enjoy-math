// 難易度の自動調整の単体テスト（DESIGN.md 6章）。

import { test, assert, assertEqual } from './runner.js';
import {
  nextLevel, createLevelController, highestSupportedLevel,
  WINDOW, MAX_JUDGEMENTS_PER_SESSION, MIN_LEVEL
} from '../js/level.js';

/** correct が n 件、誤答が (WINDOW - n) 件の履歴を作る。 */
function results(correctCount, total = WINDOW) {
  return Array.from({ length: total }, (_, i) => ({ correct: i < correctCount }));
}

// --- 判定そのもの ----------------------------------------------------------

test('難易度: 正答率80%以上で1つ上がる', () => {
  assertEqual(nextLevel(1, results(8), 5), 2);
  assertEqual(nextLevel(1, results(10), 5), 2);
});

test('難易度: 正答率40%以下で1つ下がる', () => {
  assertEqual(nextLevel(3, results(4), 5), 2);
  assertEqual(nextLevel(3, results(0), 5), 2);
});

test('難易度: 40%より上、80%未満なら変わらない', () => {
  for (const n of [5, 6, 7]) {
    assertEqual(nextLevel(3, results(n), 5), 3, `正答率 ${n * 10}% で動いた`);
  }
});

test('難易度: 10問たまるまでは判定しない', () => {
  for (let n = 0; n < WINDOW; n++) {
    assertEqual(nextLevel(2, results(n, n), 5), 2, `${n}問で判定してしまった`);
  }
});

test('難易度: 最小値・最大値を超えない', () => {
  assertEqual(nextLevel(1, results(0), 5), MIN_LEVEL, '1より下がった');
  assertEqual(nextLevel(5, results(10), 5), 5, '上限を超えた');
});

test('難易度: 実装されていないレベルには上がらない', () => {
  const max = highestSupportedLevel();
  assertEqual(nextLevel(max, results(10)), max, '未実装のレベルに上がった');
});

test('難易度: 判定に使うのは直近10問だけ', () => {
  // 古い10問が全問正解、新しい10問が全問誤答 → 下がるべき
  const history = [...results(10), ...results(0)];
  assertEqual(nextLevel(3, history, 5), 2);
});

test('難易度: 壊れた履歴を渡しても落ちない', () => {
  for (const bad of [null, undefined, 'x', 5, {}]) {
    assertEqual(nextLevel(2, bad, 5), 2);
  }
  assertEqual(nextLevel(2, [null, undefined, {}, ...results(0)], 5), 1);
});

// --- コントローラ ----------------------------------------------------------

test('コントローラ: 10問ごとに判定が走る', () => {
  const c = createLevelController({ level: 1, maxLevel: 5 });
  c.startSession();

  for (let i = 0; i < 9; i++) c.record('p', true);
  assertEqual(c.getLevel(), 1, '10問たまる前に動いた');

  c.record('p', true); // 10問目
  assertEqual(c.getLevel(), 2, '10問目で判定されていない');
});

test('コントローラ: 判定は1セッションに最大2回まで', () => {
  const c = createLevelController({ level: 1, maxLevel: 5 });
  c.startSession();

  for (let i = 0; i < 30; i++) c.record('p', true); // 本来なら3回判定できる量
  assertEqual(c.getJudgements(), MAX_JUDGEMENTS_PER_SESSION);
  assertEqual(c.getLevel(), 3, 'レベルが動きすぎている');
});

test('コントローラ: 上限に達した分は次のセッションに持ち越す', () => {
  const c = createLevelController({ level: 1, maxLevel: 5 });
  c.startSession();
  for (let i = 0; i < 30; i++) c.record('p', true);
  assertEqual(c.getLevel(), 3);

  // 次のセッション。たまっている10問分がすぐ判定される。
  c.startSession();
  assert(c.getSinceJudge() >= WINDOW, '持ち越し分が数えられていない');
  c.record('p', true);
  assertEqual(c.getLevel(), 4, '次のセッションで判定されていない');
});

test('コントローラ: 判定の回数はセッションごとにリセットされる', () => {
  const c = createLevelController({ level: 1, maxLevel: 5 });
  c.startSession();
  for (let i = 0; i < 20; i++) c.record('p', true);
  assertEqual(c.getJudgements(), 2);

  c.startSession();
  assertEqual(c.getJudgements(), 0);
});

test('コントローラ: セッションをまたいで数え続ける', () => {
  const c = createLevelController({ level: 1, maxLevel: 5 });
  c.startSession();
  for (let i = 0; i < 6; i++) c.record('p', true);

  c.startSession(); // 6問の時点でセッション終了
  assertEqual(c.getSinceJudge(), 6, 'セッションをまたぐと数え直されている');

  for (let i = 0; i < 4; i++) c.record('p', true);
  assertEqual(c.getLevel(), 2, '通算10問で判定されていない');
});

test('コントローラ: 保存された途中経過から再開できる', () => {
  const c = createLevelController({
    level: 2,
    history: results(9).map((r, i) => ({ pattern: 'p', correct: r.correct, at: i })),
    sinceJudge: 9,
    maxLevel: 5
  });
  c.startSession();
  assertEqual(c.getLevel(), 2);

  c.record('p', true); // 通算10問目
  assertEqual(c.getLevel(), 3, '復元した途中経過から判定されていない');
});

test('コントローラ: 履歴は30件までしか持たない', () => {
  const c = createLevelController({ level: 2, maxLevel: 5 });
  c.startSession();
  for (let i = 0; i < 100; i++) c.record('p', true);
  assertEqual(c.getHistory().length, 30);
});

test('コントローラ: pinned のときはレベルが動かない', () => {
  const c = createLevelController({ level: 1, maxLevel: 5, pinned: true });
  c.startSession();
  for (let i = 0; i < 20; i++) c.record('p', true);
  assertEqual(c.getLevel(), 1, '固定しているのに動いた');
});

test('コントローラ: 保存されたレベルが未実装の値でも、出せる範囲に収まる', () => {
  const max = highestSupportedLevel();
  const c = createLevelController({ level: 5 });
  assert(c.getLevel() <= max, `未実装のレベルで起動した: ${c.getLevel()}`);
  assert(c.getLevel() >= MIN_LEVEL);
});

test('コントローラ: 壊れたレベルを渡しても起動する', () => {
  for (const bad of [null, undefined, 'あ', -3, 0, NaN, {}]) {
    const c = createLevelController({ level: bad });
    assert(
      Number.isInteger(c.getLevel()) && c.getLevel() >= MIN_LEVEL,
      `レベルが不正: ${c.getLevel()}（入力 ${String(bad)}）`
    );
  }
});

test('コントローラ: 苦戦が続けばレベルが下がる', () => {
  const c = createLevelController({ level: 2, maxLevel: 5 });
  c.startSession();
  for (let i = 0; i < 10; i++) c.record('p', false);
  assertEqual(c.getLevel(), 1);

  // これ以上は下がらない
  for (let i = 0; i < 10; i++) c.record('p', false);
  assertEqual(c.getLevel(), 1);
});
