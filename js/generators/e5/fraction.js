// 小5 Lv4-5 の分数ジェネレータ（加法・減法）。
//
// 答えは必ず「1未満の既約分数」にする。
//   - 帯分数（1と1/4）を作らないので、入力欄が分子と分母の2つで済む
//   - 申告の形が1通りに決まるので、正誤の判定と解説が単純になる
//
// つまずきの中心は
//   1. 分母どうしを足してしまう（1/2 + 1/6 = 2/8）
//   2. 通分せずに分子だけ計算する
//   3. 約分を忘れる（4/6 のまま出す）
// なので、traps はこの3つから作る。
//
// 約分を忘れた答えを正解にしてしまうと、いちばん拾いたいつまずきを
// 見逃すことになるので、答えは既約の形だけを正解とする。
//
// 出題の候補は、条件を満たす組み合わせをあらかじめ全部並べておく。
// 乱数を引いてから条件を確かめて引き直す形にすると、
// 条件が厳しい組み合わせで回り続けることになるため。

import { intBetween, weightedPick, hexId } from '../../lib/rng.js';
import { gcd, lcm, reduceFraction, fracStr, reducedFracStr } from '../../lib/num.js';
import { dedupeTraps } from '../../lib/problem.js';

const LEVEL_CONFIG = {
  4: { patterns: [['fraction_same_den', 10]] },
  5: { patterns: [['fraction_diff_den', 10]] }
};

const FORMS_BY_PATTERN = {
  fraction_same_den: ['frac_add_same', 'frac_sub_same'],
  fraction_diff_den: ['frac_add_diff', 'frac_sub_diff']
};

export const SUPPORTED_LEVELS = [4, 5];

function pick(rng, list) {
  return list[intBetween(rng, 0, list.length - 1)];
}

// --- 出題候補の下ごしらえ ---------------------------------------------------

/**
 * 分母が同じ組み合わせ。
 * 答えが約分できるものだけ残す（「約分を忘れた」を必ず traps に置けるようにする）。
 */
function sameDenCandidates(dens, isAdd) {
  const out = [];
  for (const d of dens) {
    for (let x = 1; x < d; x++) {
      for (let y = 1; y < d; y++) {
        const total = isAdd ? x + y : x - y;
        if (total <= 0 || total >= d) continue;   // 答えは1未満の真分数だけ
        if (gcd(total, d) === 1) continue;        // 約分できるものだけ
        out.push({ d, x, y, total });
      }
    }
  }
  return out;
}

/**
 * 分母が違う組み合わせ。
 * traps を1件も作れない組み合わせはここで外す
 *（引き算で、分子をそのまま引くこともできず、約分も要らない場合）。
 */
function diffDenCandidates(dens, isAdd, maxLcm) {
  const out = [];
  for (const d1 of dens) {
    for (const d2 of dens) {
      if (d1 === d2) continue;
      const L = lcm(d1, d2);
      if (L > maxLcm) continue;

      for (let x = 1; x < d1; x++) {
        if (gcd(x, d1) !== 1) continue;           // 出題の時点で既約にしておく
        for (let y = 1; y < d2; y++) {
          if (gcd(y, d2) !== 1) continue;

          const nx = x * (L / d1);
          const ny = y * (L / d2);
          const total = isAdd ? nx + ny : nx - ny;
          if (total <= 0 || total >= L) continue; // 答えは1未満の真分数だけ

          const keptDen = Math.max(d1, d2);
          const naive = isAdd ? x + y : x - y;
          const naiveOk = naive > 0 && naive < keptDen;
          const reducible = gcd(total, L) !== 1;
          if (!isAdd && !naiveOk && !reducible) continue;

          out.push({ d1, d2, x, y, L, nx, ny, total, keptDen, naive, naiveOk, reducible });
        }
      }
    }
  }
  return out;
}

const SAME_DEN = {
  add: sameDenCandidates([6, 8, 9, 10, 12], true),
  sub: sameDenCandidates([6, 8, 9, 10, 12], false),
  addEasy: sameDenCandidates([4, 6, 8], true),
  subEasy: sameDenCandidates([4, 6, 8], false)
};

const DIFF_DEN = {
  add: diffDenCandidates([2, 3, 4, 5, 6, 8, 10, 12], true, 24),
  sub: diffDenCandidates([2, 3, 4, 5, 6, 8, 10, 12], false, 24),
  addEasy: diffDenCandidates([2, 3, 4, 6], true, 12),
  subEasy: diffDenCandidates([2, 3, 4, 6], false, 12)
};

