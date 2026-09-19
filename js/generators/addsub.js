// Lv1 / Lv2 の加法・減法ジェネレータ。
//
// 方針:
//   - generate() は純関数。乱数は rng を引数で受け取る。グローバル状態を持たない。
//   - 答えは必ず整数。解から逆算する必要がない範囲（2項の加減）なので、
//     項を決めた時点で答えが一意に定まる形だけを作る。
//   - 自明な問題（絶対値1を含む / 答えが0 / 正+正）は作らないか、頻度を落とす。
//   - traps（ありがちな誤答）を必ず1件以上埋める。これが解説の出し分けの入口になる。
//   - pattern / form / 絶対値の上限を指定して作れる。
//     誤答フローの「同じ形の類題」「より易しい同種問題」で使う。

import { intBetween, weightedPick, hexId } from '../lib/rng.js';
import { term, numStr, dedupeTraps } from '../lib/problem.js';

const LEVEL_CONFIG = {
  // DESIGN.md 4.1: Lv1 = 絶対値 1〜10、Lv2 = 絶対値 1〜20（負数の減法を含む）
  1: {
    max: 10,
    patterns: [
      ['add_diff_sign', 4],
      ['sub_to_negative', 3],
      ['add_same_sign', 3]
    ]
  },
  2: {
    max: 20,
    patterns: [
      ['sub_negative', 5],
      ['add_diff_sign', 3],
      ['add_same_sign', 2]
    ]
  }
};

/** pattern ごとに取りうる式の形。 */
const FORMS_BY_PATTERN = {
  add_same_sign: ['neg_neg'],
  add_diff_sign: ['neg_first', 'pos_first'],
  sub_to_negative: ['small_minus_large'],
  sub_negative: ['neg_first', 'pos_first']
};

export const SUPPORTED_LEVELS = [1, 2];

/** 絶対値の下限。これを下回る上限を指定されても 2 までしか下げない。 */
const MIN_MAX_MAGNITUDE = 3;

/**
 * 項の絶対値を1つ引く。
 * 絶対値1は自明になりやすいので、出たら7割の確率で引き直す。
 * 結果として |a|=1 の出現率は 1レベルあたり数%に収まる（DESIGN.md 4.2 の20%以下）。
 */
function magnitude(rng, max) {
  const n = intBetween(rng, 1, max);
  if (n === 1 && rng() < 0.7) return intBetween(rng, 2, max);
  return n;
}

/** 異なる2つの絶対値を引く。試行回数は固定で打ち切る。 */
function twoDistinctMagnitudes(rng, max) {
  const a = magnitude(rng, max);
  let b = magnitude(rng, max);
  for (let i = 0; i < 8 && b === a; i++) b = magnitude(rng, max);
  if (b === a) b = a === max ? a - 1 : a + 1;
  return [a, b];
}

// --- 各パターンの組み立て -------------------------------------------------

/** 同符号の加法。負 + 負 のみ（正 + 正 は小学校の計算と変わらないため出さない）。 */
function buildAddSameSign(rng, cfg) {
  const a = magnitude(rng, cfg.max);
  const b = magnitude(rng, cfg.max);
  const answer = -(a + b);

  return {
    pattern: 'add_same_sign',
    form: 'neg_neg',
    question: `${term(-a)} + ${term(-b)}`,
    answer: numStr(answer),
    facts: { A: a, B: b, sum: a + b },
    steps: [
      '同じ符号どうしの足し算',
      `${a} + ${b} = ${a + b}`,
      `符号はマイナスのまま → ${numStr(answer)}`
    ],
    traps: dedupeTraps(
      [
        { value: numStr(a + b), reason: 'sign_dropped' },
        { value: numStr(-Math.abs(a - b)), reason: 'subtracted_instead' }
      ],
      numStr(answer)
    )
  };
}

/** 異符号の加法。大きい方の絶対値の符号を取れるかを見る。 */
function buildAddDiffSign(rng, cfg, form) {
  const [a, b] = twoDistinctMagnitudes(rng, cfg.max);

  const negFirst = form ? form === 'neg_first' : rng() < 0.5;
  const x = negFirst ? -a : a;
  const y = negFirst ? b : -b;
  const answer = x + y;

  const bigger = Math.abs(x) > Math.abs(y) ? x : y;
  const d = Math.abs(Math.abs(x) - Math.abs(y));
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const signWord = bigger < 0 ? 'マイナス' : 'プラス';

  return {
    pattern: 'add_diff_sign',
    form: negFirst ? 'neg_first' : 'pos_first',
    question: `${term(x)} + ${term(y)}`,
    answer: numStr(answer),
    facts: {
      A: a, B: b, hi, lo, d,
      biggerTerm: term(bigger),
      biggerNegative: bigger < 0
    },
    steps: [
      `絶対値が大きいのは ${term(bigger)}`,
      `${hi} - ${lo} = ${d}`,
      `符号は${signWord} → ${numStr(answer)}`
    ],
    traps: dedupeTraps(
      [
        { value: numStr(-answer), reason: 'sign_of_larger_missed' },
        { value: numStr(bigger < 0 ? -(a + b) : a + b), reason: 'added_absolutes' }
      ],
      numStr(answer)
    )
  };
}

