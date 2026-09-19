// 小数と分数の計算ヘルパ。
//
// 小数を JavaScript の数値のまま足し引きすると 0.1 + 0.2 が 0.30000000000000004 になる。
// 答えが1桁ずれた問題を出すと、本人には絶対に直しようがない。
// そこで、このファイルでは小数を「整数 ÷ 10^places」の形でしか扱わない。
//   1.4  →  scaled: 14, places: 1
//   0.12 →  scaled: 12, places: 2
// 掛け算は places を足し、割り算は scaled どうしで割り切れるものだけ作る。

/** 10^n。places は 0〜4 しか使わない。 */
export function unit(places) {
  return 10 ** places;
}

/**
 * 「整数 ÷ 10^places」を文字列にする。末尾の 0 は落とす。
 *   decStr(120, 2) → "1.2"
 *   decStr(30, 1)  → "3"
 */
export function decStr(scaled, places) {
  if (!Number.isInteger(scaled)) throw new Error(`decStr: 整数ではない ${scaled}`);
  if (places <= 0) return String(scaled);

  const neg = scaled < 0;
  const abs = Math.abs(scaled);
  const u = unit(places);
  const whole = Math.floor(abs / u);
  const frac = String(abs % u).padStart(places, '0').replace(/0+$/, '');

  const s = frac ? `${whole}.${frac}` : String(whole);
  return neg && s !== '0' ? `-${s}` : s;
}

export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

export function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

/** 約分する。[分子, 分母] を返す。 */
export function reduceFraction(n, d) {
  if (d === 0) throw new Error('reduceFraction: 分母が 0');
  const g = gcd(n, d);
  const sign = d < 0 ? -1 : 1;
  return [(n / g) * sign, Math.abs(d / g)];
}

/** 分数を文字列にする。分母が 1 なら整数として書く。約分はしない。 */
export function fracStr(n, d) {
  if (d === 1) return String(n);
  return `${n}/${d}`;
}

/** 約分したうえで文字列にする。 */
export function reducedFracStr(n, d) {
  const [rn, rd] = reduceFraction(n, d);
  return fracStr(rn, rd);
}

/** すでに約分されているか。 */
export function isReduced(n, d) {
  return gcd(n, d) === 1;
}

function stripLeadingZeros(v) {
  return v.replace(/^0+(?=\d)/, '');
}

/**
 * 入力された答えを、比較できる形にそろえる。
 *
 * "2.50" と "2.5"、"02" と "2" は同じ答えとして扱う。
 * 分数の約分だけはしない。4/6 と 2/3 を同じにすると、
 * 「約分を忘れた」という、いちばん拾いたいつまずきが見分けられなくなる。
 */
export function normalizeAnswer(text) {
  let s = String(text == null ? '' : text).trim();
  if (s === '') return '';

  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);

  if (s.includes('/')) {
    const [n, d] = s.split('/');
    s = `${stripLeadingZeros(n)}/${stripLeadingZeros(d)}`;
  } else if (s.includes('.')) {
    const [w, f] = s.split('.');
    const trimmed = f.replace(/0+$/, '');
    s = trimmed ? `${stripLeadingZeros(w)}.${trimmed}` : stripLeadingZeros(w);
  } else {
    s = stripLeadingZeros(s);
  }

  if (s === '' || s === '0') return '0';
  return neg ? `-${s}` : s;
}
