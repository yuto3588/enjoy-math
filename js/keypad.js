// 自作テンキー。
//
// iOS のソフトキーボードを絶対に出さないため、
// input / textarea / contenteditable を一切使わない。
// 値はこのモジュールが JS 側で持ち、表示は div の textContent に書くだけ。

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
 * @param {HTMLElement} opts.mount     キーを並べる要素（.keypad）
 * @param {number} [opts.maxDigits=3]  入力できる桁数
 * @param {Function} opts.onChange     値が変わるたびに呼ばれる (value:string) => void
 * @param {Function} opts.onSubmit     決定が押されたときに呼ばれる (value:string) => void
 */
export function createKeypad({ mount, maxDigits = 3, onChange, onSubmit }) {
  let digits = '';
  let negative = false;
  let enabled = true;

  const LAYOUT = [
    { key: '7' }, { key: '8' }, { key: '9' }, { key: 'del', label: '⌫', cls: 'fn' },
    { key: '4' }, { key: '5' }, { key: '6' }, { key: 'sign', label: '−', cls: 'fn' },
    { key: '1' }, { key: '2' }, { key: '3' },
    { key: 'submit', label: '決定', cls: 'submit' },
    { key: '0', cls: 'zero' }
  ];

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
    b.addEventListener('click', () => press(spec.key));
    mount.appendChild(b);
    buttons.set(spec.key, b);
  }

  function value() {
    if (digits === '') return negative ? '-' : '';
    if (digits === '0') return '0'; // -0 を作らない
    return (negative ? '-' : '') + digits;
  }

  /** 決定を押せる状態か（数字が1桁以上入っているか）。 */
  function isComplete() {
    return digits !== '';
  }

  function emitChange() {
    if (onChange) onChange(value());
    const submit = buttons.get('submit');
    if (submit) submit.disabled = !isComplete();
  }

  function press(key) {
    if (!enabled) return;

    if (key === 'del') {
      if (digits !== '') digits = digits.slice(0, -1);
      else negative = false;
      return emitChange();
    }

    if (key === 'sign') {
      negative = !negative;
      return emitChange();
    }

    if (key === 'submit') {
      if (!isComplete()) return; // 空のまま押しても何も起きない
      if (onSubmit) onSubmit(value());
      return;
    }

    // 数字
    if (digits === '0') digits = key;          // 先頭の 0 は置き換える
    else if (digits.length < maxDigits) digits += key;
    emitChange();
  }

  function clear() {
    digits = '';
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
