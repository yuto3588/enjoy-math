// Lv1 / Lv2 加減ジェネレータの単体テスト。

import { test, assert, assertEqual, assertDeepEqual } from './runner.js';
import { evaluateExpression, operandsOf } from './eval.js';
import { createRng } from '../js/lib/rng.js';
import { generate, patternsFor, formsFor, maxMagnitudeFor } from '../js/generators/index.js';
import { validateProblem, FORMS } from '../js/lib/problem.js';

// このファイルは Lv1-2（加減）専用。Lv3-5 は generators.test.js で見る。
const SUPPORTED_LEVELS = [1, 2];

const N = 2000;

/** 通常の出題と同じ条件（直近3問を渡す）で n 問作る。 */
function sample(level, seed = 20260918, n = N) {
  const rng = createRng(seed);
  const out = [];
  const recent = [];
  for (let i = 0; i < n; i++) {
    const p = generate(level, rng, recent);
    out.push(p);
    recent.push(p);
    if (recent.length > 3) recent.shift();
  }
  return out;
}

// --- 1. 答えが必ず整数 ------------------------------------------------------

test('Lv1-2: answer が必ず整数の文字列', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      assert(/^-?\d+$/.test(p.answer), `Lv${level} 整数でない answer: ${p.question} → ${p.answer}`);
      assert(Number.isInteger(Number(p.answer)), `Lv${level} 整数化できない: ${p.answer}`);
    }
  }
});

// --- 2. question を独立に評価した結果が answer と一致する -------------------

test('Lv1-2: question の計算結果が answer と一致する', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      const computed = evaluateExpression(p.question);
      assertEqual(
        String(computed),
        p.answer,
        `Lv${level} 式と答えが食い違う: ${p.question}`
      );
    }
  }
});

// --- 3. traps が必ず1件以上ある --------------------------------------------

test('Lv1-2: traps が必ず1件以上あり、正解と重複しない', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      assert(Array.isArray(p.traps) && p.traps.length >= 1, `traps が空: ${p.question}`);
      const seen = new Set();
      for (const t of p.traps) {
        assert(/^-?\d+$/.test(t.value), `trap の value が整数でない: ${JSON.stringify(t)}`);
        assert(typeof t.reason === 'string' && t.reason.length > 0, `trap の reason が空: ${p.question}`);
        assert(t.value !== p.answer, `trap が正解と同じ: ${p.question} / ${t.value}`);
        assert(!seen.has(t.value), `trap の value が重複: ${p.question} / ${t.value}`);
        seen.add(t.value);
      }
    }
  }
});

test('Lv1-2: traps が2件ある問題が大半を占める（解説の出し分けが効く）', () => {
  for (const level of SUPPORTED_LEVELS) {
    const problems = sample(level);
    const withTwo = problems.filter((p) => p.traps.length >= 2).length;
    const rate = withTwo / problems.length;
    assert(rate >= 0.9, `Lv${level} traps が2件ある割合が低い: ${(rate * 100).toFixed(1)}%`);
  }
});

// --- 4. 同じ問題が連続で出ない ---------------------------------------------

test('Lv1-2: 直近3問と同じ問題が出ない', () => {
  for (const level of SUPPORTED_LEVELS) {
    const problems = sample(level);
    for (let i = 1; i < problems.length; i++) {
      const window = problems.slice(Math.max(0, i - 3), i).map((p) => p.question);
      assert(
        !window.includes(problems[i].question),
        `Lv${level} ${i}問目が直近3問と重複: ${problems[i].question}`
      );
    }
  }
});

// --- 5. 絶対値1の出現率 -----------------------------------------------------

test('Lv1-2: 絶対値1を含む問題は20%以下', () => {
  for (const level of SUPPORTED_LEVELS) {
    const problems = sample(level);
    const hasOne = problems.filter((p) =>
      operandsOf(p.question).some((n) => Math.abs(n) === 1)
    ).length;
    const rate = hasOne / problems.length;
    assert(rate <= 0.2, `Lv${level} 絶対値1の出現率が高い: ${(rate * 100).toFixed(1)}%`);
  }
});

// --- 6. レベルごとの数値範囲 ------------------------------------------------

test('Lv1-2: 項の絶対値がレベルの範囲に収まる', () => {
  for (const level of SUPPORTED_LEVELS) {
    const max = maxMagnitudeFor(level);
    for (const p of sample(level)) {
      for (const n of operandsOf(p.question)) {
        const abs = Math.abs(n);
        assert(abs >= 1 && abs <= max, `Lv${level} 範囲外の項 ${n}（上限 ${max}）: ${p.question}`);
      }
    }
  }
});

// --- 7. Problem の不変条件（steps 3行以内・既知の pattern など） -------------

