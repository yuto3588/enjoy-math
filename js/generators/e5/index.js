// 小5 のレベル → ジェネレータの振り分け。
//
//   Lv1  小数 × 整数 / 小数 ÷ 整数
//   Lv2  小数 × 小数
//   Lv3  小数 ÷ 小数
//   Lv4  分数の加減（分母が同じ・約分あり）
//   Lv5  分数の加減（通分が要る）
//
// 中1の generators/index.js と同じ形にしてある。
// 学年ごとに中身は違うが、アプリから見た呼び方は変わらない。

import * as decimal from './decimal.js';
import * as fraction from './fraction.js';

const BY_LEVEL = {
  1: decimal,
  2: decimal,
  3: decimal,
  4: fraction,
  5: fraction
};

const BY_PATTERN = {
  decimal_mul_int: decimal,
  decimal_div_int: decimal,
  decimal_mul_dec: decimal,
  decimal_div_dec: decimal,
  fraction_same_den: fraction,
  fraction_diff_den: fraction
};

/** 小5 は小数点と分数の線を使う。マイナスは出てこない。 */
export const KEYPAD = { sign: false, dot: true, slash: true, maxDigits: 3 };

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
