// 小5 Lv4: 面積・体積 / Lv5: 割合・平均・単位量あたり。
//
// ここだけ文章題になる。式を1行出す形では表せないため、
// 日本語の問題文（prompt）と単位（unit）を持つ。
//
// 問題文はひな型に数を差し込んで作る。教科書やワークからの転記はしない。
// 数は必ず答えが整数になる組み合わせだけを選ぶ。
// 小数や分数の答えになると、文章題の考え方より計算でつまずくため。
//
// つまずきの中心は
//   面積・体積  まわりの長さと面積を取り違える / 三角形で ÷2 を忘れる
//   割合        もとにする量と比べる量を取り違える / 引いた残りを答えない
//   平均        合計を出して、割るのを忘れる
//   単位量      割る向きを逆にする
// なので、traps はこの形から作る。

import { intBetween, pick, weightedPick, hexId } from '../../lib/rng.js';
import { dedupeTraps } from '../../lib/problem.js';

/**
 * 並びを混ぜる。
 * 平均の問題で、いつも同じ順に点が並ぶと答えが読めてしまうため。
 */
function shuffled(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = intBetween(rng, 0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const LEVEL_CONFIG = {
  4: {
    patterns: [
      ['e5_area', 6],
      ['e5_volume', 4]
    ]
  },
  5: {
    patterns: [
      ['e5_rate', 5],
      ['e5_average', 5]
    ]
  }
};

const FORMS_BY_PATTERN = {
  e5_area: ['e5_area_rect', 'e5_area_square', 'e5_area_triangle'],
  e5_volume: ['e5_volume_box', 'e5_volume_cube'],
  e5_rate: ['e5_percent_of', 'e5_percent_rate', 'e5_percent_off'],
  e5_average: ['e5_average_score', 'e5_per_unit']
};

export const SUPPORTED_LEVELS = [4, 5];

// --- 面積・体積（Lv4） -----------------------------------------------------

/** たて◯cm、よこ◯cm の長方形の面積。 */
function buildAreaRect(rng, opts) {
  const max = opts.easier ? 9 : 15;
  const a = intBetween(rng, 2, max);
  let b = intBetween(rng, 2, max);
  if (b === a) b = a === max ? a - 1 : a + 1;

  const answer = a * b;

  return {
    pattern: 'e5_area',
    form: 'e5_area_rect',
    prompt: `たて ${a}cm、よこ ${b}cm の長方形の面積は何 cm² ですか。`,
    question: '',
    unit: 'cm²',
    answer: String(answer),
    facts: { a, b, answerValue: answer, perimeter: (a + b) * 2 },
    steps: [
      '長方形の面積は たて × よこ',
      `${a} × ${b} = ${answer}`,
      `答えは ${answer} cm²`
    ],
    traps: dedupeTraps(
      [
        { value: String((a + b) * 2), reason: 'perimeter_not_area' },
        { value: String(a + b), reason: 'added_not_multiplied' }
      ],
      String(answer)
    )
  };
}

/** 1辺◯cm の正方形の面積。 */
function buildAreaSquare(rng, opts) {
  const a = intBetween(rng, 3, opts.easier ? 9 : 15);
  const answer = a * a;

  return {
    pattern: 'e5_area',
    form: 'e5_area_square',
    prompt: `1辺が ${a}cm の正方形の面積は何 cm² ですか。`,
    question: '',
    unit: 'cm²',
    answer: String(answer),
    facts: { a, answerValue: answer, perimeter: a * 4 },
    steps: [
      '正方形の面積は 1辺 × 1辺',
      `${a} × ${a} = ${answer}`,
      `答えは ${answer} cm²`
    ],
    traps: dedupeTraps(
      [
        { value: String(a * 4), reason: 'perimeter_not_area' },
        { value: String(a * 2), reason: 'doubled_not_squared' }
      ],
      String(answer)
    )
  };
}

/** 底辺◯cm、高さ◯cm の三角形の面積。÷2 を忘れる誤りを必ず拾う。 */
function buildAreaTriangle(rng, opts) {
  const base = intBetween(rng, 2, opts.easier ? 8 : 14) * 2; // 積が必ず偶数になるようにする
  const height = intBetween(rng, 3, opts.easier ? 9 : 15);
  const product = base * height;
  const answer = product / 2;

  return {
    pattern: 'e5_area',
    form: 'e5_area_triangle',
    prompt: `底辺 ${base}cm、高さ ${height}cm の三角形の面積は何 cm² ですか。`,
    question: '',
    unit: 'cm²',
    answer: String(answer),
    facts: { base, height, product, answerValue: answer },
    steps: [
      '三角形の面積は 底辺 × 高さ ÷ 2',
      `${base} × ${height} = ${product}、${product} ÷ 2 = ${answer}`,
      `答えは ${answer} cm²`
    ],
    traps: dedupeTraps(
      [
        { value: String(product), reason: 'forgot_half' },
        { value: String(base + height), reason: 'added_not_multiplied' }
      ],
      String(answer)
    )
  };
}

/** たて・よこ・高さ の直方体の体積。 */
function buildVolumeBox(rng, opts) {
  // 答えが4けたを超えないよう、各辺を9までにする
  const max = opts.easier ? 6 : 9;
  const a = intBetween(rng, 2, max);
  const b = intBetween(rng, 2, max);
  const c = intBetween(rng, 2, max);
  const answer = a * b * c;

  return {
    pattern: 'e5_volume',
    form: 'e5_volume_box',
    prompt: `たて ${a}cm、よこ ${b}cm、高さ ${c}cm の直方体の体積は何 cm³ ですか。`,
    question: '',
    unit: 'cm³',
    answer: String(answer),
    facts: { a, b, c, answerValue: answer, bottom: a * b },
    steps: [
      '直方体の体積は たて × よこ × 高さ',
      `${a} × ${b} × ${c} = ${answer}`,
      `答えは ${answer} cm³`
    ],
    traps: dedupeTraps(
      [
        { value: String(a * b), reason: 'bottom_only' },
        { value: String(a + b + c), reason: 'added_not_multiplied' }
      ],
      String(answer)
    )
  };
}

/** 1辺◯cm の立方体の体積。 */
function buildVolumeCube(rng, opts) {
  const a = intBetween(rng, 2, opts.easier ? 6 : 9);
  const answer = a * a * a;

  return {
    pattern: 'e5_volume',
    form: 'e5_volume_cube',
    prompt: `1辺が ${a}cm の立方体の体積は何 cm³ ですか。`,
    question: '',
    unit: 'cm³',
    answer: String(answer),
    facts: { a, answerValue: answer, face: a * a },
    steps: [
      '立方体の体積は 1辺 × 1辺 × 1辺',
      `${a} × ${a} × ${a} = ${answer}`,
      `答えは ${answer} cm³`
    ],
    traps: dedupeTraps(
      [
        { value: String(a * a), reason: 'bottom_only' },
        { value: String(a * 3), reason: 'tripled_not_cubed' }
      ],
      String(answer)
    )
  };
}

// --- 割合・平均・単位量あたり（Lv5） ----------------------------------------

/** 割合に使う「何の」。答えが整数になる数だけを使う。 */
const RATE_ITEMS = [
  { thing: 'リボン', unit: 'cm', whole: 'の長さ' },
  { thing: '水', unit: 'mL', whole: 'の量' },
  { thing: '小麦粉', unit: 'g', whole: 'の重さ' }
];

/** ◯g の ◯% は何 g ですか。 */
function buildPercentOf(rng, opts) {
  const item = pick(rng, RATE_ITEMS);
  const percent = pick(rng, opts.easier ? [10, 20, 50] : [10, 20, 25, 40, 50, 60, 75, 80]);
  // 答えが整数になるよう、100 で割り切れる全体量を選ぶ
  const whole = intBetween(rng, 2, opts.easier ? 6 : 12) * 100;
  const answer = (whole * percent) / 100;

  return {
    pattern: 'e5_rate',
    form: 'e5_percent_of',
    prompt: `${item.thing}が ${whole}${item.unit} あります。その ${percent}% は何 ${item.unit} ですか。`,
    question: '',
    unit: item.unit,
    answer: String(answer),
    facts: { whole, percent, answerValue: answer, rest: whole - answer, unit: item.unit },
    steps: [
      `${percent}% は ${percent / 100} のこと`,
      `${whole} × ${percent} ÷ 100 = ${answer}`,
      `答えは ${answer} ${item.unit}`
    ],
    traps: dedupeTraps(
      [
        { value: String(whole - answer), reason: 'rest_not_part' },
        { value: String(whole * percent), reason: 'forgot_divide' }
      ],
      String(answer)
    )
  };
}

/** ◯人のうち◯人は何%ですか。 */
function buildPercentRate(rng, opts) {
  // 人数も割合も整数になる組み合わせだけを使う。
  // 25人の10%（2.5人）のような問題を作らないため。
  const whole = pick(rng, opts.easier ? [10, 20, 50] : [10, 20, 25, 40, 50]);
  const candidates = [10, 20, 30, 40, 60, 70, 80].filter((p) => (whole * p) % 100 === 0);
  const percent = pick(rng, opts.easier ? candidates.filter((p) => p <= 50) : candidates);
  const part = (whole * percent) / 100;

  return {
    pattern: 'e5_rate',
    form: 'e5_percent_rate',
    prompt: `${whole}人のうち ${part}人がめがねをかけています。全体の何 % ですか。`,
    question: '',
    unit: '%',
    answer: String(percent),
    facts: { whole, part, percent, rest: whole - part },
    steps: [
      'くらべる量 ÷ もとにする量 で割合が出る',
      `${part} ÷ ${whole} = ${percent / 100}`,
      `答えは ${percent} %`
    ],
    traps: dedupeTraps(
      [
        { value: String(part), reason: 'count_not_percent' },
        { value: String(100 - percent), reason: 'rest_not_part' }
      ],
      String(percent)
    )
  };
}

/** 定価◯円の◯%引きはいくらですか。 */
function buildPercentOff(rng, opts) {
  const percent = pick(rng, opts.easier ? [10, 20, 50] : [10, 20, 25, 30, 40]);
  const price = intBetween(rng, 2, opts.easier ? 6 : 9) * 100;
  const discount = (price * percent) / 100;
  const answer = price - discount;

  return {
    pattern: 'e5_rate',
    form: 'e5_percent_off',
    prompt: `${price}円の品物が ${percent}% 引きです。代金は何円ですか。`,
    question: '',
    unit: '円',
    answer: String(answer),
    facts: { price, percent, discount, answerValue: answer },
    steps: [
      `引く分は ${price} × ${percent} ÷ 100 = ${discount}`,
      `${price} - ${discount} = ${answer}`,
      `答えは ${answer} 円`
    ],
    traps: dedupeTraps(
      [
        { value: String(discount), reason: 'discount_not_price' },
        { value: String(price + discount), reason: 'added_not_subtracted' }
      ],
      String(answer)
    )
  };
}

/**
 * テストの点の平均。
 *
 * 平均のまわりに、打ち消し合うずれを置いて作る（-8 と +8 のように）。
 * 最後の1つで帳尻を合わせる作り方だと、その1つだけ 0点 や 120点 になりうる。
 * この作り方なら、どの点も必ず平均 ±10 の中に収まる。
 */
function buildAverageScore(rng, opts) {
  const count = opts.easier ? 3 : pick(rng, [3, 4, 5]);
  const average = intBetween(rng, 8, 17) * 5; // 40 〜 85 点

  // ずれに 0 を使わない。平均そのものが点の中に並ぶと、
  // 計算しなくても答えが読めてしまう。
  // 奇数個のときは、3つ一組（-d, -e, d+e）で打ち消し合わせる。
  const deltas = [];
  let pairs = Math.floor(count / 2);

  if (count % 2 === 1) {
    const d = intBetween(rng, 1, 5);
    const e = intBetween(rng, 1, 5);
    deltas.push(-d, -e, d + e);
    pairs = (count - 3) / 2;
  }

  for (let i = 0; i < pairs; i++) {
    const d = intBetween(rng, 1, 10);
    deltas.push(-d, d);
  }

  const scores = shuffled(rng, deltas).map((d) => average + d);
  const total = scores.reduce((a, b) => a + b, 0);

  return {
    pattern: 'e5_average',
    form: 'e5_average_score',
    prompt: `テストの点が ${scores.join('点、')}点 でした。平均は何点ですか。`,
    question: '',
    unit: '点',
    answer: String(average),
    facts: { scores: scores.join(', '), count, total, average },
    steps: [
      '平均は 合計 ÷ 個数',
      `合計は ${total}、${total} ÷ ${count} = ${average}`,
      `答えは ${average} 点`
    ],
    traps: dedupeTraps(
      [
        { value: String(total), reason: 'not_divided' },
        { value: String(count), reason: 'count_not_average' }
      ],
      String(average)
    )
  };
}

/** 単位量あたり。◯m で◯円のリボンは、1m あたり何円ですか。 */
const PER_UNIT_ITEMS = [
  { thing: 'リボン', per: 'm', unit: '円', ask: '1m あたり何円ですか' },
  { thing: 'ジュース', per: 'L', unit: '円', ask: '1L あたり何円ですか' },
  { thing: '画用紙', per: 'まい', unit: '円', ask: '1まい あたり何円ですか' }
];

function buildPerUnit(rng, opts) {
  const item = pick(rng, PER_UNIT_ITEMS);
  const count = intBetween(rng, 2, opts.easier ? 5 : 9);
  const each = intBetween(rng, 3, opts.easier ? 15 : 60) * 10;
  const total = count * each;

  return {
    pattern: 'e5_average',
    form: 'e5_per_unit',
    prompt: `${item.thing} ${count}${item.per} で ${total}円です。${item.ask}。`,
    question: '',
    unit: item.unit,
    answer: String(each),
    facts: { count, total, each, per: item.per },
    steps: [
      '1つ分を出すので、代金 ÷ 個数',
      `${total} ÷ ${count} = ${each}`,
      `答えは ${each} 円`
    ],
    traps: dedupeTraps(
      [
        { value: String(total * count), reason: 'multiplied_not_divided' },
        { value: String(total), reason: 'total_not_each' }
      ],
      String(each)
    )
  };
}

const BUILDERS = {
  e5_area_rect: buildAreaRect,
  e5_area_square: buildAreaSquare,
  e5_area_triangle: buildAreaTriangle,
  e5_volume_box: buildVolumeBox,
  e5_volume_cube: buildVolumeCube,
  e5_percent_of: buildPercentOf,
  e5_percent_rate: buildPercentRate,
  e5_percent_off: buildPercentOff,
  e5_average_score: buildAverageScore,
  e5_per_unit: buildPerUnit
};

// --- 公開 API -------------------------------------------------------------

export function generate(level, rng, recent = [], opts = {}) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG[4];

  if (opts.pattern && !FORMS_BY_PATTERN[opts.pattern]) {
    throw new Error(`e5/word: 未知の pattern ${opts.pattern}`);
  }
  if (opts.form && !BUILDERS[opts.form]) {
    throw new Error(`e5/word: 未知の form ${opts.form}`);
  }

  const allowed = opts.form
    ? [[opts.form, 1]]
    : opts.pattern
      ? FORMS_BY_PATTERN[opts.pattern].map((f) => [f, 1])
      : null;

  const recentPrompts = recent
    .slice(-3)
    .map((p) => (typeof p === 'string' ? p : p && (p.prompt || p.question)))
    .filter(Boolean);

  // 直近3問と同じ問題を避ける。試行回数は固定で打ち切る。
  let draft = null;
  for (let i = 0; i < 20; i++) {
    const form = allowed
      ? weightedPick(rng, allowed)
      : pickForm(rng, cfg);
    draft = BUILDERS[form](rng, opts);
    if (!recentPrompts.includes(draft.prompt)) break;
  }

  return {
    id: `e5-l${level}-${draft.form}-${hexId(rng)}`,
    level,
    pattern: draft.pattern,
    form: draft.form,
    prompt: draft.prompt,
    question: draft.question,
    unit: draft.unit,
    answer: draft.answer,
    facts: draft.facts,
    steps: draft.steps,
    traps: draft.traps
  };
}

/** そのレベルの pattern を引いてから、その中の form を引く。 */
function pickForm(rng, cfg) {
  const pattern = weightedPick(rng, cfg.patterns);
  return pick(rng, FORMS_BY_PATTERN[pattern]);
}

export function patternsFor(level) {
  const cfg = LEVEL_CONFIG[level];
  return cfg ? cfg.patterns.map(([name]) => name) : [];
}

export function formsFor(pattern) {
  return FORMS_BY_PATTERN[pattern] ? FORMS_BY_PATTERN[pattern].slice() : [];
}
