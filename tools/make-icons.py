"""PWA アイコンを生成する。

アプリ本体はビルド不要だが、アイコンだけは PNG が要る（iOS は SVG のホーム画面
アイコンに対応していない）。このスクリプトは一度だけ走らせて icons/ を作るもので、
アプリの実行には関係しない。依存ライブラリなし（標準ライブラリのみ）。

    python tools/make-icons.py

図案: 幾何学的な猫。
    三角形の耳 2つ + 円の顔 + 切り抜きの目 + 三角の鼻 + ひげ
    キャラクター画ではなく図形の組み合わせにしている（DESIGN.md 10章）。
"""

import math
import os
import struct
import zlib

# アプリの配色に合わせる（css/style.css の --accent と --bg）
BG = (194, 95, 69, 255)     # テラコッタ
CAT = (250, 246, 242, 255)  # 生成り

SS = 4  # スーパーサンプリング（縁をなめらかにする）

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, '..', 'icons')


# --- 図形 -------------------------------------------------------------------

def in_circle(u, v, cx, cy, r):
    return (u - cx) ** 2 + (v - cy) ** 2 <= r * r


def in_triangle(u, v, a, b, c):
    def sign(p, q, r):
        return (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])
    p = (u, v)
    d1, d2, d3 = sign(p, a, b), sign(p, b, c), sign(p, c, a)
    neg = d1 < 0 or d2 < 0 or d3 < 0
    pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (neg and pos)


def in_capsule(u, v, x1, y1, x2, y2, half):
    dx, dy = x2 - x1, y2 - y1
    length2 = dx * dx + dy * dy
    t = 0.0 if length2 == 0 else ((u - x1) * dx + (v - y1) * dy) / length2
    t = max(0.0, min(1.0, t))
    px, py = x1 + t * dx, y1 + t * dy
    return (u - px) ** 2 + (v - py) ** 2 <= half * half


# 猫のかたち。u, v はアイコン中心を原点とした -1..1 の座標。
HEAD = (0.0, 0.14, 0.76)
EAR_L = ((-0.62, -0.28), (-0.76, -1.00), (-0.08, -0.62))
EAR_R = ((0.62, -0.28), (0.76, -1.00), (0.08, -0.62))
EYE_L = (-0.31, 0.04, 0.135)
EYE_R = (0.31, 0.04, 0.135)
NOSE = ((0.0, 0.46), (-0.13, 0.29), (0.13, 0.29))
WHISKERS = [
    (0.66, 0.30, 1.04, 0.20),
    (0.68, 0.46, 1.06, 0.50),
    (-0.66, 0.30, -1.04, 0.20),
    (-0.68, 0.46, -1.06, 0.50),
]
WHISKER_HALF = 0.035


def cat_color(u, v):
    """その点の色を返す。"""
    solid = (
        in_circle(u, v, *HEAD)
        or in_triangle(u, v, *EAR_L)
        or in_triangle(u, v, *EAR_R)
        or any(in_capsule(u, v, *w, WHISKER_HALF) for w in WHISKERS)
    )
    if not solid:
        return BG
    # 目と鼻は背景色で抜く
    if in_circle(u, v, *EYE_L) or in_circle(u, v, *EYE_R):
        return BG
    if in_triangle(u, v, *NOSE):
        return BG
    return CAT


# --- 描画 -------------------------------------------------------------------

def render(size, reach):
    """reach は猫の大きさ（画像の半分を1.0としたときの倍率）。"""
    pixels = bytearray(size * size * 4)
    step = 1.0 / (size * SS)

    for py in range(size):
        for px in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = (px * SS + sx + 0.5) * step
                    y = (py * SS + sy + 0.5) * step
                    u = (x - 0.5) / reach
                    v = (y - 0.5) / reach
                    c = cat_color(u, v)
                    r += c[0]; g += c[1]; b += c[2]; a += c[3]
            n = SS * SS
            i = (py * size + px) * 4
            pixels[i] = r // n
            pixels[i + 1] = g // n
            pixels[i + 2] = b // n
            pixels[i + 3] = a // n
    return pixels


def write_png(path, size, pixels):
    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

    stride = size * 4
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # フィルタなし
        raw += pixels[y * stride:(y + 1) * stride]

    data = (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
            + chunk(b'IEND', b''))

    with open(path, 'wb') as f:
        f.write(data)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # 通常のアイコン。iOS は角を自動で丸めるので、余白は少なめでよい。
    for size in (180, 192, 512):
        path = os.path.join(OUT_DIR, f'icon-{size}.png')
        write_png(path, size, render(size, 0.42))
        print('wrote', os.path.relpath(path, os.path.join(HERE, '..')))

    # maskable 用。円形に切られても欠けないよう、中央 80% に収める。
    path = os.path.join(OUT_DIR, 'icon-maskable-512.png')
    write_png(path, 512, render(512, 0.32))
    print('wrote', os.path.relpath(path, os.path.join(HERE, '..')))


if __name__ == '__main__':
    main()
