// 誤答パターン別解説の単体テスト（DESIGN.md 5.2）。
// 「これが本アプリの学習面での中核価値」とされている部分なので、
// 網羅性（全 pattern × 全 reason にテンプレートがあること）まで見る。

import { test, assert, assertEqual, assertDeepEqual } from './runner.js';
import { createRng } from '../js/lib/rng.js';
import { generate, patternsFor, formsFor, SUPPORTED_LEVELS } from '../js/generators/index.js';
import { explanationFor, templateKeys } from '../js/explain.js';
import { courseFor, readyGrades } from '../js/courses.js';

/**
 * 全学年 × 全レベル × 全 pattern × 全 form の問題をまんべんなく作る。
 *
 * 解説のテンプレートは学年をまたいで1つの表に入っているので、
 * 網羅性も学年をまたいで見る。
 */
function allKindsOfProblems(seed = 2468, perKind = 60) {
  const rng = createRng(seed);
  const out = [];
  for (const gradeId of readyGrades()) {
    const course = courseFor(gradeId);
    for (const level of course.SUPPORTED_LEVELS) {
      for (const pattern of course.patternsFor(level)) {
        for (const form of course.formsFor(pattern)) {
          for (let i = 0; i < perKind; i++) {
            out.push(course.generate(level, rng, [], { pattern, form }));
          }
        }
      }
    }
  }
  return out;
}

// --- 網羅性 ----------------------------------------------------------------

test('解説: 生成されうる全ての pattern × reason にテンプレートがある', () => {
  const keys = new Set(templateKeys());
  const seen = new Set();

  for (const p of allKindsOfProblems()) {
    for (const t of p.traps) {
      const key = `${p.pattern}:${t.reason}`;
      seen.add(key);
      assert(keys.has(key), `テンプレートが無い組み合わせ: ${key}（${p.question}）`);
    }
  }

  for (const key of keys) {
    assert(seen.has(key), `どの問題からも呼ばれないテンプレート: ${key}`);
  }
});

test('解説: 全レベルに専用解説がある', () => {
  for (const level of SUPPORTED_LEVELS) {
    const rng = createRng(100 + level);
    let matchedAny = false;
    for (let i = 0; i < 200 && !matchedAny; i++) {
      const p = generate(level, rng, []);
      for (const t of p.traps) {
        if (explanationFor(p, t.value).matched) matchedAny = true;
      }
    }
    assert(matchedAny, `Lv${level} に専用解説が1つも無い`);
  }
});

// --- 出し分け --------------------------------------------------------------

test('解説: traps に一致した誤答には専用解説が出る', () => {
  for (const p of allKindsOfProblems(1357, 20)) {
    for (const t of p.traps) {
      const { lines, matched } = explanationFor(p, t.value);
      assertEqual(matched, t.reason, `reason が一致しない: ${p.question} / ${t.value}`);
      assert(
        lines.join('|') !== p.steps.join('|'),
        `専用解説が汎用の steps と同じ: ${p.question} / ${t.value}`
      );
    }
  }
});

test('解説: traps に一致しない誤答には汎用の steps が出る', () => {
  for (const p of allKindsOfProblems(2469, 20)) {
    const trapValues = p.traps.map((t) => t.value);
    let odd = 777;
    while (trapValues.includes(String(odd)) || String(odd) === p.answer) odd += 1;

    const { lines, matched } = explanationFor(p, String(odd));
    assertEqual(matched, null, `一致しないはずの値で matched が付いた: ${p.question}`);
    assertDeepEqual(lines, p.steps, `steps が返っていない: ${p.question}`);
  }
});

test('解説: 正解を渡しても落ちない', () => {
  for (const p of allKindsOfProblems(3690, 10)) {
    const { lines } = explanationFor(p, p.answer);
    assert(Array.isArray(lines) && lines.length > 0, `解説が空: ${p.question}`);
  }
});

test('解説: facts が無い問題でも汎用の steps に落ちるだけで落ちない', () => {
  const p = allKindsOfProblems(999, 1)[0];
  const broken = { ...p, facts: undefined };
  const { lines, matched } = explanationFor(broken, p.traps[0].value);
  assertEqual(matched, null);
  assertDeepEqual(lines, p.steps);
});

// --- 文言の条件 ------------------------------------------------------------

test('解説: 専用解説も3行以内で、最後に答えが入っている', () => {
  for (const p of allKindsOfProblems(4812, 20)) {
    for (const t of p.traps) {
      const { lines } = explanationFor(p, t.value);
      assert(lines.length >= 1 && lines.length <= 3, `行数が不正: ${p.question} / ${lines.length}行`);
      for (const line of lines) {
        assert(typeof line === 'string' && line.trim().length > 0, `空行がある: ${p.question}`);
      }
      const last = lines[lines.length - 1];
      assert(last.includes(p.answer), `最後の行に答えがない: ${p.question} / ${last}`);
    }
  }
});

test('解説: 評価語を使わない', () => {
  const banned = ['残念', 'おしい', '惜しい', '間違', 'まちがい', 'ミス', 'ちがい',
                  'よくできました', 'すばらしい', 'がんばろう', 'がんばって', 'もう一度考え'];
  for (const p of allKindsOfProblems(5934, 15)) {
    for (const t of p.traps) {
      const text = explanationFor(p, t.value).lines.join(' ');
      for (const word of banned) {
        assert(!text.includes(word), `評価語 "${word}" が含まれる: ${text}`);
      }
    }
  }
});

test('解説: undefined が文字列に混ざっていない', () => {
  // facts の項目名を間違えるとここで見つかる
  for (const p of allKindsOfProblems(6543, 20)) {
    for (const t of p.traps) {
      const text = explanationFor(p, t.value).lines.join(' ');
      assert(!text.includes('undefined'), `undefined が混ざっている: ${p.pattern}:${t.reason} / ${text}`);
      assert(!text.includes('NaN'), `NaN が混ざっている: ${p.pattern}:${t.reason} / ${text}`);
    }
  }
});

// --- DESIGN.md 5.2 の例 ----------------------------------------------------

test('DESIGN.md 5.2 の例: (-3) - (-8) に -11 と答えるとピンポイントの解説が出る', () => {
  const rng = createRng(20260918);
  let target = null;
  for (let i = 0; i < 6000 && !target; i++) {
    const p = generate(2, rng, [], { pattern: 'sub_negative', form: 'neg_first' });
    if (p.question === '(-3) - (-8)') target = p;
  }
  assert(target, '(-3) - (-8) を生成できなかった');

  const { lines, matched } = explanationFor(target, '-11');
  assertEqual(matched, 'sign_flip_missed');
  assert(lines[0].includes('符号が2つ重なって'), `想定した解説が出ていない: ${lines.join(' / ')}`);
  assert(lines[1].includes('(-3) + 8'), `+8 への変換が示されていない: ${lines[1]}`);
  assertEqual(lines[2], '答えは 5');
});

test('Lv4 の例: (-2)^2 に -4 と答えると括弧の意味が示される', () => {
  const rng = createRng(4444);
  let target = null;
  for (let i = 0; i < 3000 && !target; i++) {
    const p = generate(4, rng, [], { pattern: 'power_paren', form: 'paren_power' });
    if (p.question === '(-2)^2') target = p;
  }
  assert(target, '(-2)^2 を生成できなかった');

  const { lines, matched } = explanationFor(target, '-4');
  assertEqual(matched, 'paren_ignored');
  assert(lines[0].includes('括弧'), `括弧の説明が出ていない: ${lines[0]}`);
  assertEqual(lines[2], '答えは 4');
});
