// 依存なしの極小テストランナー。
// ブラウザ（tests.html）と Node.js（test/run-node.js）の両方で動く。

const registry = [];

export function test(name, fn) {
  registry.push({ name, fn });
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert が false');
}

export function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || '値が一致しない'}\n  期待: ${JSON.stringify(expected)}\n  実際: ${JSON.stringify(actual)}`);
  }
}

export function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${msg || '構造が一致しない'}\n  期待: ${b}\n  実際: ${a}`);
  }
}

/**
 * 登録済みのテストをすべて実行する。
 * @param {HTMLElement|null} mount 結果を描画する要素。null ならコンソールのみ。
 * @returns {{passed:number, failed:number, results:Array}}
 */
export async function runAll(mount) {
  const results = [];
  for (const t of registry) {
    const started = Date.now();
    try {
      await t.fn();
      results.push({ name: t.name, ok: true, ms: Date.now() - started });
    } catch (err) {
      results.push({ name: t.name, ok: false, ms: Date.now() - started, error: String(err && err.message || err) });
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  if (mount) renderToDom(mount, results, passed, failed);
  else renderToConsole(results, passed, failed);

  return { passed, failed, results };
}

function renderToConsole(results, passed, failed) {
  for (const r of results) {
    if (r.ok) console.log(`  PASS  ${r.name} (${r.ms}ms)`);
    else console.log(`  FAIL  ${r.name}\n        ${r.error.replace(/\n/g, '\n        ')}`);
  }
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
}

function renderToDom(mount, results, passed, failed) {
  mount.innerHTML = '';

  const summary = document.createElement('div');
  summary.className = failed === 0 ? 'summary ok' : 'summary ng';
  summary.textContent = failed === 0
    ? `全 ${passed} 件 パス`
    : `${passed} 件パス / ${failed} 件 失敗`;
  mount.appendChild(summary);

  for (const r of results) {
    const row = document.createElement('div');
    row.className = r.ok ? 'case ok' : 'case ng';

    const head = document.createElement('div');
    head.className = 'case-head';
    head.textContent = `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`;
    row.appendChild(head);

    if (!r.ok) {
      const pre = document.createElement('pre');
      pre.textContent = r.error;
      row.appendChild(pre);
    }
    mount.appendChild(row);
  }
}
