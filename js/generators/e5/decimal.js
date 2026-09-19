// 小5 Lv1-3 の小数ジェネレータ。
//
// 方針は中1のジェネレータと同じ。
//   - generate() は純関数。乱数は rng を引数で受け取る
//   - 答えは必ず割り切れる。途中で四捨五入が要る問題は作らない
//   - traps（ありがちな誤答）を必ず1件以上埋める
//
// 小数はすべて「整数 ÷ 10^places」で計算する。
// 0.1 + 0.2 が 0.30000000000000004 になる形の計算を一切通さない。
//
// 小5 でいちばん多いつまずきは小数点の位置なので、
// traps は「小数点を打ち忘れた」「桁を1つずらした」を中心に置く。

import { intBetween, weightedPick, hexId } from '../../lib/rng.js';
import { decStr } from '../../lib/num.js';
import { dedupeTraps } from '../../lib/problem.js';

const LEVEL_CONFIG = {
  1: {
    patterns: [
      ['decimal_mul_int', 5],
      ['decimal_div_int', 5]
    ]
  },
  2: {
    patterns: [['decimal_mul_dec', 10]]
  },
  3: {
    patterns: [['decimal_div_dec', 10]]
  }
};

const FORMS_BY_PATTERN = {
  decimal_mul_int: ['dec_x_int'],
  decimal_div_int: ['dec_div_int'],
  decimal_mul_dec: ['dec_x_dec'],
  decimal_div_dec: ['dec_div_dec']
};

export const SUPPORTED_LEVELS = [1, 2, 3];

/**
 * 1桁小数の元になる整数を引く（値は scaled / 10）。
 * 10 の倍数は引き直す。3.0 は小数の問題として成立しないため。
 */
function oneDecimal(rng, min, max) {
  const n = intBetween(rng, min, max);
  if (n % 10 !== 0) return n;
  return n + 1 <= max ? n + 1 : n - 1;
}

/** 小数 × 整数。1.4 × 3 = 4.2 */
function buildMulInt(rng, opts) {
  const a = oneDecimal(rng, 12, opts.easier ? 29 : 89);   // 1.2 〜 8.9
  const n = intBetween(rng, 2, opts.easier ? 4 : 9);
  const scaled = a * n;                                    // places は 1 のまま

  const answer = decStr(scaled, 1);

  return {
    pattern: 'decimal_mul_int',
    form: 'dec_x_int',
    question: `${decStr(a, 1)} × ${n}`,
    answer,
    facts: { aText: decStr(a, 1), n, intA: a, intProduct: scaled },
    steps: [
      `小数点を外して ${a} × ${n} = ${scaled}`,
      '小数点より下は1けたなので、1けた分もどす',
      `答えは ${answer}`
    ],
    traps: dedupeTraps(
      [
        { value: String(scaled), reason: 'point_dropped' },
        { value: decStr(scaled, 2), reason: 'point_shifted' }
      ],
      answer
    )
  };
}

/** 小数 ÷ 整数。8.4 ÷ 4 = 2.1（必ず割り切れる形だけ作る） */
function buildDivInt(rng, opts) {
  const n = intBetween(rng, 2, opts.easier ? 4 : 9);

  // 商のほうを先に決めて、割られる数を逆算する。こうすれば必ず割り切れる。
  // 割られる数が 10 の倍数（＝整数）になる組み合わせは使わない。
  let q = oneDecimal(rng, 12, opts.easier ? 29 : 59);
  for (let i = 0; i < 8 && (q * n) % 10 === 0; i++) {
    q = oneDecimal(rng, 12, opts.easier ? 29 : 59);
  }
  if ((q * n) % 10 === 0) q += 1;

  const scaled = q * n;
  const answer = decStr(q, 1);

  return {
    pattern: 'decimal_div_int',
    form: 'dec_div_int',
    question: `${decStr(scaled, 1)} ÷ ${n}`,
    answer,
    facts: { aText: decStr(scaled, 1), n, intQuotient: q, intDividend: scaled },
    steps: [
      `小数点を外して ${scaled} ÷ ${n} = ${q}`,
      '小数点は、割られる数と同じ位置にもどす',
      `答えは ${answer}`
    ],
    traps: dedupeTraps(
      [
        { value: String(q), reason: 'point_dropped' },
        { value: decStr(q, 2), reason: 'point_shifted' }
      ],
      answer
    )
  };
}

