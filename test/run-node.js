// Node.js からテストを実行する入口。
//   node test/run-node.js
// ブラウザで確認する場合は tests.html を開く。

import './addsub.test.js';
import './generators.test.js';
import './recovery.test.js';
import './explain.test.js';
import './carryover.test.js';
import './timer.test.js';
import './storage.test.js';
import './profile.test.js';
import './level.test.js';
import './pwa.test.js';
import './layout.test.js';
import { runAll } from './runner.js';

const { failed } = await runAll(null);
process.exit(failed === 0 ? 0 : 1);
