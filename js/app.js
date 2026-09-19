// 画面遷移・セッション制御。
//
// Phase 5 までの範囲:
//   ホーム（時間選択）→ 問題（タイマー・休憩・やめる）→ 終了
//   誤答したら 解説 → 類題 → 易しい問題 → 明日に持ち越し（最大3手で必ず終了）
//   誤答が traps に一致したら、そのつまずき専用の解説を優先表示
//   持ち越しキューと成績を localStorage に保存し、次回に引き継ぐ
//   通常フローの問題が10問たまるたびに難易度を自動調整
//
// Phase 5 では作らないもの:
//   - Lv3-5 の出題（乗除・累乗・四則混合） … Phase 6
//   - PWA 化                                … Phase 7
//
// 画面に出さないもの（内部では持っている）:
//   レベル / 正答率 / 連続日数 / 累計学習時間 / 前回の点数

import { createRng, randomSeed } from './lib/rng.js';
import { generate } from './generators/index.js';
import { createKeypad, forDisplay } from './keypad.js';
import { STEP, nextStep, retrySpec, easierSpec } from './recovery.js';
import { explanationFor } from './explain.js';
import { createCarryOverQueue, MAX_AT_SESSION_START } from './carryover.js';
import { createTimer, remainingLabel } from './timer.js';
import { createLevelController } from './level.js';
import { load, save, clear, defaultState } from './storage.js';

const params = new URLSearchParams(location.search);

// --- 開発用のパラメータ（本番の操作では使わない） -------------------------
//   ?level=1..5  レベルを固定する（自動調整を止める）
//   ?minutes=1   時間ボタンの値を上書きする（時間切れの確認用）
//   ?reset=1     保存内容を消して起動する
//   ?newday=1    「今日はまだやっていない」状態にして起動する（持ち越し表示の確認用）
const LEVEL_OVERRIDE = (() => {
  const raw = Number(params.get('level'));
  return Number.isInteger(raw) && raw >= 1 && raw <= 5 ? raw : null;
})();
const MINUTES_OVERRIDE = (() => {
  const raw = Number(params.get('minutes'));
  return Number.isFinite(raw) && raw > 0 ? raw : null;
})();

const FLASH_MS = 600;

// 学習量を自宅 PC のサーバーに残すための宛先（保護者が確認するため）。
// 送るのは 日付 / 選んだ時間 / 解いた問題数 だけ。正誤も点数も送らない。
// 宛先は同じ配信元の相対パスのみ。外部には一切送らない。
// サーバーが応答しないとき（オフライン、GitHub Pages など）は黙って諦める。
const LOG_ENDPOINT = './_log';

const el = {
  home: document.getElementById('screen-home'),
  practice: document.getElementById('screen-practice'),
  done: document.getElementById('screen-done'),
  carryNote: document.getElementById('carryNote'),
  stage: document.getElementById('stage'),
  question: document.getElementById('question'),
  answerBox: document.getElementById('answerBox'),
  keypad: document.getElementById('keypad'),
  progressFill: document.getElementById('progressFill'),
  remain: document.getElementById('remain'),
  pauseBtn: document.getElementById('pauseBtn'),
  quitBtn: document.getElementById('quitBtn'),
  tick: document.getElementById('tick'),
  doneDots: document.getElementById('doneDots'),
  doneCount: document.getElementById('doneCount'),
  doneNote: document.getElementById('doneNote'),
  homeBtn: document.getElementById('homeBtn'),
  overlay: document.getElementById('overlay'),
  overlayExpr: document.getElementById('overlayExpr'),
  overlayLines: document.getElementById('overlayLines'),
  overlayBtn: document.getElementById('overlayBtn'),
  pausePanel: document.getElementById('pausePanel'),
  resumeBtn: document.getElementById('resumeBtn'),
  quitFromPauseBtn: document.getElementById('quitFromPauseBtn')
};

// --- 保存内容の読み込み ---------------------------------------------------
// load() は何が起きても必ず使える状態を返す。ここで落ちることはない。

const stored = (() => {
  if (params.get('reset') === '1') {
    clear();
    return defaultState();
  }
  const s = load();
  if (params.get('newday') === '1') s.sessions = [];
  return s;
})();

const rng = createRng(randomSeed());
const queue = createCarryOverQueue(stored.carryOver);
const sessions = stored.sessions;
const levels = createLevelController({
  level: LEVEL_OVERRIDE || stored.level,
  history: stored.history,
  sinceJudge: stored.sinceJudge,
  pinned: Boolean(LEVEL_OVERRIDE)
});