test('Lv1-2: Problem が不変条件を満たす', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      const errors = validateProblem(p);
      assert(errors.length === 0, `${p.question}\n  ${errors.join('\n  ')}`);
    }
  }
});

test('Lv1-2: id の形式が揃っている', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level, 777, 300)) {
      assert(
        new RegExp(`^l${level}-[a-z_]+-[0-9a-f]{4}$`).test(p.id),
        `id の形式が不正: ${p.id}`
      );
    }
  }
});

// --- 8. 同じシードなら同じ問題列（純関数であること） ------------------------

test('Lv1-2: 同じシードからは同じ問題列が出る', () => {
  for (const level of SUPPORTED_LEVELS) {
    const a = sample(level, 424242, 200);
    const b = sample(level, 424242, 200);
    assertDeepEqual(a, b, `Lv${level} 同じシードで結果が変わった`);
  }
});

test('Lv1-2: 違うシードなら違う問題列になる', () => {
  for (const level of SUPPORTED_LEVELS) {
    const a = sample(level, 1, 200).map((p) => p.question).join('|');
    const b = sample(level, 2, 200).map((p) => p.question).join('|');
    assert(a !== b, `Lv${level} 違うシードで同じ列が出た`);
  }
});

// --- 9. 自明な問題を出さない ------------------------------------------------

test('Lv1-2: 項に0を含まない / 答えが0にならない', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      assert(p.answer !== '0', `答えが0: ${p.question}`);
      for (const n of operandsOf(p.question)) {
        assert(n !== 0, `項に0が含まれる: ${p.question}`);
      }
    }
  }
});

test('Lv1: 正 + 正 の自明な足し算を出さない', () => {
  for (const p of sample(1)) {
    if (p.pattern !== 'add_same_sign') continue;
    assert(
      /^\(-\d+\) \+ \(-\d+\)$/.test(p.question),
      `同符号の加法が 負+負 になっていない: ${p.question}`
    );
  }
});

// --- 10. 例外を投げない（スモーク） ----------------------------------------

test('Lv1-2: シードを変えても例外を投げない', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = createRng(seed * 9973);
      const recent = [];
      for (let i = 0; i < 40; i++) {
        const p = generate(level, rng, recent);
        recent.push(p);
        if (recent.length > 3) recent.shift();
      }
    }
  }
});

test('未対応のレベルは明示的にエラーになる', () => {
  const rng = createRng(1);
  for (const level of [0, -1, 6, 99]) {
    let threw = false;
    try {
      generate(level, rng, []);
    } catch (e) {
      threw = true;
    }
    assert(threw, `レベル ${level} でエラーにならなかった`);
  }
});

// --- 11. pattern と式の形が対応している ------------------------------------

test('Lv1-2: 定義した pattern がすべて実際に生成される', () => {
  for (const level of SUPPORTED_LEVELS) {
    const expected = patternsFor(level);
    const actual = new Set(sample(level).map((p) => p.pattern));
    for (const name of expected) {
      assert(actual.has(name), `Lv${level} で pattern "${name}" が一度も出なかった`);
    }
    for (const name of actual) {
      assert(expected.includes(name), `Lv${level} で想定外の pattern "${name}" が出た`);
    }
  }
});

test('Lv1-2: pattern と式の形が対応している', () => {
  const shape = {
    add_same_sign: /^\(-\d+\) \+ \(-\d+\)$/,
    add_diff_sign: /^(\(-\d+\) \+ \d+|\d+ \+ \(-\d+\))$/,
    sub_to_negative: /^\d+ - \d+$/,
    sub_negative: /^(\(-\d+\)|\d+) - \(-\d+\)$/
  };

  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      const re = shape[p.pattern];
      assert(re, `形の定義がない pattern: ${p.pattern}`);
      assert(re.test(p.question), `pattern ${p.pattern} と式の形が合わない: ${p.question}`);

      if (p.pattern === 'sub_to_negative') {
        const [a, b] = operandsOf(p.question);
        assert(a < b, `sub_to_negative なのに答えが負にならない: ${p.question}`);
      }
    }
  }
});

// --- 12. 解説が「今解いたこの問題の手順」になっている -----------------------

test('Lv1-2: steps の最後に必ず答えの数値が含まれる', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      const last = p.steps[p.steps.length - 1];
      assert(last.includes(p.answer), `steps の最後に答えがない: ${p.question} / ${last}`);
    }
  }
});

test('Lv1-2: steps に評価語を使わない', () => {
  const banned = ['残念', 'おしい', '惜しい', '間違', 'まちがい', 'ミス', 'よくできました', 'すばらしい', 'がんばろう', 'がんばって'];
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level, 31337, 300)) {
      const text = p.steps.join(' ');
      for (const word of banned) {
        assert(!text.includes(word), `steps に評価語 "${word}" が含まれる: ${text}`);
      }
    }
  }
});

