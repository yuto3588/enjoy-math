// 自作テンキー。
//
// iOS のソフトキーボードを絶対に出さないため、
// input / textarea / contenteditable を一切使わない。
// 値はこのモジュールが JS 側で持ち、表示は div の textContent に書くだけ。
//
// 学年によって要るキーが違う。
//   中1  マイナス（負の数）
//   小5  小数点と分数の線
// 使わないキーは並べない。押しても意味のないキーがあると、
// どれを押せばいいのかを考える手間が増えるため。

/**
 * 内部の値（ASCII）を画面表示用に変換する。
 *   -  → −（U+2212 MINUS SIGN。ハイフンより横棒が長く、数式として読みやすい）
 *   ^2 → ²、^3 → ³（教科書と同じ上付き表記）
 */
export function forDisplay(text) {
  return String(text)
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/-/g, '−');
}

/**
 * テンキーを組み立てる。
 *
 * @param {object} opts
 * @param {HTMLElement} opts.mount      キーを並べる要素（.keypad）
 * @param {number} [opts.maxDigits=3]   1つのまとまりに入力できる桁数
 *                                      （分数なら分子と分母それぞれ）
 * @param {boolean} [opts.sign=true]    マイナスのキーを出すか
 * @param {boolean} [opts.dot=false]    小数点のキーを出すか
 * @param {boolean} [opts.slash=false]  分数の線のキーを出すか
 * @param {Function} opts.onChange      値が変わるたびに呼ばれる (value:string) => void
 * @param {Function} opts.onSubmit      決定が押されたときに呼ばれる (value:string) => void
 */
export function createKeypad({
  mount,
  maxDigits = 3,
  sign = true,
  dot = false,
  slash = false,
  onChange,
  onSubmit
}) {
  let text = '';        // 符号を除いた入力（"12", "1.5", "2/3"）
  let negative = false;
  let enabled = true;

  // 4列 × 4段。右端の列に機能キーを置き、最下段に 0 を置くのは共通。
  // 出すキーだけを、上から順に詰めていく。
  const LAYOUT = [
    { key: '7' }, { key: '8' }, { key: '9' }, { key: 'del', label: '⌫', cls: 'fn' },
    { key: '4' }, { key: '5' }, { key: '6' },
    ...(sign ? [{ key: 'sign', label: '−', cls: 'fn' }] : []),
    ...(slash ? [{ key: 'slash', label: '/', cls: 'fn' }] : []),
    { key: '1' }, { key: '2' }, { key: '3' },
    { key: 'submit', label: '決定', cls: 'submit' },
    { key: '0', cls: dot ? 'zero-narrow' : 'zero' },
    // クラス名は point。dot は終了画面の「点」で使っているので衝突させない。
    ...(dot ? [{ key: 'dot', label: '.', cls: 'fn point' }] : [])
  ];

  mount.innerHTML = '';
  const buttons = new Map();

  for (const spec of LAYOUT) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key' + (spec.cls ? ' ' + spec.cls : '');
    b.textContent = spec.label || spec.key;
    b.dataset.key = spec.key;
    // 画面読み上げ用（本人は使わないが、記号キーの意味を明示しておく）
    if (spec.key === 'del') b.setAttribute('aria-label', '1文字消す');
    if (spec.key === 'sign') b.setAttribute('aria-label', 'マイナス');
    if (spec.key === 'dot') b.setAttribute('aria-label', '小数点');
    if (spec.key === 'slash') b.setAttribute('aria-label', '分数の線');
    b.addEventListener('click', () => press(spec.key));
    mount.appendChild(b);
    buttons.set(spec.key, b);
  }

  function value() {
    if (text === '') return negative ? '-' : '';
    if (text === '0') return '0'; // -0 を作らない
    return (negative ? '-' : '') + text;
  }

  /** いま入力している部分（分数なら分母側）。 */
  function tail() {
    const i = text.lastIndexOf('/');
    return i < 0 ? text : text.slice(i + 1);
  }

  /** 決定を押せる状態か。数字で終わっていること。 */
  function isComplete() {
    if (text === '') return false;
    if (!/\d$/.test(text)) return false;          // "1." や "2/" のままでは押せない
    if (text.includes('/') && tail() === '0') return false; // 分母が 0
    return true;
  }

  function emitChange() {
    if (onChange) onChange(value());
    const submit = buttons.get('submit');
    if (submit) submit.disabled = !isComplete();
  }

  function press(key) {
    if (!enabled) return;

    if (key === 'del') {
      if (text !== '') text = text.slice(0, -1);
      else negative = false;
      return emitChange();
    }

    if (key === 'sign') {
      negative = !negative;
      return emitChange();
    }

    if (key === 'dot') {
      // 小数点は1つだけ。分数と混ぜない。数字のあとにしか置けない。
      if (text === '' || text.includes('.') || text.includes('/')) return;
      text += '.';
      return emitChange();
    }

    if (key === 'slash') {
      // 分数の線は1つだけ。小数と混ぜない。数字のあとにしか置けない。
      if (text === '' || text.includes('/') || text.includes('.')) return;
      if (!/\d$/.test(text)) return;
      text += '/';
      return emitChange();
    }

    if (key === 'submit') {
      if (!isComplete()) return; // 中途半端なまま押しても何も起きない
      if (onSubmit) onSubmit(value());
      return;
    }

    // 数字
    const segment = tail();
    if (segment === '0') {
      // 先頭の 0 は置き換える（"05" を作らない）。"0." の 0 は残す。
      text = text.slice(0, text.length - 1) + key;
    } else if (countDigits(segment) < maxDigits) {
      text += key;
    }
    emitChange();
  }

  function countDigits(s) {
    return (s.match(/\d/g) || []).length;
  }

  function clear() {
    text = '';
    negative = false;
    emitChange();
  }

  function setEnabled(next) {
    enabled = next;
    for (const [key, b] of buttons) {
      b.disabled = !next || (next && key === 'submit' && !isComplete());
    }
  }

  emitChange();

  return { value, clear, setEnabled, isComplete };
}
