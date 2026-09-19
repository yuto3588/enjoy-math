// 持ち越しキュー（DESIGN.md 7章）。
//
// 誤答フローの STEP3 まで到達した pattern を覚えておき、
// 次のセッションの冒頭で最大3問だけ出し直す。
//
// Phase 3 ではメモリ上にだけ持つ。localStorage への永続化は Phase 5。
//
// 文言・表示の原則:
//   - キューの存在を責める形で見せない（「未解決の問題が2問あります」は書かない）
//   - misses の回数は画面に出さない。内部でのみ使う

/** セッション冒頭に出す持ち越しの上限。 */
export const MAX_AT_SESSION_START = 3;

/** 何回持ち越したらレベルを下げるか。 */
const MISSES_BEFORE_EASING = 3;

/**
 * @param {Array} initial 復元する中身（Phase 5 で localStorage から渡す）
 */
export function createCarryOverQueue(initial = []) {
  let items = [];

  for (const raw of Array.isArray(initial) ? initial : []) {
    if (!raw || typeof raw.pattern !== 'string') continue;
    const level = Number(raw.level);
    items.push({
      pattern: raw.pattern,
      level: Number.isInteger(level) && level >= 1 ? level : 1,
      misses: Number.isInteger(raw.misses) && raw.misses > 0 ? raw.misses : 1
    });
  }

  /**
   * 持ち越しを登録する。すでにあれば misses を増やす。
   *
   * 3回持ち越しても正解できないときは1レベル下げて残す。
   * Lv1 まで下がってなお正解できない場合は、黙ってキューから消す。
   * （毎日「昨日の続き」が増え続けるのは、達成できなかったことへの言及になるため）
   */
  function add(pattern, level) {
    const found = items.find((it) => it.pattern === pattern);

    if (!found) {
      items.push({ pattern, level, misses: 1 });
      return;
    }

    found.misses += 1;
    if (found.misses >= MISSES_BEFORE_EASING) {
      if (found.level > 1) {
        found.level -= 1;
        found.misses = 0;
      } else {
        items = items.filter((it) => it !== found);
      }
    }
  }

  /** 正解できた pattern をキューから外す。 */
  function resolve(pattern) {
    items = items.filter((it) => it.pattern !== pattern);
  }

  /**
   * セッション冒頭に出す分を取り出す。
   * 取り出してもキューからは消えない（正解して初めて resolve される）。
   */
  function take(n = MAX_AT_SESSION_START) {
    return items.slice(0, Math.max(0, n)).map((it) => ({ ...it }));
  }

  /** 中身の写し（保存・表示用）。 */
  function list() {
    return items.map((it) => ({ ...it }));
  }

  function size() {
    return items.length;
  }

  return { add, resolve, take, list, size };
}
