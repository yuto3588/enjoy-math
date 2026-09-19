// localStorage ラッパ（DESIGN.md 9章）。
//
// このファイルの最優先事項は「壊れたデータで起動に失敗しないこと」。
// 起動失敗はこのアプリで最悪の事故なので、
//   - 読み込みは例外を外に出さない
//   - 書き込みも例外を外に出さない（保存できなくても操作は続けられる）
//   - 1項目が壊れていても、その項目だけ既定値に戻して残りは生かす
//   - JSON のパース自体に失敗したときだけ、全部を初期状態にする
//
// localStorage が使えない環境（プライベートブラウズ等）でも、
// 保存されないだけで普通に動く。

import { DEFAULT_GRADE, isGrade } from './profile.js';

// 学習の記録は学年ごとに別のキーに入れる（math-practice:j1 など）。
// 混ぜると、下の子の結果で上の子のレベルが動いてしまう。
const PREFIX = 'math-practice';

/** 学年を分ける前に使っていたキー。中1のものとして一度だけ引き継ぐ。 */
export const LEGACY_KEY = PREFIX;

/** この端末を誰が使うか（学年）。学習の記録とは別に1つだけ持つ。 */
export const GRADE_KEY = `${PREFIX}:grade`;

export function keyFor(grade) {
  return `${PREFIX}:${isGrade(grade) ? grade : DEFAULT_GRADE}`;
}

export const CURRENT_VERSION = 1;

const DEFAULT_LEVEL = 2;
const MAX_HISTORY = 30;
const MAX_SESSIONS = 30;
const MAX_CARRY_OVER = 20;

export function defaultState() {
  return {
    version: CURRENT_VERSION,
    level: DEFAULT_LEVEL,
    // 直近の判定から何問答えたか。DESIGN.md 9章のスキーマへの追加項目。
    // 「10問たまるたびに難易度を判定する」をセッションをまたいで続けるために要る。
    sinceJudge: 0,
    history: [],
    carryOver: [],
    sessions: []
  };
}

// --- 値の検査 -------------------------------------------------------------

function intInRange(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function sanitizeHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    if (!isNonEmptyString(e.pattern)) continue;
    if (typeof e.correct !== 'boolean') continue;
    if (!Number.isFinite(Number(e.at))) continue;
    out.push({ pattern: e.pattern, correct: e.correct, at: Number(e.at) });
  }
  return out.slice(-MAX_HISTORY);
}

function sanitizeCarryOver(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    if (!isNonEmptyString(e.pattern)) continue;
    if (seen.has(e.pattern)) continue;
    seen.add(e.pattern);
    out.push({
      pattern: e.pattern,
      level: intInRange(e.level, 1, 5, 1),
      misses: intInRange(e.misses, 0, 99, 1)
    });
    if (out.length >= MAX_CARRY_OVER) break;
  }
  return out;
}

function sanitizeSessions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    const minutes = Number(e.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) continue;
    out.push({
      date: e.date,
      minutes,
      solved: intInRange(e.solved, 0, 9999, 0)
    });
  }
  return out.slice(-MAX_SESSIONS);
}

/**
 * 読み込んだ中身を、必ず使える形に直す。純関数なのでテストしやすい。
 * どんな値を渡しても例外を投げない。
 */
export function sanitize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;

  const level = intInRange(raw.level, 1, 5, base.level);

  // バージョンが違うときはマイグレーションしない。level だけ引き継いで初期化する。
  if (raw.version !== CURRENT_VERSION) {
    return { ...base, level };
  }

  return {
    version: CURRENT_VERSION,
    level,
    sinceJudge: intInRange(raw.sinceJudge, 0, 9999, 0),
    history: sanitizeHistory(raw.history),
    carryOver: sanitizeCarryOver(raw.carryOver),
    sessions: sanitizeSessions(raw.sessions)
  };
}

// --- localStorage との出入り ----------------------------------------------

/** 使える localStorage を返す。使えなければ null。 */
export function defaultStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** 読み込む。何が起きても必ず使える状態を返す。 */
export function load(grade = DEFAULT_GRADE, storage = defaultStorage()) {
  if (!storage) return defaultState();

  let raw;
  try {
    raw = storage.getItem(keyFor(grade));
  } catch {
    return defaultState();
  }
  if (raw == null) return defaultState();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // JSON として読めないときだけ、全部を初期状態にする
    return defaultState();
  }

  return sanitize(parsed);
}

/** 保存する。失敗しても例外を投げず false を返すだけ。 */
export function save(state, grade = DEFAULT_GRADE, storage = defaultStorage()) {
  if (!storage) return false;
  try {
    const clean = sanitize({ ...state, version: CURRENT_VERSION });
    storage.setItem(keyFor(grade), JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

/** その学年の記録を消す（開発用）。他の学年には触らない。 */
export function clear(grade = DEFAULT_GRADE, storage = defaultStorage()) {
  try {
    if (storage) storage.removeItem(keyFor(grade));
  } catch {
    /* 消せなくても構わない */
  }
}

// --- この端末を使う学年 -----------------------------------------------------

/** 保存されている学年。決まっていない、または壊れていれば null。 */
export function loadGrade(storage = defaultStorage()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(GRADE_KEY);
    return isGrade(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** 学年を覚える。失敗しても false を返すだけ。 */
export function saveGrade(grade, storage = defaultStorage()) {
  if (!storage || !isGrade(grade)) return false;
  try {
    storage.setItem(GRADE_KEY, grade);
    return true;
  } catch {
    return false;
  }
}

/** 学年を忘れる（次の起動で選び直しになる）。 */
export function clearGrade(storage = defaultStorage()) {
  try {
    if (storage) storage.removeItem(GRADE_KEY);
  } catch {
    /* 消せなくても構わない */
  }
}

/**
 * 学年を分ける前に保存されていた記録を、中1のものとして引き継ぐ。
 *
 * 引き継いだら古いキーは消す。残したままにすると、
 * 中1の記録をリセットしたときに、消したはずの古い記録がまた復活してしまう。
 * 何が起きても例外を外に出さない（起動の途中で呼ぶため）。
 */
export function migrateLegacy(storage = defaultStorage()) {
  if (!storage) return false;
  try {
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy == null) return false;

    const target = keyFor(DEFAULT_GRADE);
    // すでに中1の記録があるなら、そちらを正とする（上書きしない）
    if (storage.getItem(target) == null) storage.setItem(target, legacy);
    storage.removeItem(LEGACY_KEY);
    return true;
  } catch {
    return false;
  }
}
