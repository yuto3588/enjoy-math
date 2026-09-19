// 中3 で使う式の書き方をここに集める。
//
// 同じ式が場所によって "x^2+8x+15" だったり "x²＋8x＋15" だったりすると、
// 選択肢と答えの突き合わせが文字列の比較でできなくなる。
// 作る側はこのファイルの関数だけを使い、画面に出すときの見た目の変換
//（^2 → ²、- → −）は keypad.js の forDisplay に任せる。

/** 係数つきの x の項。1x は x、-1x は -x と書く。 */
function xTerm(coef) {
  if (coef === 1) return 'x';
  if (coef === -1) return '-x';
  return `${coef}x`;
}

/** あとに続く項を「 + 3」「 - 3」の形でつなぐ。0 の項は書かない。 */
function joinTerm(value, text) {
  if (value === 0) return '';
  return value > 0 ? ` + ${text}` : ` - ${text}`;
}

/**
 * x² + bx + c の形を文字列にする。
 *   quadStr(8, 15)  → "x^2 + 8x + 15"
 *   quadStr(-8, 15) → "x^2 - 8x + 15"
 *   quadStr(0, -9)  → "x^2 - 9"
 */
export function quadStr(b, c) {
  let s = 'x^2';
  s += joinTerm(b, xTerm(Math.abs(b)));
  s += joinTerm(c, String(Math.abs(c)));
  return s;
}

/**
 * (x + a) の形を文字列にする。
 *   linearStr(3)  → "(x+3)"
 *   linearStr(-5) → "(x-5)"
 */
export function linearStr(a) {
  return a < 0 ? `(x-${Math.abs(a)})` : `(x+${a})`;
}

/**
 * 因数分解した形。同じ因数なら2乗で書く。
 *   factoredStr(3, 5)  → "(x+3)(x+5)"
 *   factoredStr(3, 3)  → "(x+3)^2"
 */
export function factoredStr(a, b) {
  if (a === b) return `${linearStr(a)}^2`;
  return `${linearStr(a)}${linearStr(b)}`;
}

/**
 * 二次方程式の解。小さいほうを先に書き、重解は1つだけ書く。
 *   solutionStr(-3, -2) → "x = -3, -2"
 *   solutionStr(4, 4)   → "x = 4"
 */
export function solutionStr(p, q) {
  if (p === q) return `x = ${p}`;
  const lo = Math.min(p, q);
  const hi = Math.max(p, q);
  return `x = ${lo}, ${hi}`;
}

/** √ の付いた項。a が 1 なら係数を書かない。 */
export function rootStr(coef, inside) {
  if (inside === 1) return String(coef);
  if (coef === 1) return `√${inside}`;
  return `${coef}√${inside}`;
}

/**
 * 選択肢を組み立てる。正解と traps から重複を除き、順番を混ぜる。
 * 正解の位置が偏ると、式を読まずに位置で選べてしまうため必ず混ぜる。
 */
export function buildChoices(rng, answer, traps, count = 4) {
  const seen = new Set([answer]);
  const out = [answer];

  for (const t of traps) {
    if (out.length >= count) break;
    if (seen.has(t.value)) continue;
    seen.add(t.value);
    out.push(t.value);
  }

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** その整数が平方数か。 */
export function isSquare(n) {
  if (n < 0) return false;
  const r = Math.round(Math.sqrt(n));
  return r * r === n;
}
