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
  ],

  // --- 小5 面積・体積 ---

  'e5_area:perimeter_not_area': (f, answer) => [
    'それは まわりの長さ。ここで聞かれているのは面積',
    f.b ? `面積は たて × よこ で ${f.a} × ${f.b}` : `面積は 1辺 × 1辺 で ${f.a} × ${f.a}`,
    `答えは ${answer} cm²`
  ],
  'e5_area:added_not_multiplied': (f, answer) => [
    '面積を出すときは、足すのではなくかける',
    f.base ? `${f.base} × ${f.height} ÷ 2` : `${f.a} × ${f.b}`,
    `答えは ${answer} cm²`
  ],
  'e5_area:doubled_not_squared': (f, answer) => [
    '2倍ではなく、同じ数を2回かける',
    `${f.a} × ${f.a} = ${answer}`,
    `答えは ${answer} cm²`
  ],
  'e5_area:forgot_half': (f, answer) => [
    `${f.product} は長方形にしたときの面積`,
    '三角形はその半分なので、2で割る',
    `${f.product} ÷ 2 = ${answer}`
  ],

  'e5_volume:bottom_only': (f, answer) => [
    'それは1つの面の広さ',
    f.b ? `体積は たて × よこ × 高さ で ${f.a} × ${f.b} × ${f.c}` : `体積は ${f.a} を3回かける`,
    `答えは ${answer} cm³`
  ],
  'e5_volume:added_not_multiplied': (f, answer) => [
    '体積を出すときは、足すのではなくかける',
    `${f.a} × ${f.b} × ${f.c} = ${answer}`,
    `答えは ${answer} cm³`
  ],
  'e5_volume:tripled_not_cubed': (f, answer) => [
    '3倍ではなく、同じ数を3回かける',
    `${f.a} × ${f.a} × ${f.a} = ${answer}`,
    `答えは ${answer} cm³`
  ],

  // --- 小5 割合 ---

  'e5_rate:rest_not_part': (f, answer) => [
    'それは残りのほう',
    f.price !== undefined
      ? `引く分は ${f.discount}、代金は ${f.price} - ${f.discount}`
      : `聞かれているのは ${f.percent}% にあたる分`,
    `答えは ${answer}`
  ],
  'e5_rate:forgot_divide': (f, answer) => [
    '% は 100 を全体とした言い方',
    `${f.whole} × ${f.percent} のあと、100 で割る`,
    `答えは ${answer}`
  ],
  'e5_rate:count_not_percent': (f, answer) => [
    'それは人数。聞かれているのは割合',
    `${f.part} ÷ ${f.whole} を計算して、100 をかける`,
    `答えは ${answer} %`
  ],
  'e5_rate:discount_not_price': (f, answer) => [
    `${f.discount} は引く分`,
    `代金は ${f.price} - ${f.discount}`,
    `答えは ${answer} 円`
  ],
  'e5_rate:added_not_subtracted': (f, answer) => [
    '「引き」なので、代金は安くなる',
    `${f.price} - ${f.discount} = ${answer}`,
    `答えは ${answer} 円`
  ],

  // --- 小5 平均・単位量あたり ---

  'e5_average:not_divided': (f, answer) => [
    `${f.total} は合計`,
    `平均は 合計 ÷ 個数。${f.total} ÷ ${f.count}`,
    `答えは ${answer}`
  ],
  'e5_average:count_not_average': (f, answer) => [
    'それは個数',
    `平均は 合計 ÷ 個数。${f.total} ÷ ${f.count}`,
    `答えは ${answer}`
  ],
  'e5_average:multiplied_not_divided': (f, answer) => [
    '1つ分を出すので、かけるのではなく割る',
    `${f.total} ÷ ${f.count} = ${answer}`,
    `答えは ${answer} 円`
  ],
  'e5_average:total_not_each': (f, answer) => [
    `${f.total} は全部の代金`,
    `1つ分は ${f.total} ÷ ${f.count}`,
    `答えは ${answer} 円`
  ],

  // --- 中3 平方根 ---

  'sqrt_perfect:halved': (f, answer) => [
    '√ は「半分にする」ではない',
    `2乗して ${f.n} になる数をさがす`,
    `${f.root} × ${f.root} = ${f.n} なので ${answer}`
  ],
  'sqrt_perfect:root_not_taken': (f, answer) => [
    '√ を外すところまでやる',
    `${f.root} × ${f.root} = ${f.n}`,
    `答えは ${answer}`
  ],

  'sqrt_product:root_not_taken': (f, answer) => [
    `√の中をかけて ${f.product} までは合っている`,
    `√${f.product} はまだ外せる`,
    `${f.root} × ${f.root} = ${f.product} なので ${answer}`
  ],
  'sqrt_product:added_instead': (f, answer) => [
    'これはかけ算。√の中どうしをかける',
    `${f.a} × ${f.b} = ${f.product}`,
    `√${f.product} = ${answer}`
  ],

  'sqrt_square:squared_twice': (f, answer) => [
    `2乗するのは √${f.n} であって ${f.n} ではない`,
    `√${f.n} × √${f.n} = ${f.n}`,
    `答えは ${answer}`
  ],
  'sqrt_square:doubled': (f, answer) => [
    '2乗は「2倍」ではなく「2回かける」',
    `√${f.n} × √${f.n} = ${f.n}`,
    `答えは ${answer}`
  ],

  'sqrt_quotient:root_not_taken': (f, answer) => [
    `√の中を割って ${f.quotient} までは合っている`,
    `√${f.quotient} はまだ外せる`,
    `${f.root} × ${f.root} = ${f.quotient} なので ${answer}`
  ],
  'sqrt_quotient:subtracted_instead': (f, answer) => [
    'これは割り算。√の中どうしを割る',
    `${f.a} ÷ ${f.b} = ${f.quotient}`,
    `√${f.quotient} = ${answer}`
  ],

  'sqrt_coef_square:coef_not_squared': (f, answer) => [
    `外の ${f.coef} も2乗する`,
    `${f.coef}^2 = ${f.coefSquared}、それに ${f.inside} をかける`,
    `答えは ${answer}`
  ],
  'sqrt_coef_square:inside_squared': (f, answer) => [
    `√${f.inside} を2乗すると ${f.inside}。${f.inside}^2 にはならない`,
    `${f.coefSquared} × ${f.inside}`,
    `答えは ${answer}`
  ],

  // --- 中3 展開 ---

  'expand_two:sum_product_swapped': (f, answer) => [
    'x の係数が「足した数」、最後の数が「かけた数」',
    `足すと ${f.sum}、かけると ${f.product}`,
    `答えは ${answer}`
  ],
  'expand_two:middle_missing': (f, answer) => [
    'x の項が消えてしまっている',
    `${f.a} と ${f.b} を足した ${f.sum} が x の係数になる`,
    `答えは ${answer}`
  ],
  'expand_two:constant_sign_wrong': (f, answer) => [
    `最後の数は ${f.a} × ${f.b}`,
    `${f.a} × ${f.b} = ${f.product}`,
    `答えは ${answer}`
  ],
  'expand_square:middle_missing': (f, answer) => [
    '2乗しても、真ん中の項は消えない',
    `x の係数は ${f.a} を2倍して ${f.twice}`,
    `答えは ${answer}`
  ],
  'expand_square:coef_not_doubled': (f, answer) => [
    `真ん中の項は ${f.a} が2回出てくるので2倍する`,
    `${f.a} × 2 = ${f.twice}`,
    `答えは ${answer}`
  ],
  'expand_square:constant_not_squared': (f, answer) => [
    `最後の数は ${f.a} を2乗する`,
    `${f.a}^2 = ${f.squared}`,
    `答えは ${answer}`
  ],
  'expand_square:middle_sign_wrong': (f, answer) => [
    `真ん中の項の符号は ${f.a} と同じ`,
    `${f.a} × 2 = ${f.twice}`,
    `答えは ${answer}`
  ],

  'expand_diff:constant_sign_wrong': (f, answer) => [
    `最後の数は ${f.a} × ${-f.a}`,
    `プラスとマイナスをかけるのでマイナスになる`,
    `答えは ${answer}`
  ],
  'expand_diff:middle_left': (f, answer) => [
    `x の係数は ${f.a} と ${-f.a} を足すので 0`,
    'x の項は消える',
    `答えは ${answer}`
  ],
  'expand_diff:constant_not_squared': (f, answer) => [
    `最後の数は ${f.a} を2乗する`,
    `${f.a}^2 = ${f.squared}`,
    `答えは ${answer}`
  ],

  // --- 中3 因数分解 ---

  'factor_two:sign_flipped': (f, answer) => [
    '2つとも符号を逆にすると、かけた数は同じでも足した数が逆になる',
    `足して ${f.sum} になるのは ${f.a} と ${f.b}`,
    `答えは ${answer}`
  ],
  'factor_two:one_sign_wrong': (f, answer) => [
    `かけると ${f.product} にならない`,
    `${f.a} × ${f.b} = ${f.product}、${f.a} + ${f.b} = ${f.sum}`,
    `答えは ${answer}`
  ],
  'factor_two:sum_wrong': (f, answer) => [
    `かけ算は合っているが、足すと ${f.sum} にならない`,
    `${f.a} + ${f.b} = ${f.sum}`,
    `答えは ${answer}`
  ],
  'factor_two:sum_product_swapped': (f, answer) => [
    'かっこに入るのは、足した数とかけた数ではない',
    `かけて ${f.product}、足して ${f.sum} になる ${f.a} と ${f.b}`,
    `答えは ${answer}`
  ],

  'factor_square:sign_flipped': (f, answer) => [
    `真ん中が ${f.twice > 0 ? '+' : '-'}${Math.abs(f.twice)}x なので、2つの数はどちらも${f.a > 0 ? 'プラス' : 'マイナス'}`,
    `${f.a} + ${f.a} = ${f.twice}`,
    `答えは ${answer}`
  ],
  'factor_square:one_sign_wrong': (f, answer) => [
    `かけると ${f.squared} にならない`,
    `${f.a} × ${f.a} = ${f.squared}`,
    `答えは ${answer}`
  ],
  'factor_square:sum_wrong': (f, answer) => [
    `かけ算は合っているが、足すと ${f.twice} にならない`,
    `${f.a} + ${f.a} = ${f.twice}`,
    `答えは ${answer}`
  ],
  'factor_square:sum_product_swapped': (f, answer) => [
    'かっこに入るのは、足した数とかけた数ではない',
    `どちらも ${f.a} になる`,
    `答えは ${answer}`
  ],

  'factor_diff:sign_flipped': (f, answer) => [
    `最後の数が ${-f.squared} なので、2つの数の符号は違う`,
    `${f.a} × ${-f.a} = ${-f.squared}`,
    `答えは ${answer}`
  ],
  'factor_diff:sign_flipped_both': (f, answer) => [
    `${-f.a} を2回かけると +${f.squared} になってしまう`,
    `${f.a} と ${-f.a} を組み合わせる`,
    `答えは ${answer}`
  ],
  'factor_diff:sum_wrong': (f, answer) => [
    'かけ算は合っているが、足すと 0 にならない',
    `${f.a} + ${-f.a} = 0`,
    `答えは ${answer}`
  ],

  // --- 中3 二次方程式 ---

  'solve_factorable:sign_flipped': (f, answer) => [
    `${f.factored} = 0 まで分けられる`,
    'かっこの中が 0 になる x をさがすので、符号は逆になる',
    `答えは ${answer}`
  ],
  'solve_factorable:one_sign_wrong': (f, answer) => [
    `${f.factored} = 0 まで分けられる`,
    'どちらのかっこも、中が 0 になる x を出す',
    `答えは ${answer}`
  ],
  'solve_factorable:sum_product_used': (f, answer) => [
    `足した数とかけた数（${f.sum} と ${f.product}）は解ではない`,
    `${f.factored} = 0 から出す`,
    `答えは ${answer}`
  ],

  'solve_square:negative_missing': (f, answer) => [
    `2乗して ${f.n} になる数は2つある`,
    `${-f.r} を2乗しても ${f.n} になる`,
    `答えは ${answer}`
  ],
  'solve_square:root_not_taken': (f, answer) => [
    `x そのものではなく、x を2乗した数が ${f.n}`,
    `${f.r} × ${f.r} = ${f.n}`,
    `答えは ${answer}`
  ],
  'solve_square:halved': (f, answer) => [
    '2乗は「2倍」ではないので、半分にしても戻らない',
    `${f.r} × ${f.r} = ${f.n}`,
    `答えは ${answer}`
  ],
  'solve_square:positive_missing': (f, answer) => [
    `2乗して ${f.n} になる数は2つある`,
    `${f.r} を2乗しても ${f.n} になる`,
    `答えは ${answer}`
  ],

  'solve_double:two_solutions_assumed': (f, answer) => [
    `かけて ${f.squared}、足して ${f.twice} になるのは ${f.a} が2回`,
    '同じ数が2回なので、解は1つだけ',
    `答えは ${answer}`
  ],
  'solve_double:sign_flipped': (f, answer) => [
    'かっこの中が 0 になる x をさがすので、符号は逆になる',
    `${f.a} の符号を逆にする`,
    `答えは ${answer}`
  ],
  'solve_double:sum_product_used': (f, answer) => [
    `足した数とかけた数（${f.twice} と ${f.squared}）は解ではない`,
    `どちらのかっこも ${f.a} なので、解は1つ`,
    `答えは ${answer}`
  ],
  'solve_double:doubled': (f, answer) => [
    `かっこに入る数は ${f.a} で、${f.twice} ではない`,
    `${f.a} + ${f.a} = ${f.twice} だから真ん中が ${f.twice}x になる`,
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