/**
 * いまの状態をまるごと保存する。失敗しても何も起きない。
 *
 * ?level= でレベルを固定して開いているときは、そのレベルを保存しない。
 * 開発用に覗いただけで、本来の学習の記録が上書きされてしまうため。
 */
function persist() {
  save({
    level: LEVEL_OVERRIDE ? stored.level : levels.getLevel(),
    sinceJudge: levels.getSinceJudge(),
    history: levels.getHistory(),
    carryOver: queue.list(),
    sessions
  });
}

const state = {
  step: STEP.NORMAL,
  current: null,
  origin: null,      // つまずいた元の問題。類題・易問の条件をここから引き継ぐ
  fromCarryOver: false,
  recent: [],
  solved: 0,         // 通常フローで片付いた問題数。誤答フロー中の問題は数えない
  pending: [],       // セッション冒頭に出す持ち越し
  minutes: 0,
  timer: null,
  timeUp: false,
  logged: false      // その回の学習量をもう記録したか
};

const keypad = createKeypad({
  mount: el.keypad,
  maxDigits: 3,
  onChange: (value) => {
    el.answerBox.textContent = forDisplay(value);
  },
  onSubmit: handleSubmit
});

// --- 画面 -----------------------------------------------------------------

function showScreen(name) {
  el.home.classList.toggle('active', name === 'home');
  el.practice.classList.toggle('active', name === 'practice');
  el.done.classList.toggle('active', name === 'done');
}

function updateProgress(remainingMs, durationMs) {
  const ratio = durationMs > 0 ? 1 - remainingMs / durationMs : 0;
  el.progressFill.style.width = `${Math.min(1, Math.max(0, ratio)) * 100}%`;
}

/** 全面パネルを出す。lines は3行以内。 */
function openOverlay({ expr = '', lines, buttonLabel, message = false }) {
  el.overlayExpr.textContent = expr ? forDisplay(expr) : '';
  el.overlay.classList.toggle('message', message);

  el.overlayLines.innerHTML = '';
  lines.forEach((text, i) => {
    const li = document.createElement('li');
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = String(i + 1);
    const body = document.createElement('span');
    body.textContent = forDisplay(text);
    li.append(n, body);
    el.overlayLines.appendChild(li);
  });

  el.overlayBtn.textContent = buttonLabel;
  el.overlay.classList.add('active');
}

function closeOverlay() {
  el.overlay.classList.remove('active');
}

/**
 * 式を表示する。1行に収まらない長い式（Lv5 の四則混合など）は
 * 文字を段階的に小さくして必ず1行に収める。折り返すと式として読めなくなるため。
 */
function showQuestion(text) {
  el.question.style.fontSize = '';
  el.question.textContent = forDisplay(text);

  const base = parseFloat(getComputedStyle(el.question).fontSize);
  for (let size = base; size > 20; size -= 2) {
    if (el.question.scrollWidth <= el.question.clientWidth) break;
    el.question.style.fontSize = `${size - 2}px`;
  }
}

// --- ホーム ---------------------------------------------------------------

function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function hasSessionToday() {
  return sessions.some((s) => s.date === todayKey());
}

function showHome() {
  // 持ち越しがあるときだけ、小さく知らせる。
  // その日すでに1回やっていたら出さない（「まだ残ってる」と言われる形を避ける）。
  const n = queue.size();
  el.carryNote.textContent =
    n > 0 && !hasSessionToday() ? `昨日の続きが${n}問あるよ` : '';

  showScreen('home');
}

// --- 出題 -----------------------------------------------------------------

/** いまの状態に応じた出題条件を決める。 */
function specForCurrentStep() {
  if (state.step === STEP.RETRY) return retrySpec(state.origin);
  if (state.step === STEP.EASIER) return easierSpec(state.origin);

  // 通常フロー。セッション冒頭の持ち越しが残っていればそれを先に出す。
  const carried = state.pending.shift();
  if (carried) {
    return { level: carried.level, pattern: carried.pattern, carried: true };
  }
  return { level: levels.getLevel() };
}

function nextProblem() {
  const spec = specForCurrentStep();

  state.current = generate(spec.level, rng, state.recent, {
    pattern: spec.pattern,
    form: spec.form,
    easier: spec.easier
  });
  state.fromCarryOver = Boolean(spec.carried);

  state.recent.push(state.current);
  if (state.recent.length > 3) state.recent.shift();

  showQuestion(state.current.question);
  keypad.clear();
  keypad.setEnabled(true);
}

// --- 解答 -----------------------------------------------------------------

