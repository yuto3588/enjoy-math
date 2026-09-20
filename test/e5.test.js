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

/** 計算の問題が出るレベル。 */
const CALC_LEVELS = [1, 2, 3];

/** 文章題が出るレベル。 */
const WORD_LEVELS = [4, 5];

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
  // 文章題は question が空で、問題文は prompt にある
  const textOf = (p) => p.prompt || p.question;
  for (const level of LEVELS) {
    const list = sample(level, 200);
    for (let i = 1; i < list.length; i++) {
      assert(
        textOf(list[i]) !== textOf(list[i - 1]),
        `Lv${level} で同じ問題が続いた: ${textOf(list[i])}`
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

// --- 小数（Lv1-2） ----------------------------------------------------------

test('小数: 式を計算し直すと答えと一致する', () => {
  for (const level of [1, 2]) {
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
  for (const level of [1, 2]) {
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
  for (const level of [1, 2]) {
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
  for (const level of [1, 2]) {
    for (const p of sample(level, 60)) {
      assert(
        p.question.includes('.') || p.answer.includes('.'),
        `小数がどこにも出てこない: Lv${level} ${p.question} → ${p.answer}`
      );
    }
  }
});

// --- 分数（Lv3） ------------------------------------------------------------

test('分数: 答えは必ず1未満の真分数', () => {
  for (const p of sample(3, 150)) {
    const value = toNumber(p.answer);
    assert(value > 0 && value < 1, `真分数になっていない: ${p.question} → ${p.answer}`);
  }
});

test('分数: 式を計算し直すと答えと一致する', () => {
  for (const p of sample(3, 200)) {
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
});

test('分数: 出題される分数はどちらも1未満', () => {
  for (const p of sample(3, 100)) {
    const m = /^(\d+)\/(\d+) [+-] (\d+)\/(\d+)$/.exec(p.question);
    assert(Number(m[1]) < Number(m[2]), `仮分数が出題された: ${p.question}`);
    assert(Number(m[3]) < Number(m[4]), `仮分数が出題された: ${p.question}`);
  }
});

test('分数: 同分母と通分の両方が出る', () => {
  const patterns = new Set(sample(3, 200).map((p) => p.pattern));
  assert(patterns.has('fraction_same_den'), '同分母の問題が出なかった');
  assert(patterns.has('fraction_diff_den'), '通分が要る問題が出なかった');
});

// --- 文章題（Lv4-5） --------------------------------------------------------

test('文章題: 日本語の問題文があり、式は入っていない', () => {
  for (const level of WORD_LEVELS) {
    for (const p of sample(level, 120)) {
      assert(p.prompt && p.prompt.length > 0, `問題文が空: Lv${level}`);
      assert(p.prompt.endsWith('。'), `問題文が文で終わっていない: ${p.prompt}`);
      assertEqual(p.question, '', `文章題に式が入っている: ${p.question}`);
      assert(p.unit && p.unit.length > 0, `単位が空: ${p.prompt}`);
    }
  }
});

test('文章題: 問題文が画面に収まる長さに収まっている', () => {
  // 長くなるとスクロールが出る。60文字は iPhone 縦持ちで2行に収まる目安。
  for (const level of WORD_LEVELS) {
    for (const p of sample(level, 120)) {
      assert(p.prompt.length <= 60, `問題文が長すぎる（${p.prompt.length}文字）: ${p.prompt}`);
    }
  }
});

test('文章題: 答えは必ず整数で、4けたを超えない', () => {
  // 小数の答えにすると、文章題の考え方ではなく計算でつまずく。
  // 4けたを超えるとテンキーで打てない。
  for (const level of WORD_LEVELS) {
    for (const p of sample(level, 150)) {
      assert(/^\d+$/.test(p.answer), `整数になっていない: ${p.prompt} → ${p.answer}`);
      assert(p.answer.length <= 4, `答えが4けたを超えた: ${p.prompt} → ${p.answer}`);
    }
  }
});

test('文章題: 問題文の中に答えがそのまま出てこない', () => {
  // 出ていると、読まずに写すだけで正解できてしまう
  for (const level of WORD_LEVELS) {
    for (const p of sample(level, 150)) {
      if (p.form === 'e5_percent_rate') continue; // % は数として文中に出る
      const numbers = (p.prompt.match(/\d+/g) || []);
      assert(
        !numbers.includes(p.answer),
        `問題文に答えが出ている: ${p.prompt} → ${p.answer}`
      );
    }
  }
});

test('文章題: 面積と体積の計算が合っている', () => {
  for (const p of sample(4, 250)) {
    const f = p.facts;
    const expected = {
      e5_area_rect: () => f.a * f.b,
      e5_area_square: () => f.a * f.a,
      e5_area_triangle: () => (f.base * f.height) / 2,
      e5_volume_box: () => f.a * f.b * f.c,
      e5_volume_cube: () => f.a * f.a * f.a
    }[p.form];

    assert(expected, `知らない form: ${p.form}`);
    assertEqual(Number(p.answer), expected(), `${p.prompt} の答えが合っていない`);
  }
});

test('文章題: 三角形は底辺 × 高さ が必ず偶数になる', () => {
  // 奇数だと答えが 0.5 きざみになり、面積の考え方から話がそれる
  for (const p of sample(4, 250)) {
    if (p.form !== 'e5_area_triangle') continue;
    assertEqual((p.facts.base * p.facts.height) % 2, 0, `${p.prompt} が割り切れない`);
  }
});

test('文章題: 割合・平均の計算が合っている', () => {
  for (const p of sample(5, 250)) {
    const f = p.facts;
    const expected = {
      e5_percent_of: () => (f.whole * f.percent) / 100,
      e5_percent_rate: () => (f.part / f.whole) * 100,
      e5_percent_off: () => f.price - (f.price * f.percent) / 100,
      e5_average_score: () => f.total / f.count,
      e5_per_unit: () => f.total / f.count
    }[p.form];

    assert(expected, `知らない form: ${p.form}`);
    assertEqual(Number(p.answer), expected(), `${p.prompt} の答えが合っていない`);
  }
});

test('文章題: 平均の問題の点がすべて 0〜100 に収まる', () => {
  for (const p of sample(5, 250)) {
    if (p.form !== 'e5_average_score') continue;
    for (const s of p.facts.scores.split(', ').map(Number)) {
      assert(s >= 0 && s <= 100, `点が範囲から出ている: ${p.prompt}`);
    }
  }
});

test('文章題: 人数や個数が小数にならない', () => {
  // 「25人のうち 2.5人」のような問題を作らない
  for (const p of sample(5, 250)) {
    if (p.form !== 'e5_percent_rate') continue;
    assert(Number.isInteger(p.facts.part), `人数が小数: ${p.prompt}`);
  }
});

test('文章題: 5つの単元がすべて出る', () => {
  const forms = new Set([...sample(4, 250), ...sample(5, 250)].map((p) => p.form));
  const expected = [
    'e5_area_rect', 'e5_area_square', 'e5_area_triangle',
    'e5_volume_box', 'e5_volume_cube',
    'e5_percent_of', 'e5_percent_rate', 'e5_percent_off',
    'e5_average_score', 'e5_per_unit'
  ];
  for (const form of expected) {
    assert(forms.has(form), `${form} の問題が1問も出なかった`);
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
