// Lv4 の累乗ジェネレータ。
//
// つまずきの中心は (-2)^2 と -2^2 の区別（pattern: power_paren）。
// 括弧があればマイナスも一緒にかける、無ければ数だけをかけて後からマイナスを付ける。
//
// 式の中では指数を "^2" と書く。画面では forDisplay() が ² に直す。

import { intBetween, weightedPick, hexId } from '../lib/rng.js';
import { term, numStr, dedupeTraps } from '../lib/problem.js';

const LEVEL_CONFIG = {
  // 指数2のときの底の上限 / 指数3のときの底の上限
  4: { maxSquare: 6, maxCube: 4, maxTimes: 6 }
};

const FORMS_BY_PATTERN = {
  power_paren: ['paren_power', 'bare_power', 'power_times']
};

const WEIGHTS = [
  ['paren_power', 4],
  ['bare_power', 4],
  ['power_times', 2]
];

export const SUPPORTED_LEVELS = [4];

/** (-2)^2 / (-2)^3。括弧の中まで累乗する形。 */
function buildParenPower(rng, cfg) {
  const exp = rng() < 0.75 ? 2 : 3;
  const base = intBetween(rng, 2, exp === 2 ? cfg.maxSquare : cfg.maxCube);
  const powerValue = base ** exp;
  const answer = (-base) ** exp;

  return {
    form: 'paren_power',
    question: `${term(-base)}^${exp}`,
    answer: numStr(answer),
    facts: { base, exp, hasParen: true, powerValue, signedPower: numStr(answer) },
    steps: [
      `${term(-base)}^${exp} は ${term(-base)} を${exp}回かける`,
      `マイナスが${exp}個で${exp % 2 === 0 ? 'プラス' : 'マイナス'}`,
      `${base}^${exp} = ${powerValue}、答えは ${numStr(answer)}`
    ],
    traps: [
      { value: numStr(-answer), reason: 'paren_ignored' },
      { value: numStr(-(base * exp)), reason: 'power_as_multiplication' }
    ]
  };
}

/** -2^2。括弧が無いので底だけを累乗する形。指数は2に限る。 */
function buildBarePower(rng, cfg) {
  const base = intBetween(rng, 2, cfg.maxSquare);
  const exp = 2;
  const powerValue = base ** exp;
  const answer = -powerValue;

  return {
    form: 'bare_power',
    question: `-${base}^${exp}`,
    answer: numStr(answer),
    facts: { base, exp, hasParen: false, powerValue, signedPower: numStr(answer) },
    steps: [
      `括弧が無いので、${base} だけを${exp}回かける`,
      `${base}^${exp} = ${powerValue}`,
      `前のマイナスを付けて ${numStr(answer)}`
    ],
    traps: [
      { value: numStr(powerValue), reason: 'paren_assumed' },
      { value: numStr(-(base * exp)), reason: 'power_as_multiplication' }
    ]
  };
}

/** (-3)^2 × 2。累乗を先に計算する形。底は3以上にして罠が重ならないようにする。 */
function buildPowerTimes(rng, cfg) {
  const base = intBetween(rng, 3, 5);
  const multiplier = intBetween(rng, 2, cfg.maxTimes);
  const powerValue = base * base;
  const answer = powerValue * multiplier;

  return {
    form: 'power_times',
    question: `${term(-base)}^2 × ${multiplier}`,
    answer: numStr(answer),
    facts: { base, exp: 2, hasParen: true, powerValue, signedPower: numStr(powerValue) },
    steps: [
      '累乗を先に計算する',
      `${term(-base)}^2 = ${powerValue}`,
      `${powerValue} × ${multiplier} = ${numStr(answer)}`
    ],
    traps: [
      { value: numStr(-answer), reason: 'paren_ignored' },
      { value: numStr(-(base * 2 * multiplier)), reason: 'power_as_multiplication' }
    ]
  };
}

const BUILDERS = {
  paren_power: buildParenPower,
  bare_power: buildBarePower,
  power_times: buildPowerTimes
};

// --- 公開 API -------------------------------------------------------------

export function generate(level, rng, recent = [], opts = {}) {
  const base = LEVEL_CONFIG[level] || LEVEL_CONFIG[4];

  if (opts.pattern && !FORMS_BY_PATTERN[opts.pattern]) {
    throw new Error(`power: 未知の pattern ${opts.pattern}`);
  }
  if (opts.form && !BUILDERS[opts.form]) {
    throw new Error(`power: 未知の form ${opts.form}`);
  }

  const cfg = opts.easier
    ? { maxSquare: 4, maxCube: 3, maxTimes: 3 }
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
    id: `l${level}-power_paren-${hexId(rng)}`,
    level,
    pattern: 'power_paren',
    form: draft.form,
    question: draft.question,
    answer: draft.answer,
    facts: draft.facts,
    steps: draft.steps,
    traps: dedupeTraps(draft.traps, draft.answer)
  };
}

export function patternsFor() {
  return ['power_paren'];
}

export function formsFor(pattern) {
  return FORMS_BY_PATTERN[pattern] ? FORMS_BY_PATTERN[pattern].slice() : [];
}

export function maxMagnitudeFor(level) {
  const cfg = LEVEL_CONFIG[level];
  return cfg ? cfg.maxSquare : null;
}