// --- 13. 出題条件の指定（誤答フローの類題・易問で使う） ---------------------

test('Lv1-2: form が必ず既知の値になる', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      assert(FORMS.includes(p.form), `未知の form: ${p.form}（${p.question}）`);
      assert(
        formsFor(p.pattern).includes(p.form),
        `pattern ${p.pattern} が取らないはずの form: ${p.form}`
      );
    }
  }
});

test('出題条件: pattern を指定すると必ずその pattern になる', () => {
  const rng = createRng(8080);
  for (const level of SUPPORTED_LEVELS) {
    for (const pattern of ['add_same_sign', 'add_diff_sign', 'sub_to_negative', 'sub_negative']) {
      for (let i = 0; i < 100; i++) {
        const p = generate(level, rng, [], { pattern });
        assertEqual(p.pattern, pattern, `pattern の指定が効いていない（Lv${level}）`);
      }
    }
  }
});

test('出題条件: form を指定すると必ずその form になる', () => {
  const rng = createRng(9090);
  for (const level of SUPPORTED_LEVELS) {
    for (const pattern of ['add_diff_sign', 'sub_negative']) {
      for (const form of formsFor(pattern)) {
        for (let i = 0; i < 100; i++) {
          const p = generate(level, rng, [], { pattern, form });
          assertEqual(p.form, form, `form の指定が効いていない: ${p.question}`);
        }
      }
    }
  }
});

test('出題条件: maxMagnitude を指定すると項の絶対値がそれ以下になる', () => {
  const rng = createRng(7070);
  for (const level of SUPPORTED_LEVELS) {
    for (const limit of [3, 5, 8]) {
      for (let i = 0; i < 200; i++) {
        const p = generate(level, rng, [], { maxMagnitude: limit });
        for (const n of operandsOf(p.question)) {
          assert(Math.abs(n) <= limit, `上限 ${limit} を超えた項 ${n}: ${p.question}`);
        }
      }
    }
  }
});

test('出題条件: そのレベルの通常出題に無い pattern も、明示指定なら作れる', () => {
  // Lv2 で sub_negative につまずいた場合、易問は Lv1 の sub_negative になる。
  assert(!patternsFor(1).includes('sub_negative'), 'テストの前提が変わっている');

  const rng = createRng(6060);
  for (let i = 0; i < 100; i++) {
    const p = generate(1, rng, [], { pattern: 'sub_negative' });
    assertEqual(p.pattern, 'sub_negative');
    assertEqual(p.level, 1);
    assert(validateProblem(p).length === 0, `不変条件違反: ${p.question}`);
    for (const n of operandsOf(p.question)) {
      assert(Math.abs(n) <= 10, `Lv1 の範囲を超えている: ${p.question}`);
    }
  }
});

test('出題条件: 未知の pattern を指定したらエラーになる', () => {
  const rng = createRng(1);
  let threw = false;
  try {
    generate(1, rng, [], { pattern: 'そんなものはない' });
  } catch (e) {
    threw = true;
  }
  assert(threw, '未知の pattern が素通りした');
});

test('出題条件: 極端に小さい maxMagnitude でも問題を作れる', () => {
  const rng = createRng(5050);
  for (const level of SUPPORTED_LEVELS) {
    for (const limit of [0, 1, 2]) {
      for (let i = 0; i < 50; i++) {
        const p = generate(level, rng, [], { maxMagnitude: limit });
        assert(validateProblem(p).length === 0, `不変条件違反: ${p.question}`);
        assert(p.answer !== '0', `答えが0: ${p.question}`);
      }
    }
  }
});

// --- 14. DESIGN.md の例と突き合わせ ----------------------------------------

test('DESIGN.md の例と同じ解説・traps が作られる: (-3) - (-8)', () => {
  // 仕様書に載っている代表例が、実際に生成しうる形であることを確認する。
  const problems = sample(2, 20260918, 4000).filter((p) => p.question === '(-3) - (-8)');
  assert(problems.length > 0, '(-3) - (-8) が一度も生成されなかった');

  const p = problems[0];
  assertEqual(p.answer, '5', '答えが 5 でない');
  assertEqual(p.pattern, 'sub_negative', 'pattern が sub_negative でない');

  const trapValues = p.traps.map((t) => t.value).sort();
  assertDeepEqual(trapValues, ['-11', '11'], 'traps が DESIGN.md の例と違う');

  const flip = p.traps.find((t) => t.value === '-11');
  assertEqual(flip.reason, 'sign_flip_missed', '-11 の reason が違う');
});
