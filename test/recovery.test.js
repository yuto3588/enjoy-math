// 誤答フローの単体テスト。
//
// このアプリで最も壊してはいけない性質:
//   「1つのつまずきに対する連続出題は最大3問。正解するまで続く構造を作らない」
// を、遷移表の全探索で確認する。

import { test, assert, assertEqual, assertDeepEqual } from './runner.js';
import { STEP, nextStep, isProblemStep, retrySpec, easierSpec, MAX_EXTRA_PROBLEMS } from '../js/recovery.js';
import { createRng } from '../js/lib/rng.js';
import { generate, patternsFor, formsFor, SUPPORTED_LEVELS } from '../js/generators/index.js';
import { operandsOf } from './eval.js';

const ALL_STEPS = Object.values(STEP);

// --- 必ず終わること --------------------------------------------------------

test('誤答フロー: 全問誤答でも必ず NORMAL に戻る', () => {
  for (const start of ALL_STEPS) {
    let step = start;
    let guard = 0;
    while (step !== STEP.NORMAL) {
      step = nextStep(step, false); // 一度も正解しない
      guard += 1;
      assert(guard <= 10, `${start} から抜けられない（${guard}回遷移）`);
    }
  }
});

test('誤答フロー: 全問正解でも必ず NORMAL に戻る', () => {
  for (const start of ALL_STEPS) {
    let step = start;
    let guard = 0;
    while (step !== STEP.NORMAL) {
      step = nextStep(step, true);
      guard += 1;
      assert(guard <= 10, `${start} から抜けられない（${guard}回遷移）`);
    }
  }
});

test('誤答フロー: 1つのつまずきで追加出題は2問まで（元の問題を含めて3問）', () => {
  // 通常フローで誤答し、以後すべて誤答し続けた場合をたどる。
  let step = STEP.NORMAL;
  let problemsShown = 1; // 最初の1問
  let guard = 0;

  step = nextStep(step, false); // 誤答 → EXPLAIN

  while (step !== STEP.NORMAL) {
    step = nextStep(step, false);
    if (isProblemStep(step) && step !== STEP.NORMAL) problemsShown += 1;
    guard += 1;
    assert(guard <= 10, 'フローが終わらない');
  }

  assertEqual(problemsShown, 1 + MAX_EXTRA_PROBLEMS, '出題数が3問を超えている');
  assertDeepEqual(
    [STEP.NORMAL, STEP.EXPLAIN, STEP.RETRY, STEP.EASIER, STEP.CARRY_OVER].length,
    5,
    '想定した経路の長さが変わっている'
  );
});

test('誤答フロー: 経路が仕様どおりの順番になっている', () => {
  const path = [STEP.NORMAL];
  let step = STEP.NORMAL;
  for (let i = 0; i < 5; i++) {
    step = nextStep(step, false);
    path.push(step);
    if (step === STEP.NORMAL) break;
  }
  assertDeepEqual(
    path,
    [STEP.NORMAL, STEP.EXPLAIN, STEP.RETRY, STEP.EASIER, STEP.CARRY_OVER, STEP.NORMAL],
    '解説 → 類題 → 易問 → 持ち越し の順になっていない'
  );
});

// --- 前に戻る辺が無いこと --------------------------------------------------

test('誤答フロー: 前の STEP に戻る遷移が存在しない', () => {
  const order = {
    [STEP.NORMAL]: 0,
    [STEP.EXPLAIN]: 1,
    [STEP.RETRY]: 2,
    [STEP.EASIER]: 3,
    [STEP.CARRY_OVER]: 4,
    [STEP.EXPLAIN_ONLY]: 1
  };

  for (const step of ALL_STEPS) {
    for (const correct of [true, false]) {
      const to = nextStep(step, correct);
      assert(
        to === STEP.NORMAL || order[to] > order[step],
        `${step} → ${to} が後戻りしている（correct=${correct}）`
      );
    }
  }
});

test('誤答フロー: 解説からは必ず類題へ進む（正誤に関係なく）', () => {
  assertEqual(nextStep(STEP.EXPLAIN, true), STEP.RETRY);
  assertEqual(nextStep(STEP.EXPLAIN, false), STEP.RETRY);
});

test('誤答フロー: 持ち越し表示と解説のみ表示からは必ず通常フローへ', () => {
  for (const correct of [true, false]) {
    assertEqual(nextStep(STEP.CARRY_OVER, correct), STEP.NORMAL);
    assertEqual(nextStep(STEP.EXPLAIN_ONLY, correct), STEP.NORMAL);
  }
});

