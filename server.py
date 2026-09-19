"""自宅の LAN で Enjoy数学 を配るためのサーバー。

    python server.py [ポート番号]

やっていることは2つだけ。

  1. 静的ファイルを配る（python -m http.server と同じ）
  2. POST /_log を受け取って study-log.csv に1行追記する

2 は保護者が学習量を確認するためのもので、記録するのは
「日付 / 学年 / 選んだ時間 / 解いた問題数」だけ。正誤や点数は受け取らない。
子どもが3人いて端末も別なので、どの子の分かが分かるよう学年も残す。

自宅の LAN 内でだけ動かす前提。インターネットに公開しないこと。
GitHub Pages に置いた場合、この口は存在しないので記録は残らない
（アプリ側は失敗を黙って無視するので、動作には影響しない）。
"""

import csv
import functools
import json
import os
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
LOG_PATH = os.path.join(HERE, 'study-log.csv')
LOG_ENDPOINT = '/_log'
FIELDS = ['date', 'grade', 'minutes', 'solved']
OLD_FIELDS = ['date', 'minutes', 'solved']

# アプリは学年を id で送ってくる。CSV には読める形で書く。
GRADE_LABELS = {'e5': '小5', 'j1': '中1', 'j3': '中3'}

MAX_BODY = 1024          # 受け取る本文の上限
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def clean(record):
    """受け取った内容を検査する。おかしければ None を返す。"""
    if not isinstance(record, dict):
        return None

    date = record.get('date')
    if not isinstance(date, str) or not DATE_RE.match(date):
        return None

    try:
        minutes = float(record.get('minutes'))
        solved = int(record.get('solved'))
    except (TypeError, ValueError):
        return None

    if minutes <= 0 or solved < 0 or solved > 10000:
        return None

    # 10 のような整数は 10 と書く（10.0 にしない）
    if minutes == int(minutes):
        minutes = int(minutes)

    # 学年は分からなくても記録は残す（古い版のアプリから届くこともある）
    grade = GRADE_LABELS.get(record.get('grade'), '')

    return {'date': date, 'grade': grade, 'minutes': minutes, 'solved': solved}


def append(row):
    """CSV に1行足す。見出しが無ければ先に書く。"""
    is_new = not os.path.exists(LOG_PATH) or os.path.getsize(LOG_PATH) == 0
    with open(LOG_PATH, 'a', newline='', encoding='utf-8') as f:
        if is_new:
            # Excel が日本語を化けさせないよう、作るときだけ BOM を置く
            f.write('﻿')
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        if is_new:
            writer.writeheader()
        writer.writerow(row)


def upgrade_log():
    """学年の列が無い古い CSV を、1度だけ新しい形に書き換える。

    元のファイルは .bak に残す。行は1行も捨てず、学年だけ空にする。
    失敗したら何もせず、そのまま起動する（記録が取れなくなるより軽い）。
    """
    if not os.path.exists(LOG_PATH) or os.path.getsize(LOG_PATH) == 0:
        return

    try:
        with open(LOG_PATH, newline='', encoding='utf-8-sig') as f:
            rows = list(csv.reader(f))
    except (OSError, UnicodeDecodeError):
        return

    if not rows or rows[0] != OLD_FIELDS:
        return  # すでに新しい形（か、見覚えのない形）なので触らない

    backup = LOG_PATH + '.bak'
    try:
        os.replace(LOG_PATH, backup)
        with open(LOG_PATH, 'w', newline='', encoding='utf-8') as f:
            f.write('﻿')
            writer = csv.writer(f)
            writer.writerow(FIELDS)
            for row in rows[1:]:
                if len(row) != len(OLD_FIELDS):
                    continue
                writer.writerow([row[0], '', row[1], row[2]])
    except OSError as err:
        print(f'  記録の書き換えに失敗しました: {err}')
        return

    print(f'  記録に学年の列を足しました（元のファイル: {backup}）')


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path.split('?')[0] != LOG_ENDPOINT:
            self.send_error(404)
            return

        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            length = 0

        if length <= 0 or length > MAX_BODY:
            self.send_error(400)
            return

        try:
            record = json.loads(self.rfile.read(length).decode('utf-8'))
        except Exception:
            self.send_error(400)
            return

        row = clean(record)
        if row is None:
            self.send_error(400)
            return

        try:
            append(row)
        except OSError as err:
            self.log_message('記録に失敗: %s', err)
            self.send_error(500)
            return

        self.log_message(
            '記録: %s %s %s分 %s問',
            row['date'], row['grade'] or '学年なし', row['minutes'], row['solved']
        )
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        # 開発中に古いファイルが使われないようにする
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


class Server(ThreadingHTTPServer):
    # Windows では標準の設定のまま二重起動すると、同じポートに2つが居座り、
    # リクエストがどちらに届くか分からなくなる。
    # 二重起動は「使用中」で明確に失敗させる。
    allow_reuse_address = False


def main():
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass

    upgrade_log()

    handler = functools.partial(Handler, directory=HERE)
    try:
        server = Server(('0.0.0.0', port), handler)
    except OSError:
        print(f'  ポート {port} はすでに使われています。')
        print('  サーバーの黒い画面がもう1つ開いていないか確認してください。')
        input('  Enter キーで閉じます...')
        return

    print(f'  記録の保存先: {LOG_PATH}')
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n  停止しました。')
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
