// 誤答パターン別の解説（DESIGN.md 5.2）。
//
// 入力された誤答が traps のいずれかに一致したら、
// 汎用の steps ではなく、そのつまずき専用の解説を出す。
//
// テンプレートに差し込む数値は、ジェネレータが Problem.facts に入れて渡す。
// ここで question を解析し直すことはしない（3項・累乗・括弧が入ると
// 式の再解析は間違えやすく、ジェネレータと二重に実装することになるため）。
//
// 文言の原則（CLAUDE.md）:
//   - 評価語を使わない。「残念」「おしい」「間違い」は書かない
//   - 一般論から始めず、いま間違えたこの問題の手順を書く
//   - 3行以内

const TEMPLATES = {
  // --- Lv1-2 加減 ---

  'add_same_sign:sign_dropped': (f, answer) => [
    'マイナスどうしを足すと、答えもマイナスになる',
    `${f.A} + ${f.B} = ${f.sum}`,
    `符号はマイナス → ${answer}`
  ],
  'add_same_sign:subtracted_instead': (f, answer) => [
    '符号が同じときは、引くのではなく足す',
    `${f.A} + ${f.B} = ${f.sum}`,
    `符号はマイナス → ${answer}`
  ],

  'add_diff_sign:sign_of_larger_missed': (f, answer) => [
    '符号が違うときは、絶対値が大きい方の符号になる',
    `絶対値が大きいのは ${f.biggerTerm}`,
    `だから答えは ${answer}`
  ],
  'add_diff_sign:added_absolutes': (f, answer) => [
    '符号が違うときは、足すのではなく引く',
    `${f.hi} - ${f.lo} = ${f.d}`,
    `符号は${f.biggerNegative ? 'マイナス' : 'プラス'} → ${answer}`
  ],

  'sub_to_negative:sign_dropped': (f, answer) => [
    `${f.A} から ${f.B} は引けないので、答えはマイナス側`,
    `${f.B} - ${f.A} = ${f.d}`,
    `符号はマイナス → ${answer}`
  ],
  'sub_to_negative:added_instead': (f, answer) => [
    'これは引き算。足すのではない',
    `${f.B} - ${f.A} = ${f.d}`,
    `符号はマイナス → ${answer}`
  ],

  'sub_negative:sign_flip_missed': (f, answer) => [
    '引く数がマイナスのとき、符号が2つ重なって + になる',
    `${f.aTerm} - (${f.bTerm}) は ${f.aTerm} + ${f.B}`,
    `答えは ${answer}`
  ],
  'sub_negative:sign_dropped': (f, answer) => [
    `-(${f.bTerm}) は +${f.B} になる`,
    `でも最初の ${f.aTerm} はマイナスのまま`,
    `答えは ${answer}`
  ],
  'sub_negative:reversed_order': (f, answer) => [
    `-(${f.bTerm}) は +${f.B} になる`,
    `${f.A} + ${f.B} の順で計算する`,
    `答えは ${answer}`
  ],

  // --- Lv3 乗除 ---

  'muldiv_sign_count:sign_count_wrong': (f, answer) => [
    '符号は、マイナスの個数で決まる',
    `マイナスは ${f.negCount}個。${f.negCount % 2 === 0 ? '偶数なのでプラス' : '奇数なのでマイナス'}`,
    `答えは ${answer}`
  ],
  'muldiv_sign_count:added_instead': (f, answer) => [
    `これは${f.opWord}。足すのではない`,
    f.absExpr,
    `答えは ${answer}`
  ],

  // --- Lv4 累乗 ---

  'power_paren:paren_ignored': (f, answer) => [
    `括弧が付いているので、マイナスも一緒に${f.exp}回かける`,
    `(-${f.base})^${f.exp} = ${f.signedPower}`,
    `答えは ${answer}`
  ],
  'power_paren:paren_assumed': (f, answer) => [
    `括弧が無いので、${f.base} だけを${f.exp}回かける`,
    `${f.base}^${f.exp} = ${f.powerValue}、マイナスは後から付ける`,
    `答えは ${answer}`
  ],
  'power_paren:power_as_multiplication': (f, answer) => [
    `${f.base}^${f.exp} は ${f.base} × ${f.exp} ではない`,
    `${f.base} を${f.exp}回かけて ${f.powerValue}`,
    `答えは ${answer}`
  ],

  // --- Lv5 四則混合 ---

  'order_of_ops:left_to_right': (f, answer) => [
    `左から順ではなく、${f.firstWord}を先に計算する`,
    f.stepExpr,
    `答えは ${answer}`
  ],
  'order_of_ops:paren_ignored': (f, answer) => [
    '括弧の中を先に計算する',
    f.stepExpr,
    `答えは ${answer}`
  ],
  'order_of_ops:power_sign_ignored': (f, answer) => [
    '括弧の付いた累乗は、マイナスも一緒にかける',
    f.stepExpr,
    `答えは ${answer}`
  ],
  'order_of_ops:sign_slip': (f, answer) => [
    '計算の順番は合っている。符号を確かめる',
    f.stepExpr,
    `答えは ${answer}`
  ],

  // --- 小5 小数 ---

  'decimal_mul_int:point_dropped': (f, answer) => [
    `${f.intA} × ${f.n} = ${f.intProduct} まで合っている`,
    `${f.aText} は小数点より下が1けたなので、答えも1けた分もどす`,
    `答えは ${answer}`
  ],
  'decimal_mul_int:point_shifted': (f, answer) => [
    'もどすけた数は、かけられる数と同じだけ',
    `${f.aText} は小数点より下が1けた。答えも1けた`,
    `答えは ${answer}`
  ],

  'decimal_div_int:point_dropped': (f, answer) => [
    `${f.intDividend} ÷ ${f.n} = ${f.intQuotient} まで合っている`,
    `小数点は ${f.aText} と同じ位置に打つ`,
    `答えは ${answer}`
  ],
  'decimal_div_int:point_shifted': (f, answer) => [
    '割り算では小数点の位置は動かない',
    `${f.aText} の小数点の真上に打つ`,
    `答えは ${answer}`
  ],

  'decimal_mul_dec:point_count_wrong': (f, answer) => [
    '小数点より下のけた数は、2つを足した数',
    `${f.aText} が1けた、${f.bText} が1けた。合わせて2けた`,
    `答えは ${answer}`
  ],
  'decimal_mul_dec:point_dropped': (f, answer) => [
    `${f.intA} × ${f.intB} = ${f.intProduct} まで合っている`,
    '小数点より下は 1けた + 1けた で2けた分もどす',
    `答えは ${answer}`
  ],

  'decimal_div_dec:point_shifted': (f, answer) => [
    '割る数と割られる数を、両方とも同じだけ10倍する',
    `${f.intA} ÷ ${f.intB} と同じになる`,
    `答えは ${answer}`
  ],
  'decimal_div_dec:multiplied_instead': (f, answer) => [
    'これは割り算。かけるのではない',
    `${f.intA} ÷ ${f.intB} と同じ`,
    `答えは ${answer}`
  ],

  // --- 小5 分数 ---

  'fraction_same_den:not_reduced': (f, answer) => [
    `${f.rawText} まで合っている`,
    `分子と分母を ${f.divisor} で割れる`,
    `約分して ${answer}`
  ],
  'fraction_same_den:denominator_added': (f, answer) => [
    '分母は足さない。分母が同じときは分子だけを計算する',
    `${f.x} + ${f.y} = ${f.total} で ${f.rawText}`,
    `約分して ${answer}`
  ],
  'fraction_same_den:operation_flipped': (f, answer) => [
    'これは引き算。足すのではない',
    `${f.x} - ${f.y} = ${f.total} で ${f.rawText}`,
    `約分して ${answer}`
  ],

  'fraction_diff_den:denominator_added': (f, answer) => [
    '分母は足さない。同じ分母にそろえてから分子を計算する',
    f.alignedText,
    `答えは ${answer}`
  ],
  'fraction_diff_den:not_aligned': (f, answer) => [
    `分母が ${f.d1} と ${f.d2} で違うので、そのままでは計算できない`,
    `${f.lcmValue} にそろえて ${f.alignedText}`,
    `答えは ${answer}`
  ],
  'fraction_diff_den:not_reduced': (f, answer) => [
    `${f.rawText} まで合っている`,
    '分子と分母を同じ数で割れるときは、最後まで約分する',
    `答えは ${answer}`
  ]
};

/** テンプレートが用意されている pattern:reason の一覧（テスト用）。 */
export function templateKeys() {
  return Object.keys(TEMPLATES);
}

/**
 * 解説の行を返す。
 * 入力が traps に一致し、専用のテンプレートがあればそれを優先する。
 * なければ汎用の steps をそのまま返す。
 *
 * @param {object} problem
 * @param {string} submitted 入力された答え
 * @returns {{lines: string[], matched: string|null}}
 */
export function explanationFor(problem, submitted) {
  const trap = (problem.traps || []).find((t) => t.value === submitted);
  if (trap) {
    const template = TEMPLATES[`${problem.pattern}:${trap.reason}`];
    if (template && problem.facts) {
      return { lines: template(problem.facts, problem.answer), matched: trap.reason };
    }
  }
  return { lines: problem.steps.slice(), matched: null };
}
