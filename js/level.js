// 難易度の自動調整（DESIGN.md 6章）。
//
//   直近10問（誤答フロー中の問題は除く）の正答率で判定:
//     正答率 >= 80%  →  level + 1
//     正答率 <= 40%  →  level - 1
//     それ以外       →  変更なし
//
// 守っていること:
//   - レベルは画面に一切出さない。「レベルが上がりました」も出さない
//   - 判定は1セッション中に最大2回まで（急激な変動を避ける）
//   - 10問たまるたびに判定する。セッションをまたいで数え続ける
//   - 判定の回数が上限に達したら、その分は次のセッションに持ち越す
//   - まだ実装されていないレベルには上がらない（ジェネレータの対応範囲で頭打ち）

import { SUPPORTED_LEVELS } from './generators/index.js';

export const MIN_LEVEL = 1;
export const WINDOW = 10;
export const MAX_JUDGEMENTS_PER_SESSION = 2;
export const UP_RATE = 0.8;
export const DOWN_RATE = 0.4;

const MAX_HISTORY = 30;

/** いま出題できる最大のレベル。Phase 6 で Lv3-5 を足すと自動で伸びる。 */
export function highestSupportedLevel() {
  return Math.max(...SUPPORTED_LEVELS);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * 直近の成績から次のレベルを決める純関数。
 *
 * @param {number} level
 * @param {Array<{correct:boolean}>} results 新しいものが後ろ
 * @param {number} [maxLevel]
 */
export function nextLevel(level, results, maxLevel = highestSupportedLevel()) {
  if (!Array.isArray(results) || results.length < WINDOW) return level;

  const window = results.slice(-WINDOW);
  const correct = window.filter((r) => r && r.correct === true).length;
  const rate = correct / window.length;

  if (rate >= UP_RATE) return clamp(level + 1, MIN_LEVEL, maxLevel);
  if (rate <= DOWN_RATE) return clamp(level - 1, MIN_LEVEL, maxLevel);
  return clamp(level, MIN_LEVEL, maxLevel);
}

/**
 * レベルと履歴を持ち、10問ごとに判定を走らせる。
 *
 * @param {object} opts
 * @param {number} opts.level
 * @param {Array} [opts.history]
 * @param {number} [opts.sinceJudge] 前回の判定から何問答えたか
 * @param {number} [opts.maxLevel]
 * @param {boolean} [opts.pinned] true ならレベルを動かさない（開発用の固定）
 */
export function createLevelController({
  level,
  history = [],
  sinceJudge = 0,
  maxLevel = highestSupportedLevel(),
  pinned = false
}) {
  let current = clamp(Number(level) || MIN_LEVEL, MIN_LEVEL, maxLevel);
  let items = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];
  let since = Number.isInteger(sinceJudge) && sinceJudge >= 0 ? sinceJudge : 0;
  let judgements = 0;

  /** セッションの開始時に呼ぶ。判定回数の上限をリセットする。 */
  function startSession() {
    judgements = 0;
  }

  /**
   * 通常フローの問題を1問解き終えたときに呼ぶ。
   * 誤答フロー中の類題・易問は渡さないこと（DESIGN.md 6章）。
   */
  function record(pattern, correct, at = Date.now()) {
    items.push({ pattern, correct: Boolean(correct), at });
    if (items.length > MAX_HISTORY) items = items.slice(-MAX_HISTORY);

    since += 1;
    if (since < WINDOW) return current;

    // 判定の上限に達していたら、たまった分は次のセッションに持ち越す
    if (judgements >= MAX_JUDGEMENTS_PER_SESSION) return current;

    judgements += 1;
    since = 0;
    if (!pinned) current = nextLevel(current, items, maxLevel);
    return current;
  }

  return {
    record,
    startSession,
    getLevel: () => current,
    getHistory: () => items.slice(),
    getSinceJudge: () => since,
    getJudgements: () => judgements
  };
}
