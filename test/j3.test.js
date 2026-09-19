// 中3 ジェネレータの単体テスト。
//
// 中3 は答えが式そのものになる単元があるので、
// 「選択肢が正しく組み上がっているか」まで見る必要がある。
//   - 正解が必ず選択肢に入っている
//   - 選択肢が重複していない（同じ式が2つ並ぶと、どちらを押しても同じ）
//   - 外れの選択肢はすべて traps にあり、専用の解説にたどり着ける
//   - 正解の位置が偏っていない（式を読まずに位置で選べてしまう）
//
// 平方根は答えが必ず整数になることを、実際に計算し直して確かめる。

import { test, assert, assertEqual } from './runner.js';
import { createRng } from '../js/lib/rng.js';
import { validateProblem, ANSWER_RE } from '../js/lib/problem.js';
import * as j3 from '../js/generators/j3/index.js';
import { quadStr, factoredStr, solutionStr } from '../js/generators/j3/poly.js';

const LEVELS = [1, 2, 3, 4, 5];
const NUMBER_LEVELS = [1, 2];
const CHOICE_LEVELS = [3, 4, 5];

function sample(level, count = 120, opts = {}) {
  const rng = createRng(20260919 + level * 7);
  const out = [];
  const recent = [];
  for (let i = 0; i < count; i++) {
    const p = j3.generate(level, rng, recent, opts);
    recent.push(p);
    if (recent.length > 3) recent.shift();
    out.push(p);
  }
  return out;
}

// --- 全レベル共通 -----------------------------------------------------------

test('中3: どのレベルでも Problem の形が壊れていない', () => {
  for (const level of LEVELS) {
    for (const p of sample(level, 80)) {
      const errors = validateProblem(p);
      assertEqual(errors.length, 0, `Lv${level} ${p.question}: ${errors.join(' / ')}`);
    }
  }
});

test('中3: レベルごとに答え方がそろっている', () => {
  // 1回の学習の途中でテンキーと選択肢が入れ替わらないこと
  for (const level of NUMBER_LEVELS) {
    for (const p of sample(level, 40)) {
      assertEqual(p.input, 'number', `Lv${level} が選択肢になっている: ${p.question}`);
    }
  }
  for (const level of CHOICE_LEVELS) {
    for (const p of sample(level, 40)) {
      assertEqual(p.input, 'choice', `Lv${level} がテンキーになっている: ${p.question}`);
    }
  }
});