/** 小数 × 小数。0.3 × 0.4 = 0.12（小数点より下は 1けた + 1けた で2けた） */
function buildMulDec(rng, opts) {
  const a = oneDecimal(rng, 2, opts.easier ? 19 : 49);   // 0.2 〜 4.9
  const b = oneDecimal(rng, 2, opts.easier ? 9 : 19);    // 0.2 〜 1.9
  const scaled = a * b;                                  // places = 2

  const answer = decStr(scaled, 2);

  return {
    pattern: 'decimal_mul_dec',
    form: 'dec_x_dec',
    question: `${decStr(a, 1)} × ${decStr(b, 1)}`,
    answer,
    facts: {
      aText: decStr(a, 1), bText: decStr(b, 1),
      intA: a, intB: b, intProduct: scaled
    },
    steps: [
      `小数点を外して ${a} × ${b} = ${scaled}`,
      '小数点より下は 1けた + 1けた で2けた',
      `答えは ${answer}`
    ],
    traps: dedupeTraps(
      [
        { value: decStr(scaled, 1), reason: 'point_count_wrong' },
        { value: String(scaled), reason: 'point_dropped' }
      ],
      answer
    )
  };
}

/**
 * 小数 ÷ 小数。1.2 ÷ 0.4 = 3（両方を10倍して整数の割り算にする）
 *
 * 商のほうを先に決めて、割られる数を逆算する。こうすれば必ず割り切れる。
 * 0.1 の位どうしの割り算なので、商はいつでも整数になる。
 */
function buildDivDec(rng, opts) {
  const b = intBetween(rng, 2, opts.easier ? 5 : 9);      // 0.2 〜 0.9
  const q = intBetween(rng, 2, opts.easier ? 9 : 29);     // 商（整数）
  const scaled = b * q;                                    // 割られる数（places=1）

  const answer = String(q);

  return {
    pattern: 'decimal_div_dec',
    form: 'dec_div_dec',
    question: `${decStr(scaled, 1)} ÷ ${decStr(b, 1)}`,
    answer,
    facts: {
      aText: decStr(scaled, 1), bText: decStr(b, 1),
      intA: scaled, intB: b, quotient: answer
    },
    steps: [
      '割る数が整数になるまで、両方とも10倍する',
      `${scaled} ÷ ${b} と同じ`,
      `答えは ${answer}`
    ],
    traps: dedupeTraps(
      [
        // 割る数だけ10倍して、割られる数はそのままにした
        { value: decStr(q, 1), reason: 'point_shifted' },
        { value: decStr(scaled * b, 2), reason: 'multiplied_instead' }
      ],
      answer
    )
  };
}

const BUILDERS = {
  decimal_mul_int: buildMulInt,
  decimal_div_int: buildDivInt,
  decimal_mul_dec: buildMulDec,
  decimal_div_dec: buildDivDec
};

// --- 公開 API -------------------------------------------------------------

export function generate(level, rng, recent = [], opts = {}) {
  const base = LEVEL_CONFIG[level] || LEVEL_CONFIG[1];

  if (opts.pattern && !BUILDERS[opts.pattern]) {
    throw new Error(`e5/decimal: 未知の pattern ${opts.pattern}`);
  }

  const recentQuestions = recent
    .slice(-3)
    .map((p) => (typeof p === 'string' ? p : p && p.question))
    .filter(Boolean);

  // 直近3問と同じ問題を避ける。
  // 試行回数は固定で打ち切る（条件が満たされるまで回り続ける構造を作らない）。
  let draft = null;
  for (let i = 0; i < 20; i++) {
    const pattern = opts.pattern || weightedPick(rng, base.patterns);
    draft = BUILDERS[pattern](rng, opts);
    if (!recentQuestions.includes(draft.question)) break;
  }

  return {
    id: `e5-l${level}-${draft.pattern}-${hexId(rng)}`,
    level,
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
