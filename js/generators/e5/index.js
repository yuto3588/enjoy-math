// 小5 のレベル → ジェネレータの振り分け。
//
//   Lv1  小数 × 整数 / 小数 ÷ 整数
//   Lv2  小数 × 小数 / 小数 ÷ 小数
//   Lv3  分数の加減（同分母・通分）
//   Lv4  面積・体積（文章題）
//   Lv5  割合・平均・単位量あたり（文章題）
//
// Lv1-3 が計算、Lv4-5 が文章題。
// 計算でつまずいている間は文章題に進まないので、
// 「式は解けるのに文章題で手が止まる」状態のまま先へ行くことがない。
//
// 中1の generators/index.js と同じ形にしてある。
// 学年ごとに中身は違うが、アプリから見た呼び方は変わらない。

import * as decimal from './decimal.js';
import * as fraction from './fraction.js';
import * as word from './word.js';

const BY_LEVEL = {
  1: decimal,
  2: decimal,
  3: fraction,
  4: word,
  5: word
};

const BY_PATTERN = {
  decimal_mul_int: decimal,
  decimal_div_int: decimal,
  decimal_mul_dec: decimal,
  decimal_div_dec: decimal,
  fraction_same_den: fraction,
  fraction_diff_den: fraction,
  e5_area: word,
  e5_volume: word,
  e5_rate: word,
  e5_average: word
};

/** 小5 は小数点と分数の線を使う。マイナスは出てこない。 */
export const KEYPAD = { sign: false, dot: true, slash: true, maxDigits: 4 };

export const SUPPORTED_LEVELS = Object.keys(BY_LEVEL).map(Number);

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

export function patternsFor(level) {
  const gen = BY_LEVEL[level];
  return gen ? gen.patternsFor(level) : [];
}

export function formsFor(pattern) {
  const gen = BY_PATTERN[pattern];
  return gen ? gen.formsFor(pattern) : [];
}

export function allPatterns() {
  return Object.keys(BY_PATTERN);
}
