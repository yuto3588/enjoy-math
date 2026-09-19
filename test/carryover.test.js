// 持ち越しキューの単体テスト（DESIGN.md 7章）。

import { test, assert, assertEqual, assertDeepEqual } from './runner.js';
import { createCarryOverQueue, MAX_AT_SESSION_START } from '../js/carryover.js';

test('持ち越し: 登録すると増える', () => {
  const q = createCarryOverQueue();
  assertEqual(q.size(), 0);
  q.add('sub_negative', 2);
  assertEqual(q.size(), 1);
  assertDeepEqual(q.list(), [{ pattern: 'sub_negative', level: 2, misses: 1 }]);
});

test('持ち越し: 同じ pattern を登録しても件数は増えない', () => {
  const q = createCarryOverQueue();
  q.add('sub_negative', 2);
  q.add('sub_negative', 2);
  assertEqual(q.size(), 1, '同じつまずきが二重に積まれている');
  assertEqual(q.list()[0].misses, 2);
});

test('持ち越し: 正解したらキューから消える', () => {
  const q = createCarryOverQueue();
  q.add('sub_negative', 2);
  q.add('add_diff_sign', 1);
  q.resolve('sub_negative');
  assertDeepEqual(q.list().map((it) => it.pattern), ['add_diff_sign']);
});

test('持ち越し: 3回持ち越すと1レベル下がって残る', () => {
  const q = createCarryOverQueue();
  q.add('sub_negative', 2);
  q.add('sub_negative', 2);
  q.add('sub_negative', 2); // 3回目
  assertEqual(q.size(), 1, 'キューから消えてしまった');
  assertEqual(q.list()[0].level, 1, 'レベルが下がっていない');
  assertEqual(q.list()[0].misses, 0, 'カウントがリセットされていない');
});

test('持ち越し: Lv1 でさらに3回持ち越すと黙って消える', () => {
  const q = createCarryOverQueue();
  for (let i = 0; i < 3; i++) q.add('add_diff_sign', 1);
  assertEqual(q.size(), 0, 'Lv1 の持ち越しが永久に残っている');
});

test('持ち越し: 毎日つまずいても件数が増え続けない', () => {
  // 同じ苦手を30日続けても「昨日の続きが30問あるよ」にならないこと。
  const q = createCarryOverQueue();
  for (let day = 0; day < 30; day++) q.add('sub_negative', 2);
  assert(q.size() <= 1, `キューが積み上がっている: ${q.size()}件`);
});

test('持ち越し: セッション冒頭に取り出すのは最大3件', () => {
  const q = createCarryOverQueue();
  for (const p of ['a', 'b', 'c', 'd', 'e']) q.add(p, 2);
  assertEqual(q.take().length, MAX_AT_SESSION_START);
  assertEqual(q.take(2).length, 2);
  assertEqual(q.take(0).length, 0);
});

test('持ち越し: 取り出してもキューからは消えない（正解して初めて消える）', () => {
  const q = createCarryOverQueue();
  q.add('sub_negative', 2);
  q.take();
  assertEqual(q.size(), 1);
  q.resolve('sub_negative');
  assertEqual(q.size(), 0);
});

test('持ち越し: take が返すのは写しで、外から壊せない', () => {
  const q = createCarryOverQueue();
  q.add('sub_negative', 2);
  const taken = q.take();
  taken[0].level = 99;
  assertEqual(q.list()[0].level, 2, 'キューの中身が外から書き換えられた');
});

test('持ち越し: 壊れた中身を渡しても落ちず、使える形に直る', () => {
  const broken = [
    null,
    'ただの文字列',
    { pattern: 'ok', level: 'あ', misses: -5 },
    { level: 2 },
    { pattern: 'sub_negative', level: 2, misses: 1 }
  ];
  const q = createCarryOverQueue(broken);
  assertEqual(q.size(), 2, '取り込める件数が想定と違う');
  for (const it of q.list()) {
    assert(typeof it.pattern === 'string' && it.pattern.length > 0, 'pattern が不正');
    assert(Number.isInteger(it.level) && it.level >= 1, `level が不正: ${it.level}`);
    assert(Number.isInteger(it.misses) && it.misses > 0, `misses が不正: ${it.misses}`);
  }
});

test('持ち越し: 引数なし・配列以外を渡しても落ちない', () => {
  for (const bad of [undefined, null, 0, 'x', { a: 1 }]) {
    const q = createCarryOverQueue(bad);
    assertEqual(q.size(), 0);
  }
});
