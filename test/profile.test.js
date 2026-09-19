// 学年プロファイルとコース振り分けの単体テスト。
//
// 学年を足していく作業で壊しやすいところを見張る:
//   - 学年の id がぶつかっていないか（ぶつかると記録が混ざる）
//   - 既定の学年が実在するか（起動時の引き継ぎ先になる）
//   - まだ作っていない学年が「作れる」と誤って答えないか

import { test, assert, assertEqual } from './runner.js';
import { GRADES, DEFAULT_GRADE, isGrade, gradeLabel } from '../js/profile.js';
import { courseFor, isCourseReady } from '../js/courses.js';

test('学年: 小5・中1・中3の3つがある', () => {
  assertEqual(GRADES.length, 3);
  for (const id of ['e5', 'j1', 'j3']) {
    assert(GRADES.some((g) => g.id === id), `${id} が無い`);
  }
});

test('学年: id が重複していない', () => {
  const ids = GRADES.map((g) => g.id);
  assertEqual(new Set(ids).size, ids.length, 'id がぶつかっている（記録が混ざる）');
});

test('学年: どの学年にも画面に出す名前がある', () => {
  for (const g of GRADES) {
    assert(typeof g.label === 'string' && g.label.length > 0, `${g.id} に名前が無い`);
    assertEqual(gradeLabel(g.id), g.label);
  }
});

test('学年: 既定の学年は実在する', () => {
  assert(isGrade(DEFAULT_GRADE), '既定の学年が一覧に無い');
});

test('学年: 知らない値は学年として受け付けない', () => {
  for (const bad of [null, undefined, '', 'x', '中1', 1, {}, []]) {
    assertEqual(isGrade(bad), false, `通ってしまった: ${String(bad)}`);
  }
  assertEqual(gradeLabel('x9'), '');
});

test('コース: 中1は問題を作れる', () => {
  assertEqual(isCourseReady('j1'), true);
  const course = courseFor('j1');
  assert(course && typeof course.generate === 'function', 'generate が無い');
});

test('コース: まだ無い学年は、作れると答えない', () => {
  for (const id of GRADES.map((g) => g.id)) {
    if (id === 'j1') continue;
    if (isCourseReady(id)) {
      // 足したあとは、ちゃんと generate を持っていること
      assert(typeof courseFor(id).generate === 'function', `${id} に generate が無い`);
    } else {
      assertEqual(courseFor(id), null, `${id} は未実装なのに何か返ってくる`);
    }
  }
});

test('コース: 知らない学年を渡されても落ちない', () => {
  for (const bad of [null, undefined, '', 'x9', 1, {}]) {
    assertEqual(courseFor(bad), null, `落ちるか変な値を返した: ${String(bad)}`);
    assertEqual(isCourseReady(bad), false);
  }
});
