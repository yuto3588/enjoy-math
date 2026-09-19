// 小5 ジェネレータの単体テスト。
//
// ここで必ず見張ること（CLAUDE.md のコード方針）:
//   - 答えが必ず整数・小数・既約分数のどれかになる
//   - 同じ問題が連続で生成されない
//   - traps が必ず1件以上ある
//
// 小数は「0.1 + 0.2 = 0.30000000000000004」の形の誤差が一度でも混ざると
// 本人には直しようがない問題になるので、答えを実際に計算し直して確かめる。

import { test, assert, assertEqual } from './runner.js';
import { createRng } from '../js/lib/rng.js';
import { validateProblem, ANSWER_RE } from '../js/lib/problem.js';
import { decStr, gcd, reduceFraction, normalizeAnswer } from '../js/lib/num.js';
import * as e5 from '../js/generators/e5/index.js';

const LEVELS = [1, 2, 3, 4, 5];

/** 同じ並びで作り直せるよう、種を固定して回す。 */
function sample(level, count = 120, opts = {}) {
  const rng = createRng(20260919 + level);
  const out = [];
  const recent = [];
  for (let i = 0; i < count; i++) {
    const p = e5.generate(level, rng, recent, opts);
    recent.push(p);
    if (recent.length > 3) recent.shift();
    out.push(p);
  }
  return out;
}

/** "1.2" や "2/3" を数値に直す（テストで答えを検算するためだけに使う）。 */
function toNumber(text) {
  if (text.includes('/')) {
    const [n, d] = text.split('/').map(Number);
    return n / d;
  }
  return Number(text);
}

/** "1.4 × 3" のような式を計算する（分数は別で確かめる）。 */
function evalDecimalQuestion(q) {
  const m = /^([\d.]+)\s*([×÷])\s*([\d.]+)$/.exec(q);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  return m[2] === '×' ? a * b : a / b;
}

// --- 全レベル共通 -----------------------------------------------------------

test('小5: どのレベルでも Problem の形が壊れていない', () => {
  for (const level of LEVELS) {
    for (const p of sample(level, 60)) {
      const errors = validateProblem(p);
      assertEqual(errors.length, 0, `Lv${level} ${p.question}: ${errors.join(' / ')}`);
    }
  }
});

test('小5: 答えは整数・小数・既約分数のどれか', () => {
  for (const level of LEVELS) {
    for (const p of sample(level, 60)) {
      assert(ANSWER_RE.test(p.answer), `Lv${level} ${p.question} → ${p.answer}`);

      if (p.answer.includes('/')) {
        const [n, d] = p.answer.split('/').map(Number);
        assertEqual(gcd(n, d), 1, `約分されていない: ${p.question} → ${p.answer}`);
        assert(d > 1, `分母が 1 の分数が出た: ${p.answer}`);
      }
    }
  }
});

test('小5: 答えの小数のけたが増えすぎない', () => {
  // 3けた以上の小数になると、テンキーで打つのが現実的でなくなる
  for (const level of LEVELS) {
    for (const p of sample(level, 60)) {
      const dot = p.answer.indexOf('.');
      if (dot < 0) continue;
      const places = p.answer.length - dot - 1;
      assert(places <= 2, `小数点より下が ${places} けた: ${p.question} → ${p.answer}`);
    }
  }
});

test('小5: traps が必ず1件以上あり、正解と重複しない', () => {
  for (const level of LEVELS) {
    for (const p of sample(level, 60)) {
      assert(p.traps.length >= 1, `traps が空: Lv${level} ${p.question}`);
      const seen = new Set();
      for (const t of p.traps) {
        assert(t.value !== p.answer, `traps が正解と同じ: ${p.question} → ${t.value}`);
        assert(!seen.has(t.value), `traps が重複: ${p.question} → ${t.value}`);
        seen.add(t.value);
        assert(ANSWER_RE.test(t.value), `traps の形式が不正: ${t.value}`);
      }
    }
  }
});

test('小5: 同じ問題が連続で出ない', () => {
  for (const level of LEVELS) {
    const list = sample(level, 200);
    for (let i = 1; i < list.length; i++) {
      assert(
        list[i].question !== list[i - 1].question,
        `Lv${level} で同じ問題が続いた: ${list[i].question}`
      );
    }
  }
});

test('小5: 解説は3行以内で、評価する言葉を使わない', () => {
  const banned = ['残念', 'おしい', '惜しい', 'まちがい', '間違い', 'すごい', 'えらい', 'ダメ'];
  for (const level of LEVELS) {
    for (const p of sample(level, 40)) {
      assert(p.steps.length <= 3, `steps が3行を超えた: ${p.question}`);
      for (const line of p.steps) {
        for (const word of banned) {
          assert(!line.includes(word), `評価する言葉が入っている: ${line}`);
        }
      }
    }
  }
});

// --- 小数（Lv1-3） ----------------------------------------------------------

test('小数: 式を計算し直すと答えと一致する', () => {
  for (const level of [1, 2, 3]) {
    for (const p of sample(level, 120)) {
      const expected = evalDecimalQuestion(p.question);
      assert(expected !== null, `式を読み取れない: ${p.question}`);

      // 小数の誤差ぶんだけ許して比べる（答えの文字列は整数計算で作っている）
      const got = toNumber(p.answer);
      assert(
        Math.abs(expected - got) < 1e-9,
        `Lv${level} ${p.question} の答えが合っていない: ${p.answer}（計算すると ${expected}）`
      );
    }
  }
});

test('小数: 割り算は必ず割り切れる', () => {
  for (const level of [1, 3]) {
    for (const p of sample(level, 120)) {
      if (!p.question.includes('÷')) continue;
      const expected = evalDecimalQuestion(p.question);
      const rounded = Math.round(expected * 100) / 100;
      assert(
        Math.abs(expected - rounded) < 1e-9,
        `割り切れない問題が出た: ${p.question} = ${expected}`
      );
    }
  }
});

