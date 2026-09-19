// 学年プロファイル。
//
// 子どもが3人いて、それぞれが自分の端末でこのアプリを使う。
// 「この端末は誰のものか」を1つだけ持ち、学習の記録は学年ごとに分けて保存する。
// 分けないと、下の子が解いた結果で上の子のレベルが動き、
// 持ち越しの問題も混ざってしまう。
//
// 学年を画面に出すことについて:
//   CLAUDE.md が禁じているのは レベル・正答率・順位・他者比較 の表示。
//   学年は本人の事実であって序列ではないので、出してよい。
//   ただし「中1なのに小5をやっている」と読める見せ方はしない
//   （他の学年の進み具合を並べて見せない、選び直しを咎めない）。

export const GRADES = [
  { id: 'e5', label: '小5' },
  { id: 'j1', label: '中1' },
  { id: 'j3', label: '中3' }
];

/** 学年が決まっていないときに使う既定。学年を分ける前の記録はここへ引き継ぐ。 */
export const DEFAULT_GRADE = 'j1';

export function isGrade(id) {
  return GRADES.some((g) => g.id === id);
}

export function gradeLabel(id) {
  const g = GRADES.find((x) => x.id === id);
  return g ? g.label : '';
}
