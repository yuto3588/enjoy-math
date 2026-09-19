// タイマーの単体テスト（DESIGN.md 8章）。
// 時計と表示状態を差し替えて、実時間を待たずに検証する。

import { test, assert, assertEqual } from './runner.js';
import { createTimer, remainingLabel } from '../js/timer.js';

/** 手で進められる時計と、手で切り替えられる表示状態を持つタイマーを作る。 */
function makeHarness(minutes, opts = {}) {
  let clock = 0;
  let visible = true;
  let expired = 0;
  const ticks = [];

  const timer = createTimer({
    durationMs: minutes * 60 * 1000,
    onTick: (remaining) => ticks.push(remaining),
    onExpire: () => { expired += 1; },
    now: () => clock,
    isVisible: () => visible,
    ...opts
  });

  return {
    timer,
    ticks,
    expiredCount: () => expired,
    hide: () => { visible = false; },
    show: () => { visible = true; },
    /** dt ミリ秒進めて 1 回 tick させる。 */
    advance(dt) { clock += dt; timer.tick(); },
    setClock(v) { clock = v; }
  };
}

test('タイマー: 経過した分だけ減る', () => {
  const h = makeHarness(10);
  h.timer.resume();
  h.advance(60 * 1000);
  assertEqual(h.timer.remainingMs(), 9 * 60 * 1000);
  h.advance(30 * 1000);
  assertEqual(h.timer.remainingMs(), 8.5 * 60 * 1000);
});

test('タイマー: 開始していなければ減らない', () => {
  const h = makeHarness(10);
  h.advance(5 * 60 * 1000);
  assertEqual(h.timer.remainingMs(), 10 * 60 * 1000);
});

test('タイマー: バックグラウンドに回っている間は減らない', () => {
  const h = makeHarness(10);
  h.timer.resume();

  h.advance(60 * 1000);
  assertEqual(h.timer.remainingMs(), 9 * 60 * 1000);

  h.hide();
  h.advance(30 * 60 * 1000); // 30分ほったらかす
  assertEqual(h.timer.remainingMs(), 9 * 60 * 1000, '見ていない間に時間が減った');

  h.show();
  h.advance(60 * 1000);
  assertEqual(h.timer.remainingMs(), 8 * 60 * 1000, '戻ってきた後に進まない');
});

test('タイマー: 一時停止している間は減らない', () => {
  const h = makeHarness(10);
  h.timer.resume();
  h.advance(60 * 1000);

  h.timer.pause();
  h.advance(10 * 60 * 1000); // 席を10分離れる
  assertEqual(h.timer.remainingMs(), 9 * 60 * 1000, '休憩中に時間が減った');

  h.timer.resume();
  h.advance(60 * 1000);
  assertEqual(h.timer.remainingMs(), 8 * 60 * 1000);
});

test('タイマー: 0 を下回らない', () => {
  const h = makeHarness(10);
  h.timer.resume();
  h.advance(60 * 60 * 1000);
  assertEqual(h.timer.remainingMs(), 0);
});

test('タイマー: onExpire は1回しか呼ばれない', () => {
  const h = makeHarness(10);
  h.timer.resume();
  h.advance(10 * 60 * 1000);
  assertEqual(h.expiredCount(), 1);

  h.advance(60 * 1000);
  h.advance(60 * 1000);
  assertEqual(h.expiredCount(), 1, '時間切れが繰り返し発火している');
});

test('タイマー: 時間切れの後に resume しても再開しない', () => {
  const h = makeHarness(10);
  h.timer.resume();
  h.advance(10 * 60 * 1000);
  assert(h.timer.isExpired(), '時間切れになっていない');

  h.timer.resume();
  assert(!h.timer.isRunning(), '時間切れ後に動き出した');
});

test('タイマー: 時計が巻き戻っても残り時間が増えない', () => {
  const h = makeHarness(10);
  h.timer.resume();
  h.advance(60 * 1000);
  const before = h.timer.remainingMs();

  h.setClock(0); // 端末の時刻がずれた想定
  h.timer.tick();
  assert(h.timer.remainingMs() <= before, '残り時間が増えた');
});

// --- 表示 ------------------------------------------------------------------

test('残り時間の表示: 分だけを出す（秒を刻まない）', () => {
  assertEqual(remainingLabel(10 * 60 * 1000), 'のこり 10分');
  assertEqual(remainingLabel(9 * 60 * 1000 + 59 * 1000), 'のこり 10分');
  assertEqual(remainingLabel(9 * 60 * 1000), 'のこり 9分');
  assertEqual(remainingLabel(61 * 1000), 'のこり 2分');
});

test('残り時間の表示: 1分を下回っても「0分」とは出さない', () => {
  assertEqual(remainingLabel(30 * 1000), 'のこり 1分');
  assertEqual(remainingLabel(0), 'のこり 1分');
});

test('残り時間の表示: 秒・コロン・パーセントを含まない', () => {
  for (const ms of [0, 1000, 59_000, 60_000, 600_000, 3_600_000]) {
    const label = remainingLabel(ms);
    assert(!label.includes(':'), `時計表記になっている: ${label}`);
    assert(!label.includes('秒'), `秒を出している: ${label}`);
    assert(!label.includes('%'), `割合を出している: ${label}`);
  }
});
