// レベル → ジェネレータの振り分け。
//
// pattern を明示されたときは、その pattern を持つジェネレータに回す。
// 誤答フローの類題・易問はレベルではなく pattern で決まるため、
// レベルだけで振り分けると「Lv3 の乗除の易問を Lv2 の加減ジェネレータに頼む」
// といった食い違いが起きる。

import * as addsub from './addsub.js';
import * as muldiv from './muldiv.js';
import * as power from './power.js';
import * as mixed from './mixed.js';

const BY_LEVEL = {
  1: addsub,
  2: addsub,
  3: muldiv,
  4: power,
  5: mixed
};

const BY_PATTERN = {
  add_same_sign: addsub,
  add_diff_sign: addsub,
  sub_to_negative: addsub,
  sub_negative: addsub,
  muldiv_sign_count: muldiv,
  power_paren: power,
  order_of_ops: mixed
};

/** 現時点で出題できるレベル。 */
export const SUPPORTED_LEVELS = Object.keys(BY_LEVEL).map(Number);

/**
 * 問題を1問作る。
 *
 * @param {number} level
 * @param {Function} rng  createRng() が返す関数
 * @param {Array} recent  直近に出した問題（重複回避に使う）
 * @param {object} [opts] pattern / form / easier / maxMagnitude
 * @returns {object} Problem
 */
export function generate(level, rng, recent = [], opts = {}) {
  if (opts.pattern) {
    const gen = BY_PATTERN[opts.pattern];
    if (!gen) throw new Error(`未知の pattern: ${opts.pattern}`);
    return gen.generate(level, rng, recent, opts);
  }

  const gen = BY_LEVEL[level];
  if (!gen) throw new Error(`レベル ${level} のジェネレータは未実装`);
  return gen.generate(level, rng, recent, opts);
}

/** そのレベルでランダム出題に使う pattern の一覧。 */
export function patternsFor(level) {
  const gen = BY_LEVEL[level];
  return gen ? gen.patternsFor(level) : [];
}

/** その pattern が取りうる式の形の一覧。 */
export function formsFor(pattern) {
  const gen = BY_PATTERN[pattern];
  return gen ? gen.formsFor(pattern) : [];
}

/** そのレベルの代表的な絶対値の上限（テスト用）。 */
export function maxMagnitudeFor(level) {
  const gen = BY_LEVEL[level];
  return gen ? gen.maxMagnitudeFor(level) : null;
}

/** すべての pattern の一覧（テスト用）。 */
export function allPatterns() {
  return Object.keys(BY_PATTERN);
}
