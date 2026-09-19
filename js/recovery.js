// 誤答フローの状態機械。
//
// DESIGN.md 3.4:
//   誤答 → [STEP1] 解説 → [STEP2] 類題 → [STEP3] 易しい問題 → 明日に持ち越し
//
// ここが本アプリで最も壊してはいけない部分なので、
// 「遷移表を持つ純関数」として独立させ、UI から切り離してテストできるようにした。
//
// 守っている性質:
//   - 遷移は一方向のみ。前の STEP に戻る辺が存在しない。
//   - どの入力を与えても、有限回で必ず NORMAL に戻る。
//   - 1つのつまずきに対して追加で出す問題は 2 問まで（元の問題を含めて 3 問）。
//
// while / 再帰で「正解するまで」を表現する構造は、このファイルにも他にも無い。

export const STEP = {
  NORMAL: 'normal',           // 通常の出題
  EXPLAIN: 'explain',         // STEP1: 解説を表示している
  RETRY: 'retry',             // STEP2: 同じ形の類題を出している
  EASIER: 'easier',           // STEP3: より易しい同種問題を出している
  CARRY_OVER: 'carryOver',    // 「ここは明日もう一回やろう」を表示している

  // 持ち越し問題を誤答したとき。解説を1画面出すだけで通常フローに戻る。
  // セッション冒頭でいきなり最大9問の苦手問題を浴びる状態を避けるため、
  // 持ち越し問題からは類題・易問に進めない。
  EXPLAIN_ONLY: 'explainOnly'
};

/** 1つのつまずきに対して追加で出題される問題数の上限。 */
export const MAX_EXTRA_PROBLEMS = 2;

/**
 * 次の状態を返す。
 *
 * @param {string} step     いまの状態
 * @param {boolean} correct 直前の解答が正解だったか（EXPLAIN / CARRY_OVER では無視される）
 * @returns {string} 次の状態
 */
export function nextStep(step, correct) {
  switch (step) {
    case STEP.NORMAL:
      return correct ? STEP.NORMAL : STEP.EXPLAIN;

    case STEP.EXPLAIN:
      // 「わかった」を押す以外の出口を作らない。必ず類題へ進む。
      return STEP.RETRY;

    case STEP.RETRY:
      return correct ? STEP.NORMAL : STEP.EASIER;

    case STEP.EASIER:
      // ここで正解できなくても、それ以上は出さずに持ち越す。
      return correct ? STEP.NORMAL : STEP.CARRY_OVER;

    case STEP.CARRY_OVER:
      // 表示したら必ず通常フローに戻る。
      return STEP.NORMAL;

    case STEP.EXPLAIN_ONLY:
      // 解説を読んだら必ず通常フローに戻る。追加の出題はしない。
      return STEP.NORMAL;

    default:
      return STEP.NORMAL;
  }
}

/** その状態が「問題を出す」状態か。 */
export function isProblemStep(step) {
  return step === STEP.NORMAL || step === STEP.RETRY || step === STEP.EASIER;
}

/**
 * STEP2 の類題の出題条件。
 * つまずいた問題と同じレベル・同じ pattern・同じ式の形にする。
 */
export function retrySpec(origin) {
  return {
    level: origin.level,
    pattern: origin.pattern,
    form: origin.form
  };
}

/**
 * STEP3 の易しい問題の出題条件。
 *
 * DESIGN.md 3.4 は「1レベル下の、より易しい同種問題」としている。
 * ただし Lv3 以降は1レベル下が別の単元になってしまう
 * （Lv3 の乗除に対する Lv2 は加減で、同種ではない）。
 * 「同種であること」の方が本質なので、
 * pattern と式の形は変えず、扱う数だけを易しくする形に統一した。
 * Lv2 の加減であれば、これは実質的に Lv1 の範囲に落ちることと同じになる。
 */
export function easierSpec(origin) {
  return {
    level: origin.level,
    pattern: origin.pattern,
    form: origin.form,
    easier: true
  };
}
