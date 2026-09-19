// 全レベル（Lv1-5）に共通する不変条件のテスト。
// Lv1-2 固有の条件は addsub.test.js を見る。

import { test, assert, assertEqual, assertDeepEqual } from './runner.js';
import { evaluateExpression } from './eval.js';
import { createRng } from '../js/lib/rng.js';
import {
  generate, patternsFor, formsFor, maxMagnitudeFor, allPatterns, SUPPORTED_LEVELS
} from '../js/generators/index.js';
import { validateProblem, FORMS, PATTERNS } from '../js/lib/problem.js';

const N = 1200;

function sample(level, seed = 20260918, n = N) {
  const rng = createRng(seed + level);
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

/** 全 pattern × 全 form をまんべんなく作る。 */
function everyKind(seed = 4242, perKind = 80, opts = {}) {
  const rng = createRng(seed);
  const out = [];
  for (const level of SUPPORTED_LEVELS) {
    for (const pattern of patternsFor(level)) {
      for (const form of formsFor(pattern)) {
        for (let i = 0; i < perKind; i++) {
          out.push(generate(level, rng, [], { pattern, form, ...opts }));
        }
      }
    }
  }
  return out;
}

// --- レベルが揃っていること ------------------------------------------------

test('全レベル: Lv1-5 がすべて出題できる', () => {
  assertDeepEqual(SUPPORTED_LEVELS.slice().sort(), [1, 2, 3, 4, 5]);
});

test('全レベル: DESIGN.md の pattern がすべてジェネレータを持つ', () => {
  const implemented = new Set(allPatterns());
  for (const name of PATTERNS) {
    if (name === 'fraction_sign') continue; // 分数は当面出さない（Phase 6 で見送り）
    assert(implemented.has(name), `pattern "${name}" にジェネレータが無い`);
  }
});

// --- 答えの正しさ ----------------------------------------------------------

test('全レベル: question を独立に計算した結果が answer と一致する', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      const computed = evaluateExpression(p.question);
      assertEqual(String(computed), p.answer, `Lv${level} 式と答えが食い違う: ${p.question}`);
    }
  }
});

test('全レベル: answer が必ず整数の文字列', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      assert(/^-?\d+$/.test(p.answer), `Lv${level} 整数でない answer: ${p.question} → ${p.answer}`);
    }
  }
});

test('全レベル: 負の数が式か答えのどちらかに必ず現れる（正負の数の問題になっている）', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      const hasNegativeTerm = /\(-\d/.test(p.question) || /^-\d/.test(p.question);
      const negativeAnswer = p.answer.startsWith('-');
      assert(
        hasNegativeTerm || negativeAnswer,
        `Lv${level} 負の数が出てこない: ${p.question} = ${p.answer}`
      );
    }
  }
});

test('全レベル: 答えが0にならない', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      assert(p.answer !== '0', `Lv${level} 答えが0: ${p.question}`);
    }
  }
});

test('全レベル: 答えが自作テンキーで入力できる桁数に収まる', () => {
  // テンキーは符号 + 3桁まで
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      const digits = p.answer.replace('-', '').length;
      assert(digits <= 3, `Lv${level} 入力できない桁数: ${p.question} → ${p.answer}`);
    }
  }
});

// --- Problem の形 ----------------------------------------------------------

test('全レベル: Problem が不変条件を満たす', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      const errors = validateProblem(p);
      assert(errors.length === 0, `Lv${level} ${p.question}\n  ${errors.join('\n  ')}`);
    }
  }
});

test('全レベル: pattern と form が既知の値になる', () => {
  for (const level of SUPPORTED_LEVELS) {
    const expected = patternsFor(level);
    for (const p of sample(level)) {
      assert(expected.includes(p.pattern), `Lv${level} で想定外の pattern: ${p.pattern}`);
      assert(FORMS.includes(p.form), `未知の form: ${p.form}`);
      assert(formsFor(p.pattern).includes(p.form), `pattern ${p.pattern} が取らない form: ${p.form}`);
    }
  }
});

test('全レベル: 定義した form がすべて実際に生成される', () => {
  for (const level of SUPPORTED_LEVELS) {
    const seen = new Set(sample(level).map((p) => p.form));
    for (const pattern of patternsFor(level)) {
      for (const form of formsFor(pattern)) {
        assert(seen.has(form), `Lv${level} で form "${form}" が一度も出なかった`);
      }
    }
  }
});

test('全レベル: traps が必ず1件以上あり、正解と重複しない', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      assert(p.traps.length >= 1, `traps が空: ${p.question}`);
      const seen = new Set();
      for (const t of p.traps) {
        assert(/^-?\d+$/.test(t.value), `trap の value が整数でない: ${p.question} / ${t.value}`);
        assert(t.value !== p.answer, `trap が正解と同じ: ${p.question} / ${t.value}`);
        assert(!seen.has(t.value), `trap の value が重複: ${p.question}`);
        seen.add(t.value);
      }
    }
  }
});

test('全レベル: steps は3行以内で、最後の行に答えが入っている', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level)) {
      assert(p.steps.length >= 1 && p.steps.length <= 3, `行数が不正: ${p.question}`);
      const last = p.steps[p.steps.length - 1];
      assert(last.includes(p.answer), `最後の行に答えがない: ${p.question} / ${last}`);
    }
  }
});

test('全レベル: steps に評価語を使わない', () => {
  const banned = ['残念', 'おしい', '惜しい', '間違', 'まちがい', 'ミス', 'すばらしい', 'がんばろう'];
  for (const level of SUPPORTED_LEVELS) {
    for (const p of sample(level, 555, 300)) {
      const text = p.steps.join(' ');
      for (const word of banned) {
        assert(!text.includes(word), `評価語 "${word}" が含まれる: ${text}`);
      }
    }
  }
});

