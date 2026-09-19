// Lv5 の四則混合ジェネレータ。
//
// つまずきの中心は計算の順序（pattern: order_of_ops）。
//   累乗 → 乗除 → 加減、括弧があれば中を先に。
//
// DESIGN.md の Lv5 には分数の例もあるが、当面は整数だけにしている。
// 四則混合は整数のままで十分に難しく、テンキーに「/」を足すと入力ミスが増えるため。
// 分数が必要になったら別フェーズで足す。

import { intBetween, weightedPick, hexId } from '../lib/rng.js';
import { term, numStr, dedupeTraps } from '../lib/problem.js';

const LEVEL_CONFIG = {
  5: { maxFirst: 9, maxFactor: 6, maxSmall: 5 }
};

const FORMS_BY_PATTERN = {
  order_of_ops: ['add_mul', 'power_mul_add', 'paren_first']
};

const WEIGHTS = [
  ['add_mul', 4],
  ['power_mul_add', 3],
  ['paren_first', 3]
];

export const SUPPORTED_LEVELS = [5];

function signed(rng, max) {
  const n = intBetween(rng, 2, Math.max(2, max));
  return rng() < 0.5 ? -n : n;
}

/**
 * 全部が正の数だと「正負の数」の問題にならないので、
 * 1つも負が無ければどれか1つの符号を反転させる。
 */
function ensureNegative(rng, values) {
  if (values.some((v) => v < 0)) return values;
  const i = Math.floor(rng() * values.length);
  const out = values.slice();
  out[i] = -out[i];
  return out;
}

/** (-6) + (-2) × 3 */
function buildAddMul(rng, cfg) {
  let [a, b, c] = ensureNegative(rng, [
    signed(rng, cfg.maxFirst),
    signed(rng, cfg.maxFactor),
    signed(rng, cfg.maxSmall)
  ]);

  const product = b * c;
  // 答えが0になる自明な形を避ける。
  // ここで引き直すと ensureNegative で付けた符号が消えることがあるので、
  // 符号は変えずに絶対値だけをずらす。
  if (a + product === 0) a = a > 0 ? a + 1 : a - 1;

  const answer = a + product;
  const stepExpr = `${term(b)} × ${term(c)} = ${numStr(product)}`;

  return {
    form: 'add_mul',
    question: `${term(a)} + ${term(b)} × ${term(c)}`,
    answer: numStr(answer),
    facts: { firstWord: 'かけ算', stepExpr, stepValue: product },
    steps: [
      'かけ算を先に計算する',
      stepExpr,
      `${term(a)} + ${term(product)} = ${numStr(answer)}`
    ],
    traps: [
      { value: numStr((a + b) * c), reason: 'left_to_right' },
      { value: numStr(-answer), reason: 'sign_slip' }
    ]
  };
}

/** (-6) + (-2)^2 × 3 */
function buildPowerMulAdd(rng, cfg) {
  // (-base)^2 の形で必ず負の数が出るので、a の符号は自由でよい
  let a = signed(rng, cfg.maxFirst);
  const base = intBetween(rng, 2, 4);
  const c = intBetween(rng, 2, cfg.maxSmall);

  const powerValue = base * base;
  const product = powerValue * c;
  if (a + product === 0) a = a > 0 ? a + 1 : a - 1;

  const answer = a + product;
  const stepExpr = `${term(-base)}^2 = ${powerValue}、${powerValue} × ${c} = ${product}`;

  return {
    form: 'power_mul_add',
    question: `${term(a)} + ${term(-base)}^2 × ${c}`,
    answer: numStr(answer),
    facts: { firstWord: '累乗', stepExpr, stepValue: product },
    steps: [
      '累乗 → かけ算 → 足し算 の順',
      stepExpr,
      `${term(a)} + ${product} = ${numStr(answer)}`
    ],
    traps: [
      { value: numStr(a - product), reason: 'power_sign_ignored' },
      { value: numStr((a + powerValue) * c), reason: 'left_to_right' }
    ]
  };
}

/** (7 + (-9)) × 3。括弧の中を先に計算する形。 */
function buildParenFirst(rng, cfg) {
  // 括弧の中の先頭は正の数にする（((-6) + 4) × 3 のような二重括弧を避けるため）
  const a = intBetween(rng, 2, cfg.maxFirst);
  let [b, c] = ensureNegative(rng, [
    signed(rng, cfg.maxFactor),
    signed(rng, cfg.maxSmall)
  ]);

  // 括弧の中が0になると、括弧の意味が見えなくなる。
  // 符号は変えずに絶対値だけをずらす（負の数を消さないため）。
  if (a + b === 0) b = b > 0 ? b + 1 : b - 1;

  const inner = a + b;
  const answer = inner * c;
  const stepExpr = `${a} + ${term(b)} = ${numStr(inner)}`;

  return {
    form: 'paren_first',
    question: `(${a} + ${term(b)}) × ${term(c)}`,
    answer: numStr(answer),
    facts: { firstWord: '括弧の中', stepExpr, stepValue: inner },
    steps: [
      '括弧の中を先に計算する',
      stepExpr,
      `${term(inner)} × ${term(c)} = ${numStr(answer)}`
    ],
    traps: [
      { value: numStr(a + b * c), reason: 'paren_ignored' },
      { value: numStr(-answer), reason: 'sign_slip' }
    ]
  };
}

const BUILDERS = {
  add_mul: buildAddMul,
  power_mul_add: buildPowerMulAdd,
  paren_first: buildParenFirst
};

// --- 公開 API -------------------------------------------------------------

export function generate(level, rng, recent = [], opts = {}) {
  const base = LEVEL_CONFIG[level] || LEVEL_CONFIG[5];

  if (opts.pattern && !FORMS_BY_PATTERN[opts.pattern]) {
    throw new Error(`mixed: 未知の pattern ${opts.pattern}`);
  }
  if (opts.form && !BUILDERS[opts.form]) {
    throw new Error(`mixed: 未知の form ${opts.form}`);
  }

  const cfg = opts.easier
    ? { maxFirst: 5, maxFactor: 3, maxSmall: 3 }
    : { ...base };

  const recentQuestions = recent
    .slice(-3)
    .map((p) => (typeof p === 'string' ? p : p && p.question))
    .filter(Boolean);

  let draft = null;
  for (let i = 0; i < 20; i++) {
    const form = opts.form || weightedPick(rng, WEIGHTS);
    draft = BUILDERS[form](rng, cfg);
    if (!recentQuestions.includes(draft.question)) break;
  }

  return {
    id: `l${level}-order_of_ops-${hexId(rng)}`,
    level,
    pattern: 'order_of_ops',
    form: draft.form,
    question: draft.question,
    answer: draft.answer,
    facts: draft.facts,
    steps: draft.steps,
    traps: dedupeTraps(draft.traps, draft.answer)
  };
}

export function patternsFor() {
  return ['order_of_ops'];
}

export function formsFor(pattern) {
  return FORMS_BY_PATTERN[pattern] ? FORMS_BY_PATTERN[pattern].slice() : [];
}

export function maxMagnitudeFor(level) {
  const cfg = LEVEL_CONFIG[level];
  return cfg ? cfg.maxFirst : null;
}