function bucket(table, isAdd, easier) {
  return table[isAdd ? (easier ? 'addEasy' : 'add') : (easier ? 'subEasy' : 'sub')];
}

// --- 組み立て ---------------------------------------------------------------

/** 分母が同じ分数の加減。1/6 + 3/6 = 4/6 = 2/3 */
function buildSameDen(rng, opts, form) {
  const isAdd = form ? form === 'frac_add_same' : rng() < 0.5;
  const { d, x, y, total } = pick(rng, bucket(SAME_DEN, isAdd, opts.easier));

  const answer = reducedFracStr(total, d);
  const [rn, rd] = reduceFraction(total, d);
  const opSign = isAdd ? '+' : '-';
  const divisor = gcd(total, d);

  const traps = [{ value: fracStr(total, d), reason: 'not_reduced' }];
  if (isAdd) {
    traps.push({ value: fracStr(x + y, d + d), reason: 'denominator_added' });
  } else {
    const flipped = x + y;  // 引き算を足し算と取り違えた
    if (flipped < d) traps.push({ value: reducedFracStr(flipped, d), reason: 'operation_flipped' });
  }

  return {
    pattern: 'fraction_same_den',
    form: isAdd ? 'frac_add_same' : 'frac_sub_same',
    question: `${x}/${d} ${opSign} ${y}/${d}`,
    answer,
    facts: {
      d, x, y, total, rn, rd, divisor,
      rawText: fracStr(total, d),
      reducedText: answer,
      opSign,
      opWord: isAdd ? '足し算' : '引き算'
    },
    steps: [
      '分母が同じなので、分子だけを計算する',
      `${x} ${opSign} ${y} = ${total} で ${fracStr(total, d)}`,
      `${divisor} で約分して ${answer}`
    ],
    traps: dedupeTraps(traps, answer)
  };
}

/** 分母が違う分数の加減。1/2 + 1/6 → 3/6 + 1/6 = 4/6 = 2/3 */
function buildDiffDen(rng, opts, form) {
  const isAdd = form ? form === 'frac_add_diff' : rng() < 0.5;
  const c = pick(rng, bucket(DIFF_DEN, isAdd, opts.easier));

  const answer = reducedFracStr(c.total, c.L);
  const opSign = isAdd ? '+' : '-';

  const traps = [];
  if (isAdd) {
    // 分母どうしを足してしまう（1/2 + 1/6 = 2/8）
    traps.push({ value: fracStr(c.x + c.y, c.d1 + c.d2), reason: 'denominator_added' });
  }
  if (c.naiveOk) {
    // 通分せずに分子だけ計算し、分母は大きいほうを使う
    traps.push({ value: fracStr(c.naive, c.keptDen), reason: 'not_aligned' });
  }
  if (c.reducible) {
    // 通分まではできたが、約分を忘れた
    traps.push({ value: fracStr(c.total, c.L), reason: 'not_reduced' });
  }

  return {
    pattern: 'fraction_diff_den',
    form: isAdd ? 'frac_add_diff' : 'frac_sub_diff',
    question: `${c.x}/${c.d1} ${opSign} ${c.y}/${c.d2}`,
    answer,
    facts: {
      d1: c.d1, d2: c.d2, x: c.x, y: c.y,
      lcmValue: c.L, nx: c.nx, ny: c.ny, total: c.total,
      alignedText: `${c.nx}/${c.L} ${opSign} ${c.ny}/${c.L}`,
      rawText: fracStr(c.total, c.L),
      reducedText: answer,
      opSign,
      opWord: isAdd ? '足し算' : '引き算'
    },
    steps: [
      `分母を ${c.L} にそろえる`,
      `${c.nx}/${c.L} ${opSign} ${c.ny}/${c.L} = ${fracStr(c.total, c.L)}`,
      c.reducible ? `約分して ${answer}` : `答えは ${answer}`
    ],
    traps: dedupeTraps(traps, answer)
  };
}

const BUILDERS = {
  fraction_same_den: buildSameDen,
  fraction_diff_den: buildDiffDen
};

// --- 公開 API -------------------------------------------------------------

export function generate(level, rng, recent = [], opts = {}) {
  const base = LEVEL_CONFIG[level] || LEVEL_CONFIG[4];

  if (opts.pattern && !BUILDERS[opts.pattern]) {
    throw new Error(`e5/fraction: 未知の pattern ${opts.pattern}`);
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
    draft = BUILDERS[pattern](rng, opts, opts.form || null);
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