// --- 出題の並び ------------------------------------------------------------

test('全レベル: 直近3問と同じ問題が出ない', () => {
  for (const level of SUPPORTED_LEVELS) {
    const problems = sample(level);
    for (let i = 1; i < problems.length; i++) {
      const window = problems.slice(Math.max(0, i - 3), i).map((p) => p.question);
      assert(!window.includes(problems[i].question), `Lv${level} 重複: ${problems[i].question}`);
    }
  }
});

test('全レベル: 同じシードからは同じ問題列が出る', () => {
  for (const level of SUPPORTED_LEVELS) {
    assertDeepEqual(sample(level, 777, 150), sample(level, 777, 150), `Lv${level} 再現しない`);
  }
});

test('全レベル: シードを変えても例外を投げない', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = createRng(seed * 7919);
      const recent = [];
      for (let i = 0; i < 40; i++) {
        const p = generate(level, rng, recent);
        recent.push(p);
        if (recent.length > 3) recent.shift();
      }
    }
  }
});

// --- 易しくする指定 --------------------------------------------------------

test('全レベル: easier を指定しても pattern と form は変わらない', () => {
  for (const p of everyKind(1111, 40, { easier: true })) {
    assert(validateProblem(p).length === 0, `不変条件違反: ${p.question}`);
  }
});

test('全レベル: easier を指定すると答えの絶対値が小さくなる', () => {
  for (const level of SUPPORTED_LEVELS) {
    for (const pattern of patternsFor(level)) {
      for (const form of formsFor(pattern)) {
        const normal = magnitudes(level, pattern, form, false);
        const easier = magnitudes(level, pattern, form, true);
        assert(
          easier <= normal,
          `Lv${level}/${form} easier の方が大きい: ${easier} > ${normal}`
        );
      }
    }
  }
});

function magnitudes(level, pattern, form, easier) {
  const rng = createRng(31337);
  let total = 0;
  const n = 200;
  for (let i = 0; i < n; i++) {
    const p = generate(level, rng, [], { pattern, form, easier });
    total += Math.abs(Number(p.answer));
  }
  return total / n;
}

// --- Lv3-5 の中身 ----------------------------------------------------------

test('Lv3: 除法は必ず割り切れる', () => {
  for (const p of sample(3)) {
    if (p.form !== 'div2') continue;
    const computed = evaluateExpression(p.question); // 割り切れなければ例外になる
    assertEqual(String(computed), p.answer);
  }
});

test('Lv3: 因数に1を使わない（符号の練習にならないため）', () => {
  for (const p of sample(3)) {
    if (p.form === 'div2') continue;
    const nums = p.question.match(/\d+/g).map(Number);
    for (const n of nums) {
      assert(n >= 2, `1 が因数に入っている: ${p.question}`);
    }
  }
});

test('Lv3: 負の因数が必ず1つ以上ある', () => {
  for (const p of sample(3)) {
    assert(p.question.includes('-'), `負の数が入っていない: ${p.question}`);
    assert(p.facts.negCount >= 1, `negCount が不正: ${p.question} / ${p.facts.negCount}`);
  }
});

test('Lv4: (-2)^2 と -2^2 が両方出て、答えが食い違う', () => {
  const problems = sample(4);
  const paren = problems.filter((p) => p.form === 'paren_power');
  const bare = problems.filter((p) => p.form === 'bare_power');
  assert(paren.length > 0 && bare.length > 0, '両方の形が出ていない');

  for (const p of paren) {
    if (p.facts.exp !== 2) continue;
    assert(Number(p.answer) > 0, `(-a)^2 が負になっている: ${p.question} → ${p.answer}`);
  }
  for (const p of bare) {
    assert(Number(p.answer) < 0, `-a^2 が正になっている: ${p.question} → ${p.answer}`);
  }
});

test('Lv4: 指数は2か3だけ（画面で上付きにできる範囲）', () => {
  for (const p of sample(4)) {
    assert(p.facts.exp === 2 || p.facts.exp === 3, `指数が不正: ${p.question}`);
    assert(/\^[23]/.test(p.question), `指数の書き方が不正: ${p.question}`);
  }
});

test('Lv5: 順番を間違えたときの値が、必ず答えと違う（順序が問われる形になっている）', () => {
  // 順番を間違えた値が答えと一致してしまう問題は、dedupeTraps でその trap が
  // 落ちるので、順序のつまずきを表す trap が残っているかどうかで判定できる。
  const orderReasons = ['left_to_right', 'paren_ignored', 'power_sign_ignored'];
  for (const p of sample(5)) {
    assert(
      p.traps.some((t) => orderReasons.includes(t.reason)),
      `順序を間違えても同じ答えになる（順序の練習にならない）: ${p.question}`
    );
  }
});

test('Lv5: 括弧の中が0にならない', () => {
  for (const p of sample(5)) {
    if (p.form !== 'paren_first') continue;
    assert(p.facts.stepValue !== 0, `括弧の中が0: ${p.question}`);
  }
});

// --- 未対応の指定 ----------------------------------------------------------

test('全レベル: 未知の pattern / form を指定したらエラーになる', () => {
  const rng = createRng(1);
  for (const opts of [{ pattern: 'そんなものはない' }, { pattern: 'muldiv_sign_count', form: 'xxx' }]) {
    let threw = false;
    try {
      generate(3, rng, [], opts);
    } catch {
      threw = true;
    }
    assert(threw, `素通りした: ${JSON.stringify(opts)}`);
  }
});

test('全レベル: maxMagnitudeFor が数値を返す', () => {
  for (const level of SUPPORTED_LEVELS) {
    assert(Number.isFinite(maxMagnitudeFor(level)), `Lv${level} で取れない`);
  }
});