test('中3: 同じ問題が連続で出ない', () => {
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

test('中3: traps が必ず1件以上あり、正解と重複しない', () => {
  for (const level of LEVELS) {
    for (const p of sample(level, 80)) {
      assert(p.traps.length >= 1, `traps が空: Lv${level} ${p.question}`);
      const seen = new Set();
      for (const t of p.traps) {
        assert(t.value !== p.answer, `traps が正解と同じ: ${p.question} → ${t.value}`);
        assert(!seen.has(t.value), `traps が重複: ${p.question} → ${t.value}`);
        seen.add(t.value);
      }
    }
  }
});

test('中3: 解説は3行以内で、評価する言葉を使わない', () => {
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

// --- 平方根（Lv1-2、テンキー） ---------------------------------------------

test('平方根: 答えは必ず整数', () => {
  for (const level of NUMBER_LEVELS) {
    for (const p of sample(level, 120)) {
      assert(ANSWER_RE.test(p.answer), `形式が不正: ${p.question} → ${p.answer}`);
      assert(
        /^-?\d+$/.test(p.answer),
        `√ や小数が残っている: ${p.question} → ${p.answer}`
      );
    }
  }
});

test('平方根: 式を計算し直すと答えと一致する', () => {
  for (const level of NUMBER_LEVELS) {
    for (const p of sample(level, 120)) {
      const expected = evalRootQuestion(p.question);
      assert(expected !== null, `式を読み取れない: ${p.question}`);
      assert(
        Math.abs(expected - Number(p.answer)) < 1e-9,
        `${p.question} の答えが合っていない: ${p.answer}（計算すると ${expected}）`
      );
    }
  }
});

/** "√8 × √2" や "(2√3)^2" を計算する。 */
function evalRootQuestion(q) {
  let m = /^√(\d+)$/.exec(q);
  if (m) return Math.sqrt(Number(m[1]));

  m = /^√(\d+) ([×÷]) √(\d+)$/.exec(q);
  if (m) {
    const a = Math.sqrt(Number(m[1]));
    const b = Math.sqrt(Number(m[3]));
    return m[2] === '×' ? a * b : a / b;
  }

  m = /^\(√(\d+)\)\^2$/.exec(q);
  if (m) return Number(m[1]);

  m = /^\((\d+)√(\d+)\)\^2$/.exec(q);
  if (m) return Number(m[1]) ** 2 * Number(m[2]);

  return null;
}

test('平方根: traps もテンキーで打てる形になっている', () => {
  for (const level of NUMBER_LEVELS) {
    for (const p of sample(level, 80)) {
      for (const t of p.traps) {
        assert(ANSWER_RE.test(t.value), `打てない形の traps: ${p.question} → ${t.value}`);
      }
    }
  }
});

// --- 選択肢（Lv3-5） --------------------------------------------------------

test('選択肢: 正解が必ず入っていて、重複がない', () => {
  for (const level of CHOICE_LEVELS) {
    for (const p of sample(level, 120)) {
      assert(p.choices.includes(p.answer), `正解が選択肢に無い: ${p.question}`);
      assertEqual(
        new Set(p.choices).size,
        p.choices.length,
        `選択肢が重複している: ${p.question} / ${p.choices.join(' | ')}`
      );
    }
  }
});

test('選択肢: 外れはすべて traps に入っている', () => {
  // ここが崩れると、外れを選んでも専用の解説にたどり着けない
  for (const level of CHOICE_LEVELS) {
    for (const p of sample(level, 120)) {
      const trapValues = new Set(p.traps.map((t) => t.value));
      for (const c of p.choices) {
        if (c === p.answer) continue;
        assert(trapValues.has(c), `traps に無い外れがある: ${p.question} → ${c}`);
      }
    }
  }
});

test('選択肢: traps はすべて選択肢に出る', () => {
  // 選べない誤答の解説を抱えていないこと
  for (const level of CHOICE_LEVELS) {
    for (const p of sample(level, 120)) {
      for (const t of p.traps) {
        assert(p.choices.includes(t.value), `選べない traps がある: ${p.question} → ${t.value}`);
      }
    }
  }
});

test('選択肢: 4つ並ぶ', () => {
  for (const level of CHOICE_LEVELS) {
    for (const p of sample(level, 120)) {
      assertEqual(p.choices.length, 4, `選択肢が4つでない: ${p.question} / ${p.choices.join(' | ')}`);
    }
  }
});

test('選択肢: 正解の位置が偏らない', () => {
  // 位置で選べてしまうと、式を読まずに正解できてしまう
  for (const level of CHOICE_LEVELS) {
    const counts = [0, 0, 0, 0];
    const list = sample(level, 400);
    for (const p of list) counts[p.choices.indexOf(p.answer)] += 1;

    for (let i = 0; i < 4; i++) {
      const ratio = counts[i] / list.length;
      assert(
        ratio > 0.15 && ratio < 0.35,
        `Lv${level} の正解が ${i + 1}番目に偏っている（${Math.round(ratio * 100)}%）`
      );
    }
  }
});

test('選択肢: 1行に収まる長さ', () => {
  // 折り返すと式として読めなくなる
  for (const level of CHOICE_LEVELS) {
    for (const p of sample(level, 120)) {
      for (const c of p.choices) {
        assert(c.length <= 22, `選択肢が長すぎる: ${c}（${c.length}文字）`);
      }
    }
  }
});

// --- 中身の正しさ -----------------------------------------------------------

test('展開: 因数分解した形を展開すると、答えと一致する', () => {
  for (const p of sample(3, 200)) {
    const m = /^\(x([+-])(\d+)\)(?:\(x([+-])(\d+)\)|\^2)$/.exec(p.question);
    assert(m, `式を読み取れない: ${p.question}`);

    const a = Number(m[1] + m[2]);
    const b = m[3] ? Number(m[3] + m[4]) : a;
    assertEqual(p.answer, quadStr(a + b, a * b), `${p.question} の展開が合っていない`);
  }
});

test('因数分解: 因数をかけ戻すと、問題の式に一致する', () => {
  for (const p of sample(4, 200)) {
    const m = /^\(x([+-])(\d+)\)(?:\(x([+-])(\d+)\)|\^2)$/.exec(p.answer);
    assert(m, `答えを読み取れない: ${p.answer}`);

    const a = Number(m[1] + m[2]);
    const b = m[3] ? Number(m[3] + m[4]) : a;
    assertEqual(p.question, quadStr(a + b, a * b), `${p.answer} をかけ戻すと式に戻らない`);
  }
});

test('二次方程式: 解を代入すると 0 になる', () => {
  for (const p of sample(5, 200)) {
    const solutions = p.answer.replace('x = ', '').split(', ').map(Number);
    for (const x of solutions) {
      assert(Number.isInteger(x), `解が整数でない: ${p.question} → ${p.answer}`);
    }

    const eq = /^x\^2 = (\d+)$/.exec(p.question);
    if (eq) {
      for (const x of solutions) {
        assertEqual(x * x, Number(eq[1]), `${p.question} に ${x} を入れると合わない`);
      }
      continue;
    }

    // 係数 1 は "x" と書かれるので、数字が無い場合も読めるようにする
    const m = /^x\^2(?: ([+-]) (\d*)x)?(?: ([+-]) (\d+))? = 0$/.exec(p.question);
    assert(m, `式を読み取れない: ${p.question}`);
    const b = m[1] ? Number(m[1] + (m[2] || '1')) : 0;
    const c = m[4] ? Number(m[3] + m[4]) : 0;

    for (const x of solutions) {
      assertEqual(x * x + b * x + c, 0, `${p.question} に ${x} を入れると 0 にならない`);
    }
  }
});

test('二次方程式: 解は小さいほうを先に書く', () => {
  for (const p of sample(5, 120)) {
    const solutions = p.answer.replace('x = ', '').split(', ').map(Number);
    if (solutions.length < 2) continue;
    assert(solutions[0] < solutions[1], `並びが逆: ${p.answer}`);
  }
});

// --- 誤答フローで使う指定 ---------------------------------------------------

test('中3: pattern を指定すると、その pattern の問題が返る', () => {
  const rng = createRng(31);
  const levelOf = { sqrt: 1, expand: 3, factor: 4, solve: 5 };
  for (const pattern of j3.allPatterns()) {
    const level = levelOf[pattern.split('_')[0]];
    for (let i = 0; i < 20; i++) {
      const p = j3.generate(level, rng, [], { pattern });
      assertEqual(p.pattern, pattern);
      assertEqual(validateProblem(p).length, 0, `${pattern}: ${validateProblem(p).join(' / ')}`);
    }
  }
});

test('中3: easier を指定しても Problem が壊れない', () => {
  const rng = createRng(37);
  const levelOf = { sqrt: 1, expand: 3, factor: 4, solve: 5 };
  for (const pattern of j3.allPatterns()) {
    const level = levelOf[pattern.split('_')[0]];
    for (let i = 0; i < 30; i++) {
      const p = j3.generate(level, rng, [], { pattern, easier: true });
      assertEqual(validateProblem(p).length, 0, `${pattern}: ${validateProblem(p).join(' / ')}`);
    }
  }
});

// --- 式の書き方 -------------------------------------------------------------

test('式: x² + bx + c の書き方が1通りに決まる', () => {
  assertEqual(quadStr(8, 15), 'x^2 + 8x + 15');
  assertEqual(quadStr(-8, 15), 'x^2 - 8x + 15');
  assertEqual(quadStr(0, -9), 'x^2 - 9');
  assertEqual(quadStr(5, 0), 'x^2 + 5x');
  assertEqual(quadStr(1, 6), 'x^2 + x + 6');
  assertEqual(quadStr(-1, 6), 'x^2 - x + 6');
});

test('式: 因数分解の形と解の形が1通りに決まる', () => {
  assertEqual(factoredStr(3, 5), '(x+3)(x+5)');
  assertEqual(factoredStr(-3, 5), '(x-3)(x+5)');
  assertEqual(factoredStr(4, 4), '(x+4)^2');
  assertEqual(solutionStr(-3, -2), 'x = -3, -2');
  assertEqual(solutionStr(-2, -3), 'x = -3, -2');
  assertEqual(solutionStr(4, 4), 'x = 4');
});
