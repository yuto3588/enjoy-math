// 学年 → 問題ジェネレータ一式の振り分け。
//
// 学年ごとに扱う単元がまったく違うので、レベル 1-5 の中身も学年ごとに別物になる。
//   小5  小数の×÷ / 分数の+- / 割合 / 平均 / 面積・体積
//   中1  正負の数
//   中3  展開・因数分解 / 平方根 / 二次方程式
//
// ここに載っていない学年は「じゅんび中」として、選べるが始められない状態で出す。
// 選択肢だけ先に見せておくと、あとから足したときに置き場所が変わらない。
//
// 学年ごとに使うキーも違うので、各コースが KEYPAD で宣言する
//（中1はマイナス、小5は小数点と分数の線）。

import * as j1 from './generators/index.js';
import * as e5 from './generators/e5/index.js';
import * as j3 from './generators/j3/index.js';

const COURSES = {
  e5,
  j1,
  j3
};

/** その学年の問題を作る一式。まだ無ければ null。 */
export function courseFor(grade) {
  return COURSES[grade] || null;
}

/** その学年の問題がもう作れるか。 */
export function isCourseReady(grade) {
  return Boolean(COURSES[grade]);
}

/** 問題を作れる学年の一覧（テスト用）。 */
export function readyGrades() {
  return Object.keys(COURSES);
}