function handleSubmit(value) {
  if (!isAnswering()) return;

  const correct = value === state.current.answer;
  keypad.setEnabled(false);

  if (correct) onCorrect();
  else onWrong(value);
}

function isAnswering() {
  return state.step === STEP.NORMAL || state.step === STEP.RETRY || state.step === STEP.EASIER;
}

/**
 * 難易度調整の材料にするのは通常フローの1回目の解答だけ。
 * 誤答フロー中の類題・易問は記録しない（DESIGN.md 6章）。
 */
function recordResult(correct) {
  levels.record(state.current.pattern, correct);
}

function onCorrect() {
  const from = state.step;

  if (from === STEP.NORMAL) recordResult(true);

  // 誤答フローから戻ってきた、または持ち越し問題に正解したら、キューから外す。
  if (from === STEP.RETRY || from === STEP.EASIER) queue.resolve(state.origin.pattern);
  else if (state.fromCarryOver) queue.resolve(state.current.pattern);

  state.step = nextStep(from, true);
  state.origin = null;
  persist();

  // 正解のフィードバック。言葉は出さない（褒め言葉は子供扱いに読まれるため）。
  // 印と色だけを 0.6 秒動かす。テンポは変えない。
  el.stage.classList.add('flash');
  el.answerBox.classList.add('ok');
  el.tick.classList.remove('on');
  void el.tick.offsetWidth; // 連続で正解しても毎回動かすため、いったん止める
  el.tick.classList.add('on');

  setTimeout(() => {
    el.stage.classList.remove('flash');
    el.answerBox.classList.remove('ok');
    el.tick.classList.remove('on');
    advance();
  }, FLASH_MS);
}

function onWrong(submitted) {
  const from = state.step;

  if (from === STEP.NORMAL) recordResult(false);

  // 持ち越し問題の誤答は、解説を1画面出すだけで通常フローに戻す。
  if (from === STEP.NORMAL && state.fromCarryOver) {
    queue.add(state.current.pattern, state.current.level);
    state.step = STEP.EXPLAIN_ONLY;
    persist();
    return showExplanation(submitted, 'わかった');
  }

  state.step = nextStep(from, false);

  if (state.step === STEP.EXPLAIN) {
    state.origin = state.current;
    persist();
    return showExplanation(submitted, 'わかった');
  }

  if (state.step === STEP.EASIER) {
    // DESIGN.md 3.4 のとおり、類題を誤答したらそのまま易しい問題へ進む。
    return nextProblem();
  }

  if (state.step === STEP.CARRY_OVER) {
    queue.add(state.origin.pattern, state.origin.level);
    persist();
    return openOverlay({
      lines: ['ここは明日もう一回やろう'],
      buttonLabel: 'つぎへ',
      message: true
    });
  }
}

/** 誤答が traps に一致すれば専用解説、しなければ汎用の steps を出す。 */
function showExplanation(submitted, buttonLabel) {
  const { lines } = explanationFor(state.current, submitted);
  openOverlay({
    expr: `${state.current.question} = ${state.current.answer}`,
    lines,
    buttonLabel
  });
}

// --- セッションの進行 -----------------------------------------------------

/**
 * 1つの問題（誤答フローを含む）が片付いたときに呼ぶ。
 * 時間切れの判定はここでしか行わない。
 * 途中で画面を切らず、走っている誤答フローは必ず最後まで終わらせる。
 */
function advance() {
  state.solved += 1;

  if (state.timeUp) finish();
  else nextProblem();
}

function onTimeUp() {
  state.timeUp = true;
  // 残り時間の表示は消す。0分と出し続けるのは急かしになるため。
  el.remain.textContent = '';
  el.progressFill.style.width = '100%';
}

/**
 * その回の学習量を1件だけ記録する。
 *
 * 記録できなくてもアプリは何事もなく続く。ここで失敗しても
 * 画面には何も出さない（本人には関係のない処理のため）。
 * 1問も解いていない回は記録しない。
 */
function logSession() {
  if (state.logged || !state.minutes || state.solved <= 0) return;

  // iframe の中で動いているときは記録しない。
  // 本物のアプリは iframe に入らない。テストがアプリを読み込んで動かすので、
  // この guard が無いとテストを走らせるたびに記録が増えてしまう。
  if (window.top !== window.self) return;

  state.logged = true;

  try {
    fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: todayKey(),
        minutes: state.minutes,
        solved: state.solved
      }),
      keepalive: true
    }).catch(() => {});
  } catch {
    /* 送れなくても構わない */
  }
}

