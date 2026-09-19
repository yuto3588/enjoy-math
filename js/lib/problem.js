// Problem データ構造の共通ヘルパと不変条件チェック。
// DESIGN.md 4.3 / 4.4 に対応する。

/** 解説の出し分けキー。DESIGN.md 4.4 + Lv1 用に sub_to_negative / add_same_sign を追加。 */
export const PATTERNS = [
  'add_same_sign',     // 同符号の加法（負 + 負）
  'add_diff_sign',     // 異符号の加法で、大きい方の符号を取れない
  'sub_to_negative',   // 小さい数から大きい数を引いて負になる
  'sub_negative',      // 負の数を引くと足し算になる
  'muldiv_sign_count', // 負の因数の個数で符号が決まる（Lv3 以降）
  'power_paren',       // (-2)^2 と -2^2 の区別（Lv4 以降）
  'order_of_ops',      // 累乗・乗除・加減の順序（Lv5 以降）
  'fraction_sign',     // 分数・小数での符号処理（Lv5 以降）

  // --- 小5 ---
  'decimal_mul_int',   // 小数 × 整数
  'decimal_div_int',   // 小数 ÷ 整数
  'decimal_mul_dec',   // 小数 × 小数
  'decimal_div_dec',   // 小数 ÷ 小数
  'fraction_same_den', // 分数の加減（分母が同じ）
  'fraction_diff_den'  // 分数の加減（通分が要る）
];

/**
 * 式の形。誤答フローの「類題」で、つまずいた形と同じ形を出すために使う。
 * pattern だけ揃えても符号の配置が違うと別物になるため、1段細かく持つ。
 */
export const FORMS = [
  // Lv1-2 加減
  'neg_neg',           // (-a) + (-b)
  'neg_first',         // (-a) + b / (-a) - (-b)
  'pos_first',         // a + (-b) / a - (-b)
  'small_minus_large', // a - b （a < b）

  // Lv3 乗除
  'mul2',              // (-4) × 3
  'div2',              // (-24) ÷ (-6)
  'mul3',              // (-2) × (-3) × (-1)

  // Lv4 累乗
  'paren_power',       // (-2)^2
  'bare_power',        // -2^2
  'power_times',       // (-3)^2 × 2

  // Lv5 四則混合
  'add_mul',           // (-6) + (-2) × 3
  'power_mul_add',     // (-6) + (-2)^2 × 3
  'paren_first',       // (7 + (-9)) × 3

  // 小5 小数
  'dec_x_int',         // 1.4 × 3
  'dec_div_int',       // 8.4 ÷ 4
  'dec_x_dec',         // 0.3 × 0.4
  'dec_div_dec',       // 1.2 ÷ 0.4

  // 小5 分数
  'frac_add_same',     // 1/6 + 3/6
  'frac_sub_same',     // 5/6 - 1/6
  'frac_add_diff',     // 1/2 + 1/6
  'frac_sub_diff'      // 3/4 - 1/6
];

/**
 * 答えとして許す形式。マイナスは先頭のみ。
 *   整数     12
 *   小数     1.25
 *   分数     2/3
 * 小数と分数が混ざった形（1.5/2）は作らない。
 */
export const ANSWER_RE = /^-?(\d+(\.\d+)?|\d+\/\d+)$/;

/** -0 を "0" として出す。 */
export function numStr(n) {
  return Object.is(n, -0) ? '0' : String(n);
}

/**
 * 式の中の1項を文字列にする。
 * 負の数は常に括弧で囲む（表記を1つに固定して読み違いを減らす）。
 */
export function term(n) {
  return n < 0 ? `(${numStr(n)})` : numStr(n);
}

/**
 * traps から、答えと同じ値・重複した値を取り除く。
 * ジェネレータ側で重複しないよう作ってあるが、保険として必ず通す。
 */
export function dedupeTraps(traps, answer) {
  const seen = new Set();
  const out = [];
  for (const t of traps) {
    if (t.value === answer) continue;
    if (seen.has(t.value)) continue;
    seen.add(t.value);
    out.push(t);
  }
  return out;
}

/**
 * Problem が満たすべき条件を検査し、違反の説明を配列で返す。
 * 問題がなければ空配列。テストと preview.html から呼ぶ。
 */
export function validateProblem(p) {
  const errors = [];
  const push = (msg) => errors.push(msg);

  if (!p || typeof p !== 'object') return ['Problem がオブジェクトではない'];

  if (typeof p.id !== 'string' || p.id.length === 0) push('id が空');
  if (!Number.isInteger(p.level) || p.level < 1 || p.level > 5) push(`level が不正: ${p.level}`);
  if (!PATTERNS.includes(p.pattern)) push(`未知の pattern: ${p.pattern}`);
  if (!FORMS.includes(p.form)) push(`未知の form: ${p.form}`);

  if (typeof p.question !== 'string' || p.question.trim().length === 0) {
    push('question が空');
  }

  if (typeof p.answer !== 'string' || !ANSWER_RE.test(p.answer)) {
    push(`answer の形式が不正: ${JSON.stringify(p.answer)}`);
  }

  // facts は解説のテンプレートに差し込む値。ジェネレータ側が必ず用意する。
  if (!p.facts || typeof p.facts !== 'object' || Array.isArray(p.facts)) {
    push('facts が無い');
  }

  if (!Array.isArray(p.steps) || p.steps.length === 0) {
    push('steps が空');
  } else {
    if (p.steps.length > 3) push(`steps が3行を超えている: ${p.steps.length}行`);
    p.steps.forEach((s, i) => {
      if (typeof s !== 'string' || s.trim().length === 0) push(`steps[${i}] が空`);
    });
  }

  if (!Array.isArray(p.traps) || p.traps.length === 0) {
    push('traps が1件もない');
  } else {
    const seen = new Set();
    p.traps.forEach((t, i) => {
      if (!t || typeof t !== 'object') return push(`traps[${i}] がオブジェクトではない`);
      if (typeof t.value !== 'string' || !ANSWER_RE.test(t.value)) {
        push(`traps[${i}].value の形式が不正: ${JSON.stringify(t.value)}`);
      }
      if (typeof t.reason !== 'string' || t.reason.trim().length === 0) {
        push(`traps[${i}].reason が空`);
      }
      if (t.value === p.answer) push(`traps[${i}] が正解と同じ値: ${t.value}`);
      if (seen.has(t.value)) push(`traps の value が重複: ${t.value}`);
      seen.add(t.value);
    });
  }

  return errors;
}