/** 小さい数から大きい数を引く。答えが必ず負になるものだけ出す。 */
function buildSubToNegative(rng, cfg) {
  const [p, q] = twoDistinctMagnitudes(rng, cfg.max);
  const small = Math.min(p, q);
  const large = Math.max(p, q);
  const d = large - small;
  const answer = small - large;

  return {
    pattern: 'sub_to_negative',
    form: 'small_minus_large',
    question: `${small} - ${large}`,
    answer: numStr(answer),
    facts: { A: small, B: large, d },
    steps: [
      `${small} - ${large} は ${small} + (${numStr(-large)}) と同じ`,
      `絶対値が大きいのは ${large}、${large} - ${small} = ${d}`,
      `符号はマイナス → ${numStr(answer)}`
    ],
    traps: dedupeTraps(
      [
        { value: numStr(d), reason: 'sign_dropped' },
        { value: numStr(-(small + large)), reason: 'added_instead' }
      ],
      numStr(answer)
    )
  };
}

/** 負の数を引く。符号が2つ重なって + になることを扱う。Lv2 の中心。 */
function buildSubNegative(rng, cfg, form) {
  const b = magnitude(rng, cfg.max); // 引く数の絶対値
  const negFirst = form ? form === 'neg_first' : rng() < 0.6;

  let a;
  if (negFirst) {
    // 答えが0になる (-5) - (-5) の形を避ける
    a = magnitude(rng, cfg.max);
    for (let i = 0; i < 8 && a === b; i++) a = magnitude(rng, cfg.max);
    if (a === b) a = a === cfg.max ? a - 1 : a + 1;
  } else {
    a = magnitude(rng, cfg.max);
  }

  const x = negFirst ? -a : a;
  const answer = x + b;

  const traps = negFirst
    ? [
        { value: numStr(x - b), reason: 'sign_flip_missed' },
        { value: numStr(a + b), reason: 'sign_dropped' }
      ]
    : [
        { value: numStr(x - b), reason: 'sign_flip_missed' },
        { value: numStr(b - x), reason: 'reversed_order' }
      ];

  return {
    pattern: 'sub_negative',
    form: negFirst ? 'neg_first' : 'pos_first',
    question: `${term(x)} - ${term(-b)}`,
    answer: numStr(answer),
    facts: {
      aTerm: term(x), A: a, B: b,
      bTerm: numStr(-b),
      firstNegative: negFirst
    },
    steps: [
      `「-(${numStr(-b)})」は「+${b}」に変わる`,
      `${term(x)} + ${b} になる`,
      `答えは ${numStr(answer)}`
    ],
    traps: dedupeTraps(traps, numStr(answer))
  };
}

const BUILDERS = {
  add_same_sign: buildAddSameSign,
  add_diff_sign: buildAddDiffSign,
  sub_to_negative: buildSubToNegative,
  sub_negative: buildSubNegative
};

// --- 公開 API -------------------------------------------------------------

/**
 * 問題を1問作る。
 *
 * @param {number} level   1 または 2
 * @param {Function} rng   createRng() が返す関数
 * @param {Array} recent   直近に出した問題（Problem または question 文字列の配列）
 * @param {object} [opts]
 * @param {string} [opts.pattern]       この pattern に固定する（類題・易問で使う）
 * @param {string} [opts.form]          この式の形に固定する
 * @param {boolean} [opts.easier]       同じ形のまま数値を易しくする（誤答フローの STEP3）
 * @param {number} [opts.maxMagnitude]  項の絶対値の上限をさらに下げる
 * @returns {object} Problem
 */
export function generate(level, rng, recent = [], opts = {}) {
  const base = LEVEL_CONFIG[level] || LEVEL_CONFIG[2];

  if (opts.pattern && !BUILDERS[opts.pattern]) {
    throw new Error(`addsub: 未知の pattern ${opts.pattern}`);
  }

  const cfg = { max: resolveMax(opts, base.max) };

  const recentQuestions = recent
    .slice(-3)
    .map((p) => (typeof p === 'string' ? p : p && p.question))
    .filter(Boolean);

  // 直近3問と同じ問題を避ける。
  // 試行回数は固定で打ち切る（条件が満たされるまで回り続ける構造を作らない）。
  let draft = null;
  for (let i = 0; i < 20; i++) {
    const pattern = opts.pattern || weightedPick(rng, base.patterns);
    draft = BUILDERS[pattern](rng, cfg, opts.form || null);
    if (!recentQuestions.includes(draft.question)) break;
  }

  return {
    id: `l${level}-${draft.pattern}-${hexId(rng)}`,
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

/** 項の絶対値の上限を決める。easier のときは同じ形のまま範囲を半分にする。 */
function resolveMax(opts, levelMax) {
  let max = levelMax;
  if (opts.easier) max = Math.max(MIN_MAX_MAGNITUDE, Math.floor(levelMax / 2));
  if (Number.isFinite(opts.maxMagnitude)) {
    max = Math.min(max, Math.max(MIN_MAX_MAGNITUDE, Math.floor(opts.maxMagnitude)));
  }
  return max;
}

/** そのレベルでランダム出題に使う pattern の一覧。 */
export function patternsFor(level) {
  const cfg = LEVEL_CONFIG[level];
  return cfg ? cfg.patterns.map(([name]) => name) : [];
}

/** その pattern が取りうる式の形の一覧。 */
export function formsFor(pattern) {
  return FORMS_BY_PATTERN[pattern] ? FORMS_BY_PATTERN[pattern].slice() : [];
}

/** そのレベルの絶対値の上限。 */
export function maxMagnitudeFor(level) {
  const cfg = LEVEL_CONFIG[level];
  return cfg ? cfg.max : null;
}
