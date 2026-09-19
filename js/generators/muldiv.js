// Lv3 の乗法・除法ジェネレータ。
//
// つまずきの中心は「符号は負の因数の個数で決まる」こと（pattern: muldiv_sign_count）。
// 除法は割り切れる形だけを出すため、商から逆算して作る。

import { intBetween, weightedPick, hexId } from '../lib/rng.js';
import { term, numStr, dedupeTraps } from '../lib/problem.js';

const LEVEL_CONFIG = {
  3: { max: 9, max3: 5 }
};

const FORMS_BY_PATTERN = {
  muldiv_sign_count: ['mul2', 'div2', 'mul3']
};

const WEIGHTS = [
  ['mul2', 4],
  ['div2', 3],
  ['mul3', 3]
];

export const SUPPORTED_LEVELS = [3];

/** 2 以上の絶対値を引く。1 は符号の練習にならないので使わない。 */
function factor(rng, max) {
  return intBetween(rng, 2, Math.max(2, max));
}

/** 負の因数を1つ以上含む符号の並びを作る。 */
function signs(rng, count) {
  const out = [];
  for (let i = 0; i < count; i++) out.push(rng() < 0.5 ? -1 : 1);
  if (out.every((s) => s > 0)) out[Math.floor(rng() * count)] = -1;
  return out;
}

function signWord(negCount) {
  return negCount % 2 === 0 ? '偶数なのでプラス' : '奇数なのでマイナス';
}

// --- 各形の組み立て -------------------------------------------------------

/** (-4) × 3 */
function buildMul2(rng, cfg) {
  const a = factor(rng, cfg.max);
  let b = factor(rng, cfg.max);
  // 絶対値が同じだと平方（Lv4 の話）になるので避ける
  for (let i = 0; i < 8 && b === a; i++) b = factor(rng, cfg.max);
  if (b === a) b = a === cfg.max ? a - 1 : a + 1;

  const [sa, sb] = signs(rng, 2);
  const x = sa * a;
  const y = sb * b;
  const negCount = (sa < 0 ? 1 : 0) + (sb < 0 ? 1 : 0);
  const abs = a * b;
  const answer = x * y;
  const absExpr = `${a} × ${b} = ${abs}`;

  return {
    form: 'mul2',
    question: `${term(x)} × ${term(y)}`,
    answer: numStr(answer),
    facts: { negCount, absExpr, absResult: abs, opWord: 'かけ算' },
    steps: [
      `マイナスは ${negCount}個。${signWord(negCount)}`,
      absExpr,
      `答えは ${numStr(answer)}`
    ],
    traps: [
      { value: numStr(-answer), reason: 'sign_count_wrong' },
      { value: numStr(x + y), reason: 'added_instead' }
    ]
  };
}

/** (-24) ÷ (-6)。商から逆算して必ず割り切れるようにする。 */
function buildDiv2(rng, cfg) {
  const quotient = factor(rng, cfg.max);
  const divisor = factor(rng, cfg.max);
  const dividend = quotient * divisor;

  const [sd, sv] = signs(rng, 2);
  const x = sd * dividend;
  const y = sv * divisor;
  const negCount = (sd < 0 ? 1 : 0) + (sv < 0 ? 1 : 0);
  const answer = x / y;
  const absExpr = `${dividend} ÷ ${divisor} = ${quotient}`;

  return {
    form: 'div2',
    question: `${term(x)} ÷ ${term(y)}`,
    answer: numStr(answer),
    facts: { negCount, absExpr, absResult: quotient, opWord: 'わり算' },
    steps: [
      `マイナスは ${negCount}個。${signWord(negCount)}`,
      absExpr,
      `答えは ${numStr(answer)}`
    ],
    traps: [
      { value: numStr(-answer), reason: 'sign_count_wrong' }
    ]
  };
}

/** (-2) × (-3) × (-1) の形。因数の個数で符号が決まることが見えやすい。 */
function buildMul3(rng, cfg) {
  const a = factor(rng, cfg.max3);
  const b = factor(rng, cfg.max3);
  const c = factor(rng, cfg.max3);

  const [sa, sb, sc] = signs(rng, 3);
  const x = sa * a;
  const y = sb * b;
  const z = sc * c;
  const negCount = [sa, sb, sc].filter((s) => s < 0).length;
  const abs = a * b * c;
  const answer = x * y * z;
  const absExpr = `${a} × ${b} × ${c} = ${abs}`;

  return {
    form: 'mul3',
    question: `${term(x)} × ${term(y)} × ${term(z)}`,
    answer: numStr(answer),
    facts: { negCount, absExpr, absResult: abs, opWord: 'かけ算' },
    steps: [
      `マイナスは ${negCount}個。${signWord(negCount)}`,
      absExpr,
      `答えは ${numStr(answer)}`
    ],
    traps: [
      { value: numStr(-answer), reason: 'sign_count_wrong' },
      { value: numStr(x + y + z), reason: 'added_instead' }
    ]
  };
}

const BUILDERS = { mul2: buildMul2, div2: buildDiv2, mul3: buildMul3 };

// --- 公開 API -------------------------------------------------------------

export function generate(level, rng, recent = [], opts = {}) {
  const base = LEVEL_CONFIG[level] || LEVEL_CONFIG[3];

  if (opts.pattern && !FORMS_BY_PATTERN[opts.pattern]) {
    throw new Error(`muldiv: 未知の pattern ${opts.pattern}`);
  }
  if (opts.form && !BUILDERS[opts.form]) {
    throw new Error(`muldiv: 未知の form ${opts.form}`);
  }

  const cfg = opts.easier
    ? { max: Math.max(2, Math.floor(base.max / 2)), max3: Math.max(2, base.max3 - 2) }
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
    id: `l${level}-muldiv_sign_count-${hexId(rng)}`,
    level,
    pattern: 'muldiv_sign_count',
    form: draft.form,
    question: draft.question,
    answer: draft.answer,
    facts: draft.facts,
    steps: draft.steps,
    traps: dedupeTraps(draft.traps, draft.answer)
  };
}

export function patternsFor() {
  return ['muldiv_sign_count'];
}

export function formsFor(pattern) {
  return FORMS_BY_PATTERN[pattern] ? FORMS_BY_PATTERN[pattern].slice() : [];
}

export function maxMagnitudeFor(level) {
  const cfg = LEVEL_CONFIG[level];
  return cfg ? cfg.max : null;
}
