# Enjoy数学

中学1年の「正負の数」を練習する、ひとり用の学習アプリ。

- 問題は**全問プログラムで自動生成**する。問題文の固定データは持たない
- **外部通信ゼロ**。アカウントもサーバー保存も分析も広告もない
- 保存先は端末の localStorage だけ
- PWA。iPhone のホーム画面に追加すると全画面で起動し、機内モードでも動く

## 構成

ビルド不要。依存ライブラリなし。`index.html` を HTTP 経由で開けば動く。

```
index.html          画面（ホーム / 問題 / 終了）
manifest.json       PWA の設定
sw.js               Service Worker（オフライン用）
css/style.css
js/
  app.js            画面遷移・セッション制御
  keypad.js         自作テンキー（iOS のキーボードを出さない）
  timer.js          カウントダウン
  recovery.js       誤答フローの状態機械
  explain.js        誤答パターン別の解説
  carryover.js      持ち越しキュー
  level.js          難易度の自動調整
  storage.js        localStorage ラッパ
  lib/              乱数・Problem の共通部品
  generators/       レベルごとの問題ジェネレータ
icons/              PWA アイコン
test/               単体テスト
tools/make-icons.py アイコン生成（一度だけ走らせる。実行時には不要）
```

## 手元で動かす

ES Modules を使っているので、ファイルを直接開く（`file://`）のではなく
HTTP 経由で開く必要がある。

```bash
python -m http.server 8000 --bind 0.0.0.0
```

- アプリ: `http://localhost:8000/`
- 同じ Wi-Fi の iPhone からは `http://<PCのIPアドレス>:8000/`

Service Worker は HTTPS か localhost でしか動かないので、
LAN 経由の確認ではオフライン動作だけは試せない。

## テスト

ブラウザで `tests.html` を開くと全部走って結果が出る。iPhone でも開ける。

Node.js が入っていれば、こちらでも走る（`npm install` は不要）。

```bash
node test/run-node.js
```

一部のテスト（PWA まわり）は HTTP 経由でないと走らないので、
ブラウザで `tests.html` を開くのが基本。

## 問題を目で見る

`preview.html` を開くと、Lv1〜Lv5 の問題が並ぶ。
難易度や解説の言い回しはここで確認して調整する。

## アイコンを作り直す

```bash
python tools/make-icons.py
```

## 開発用の URL パラメータ

本番の操作では使わない。

| | |
|---|---|
| `?level=1`〜`?level=5` | レベルを固定する（自動調整を止める） |
| `?minutes=1` | 時間ボタンの値を上書きする（時間切れの確認用） |
| `?reset=1` | 保存内容を消して起動する |
| `?newday=1` | 「今日はまだやっていない」状態で起動する |

## 公開

GitHub Pages（Settings → Pages → Branch: `main` / root）。

`manifest.json` の `start_url` と `scope` を `./` にしてあるので、
`https://<ユーザー名>.github.io/<リポジトリ名>/` のようなサブディレクトリでも動く。

`sw.js` にファイルの一覧（`PRECACHE`）がある。**ファイルを増やしたらここにも足すこと。**
足し忘れは `tests.html` が見つける。
