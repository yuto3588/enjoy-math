// 中3 Lv3-4 の展開・因数分解ジェネレータ。
//
// 答えが式そのものなので、テンキーでは打てない。4択で選ぶ形にする。
// 選択肢は「ありがちな誤答」をそのまま並べたもの（traps = 選択肢の外れ）。
// 数を当てずっぽうで選んでも、どこを間違えたかが解説で分かるようにしてある。
//
// つまずきの中心は
//   1. (x+a)² の真ん中の項を落とす（x² + a² と書く）
//   2. 符号を取り違える
//   3. 和と積を入れ替える（x² + abx + (a+b)）

import { intBetween, weightedPick, hexId } from '../../lib/rng.js';
import { dedupeTraps } from '../../lib/problem.js';
import { quadStr, factoredStr, buildChoices } from './poly.js';

const LEVEL_CONFIG = {
  3: {
    patterns: [
      ['expand_two', 5],
      ['expand_square', 3],
      ['expand_diff', 2]
    ]
  },
  4: {
    patterns: [
      ['factor_two', 5],
      ['factor_square', 3],
      ['factor_diff', 2]
    ]
  }
};

const FORMS_BY_PATTERN = {
  expand_two: ['prod_two'],
  expand_square: ['square_binomial'],
  expand_diff: ['diff_squares'],
  factor_two: ['pair_factors'],
  factor_square: ['square_factors'],
  factor_diff: ['diff_factors']
};

export const SUPPORTED_LEVELS = [3, 4];

function pick(rng, list) {
  return list[intBetween(rng, 0, list.length - 1)];
}

/** 0 を避けた、符号つきの小さい整数。 */
function signedSmall(rng, max) {
  const n = intBetween(rng, 1, max);
  return rng() < 0.45 ? -n : n;
}

/**
 * 異なる2つを引く。試行回数は固定で打ち切る。
 *
 * a + b = 0 になる組（3 と -3 など）は使わない。
 *   - 展開では x の項が消えて、外れの選択肢が足りなくなる
 *   - 因数分解では (x+3)(x-3) と (x-3)(x+3) が両方とも正解になってしまう
 * この形は expand_diff / factor_diff が専用に作る。
 */
function twoDistinct(rng, max) {
  const a = signedSmall(rng, max);
  let b = signedSmall(rng, max);
  for (let i = 0; i < 12 && (b === a || b === -a); i++) b = signedSmall(rng, max);
  if (b === a || b === -a) b = a > 0 ? a + 1 : a - 1;
  return [a, b];
}

/**
 * c の約数の組から、和が b にならないものを1つ探す（因数分解の外れに使う）。
 * 正解そのものと、符号を反転しただけの組は避ける（他の外れと重なるため）。
 */
function wrongPair(c, b, avoid) {
  const taken = new Set(avoid.map((pair) => pair.slice().sort((x, y) => x - y).join(',')));
  const key = (p, q) => [p, q].sort((x, y) => x - y).join(',');

  for (let p = 1; p <= Math.abs(c); p++) {
    if (c % p !== 0) continue;
    const q = c / p;
    if (p + q !== b && !taken.has(key(p, q))) return [p, q];
    if (-p - q !== b && !taken.has(key(-p, -q))) return [-p, -q];
  }
  return null;
}

// --- 展開（Lv3） -----------------------------------------------------------

/** (x+3)(x+5) を展開する。 */
function buildExpandTwo(rng, opts) {
  const [a, b] = twoDistinct(rng, opts.easier ? 5 : 9);
  const sum = a + b;
  const product = a * b;
  const answer = quadStr(sum, product);

  return {
    pattern: 'expand_two',
    form: 'prod_two',
    question: factoredStr(a, b),
    answer,
    facts: { a, b, sum, product },
    steps: [
      `x の係数は ${a} と ${b} を足して ${sum}`,
      `最後の数は ${a} と ${b} をかけて ${product}`,
      `答えは ${answer}`
    ],
    traps: dedupeTraps(
      [
        { value: quadStr(product, sum), reason: 'sum_product_swapped' },
        { value: quadStr(0, product), reason: 'middle_missing' },
        { value: quadStr(sum, -product), reason: 'constant_sign_wrong' }
      ],
      answer
    )
  };
}

/** (x+4)² を展開する。真ん中の項を落とす誤りがいちばん多い。 */
function buildExpandSquare(rng, opts) {
  const a = signedSmall(rng, opts.easier ? 5 : 9);
  const answer = quadStr(2 * a, a * a);

  return {
    pattern: 'expand_square',
    form: 'square_binomial',
    question: factoredStr(a, a),
    answer,
    facts: { a, twice: 2 * a, squared: a * a },
    steps: [
      `${factoredStr(a, a)} は ${factoredStr(a, a).replace('^2', '')} を2回かけたもの`,
      `x の係数は ${a} を2倍して ${2 * a}、最後の数は ${a * a}`,
      `答えは ${answer}`
    ],
    traps: dedupeTraps(
      [
        { value: quadStr(0, a * a), reason: 'middle_missing' },
        { value: quadStr(a, a * a), reason: 'coef_not_doubled' },
        { value: quadStr(2 * a, 2 * a), reason: 'constant_not_squared' },
        { value: quadStr(-2 * a, a * a), reason: 'middle_sign_wrong' }
      ],
      answer
    )
  };
}

