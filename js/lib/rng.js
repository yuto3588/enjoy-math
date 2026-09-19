// シード付き乱数。
// ジェネレータを純関数に保つため、乱数は必ず引数で注入する。
// 同じシードからは必ず同じ問題列が出るので、テストで再現できる。

/**
 * mulberry32。seed（符号なし32bit整数）から [0,1) を返す関数を作る。
 */
export function createRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 実行のたびに変わるシード。本番の出題で使う。 */
export function randomSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/** min 以上 max 以下の整数（両端を含む）。 */
export function intBetween(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** 配列から1つ選ぶ。 */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** [[値, 重み], ...] から重み付きで1つ選ぶ。 */
export function weightedPick(rng, entries) {
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = rng() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r < 0) return value;
  }
  return entries[entries.length - 1][0];
}

/** 問題 id の末尾に付ける短いランダム文字列。 */
export function hexId(rng, len = 4) {
  const chars = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(rng() * 16)];
  return s;
}