test('小数: 0.30000000000000004 のような答えが出てこない', () => {
  for (const level of [1, 2, 3]) {
    for (const p of sample(level, 120)) {
      assert(
        p.answer.length <= 6,
        `答えの桁が異常に長い（誤差が混ざっている）: ${p.question} → ${p.answer}`
      );
      for (const line of p.steps) {
        assert(
          !/\d\.\d{4,}/.test(line),
          `解説に誤差が混ざっている: ${p.question} / ${line}`
        );
      }
    }
  }
});

test('小数: 小数の問題に小数が1つ以上出てくる', () => {
  for (const level of [1, 2, 3]) {
    for (const p of sample(level, 60)) {
      assert(
        p.question.includes('.') || p.answer.includes('.'),
        `小数がどこにも出てこない: Lv${level} ${p.question} → ${p.answer}`
      );
    }
  }
});

// --- 分数（Lv4-5） ----------------------------------------------------------

test('分数: 答えは必ず1未満の真分数', () => {
  for (const level of [4, 5]) {
    for (const p of sample(level, 120)) {
      const value = toNumber(p.answer);
      assert(value > 0 && value < 1, `真分数になっていない: ${p.question} → ${p.answer}`);
    }
  }
});

test('分数: 式を計算し直すと答えと一致する', () => {
  for (const level of [4, 5]) {
    for (const p of sample(level, 120)) {
      const m = /^(\d+)\/(\d+) ([+-]) (\d+)\/(\d+)$/.exec(p.question);
      assert(m, `式を読み取れない: ${p.question}`);

      const [, x, d1, op, y, d2] = m;
      const n = op === '+'
        ? Number(x) * Number(d2) + Number(y) * Number(d1)
        : Number(x) * Number(d2) - Number(y) * Number(d1);
      const d = Number(d1) * Number(d2);
      const [rn, rd] = reduceFraction(n, d);

      assertEqual(
        p.answer,
        rd === 1 ? String(rn) : `${rn}/${rd}`,
        `${p.question} の答えが合っていない`
      );
    }
  }
});

test('分数: 出題される分数はどちらも1未満', () => {
  for (const level of [4, 5]) {
    for (const p of sample(level, 60)) {
      const m = /^(\d+)\/(\d+) [+-] (\d+)\/(\d+)$/.exec(p.question);
      assert(Number(m[1]) < Number(m[2]), `仮分数が出題された: ${p.question}`);
      assert(Number(m[3]) < Number(m[4]), `仮分数が出題された: ${p.question}`);
    }
  }
});

test('分数: 分母をそろえる問題では、分母が違う', () => {
  for (const p of sample(5, 60)) {
    const m = /^(\d+)\/(\d+) [+-] (\d+)\/(\d+)$/.exec(p.question);
    assert(m[2] !== m[4], `Lv5 なのに分母が同じ: ${p.question}`);
  }
  for (const p of sample(4, 60)) {
    const m = /^(\d+)\/(\d+) [+-] (\d+)\/(\d+)$/.exec(p.question);
    assertEqual(m[2], m[4], `Lv4 なのに分母が違う: ${p.question}`);
  }
});

// --- 誤答フローで使う指定 ---------------------------------------------------

test('小5: pattern を指定すると、その pattern の問題が返る', () => {
  const rng = createRng(7);
  for (const pattern of e5.allPatterns()) {
    for (let i = 0; i < 20; i++) {
      const p = e5.generate(1, rng, [], { pattern });
      assertEqual(p.pattern, pattern);
      assertEqual(validateProblem(p).length, 0, `${pattern}: ${validateProblem(p).join(' / ')}`);
    }
  }
});

test('小5: form を指定すると、その式の形が返る', () => {
  const rng = createRng(11);
  for (const pattern of e5.allPatterns()) {
    for (const form of e5.formsFor(pattern)) {
      for (let i = 0; i < 10; i++) {
        const p = e5.generate(1, rng, [], { pattern, form });
        assertEqual(p.form, form, `${pattern} / ${form} を指定したのに ${p.form}`);
      }
    }
  }
});

test('小5: easier を指定しても Problem が壊れない', () => {
  const rng = createRng(13);
  for (const pattern of e5.allPatterns()) {
    for (let i = 0; i < 30; i++) {
      const p = e5.generate(1, rng, [], { pattern, easier: true });
      assertEqual(validateProblem(p).length, 0, `${pattern}: ${validateProblem(p).join(' / ')}`);
    }
  }
});

// --- 答えのそろえ方 ---------------------------------------------------------

test('入力: 2.50 と 2.5、02 と 2 は同じ答えとして扱う', () => {
  assertEqual(normalizeAnswer('2.50'), '2.5');
  assertEqual(normalizeAnswer('2.0'), '2');
  assertEqual(normalizeAnswer('02'), '2');
  assertEqual(normalizeAnswer('0.50'), '0.5');
  assertEqual(normalizeAnswer('-0'), '0');
  assertEqual(normalizeAnswer('-12'), '-12');
  assertEqual(normalizeAnswer(''), '');
});

test('入力: 分数は約分しない（約分忘れを見分けるため）', () => {
  assertEqual(normalizeAnswer('4/6'), '4/6');
  assertEqual(normalizeAnswer('04/06'), '4/6');
});

test('小数: decStr が誤差なしで文字列を作る', () => {
  assertEqual(decStr(12, 1), '1.2');
  assertEqual(decStr(120, 2), '1.2');
  assertEqual(decStr(30, 1), '3');
  assertEqual(decStr(12, 2), '0.12');
  assertEqual(decStr(3, 0), '3');
});