/** (x+5)(x-5) を展開する。真ん中の項が消える形。 */
function buildExpandDiff(rng, opts) {
  const a = intBetween(rng, 2, opts.easier ? 6 : 12);
  const answer = quadStr(0, -(a * a));

  return {
    pattern: 'expand_diff',
    form: 'diff_squares',
    question: factoredStr(a, -a),
    answer,
    facts: { a, squared: a * a },
    steps: [
      `x の係数は ${a} と ${-a} を足して 0 になり、消える`,
      `最後の数は ${a} × ${-a} で ${-(a * a)}`,
      `答えは ${answer}`
    ],
    traps: dedupeTraps(
      [
        { value: quadStr(0, a * a), reason: 'constant_sign_wrong' },
        { value: quadStr(-2 * a, -(a * a)), reason: 'middle_left' },
        { value: quadStr(0, -a), reason: 'constant_not_squared' },
        { value: quadStr(2 * a, -(a * a)), reason: 'middle_left' }
      ],
      answer
    )
  };
}

// --- 因数分解（Lv4） -------------------------------------------------------

/** x² + 8x + 15 を因数分解する。 */
function buildFactorTwo(rng, opts) {
  const [a, b] = twoDistinct(rng, opts.easier ? 5 : 9);
  const sum = a + b;
  const product = a * b;
  const answer = factoredStr(a, b);

  const other = wrongPair(product, sum, [[a, b], [-a, -b], [a, -b], [-a, b]]);
  const traps = [
    { value: factoredStr(-a, -b), reason: 'sign_flipped' },
    { value: factoredStr(a, -b), reason: 'one_sign_wrong' }
  ];
  if (other) traps.push({ value: factoredStr(other[0], other[1]), reason: 'sum_wrong' });
  traps.push({ value: factoredStr(sum, product), reason: 'sum_product_swapped' });

  return {
    pattern: 'factor_two',
    form: 'pair_factors',
    question: quadStr(sum, product),
    answer,
    facts: { a, b, sum, product },
    steps: [
      `かけて ${product}、足して ${sum} になる2つの数をさがす`,
      `${a} と ${b} が当てはまる`,
      `答えは ${answer}`
    ],
    traps: dedupeTraps(traps, answer)
  };
}

/** x² + 8x + 16 のように、同じ数が2回の形。 */
function buildFactorSquare(rng, opts) {
  const a = signedSmall(rng, opts.easier ? 5 : 9);
  const answer = factoredStr(a, a);

  return {
    pattern: 'factor_square',
    form: 'square_factors',
    question: quadStr(2 * a, a * a),
    answer,
    facts: { a, twice: 2 * a, squared: a * a },
    steps: [
      `かけて ${a * a}、足して ${2 * a} になる2つの数をさがす`,
      `どちらも ${a} で、同じ数が2回になる`,
      `答えは ${answer}`
    ],
    traps: dedupeTraps(
      [
        { value: factoredStr(-a, -a), reason: 'sign_flipped' },
        { value: factoredStr(a, -a), reason: 'one_sign_wrong' },
        { value: factoredStr(1, a * a), reason: 'sum_wrong' },
        { value: factoredStr(2 * a, a * a), reason: 'sum_product_swapped' }
      ],
      answer
    )
  };
}

/** x² - 25 のように、真ん中の項が無い形。 */
function buildFactorDiff(rng, opts) {
  const a = intBetween(rng, 2, opts.easier ? 6 : 12);
  const answer = factoredStr(a, -a);

  return {
    pattern: 'factor_diff',
    form: 'diff_factors',
    question: quadStr(0, -(a * a)),
    answer,
    facts: { a, squared: a * a },
    steps: [
      `かけて ${-(a * a)}、足して 0 になる2つの数をさがす`,
      `${a} と ${-a} が当てはまる`,
      `答えは ${answer}`
    ],
    traps: dedupeTraps(
      [
        { value: factoredStr(a, a), reason: 'sign_flipped' },
        { value: factoredStr(-a, -a), reason: 'sign_flipped_both' },
        { value: factoredStr(1, -(a * a)), reason: 'sum_wrong' },
        { value: factoredStr(a * a, -1), reason: 'sum_wrong' }
      ],
      answer
    )
  };
}

const BUILDERS = {
  expand_two: buildExpandTwo,
  expand_square: buildExpandSquare,
  expand_diff: buildExpandDiff,
  factor_two: buildFactorTwo,
  factor_square: buildFactorSquare,
  factor_diff: buildFactorDiff
};

// --- 公開 API -------------------------------------------------------------

export function generate(level, rng, recent = [], opts = {}) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG[3];

  if (opts.pattern && !BUILDERS[opts.pattern]) {
    throw new Error(`j3/expand: 未知の pattern ${opts.pattern}`);
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
