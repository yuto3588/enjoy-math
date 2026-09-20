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
  'fraction_diff_den', // 分数の加減（通分が要る）
  'e5_area',           // 面積（文章題）
  'e5_volume',         // 体積（文章題）
  'e5_rate',           // 割合（文章題）
  'e5_average',        // 平均・単位量あたり（文章題）

  // --- 中3 ---
  'sqrt_perfect',      // √36
  'sqrt_product',      // √8 × √2
  'sqrt_square',       // (√7)²
  'sqrt_quotient',     // √72 ÷ √2
  'sqrt_coef_square',  // (2√3)²
  'expand_two',        // (x+3)(x+5) の展開
  'expand_square',     // (x+4)² の展開
  'expand_diff',       // (x+5)(x-5) の展開
  'factor_two',        // x² + 8x + 15 の因数分解
  'factor_square',     // x² + 8x + 16 の因数分解
  'factor_diff',       // x² - 25 の因数分解
  'solve_factorable',  // x² + 5x + 6 = 0
  'solve_square',      // x² = 49
  'solve_double'       // x² + 8x + 16 = 0
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
  'frac_sub_diff',     // 3/4 - 1/6

  // 小5 文章題
  'e5_area_rect', 'e5_area_square', 'e5_area_triangle',
  'e5_volume_box', 'e5_volume_cube',
  'e5_percent_of', 'e5_percent_rate', 'e5_percent_off',
  'e5_average_score', 'e5_per_unit',

  // 中3 平方根
  'root_of_square',    // √36
  'root_times_root',   // √8 × √2
  'root_squared',      // (√7)²
  'root_div_root',     // √72 ÷ √2
  'coef_root_squared', // (2√3)²

  // 中3 展開・因数分解
  'prod_two',          // (x+3)(x+5)
  'square_binomial',   // (x+4)²
  'diff_squares',      // (x+5)(x-5)
  'pair_factors',      // x² + 8x + 15
  'square_factors',    // x² + 8x + 16
  'diff_factors',      // x² - 25

  // 中3 二次方程式
  'two_solutions',     // x² + 5x + 6 = 0
  'x_squared_equals',  // x² = 49
  'double_root'        // x² + 8x + 16 = 0
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

  // 式の問題は question に式を持つ。文章題は question が空で、
  // かわりに prompt（日本語の問題文）と unit（答えの単位）を持つ。
  const hasWords = typeof p.prompt === 'string' && p.prompt.trim().length > 0;
  const hasExpr = typeof p.question === 'string' && p.question.trim().length > 0;

  if (!hasWords && !hasExpr) push('question も prompt も空');
  if (p.prompt !== undefined && typeof p.prompt !== 'string') push('prompt が文字列でない');
  if (p.unit !== undefined && typeof p.unit !== 'string') push('unit が文字列でない');

  if (hasWords) {
    if (hasExpr) push('文章題なのに式も入っている（どちらか一方にする）');
    if (!p.prompt.endsWith('。')) push(`問題文が文で終わっていない: ${p.prompt}`);
    // 画面がスクロールしない長さに収める
    if (p.prompt.length > 60) push(`問題文が長すぎる（${p.prompt.length}文字）: ${p.prompt}`);
  }

  // 答え方は2つある。
  //   number  テンキーで数を打つ（中1・小5・中3の平方根）
  //   choice  並んだ式から選ぶ（中3の展開・因数分解・二次方程式）
  // 式そのものが答えになる単元はテンキーでは打てないため。
  const input = p.input || 'number';
  if (input !== 'number' && input !== 'choice') {
    push(`未知の input: ${p.input}`);
  }

  if (input === 'number') {
    if (typeof p.answer !== 'string' || !ANSWER_RE.test(p.answer)) {
      push(`answer の形式が不正: ${JSON.stringify(p.answer)}`);
    }
    if (p.choices !== undefined) push('number なのに choices がある');
  } else {
    if (typeof p.answer !== 'string' || p.answer.trim().length === 0) {
      push('answer が空');
    }
    if (!Array.isArray(p.choices) || p.choices.length < 3 || p.choices.length > 5) {
      push(`choices が 3〜5 件でない: ${p.choices && p.choices.length}`);
    } else {
      const seen = new Set();
      for (const c of p.choices) {
        if (typeof c !== 'string' || c.trim().length === 0) push('choices に空のものがある');
        if (seen.has(c)) push(`choices が重複: ${c}`);
        seen.add(c);
      }
      if (!seen.has(p.answer)) push(`正解が choices に入っていない: ${p.answer}`);
    }
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

      if (input === 'number') {
        if (typeof t.value !== 'string' || !ANSWER_RE.test(t.value)) {
          push(`traps[${i}].value の形式が不正: ${JSON.stringify(t.value)}`);
        }
      } else if (typeof t.value !== 'string' || t.value.trim().length === 0) {
        push(`traps[${i}].value が空`);
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
