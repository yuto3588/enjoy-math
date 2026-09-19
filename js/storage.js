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

export const STORAGE_KEY = 'math-practice';
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
export function load(storage = defaultStorage()) {
  if (!storage) return defaultState();

  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
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
export function save(state, storage = defaultStorage()) {
  if (!storage) return false;
  try {
    const clean = sanitize({ ...state, version: CURRENT_VERSION });
    storage.setItem(STORAGE_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

/** 消す（開発用）。 */
export function clear(storage = defaultStorage()) {
  try {
    if (storage) storage.removeItem(STORAGE_KEY);
  } catch {
    /* 消せなくても構わない */
  }
}