function finish() {
  if (state.timer) state.timer.stop();
  keypad.setEnabled(false);
  closeOverlay();
  el.pausePanel.classList.remove('active');

  sessions.push({ date: todayKey(), minutes: state.minutes, solved: state.solved });
  if (sessions.length > 30) sessions.shift();
  persist();
  logSession();

  // やった問題数だけ。10分の日と60分の日で文言を変えない。
  el.doneCount.textContent = `${state.solved}問`;
  renderDoneDots(state.solved);
  showScreen('done');
}

/**
 * その日に解いた問題を、ひとつずつ積み上げて見せる。
 *
 * 数で評価するのではなく、やったことをそのまま置くだけ。
 * 何問でも同じ見せ方にする（多い日だけ派手にしない）。
 * 全体で 0.9 秒に収まるよう、問題数に応じて間隔を詰める。
 */
function renderDoneDots(count) {
  const shown = Math.min(count, 120);
  const step = shown > 0 ? Math.min(70, 900 / shown) : 0;

  // 少ない日でも手応えが見えるよう、数に応じて大きさを変える。
  // 多い日だけ派手にならないよう、上限と下限をはっきり決めておく。
  const size = shown <= 12 ? 15 : shown <= 30 ? 11 : 8;
  el.doneDots.style.setProperty('--dot-size', `${size}px`);

  el.doneDots.innerHTML = '';
  for (let i = 0; i < shown; i++) {
    const dot = document.createElement('i');
    dot.className = 'dot';
    dot.style.animationDelay = `${Math.round(i * step)}ms`;
    el.doneDots.appendChild(dot);
  }

  // 数と一言は、積み上がったあとに出す
  const after = `${Math.round(shown * step) + 250}ms`;
  for (const node of [el.doneCount, el.doneNote]) {
    node.style.animation = 'none';
    void node.offsetWidth;
    node.style.animation = '';
    node.style.animationDelay = after;
  }
}

function startSession(minutes) {
  state.step = STEP.NORMAL;
  state.origin = null;
  state.fromCarryOver = false;
  state.recent = [];
  state.solved = 0;
  state.minutes = minutes;
  state.timeUp = false;
  state.logged = false;
  state.pending = queue.take(MAX_AT_SESSION_START);

  levels.startSession();

  if (state.timer) state.timer.stop();
  const durationMs = minutes * 60 * 1000;
  state.timer = createTimer({
    durationMs,
    onTick: (remaining) => {
      if (state.timeUp) return;
      el.remain.textContent = remainingLabel(remaining);
      updateProgress(remaining, durationMs);
    },
    onExpire: onTimeUp
  });

  closeOverlay();
  el.pausePanel.classList.remove('active');
  showScreen('practice');
  nextProblem();
  state.timer.start();
}

function goHome() {
  if (state.timer) state.timer.stop();
  showHome();
}

// --- イベント -------------------------------------------------------------

for (const btn of document.querySelectorAll('.time')) {
  btn.addEventListener('click', () => {
    startSession(MINUTES_OVERRIDE || Number(btn.dataset.min));
  });
}

el.overlayBtn.addEventListener('click', () => {
  const from = state.step;
  if (from !== STEP.EXPLAIN && from !== STEP.EXPLAIN_ONLY && from !== STEP.CARRY_OVER) return;

  closeOverlay();
  state.step = nextStep(from, false);

  if (state.step === STEP.RETRY) nextProblem();  // 類題へ
  else advance();                                // 解説だけ / 持ち越し → 通常フローへ
});

el.pauseBtn.addEventListener('click', () => {
  if (state.timer) state.timer.pause();
  el.pausePanel.classList.add('active');
});

el.resumeBtn.addEventListener('click', () => {
  el.pausePanel.classList.remove('active');
  if (state.timer) state.timer.resume();
});

// やめるは確認を挟まない。引き止めない。
el.quitBtn.addEventListener('click', finish);
el.quitFromPauseBtn.addEventListener('click', finish);

el.homeBtn.addEventListener('click', goHome);

// アプリが閉じられる直前にも一度だけ保存しておく。
// 終了画面まで行かずに閉じられた回も、そこまでの分を記録しておく
// （記録に残らないと「何もしていない」と読めてしまうため）。
window.addEventListener('pagehide', () => {
  persist();
  logSession();
});

// --- オフライン対応 -------------------------------------------------------
// Service Worker が登録できなくても（file:// で開いた、対応していない等）
// アプリ自体は普通に動く。失敗しても黙って続ける。
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// --- 起動 -----------------------------------------------------------------

showHome();
