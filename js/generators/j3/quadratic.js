// 中3 Lv5 の二次方程式ジェネレータ。
//
// 解が2つあるので、テンキーでは答えられない。4択で選ぶ形にする。
//
// 因数分解で解けるものと、x² = n の形だけを作る。
// 解の公式は使わない（答えに √ と分数が混ざり、選択肢が読みにくくなるため）。
//
// つまずきの中心は
//   1. 符号を逆にする（x² + 5x + 6 = 0 の解を 2, 3 と答える）
//   2. x² = 49 でマイナスのほうを落とす
//   3. 重解を2つあると思う

import { intBetween, weightedPick, hexId } from '../../lib/rng.js';
import { dedupeTraps } from '../../lib/problem.js';
import { quadStr, solutionStr, buildChoices } from './poly.js';

const SQUARES = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144];

const LEVEL_CONFIG = {
  5: {
    patterns: [
      ['solve_factorable', 5],
      ['solve_square', 3],
      ['solve_double', 2]
    ]
  }
};

const FORMS_BY_PATTERN = {
  solve_factorable: ['two_solutions'],
  solve_square: ['x_squared_equals'],
  solve_double: ['double_root']
};

export const SUPPORTED_LEVELS = [5];

function pick(rng, list) {
  return list[intBetween(rng, 0, list.length - 1)];
}

function signedSmall(rng, max) {
  const n = intBetween(rng, 1, max);
  return rng() < 0.45 ? -n : n;
}

/**
 * 異なる2つを引く。a + b = 0 になる組は使わない。
 * x の項が消えて x² = n の形と見分けがつかなくなり、
 * 外れの選択肢も足りなくなるため（その形は solve_square が作る）。
 */
function twoDistinct(rng, max) {
  const a = signedSmall(rng, max);
  let b = signedSmall(rng, max);
  for (let i = 0; i < 12 && (b === a || b === -a); i++) b = signedSmall(rng, max);
  if (b === a || b === -a) b = a > 0 ? a + 1 : a - 1;
  return [a, b];
}

/** x² + 5x + 6 = 0 の形。因数分解して解く。 */
function buildFactorable(rng, opts) {
  // (x+a)(x+b) = 0 の解は x = -a, -b
  const [a, b] = twoDistinct(rng, opts.easier ? 5 : 9);
  const sum = a + b;
  const product = a * b;
  const answer = solutionStr(-a, -b);

  return {
    pattern: 'solve_factorable',
    form: 'two_solutions',
    question: `${quadStr(sum, product)} = 0`,
    answer,
    facts: { a, b, sum, product, factored: `(x${a < 0 ? '-' : '+'}${Math.abs(a)})(x${b < 0 ? '-' : '+'}${Math.abs(b)})` },
    steps: [
      `かけて ${product}、足して ${sum} になるのは ${a} と ${b}`,
      `${quadStr(sum, product)} = 0 は、2つの式のかけ算が 0 という意味`,
      `答えは ${answer}`
    ],
    traps: dedupeTraps(
      [
        { value: solutionStr(a, b), reason: 'sign_flipped' },
        { value: solutionStr(-a, b), reason: 'one_sign_wrong' },
        { value: solutionStr(sum, product), reason: 'sum_product_used' },
        { value: solutionStr(a, -b), reason: 'one_sign_wrong' }
      ],
      answer
    )
  };
}

/** x² = 49 の形。プラスとマイナスの両方が解になる。 */
function buildSquare(rng, opts) {
  const pool = opts.easier ? SQUARES.slice(0, 6) : SQUARES;
  const n = pick(rng, pool);
  const r = Math.round(Math.sqrt(n));
  const answer = solutionStr(-r, r);

  return {
    pattern: 'solve_square',
    form: 'x_squared_equals',
    question: `x^2 = ${n}`,
    answer,
    facts: { n, r },
    steps: [
      `2乗して ${n} になる数をさがす`,
      `${r} と ${-r} のどちらも2乗すると ${n} になる`,
      `答えは ${answer}`
    ],
    traps: dedupeTraps(
      [
        { value: solutionStr(r, r), reason: 'negative_missing' },
        { value: solutionStr(-n, n), reason: 'root_not_taken' },
        { value: solutionStr(-(n / 2), n / 2), reason: 'halved' },
        { value: solutionStr(-r, -r), reason: 'positive_missing' }
      ].filter((t) => /^x = -?\d+(, -?\d+)?$/.test(t.value)),
      answer
    )
  };
}

/** x² + 8x + 16 = 0 の形。解が1つだけになる。 */
function buildDouble(rng, opts) {
  const a = signedSmall(rng, opts.easier ? 5 : 9);
  const answer = solutionStr(-a, -a);

  return {
    pattern: 'solve_double',
    form: 'double_root',
    question: `${quadStr(2 * a, a * a)} = 0`,
    answer,
    facts: { a, twice: 2 * a, squared: a * a },
    steps: [
      `かけて ${a * a}、足して ${2 * a} になるのは ${a} と ${a}`,
      '同じ数が2回なので、解は1つになる',
      `答えは ${answer}`
    ],
    traps: dedupeTraps(
      [
        { value: solutionStr(-a, a), reason: 'two_solutions_assumed' },
        { value: solutionStr(a, a), reason: 'sign_flipped' },
        { value: solutionStr(-a, -(a * a)), reason: 'sum_product_used' },
        { value: solutionStr(-(2 * a), -(2 * a)), reason: 'doubled' }
      ],
      answer
    )
  };
}

const BUILDERS = {
  solve_factorable: buildFactorable,
  solve_square: buildSquare,
  solve_double: buildDouble
};

// --- 公開 API -------------------------------------------------------------

export function generate(level, rng, recent = [], opts = {}) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG[5];

  if (opts.pattern && !BUILDERS[opts.pattern]) {
    throw new Error(`j3/quadratic: 未知の pattern ${opts.pattern}`);
  }

  const recentQuestions = recent
    .slice(-3)
    .map((p) => (typeof p === 'string' ? p : p && p.question))
    .filter(Boolean);

  // 直近3問と同じ問題を避ける。
  // 試行回数は固定で打ち切る（条件が満たされるまで回り続ける構造を作らない）。
  let draft = null;
  for (let i = 0; i < 20; i++) {
    const pattern = opts.pattern || weightedPick(rng, cfg.patterns);
    draft = BUILDERS[pattern](rng, opts);
    if (!recentQuestions.includes(draft.question)) break;
  }

  // 選択肢に出なかった traps は落とす。
  // 選べない誤答が残っていると、呼ばれない解説を抱えることになる。
  const choices = buildChoices(rng, draft.answer, draft.traps);
  const traps = draft.traps.filter((t) => choices.includes(t.value));

  return {
    id: `j3-l${level}-${draft.pattern}-${hexId(rng)}`,
    level,
    input: 'choice',
    pattern: draft.pattern,
    form: draft.form,
    question: draft.question,
    answer: draft.answer,
    choices,
    facts: draft.facts,
    steps: draft.steps,
    traps
  };
}

export function patternsFor(level) {
  const cfg = LEVEL_CONFIG[level];
  return cfg ? cfg.patterns.map(([name]) => name) : [];
}

export function formsFor(pattern) {
  return FORMS_BY_PATTERN[pattern] ? FORMS_BY_PATTERN[pattern].slice() : [];
}
