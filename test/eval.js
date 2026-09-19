// テスト専用の式評価器。
//
// ジェネレータのコードを一切使わずに question を独立に計算し、
// answer と突き合わせるために使う。
// ここでジェネレータのロジックを再利用してしまうと、
// 同じ間違いを両側でして「テストが通ってしまう」ので必ず独立に書く。
//
// 対応する文法（Lv1-5）:
//   expr    := term (('+' | '-') term)*
//   term    := unary (('×' | '÷') unary)*
//   unary   := '-' unary | power
//   power   := primary ('^' 整数)?
//   primary := 整数 | '(' expr ')'
//
// 単項マイナスは累乗より弱く結びつく。つまり
//   -2^2   は -(2^2) = -4
//   (-2)^2 は 4
// になる。Lv4 の中心はこの区別なので、評価器側でも正しく扱う必要がある。

export function evaluateExpression(expr) {
  if (typeof expr !== 'string') throw new Error(`式が文字列でない: ${expr}`);

  const tokens = tokenize(expr);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const expect = (t) => {
    if (peek() !== t) throw new Error(`"${t}" が来るはずの場所に "${peek()}" があった: ${expr}`);
    return next();
  };

  function parseExpr() {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = next();
      const rhs = parseTerm();
      value = op === '+' ? value + rhs : value - rhs;
    }
    return value;
  }

  function parseTerm() {
    let value = parseUnary();
    while (peek() === '×' || peek() === '÷') {
      const op = next();
      const rhs = parseUnary();
      if (op === '×') {
        value = value * rhs;
      } else {
        if (rhs === 0) throw new Error(`0 で割っている: ${expr}`);
        if (value % rhs !== 0) throw new Error(`割り切れない: ${expr}`);
        value = value / rhs;
      }
    }
    return value;
  }

  function parseUnary() {
    if (peek() === '-') {
      next();
      return -parseUnary();
    }
    return parsePower();
  }

  function parsePower() {
    const base = parsePrimary();
    if (peek() === '^') {
      next();
      const exp = parsePrimary();
      if (!Number.isInteger(exp) || exp < 0) throw new Error(`指数が不正: ${expr}`);
      return base ** exp;
    }
    return base;
  }

  function parsePrimary() {
    const t = peek();
    if (t === '(') {
      next();
      const value = parseExpr();
      expect(')');
      return value;
    }
    if (typeof t === 'number') return next();
    throw new Error(`評価できないトークン "${t}": ${expr}`);
  }

  const result = parseExpr();
  if (pos !== tokens.length) {
    throw new Error(`式の末尾が余っている（${tokens.length - pos}トークン）: ${expr}`);
  }
  return result;
}

const SYMBOLS = new Set(['+', '-', '×', '÷', '^', '(', ')']);

function tokenize(expr) {
  const out = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) { i += 1; continue; }

    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < expr.length && /[0-9]/.test(expr[j])) j += 1;
      out.push(Number(expr.slice(i, j)));
      i = j;
      continue;
    }

    if (SYMBOLS.has(ch)) {
      out.push(ch);
      i += 1;
      continue;
    }

    throw new Error(`読めない文字 "${ch}": ${expr}`);
  }
  return out;
}

/**
 * 式に現れる数値をすべて返す。Lv1-2 の絶対値チェック用。
 * 累乗や括弧が入ると「項」の意味が変わるので、Lv3 以降では使わない。
 */
export function operandsOf(expr) {
  return (expr.match(/-?\d+/g) || []).map(Number);
}
