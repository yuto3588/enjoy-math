// 中3 Lv1-2 の平方根ジェネレータ。
//
// 答えが必ず整数になる組み合わせだけを作る。
// √ を含む答え（2√3 など）はテンキーで打てないので出さない。
//
// つまずきの中心は
//   1. √ を外さずに中身のまま答える（√8 × √2 → 16）
//   2. 半分にしてしまう（√36 → 18）
//   3. 係数を2乗し忘れる（(2√3)² → 6）
// なので、traps はこの3つから作る。

import { intBetween, weightedPick, hexId } from '../../lib/rng.js';
import { dedupeTraps } from '../../lib/problem.js';

// √ を外すと整数になる組み合わせ。積が平方数になるものだけを並べておく。
const PRODUCT_PAIRS = [
  [2, 8], [2, 18], [2, 32], [2, 50],
  [3, 12], [3, 27], [3, 48],
  [5, 20], [5, 45], [5, 80],
  [6, 24], [6, 54],
  [7, 28], [7, 63],
  [8, 18], [10, 40], [11, 44], [12, 27], [13, 52]
];

// 割ると平方数になる組み合わせ [割られる数, 割る数]
const QUOTIENT_PAIRS = [
  [8, 2], [18, 2], [32, 2], [50, 2], [72, 2], [98, 2],
  [12, 3], [27, 3], [48, 3], [75, 3], [108, 3],
  [20, 5], [45, 5], [80, 5], [125, 5],
  [24, 6], [54, 6], [96, 6],
  [28, 7], [63, 7],
  [40, 10], [90, 10]
];

const SMALL_SQUARES = [4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144];
const BIG_SQUARES = [169, 196, 225, 256, 289, 324, 361, 400, 441, 484];

const LEVEL_CONFIG = {
  1: {
    squares: SMALL_SQUARES,
    patterns: [
      ['sqrt_perfect', 3],
      ['sqrt_product', 4],
      ['sqrt_square', 3]
    ]
  },
  2: {
    squares: BIG_SQUARES,
    patterns: [
      ['sqrt_quotient', 4],
      ['sqrt_coef_square', 4],
      ['sqrt_perfect', 2]
    ]
  }
};

const FORMS_BY_PATTERN = {
  sqrt_perfect: ['root_of_square'],
  sqrt_product: ['root_times_root'],
  sqrt_square: ['root_squared'],
  sqrt_quotient: ['root_div_root'],
  sqrt_coef_square: ['coef_root_squared']
};

export const SUPPORTED_LEVELS = [1, 2];

function pick(rng, list) {
  return list[intBetween(rng, 0, list.length - 1)];
}

/** √144 のような形。中身が平方数なので答えは整数。 */
function buildPerfect(rng, opts, cfg) {
  const squares = opts.easier ? SMALL_SQUARES.slice(0, 6) : cfg.squares;
  const n = pick(rng, squares);
  const root = Math.round(Math.sqrt(n));

  return {
    pattern: 'sqrt_perfect',
    form: 'root_of_square',
    question: `√${n}`,
    answer: String(root),
    facts: { n, root },
    steps: [
      `${root} × ${root} = ${n}`,
      `√${n} は、2乗して ${n} になる数`,
      `答えは ${root}`
    ],
    traps: dedupeTraps(
      [
        { value: String(n / 2), reason: 'halved' },
        { value: String(n), reason: 'root_not_taken' }
      ].filter((t) => Number.isInteger(Number(t.value))),
      String(root)
    )
  };
}

/** √8 × √2 のような形。積が平方数になる組み合わせだけを使う。 */
function buildProduct(rng, opts) {
  const pool = opts.easier ? PRODUCT_PAIRS.slice(0, 8) : PRODUCT_PAIRS;
  const [a, b] = pick(rng, pool);
  const product = a * b;
  const root = Math.round(Math.sqrt(product));

  return {
    pattern: 'sqrt_product',
    form: 'root_times_root',
    question: `√${a} × √${b}`,
    answer: String(root),
    facts: { a, b, product, root },
    steps: [
      `√の中どうしをかけて ${a} × ${b} = ${product}`,
      `√${product} = ${root}`,
      `答えは ${root}`
    ],
    traps: dedupeTraps(
      [
        { value: String(product), reason: 'root_not_taken' },
        { value: String(a + b), reason: 'added_instead' }
      ],
      String(root)
    )
  };
}

