// 中3 のレベル → ジェネレータの振り分け。
//
//   Lv1  平方根の基本（√36、√8 × √2、(√7)²）      … 数値で答える
//   Lv2  平方根（√72 ÷ √2、(2√3)²）                … 数値で答える
//   Lv3  展開（(x+3)(x+5)）                        … 4択
//   Lv4  因数分解（x² + 8x + 15）                   … 4択
//   Lv5  二次方程式（x² + 5x + 6 = 0）              … 4択
//
// 展開から先は答えが式になるのでテンキーでは打てない。
// レベルごとに入力の形をそろえてあるので、1回の学習の途中で
// 打ち方が切り替わることはない。

import * as sqrt from './sqrt.js';
import * as expand from './expand.js';
import * as quadratic from './quadratic.js';

const BY_LEVEL = {
  1: sqrt,
  2: sqrt,
  3: expand,
  4: expand,
  5: quadratic
};

const BY_PATTERN = {
  sqrt_perfect: sqrt,
  sqrt_product: sqrt,
  sqrt_square: sqrt,
  sqrt_quotient: sqrt,
  sqrt_coef_square: sqrt,
  expand_two: expand,
  expand_square: expand,
  expand_diff: expand,
  factor_two: expand,
  factor_square: expand,
  factor_diff: expand,
  solve_factorable: quadratic,
  solve_square: quadratic,
  solve_double: quadratic
};

/** 中3 は平方根でマイナスの答えが出る。小数点と分数の線は使わない。 */
export const KEYPAD = { sign: true, dot: false, slash: false, maxDigits: 3 };

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