test('誤答フロー: 類題・易問に正解したら通常フローへ戻る', () => {
  assertEqual(nextStep(STEP.RETRY, true), STEP.NORMAL);
  assertEqual(nextStep(STEP.EASIER, true), STEP.NORMAL);
});

test('誤答フロー: 未知の状態を渡しても NORMAL を返す（起動不能にしない）', () => {
  assertEqual(nextStep('こわれた値', false), STEP.NORMAL);
  assertEqual(nextStep(undefined, true), STEP.NORMAL);
});

// --- 類題・易問の条件 ------------------------------------------------------

test('類題: レベル・pattern・式の形が元の問題と同じ', () => {
  const origin = { level: 2, pattern: 'sub_negative', form: 'neg_first' };
  assertDeepEqual(retrySpec(origin), { level: 2, pattern: 'sub_negative', form: 'neg_first' });
});

test('易問: pattern と式の形は変えず、数だけを易しくする', () => {
  const spec = easierSpec({ level: 2, pattern: 'sub_negative', form: 'pos_first' });
  assertEqual(spec.pattern, 'sub_negative', '別の単元に飛んでいる');
  assertEqual(spec.form, 'pos_first', '式の形が変わっている');
  assertEqual(spec.easier, true);
});

test('易問: Lv1 でも「1つ下のレベル」を要求しない', () => {
  const spec = easierSpec({ level: 1, pattern: 'add_diff_sign', form: 'neg_first' });
  assert(spec.level >= 1, 'Lv1 より下のレベルを要求している');
  assertEqual(spec.easier, true);
});

test('易問: Lv3 以降でも同じ単元のまま易しくなる', () => {
  // Lv3 の乗除に対する「1レベル下」は加減で、同種ではない。
  const spec = easierSpec({ level: 3, pattern: 'muldiv_sign_count', form: 'mul3' });
  assertEqual(spec.pattern, 'muldiv_sign_count', '別の単元に飛んでいる');
  assertEqual(spec.form, 'mul3');
});

// --- 実際に生成してみる ----------------------------------------------------

test('類題: 実際に生成すると pattern と form とレベルが一致する（全レベル）', () => {
  const rng = createRng(555);
  for (const level of SUPPORTED_LEVELS) {
    for (const pattern of patternsFor(level)) {
      for (const form of formsFor(pattern)) {
        const spec = retrySpec({ level, pattern, form });
        for (let i = 0; i < 40; i++) {
          const p = generate(spec.level, rng, [], spec);
          assertEqual(p.pattern, pattern, '類題の pattern が違う');
          assertEqual(p.form, form, '類題の form が違う');
          assertEqual(p.level, level, '類題のレベルが違う');
        }
      }
    }
  }
});

test('易問: 実際に生成しても pattern と form が保たれる（全レベル）', () => {
  const rng = createRng(999);
  for (const level of SUPPORTED_LEVELS) {
    for (const pattern of patternsFor(level)) {
      for (const form of formsFor(pattern)) {
        const spec = easierSpec({ level, pattern, form });
        for (let i = 0; i < 40; i++) {
          const p = generate(spec.level, rng, [], spec);
          assertEqual(p.pattern, pattern, '易問の pattern が違う');
          assertEqual(p.form, form, '易問の form が違う');
        }
      }
    }
  }
});

test('易問: Lv1 の加減なら項の絶対値が5以下になる', () => {
  const rng = createRng(1357);
  for (const pattern of patternsFor(1)) {
    for (const form of formsFor(pattern)) {
      const spec = easierSpec({ level: 1, pattern, form });
      for (let i = 0; i < 60; i++) {
        const p = generate(spec.level, rng, [], spec);
        for (const n of operandsOf(p.question)) {
          assert(Math.abs(n) <= 5, `易問なのに絶対値が大きい: ${p.question}`);
        }
      }
    }
  }
});

test('易問: Lv2 の加減なら Lv1 の範囲（絶対値10以下）に収まる', () => {
  const rng = createRng(1234);
  for (const pattern of patternsFor(2)) {
    for (const form of formsFor(pattern)) {
      const spec = easierSpec({ level: 2, pattern, form });
      for (let i = 0; i < 60; i++) {
        const p = generate(spec.level, rng, [], spec);
        for (const n of operandsOf(p.question)) {
          assert(Math.abs(n) <= 10, `Lv1 の範囲を超えている: ${p.question}`);
        }
      }
    }
  }
});