/** (√7)² のような形。答えは中身そのもの。 */
function buildSquare(rng, opts) {
  const n = intBetween(rng, 2, opts.easier ? 9 : 19);

  return {
    pattern: 'sqrt_square',
    form: 'root_squared',
    question: `(√${n})^2`,
    answer: String(n),
    facts: { n },
    steps: [
      `√${n} を2回かける`,
      `√${n} × √${n} = √${n * n}`,
      `答えは ${n}`
    ],
    traps: dedupeTraps(
      [
        { value: String(n * n), reason: 'squared_twice' },
        { value: String(n * 2), reason: 'doubled' }
      ],
      String(n)
    )
  };
}

/** √72 ÷ √2 のような形。商が平方数になる組み合わせだけを使う。 */
function buildQuotient(rng, opts) {
  const pool = opts.easier ? QUOTIENT_PAIRS.slice(0, 10) : QUOTIENT_PAIRS;
  const [a, b] = pick(rng, pool);
  const quotient = a / b;
  const root = Math.round(Math.sqrt(quotient));

  return {
    pattern: 'sqrt_quotient',
    form: 'root_div_root',
    question: `√${a} ÷ √${b}`,
    answer: String(root),
    facts: { a, b, quotient, root },
    steps: [
      `√の中どうしを割って ${a} ÷ ${b} = ${quotient}`,
      `√${quotient} = ${root}`,
      `答えは ${root}`
    ],
    traps: dedupeTraps(
      [
        { value: String(quotient), reason: 'root_not_taken' },
        { value: String(a - b), reason: 'subtracted_instead' }
      ],
      String(root)
    )
  };
}

/** (2√3)² のような形。係数も2乗する。 */
function buildCoefSquare(rng, opts) {
  const coef = intBetween(rng, 2, opts.easier ? 4 : 7);
  const inside = pick(rng, [2, 3, 5, 6, 7, 10, 11]);
  const answer = coef * coef * inside;

  return {
    pattern: 'sqrt_coef_square',
    form: 'coef_root_squared',
    question: `(${coef}√${inside})^2`,
    answer: String(answer),
    facts: { coef, inside, coefSquared: coef * coef, answerValue: answer },
    steps: [
      `${coef} も √${inside} も、それぞれ2乗する`,
      `${coef}^2 × ${inside} = ${coef * coef} × ${inside}`,
      `答えは ${answer}`
    ],
    traps: dedupeTraps(
      [
        { value: String(coef * inside), reason: 'coef_not_squared' },
        { value: String(coef * inside * inside), reason: 'inside_squared' }
      ],
      String(answer)
    )
  };
}

const BUILDERS = {
  sqrt_perfect: buildPerfect,
  sqrt_product: buildProduct,
  sqrt_square: buildSquare,
  sqrt_quotient: buildQuotient,
  sqrt_coef_square: buildCoefSquare
};

// --- 公開 API -------------------------------------------------------------

export function generate(level, rng, recent = [], opts = {}) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];

  if (opts.pattern && !BUILDERS[opts.pattern]) {
    throw new Error(`j3/sqrt: 未知の pattern ${opts.pattern}`);
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
    draft = BUILDERS[pattern](rng, opts, cfg);
    if (!recentQuestions.includes(draft.question)) break;
  }

  return {
    id: `j3-l${level}-${draft.pattern}-${hexId(rng)}`,
    level,
    input: 'number',
    pattern: draft.pattern,
    form: draft.form,
    question: draft.question,
    answer: draft.answer,
    facts: draft.facts,
    steps: draft.steps,
    traps: draft.traps
  };
}

export function patternsFor(level) {
  const cfg = LEVEL_CONFIG[level];
  return cfg ? cfg.patterns.map(([name]) => name) : [];
}

export function formsFor(pattern) {
  return FORMS_BY_PATTERN[pattern] ? FORMS_BY_PATTERN[pattern].slice() : [];
}
