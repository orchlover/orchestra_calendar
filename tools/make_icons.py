"""ホーム画面用のアイコン（PNG）を Python 標準機能だけで描く。

使い方: python3 tools/make_icons.py
"""

import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "docs" / "icons"

NAVY = (27, 35, 64)
WHITE = (255, 255, 255)
RED = (200, 16, 46)
GOLD = (232, 182, 72)


def write_png(path, pixels, size):
    raw = b"".join(b"\x00" + bytes(c for px in row for c in px) for row in pixels)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def draw(size):
    s = size / 512  # 512px の設計図を拡大縮小する
    px = [[NAVY] * size for _ in range(size)]

    def rect(x0, y0, x1, y1, color, r=0):
        for y in range(int(y0 * s), int(y1 * s)):
            for x in range(int(x0 * s), int(x1 * s)):
                # 角を丸める
                cx = min(max(x, (x0 + r) * s), (x1 - r) * s)
                cy = min(max(y, (y0 + r) * s), (y1 - r) * s)
                if (x - cx) ** 2 + (y - cy) ** 2 <= (r * s) ** 2:
                    px[y][x] = color

    def ellipse(cx, cy, rx, ry, angle, color):
        a = math.radians(angle)
        for y in range(int((cy - rx) * s), int((cy + rx) * s) + 1):
            for x in range(int((cx - rx) * s), int((cx + rx) * s) + 1):
                dx, dy = x / s - cx, y / s - cy
                u = dx * math.cos(a) + dy * math.sin(a)
                v = -dx * math.sin(a) + dy * math.cos(a)
                if (u / rx) ** 2 + (v / ry) ** 2 <= 1 and 0 <= x < size and 0 <= y < size:
                    px[y][x] = color

    # カレンダーの紙
    rect(96, 118, 416, 420, WHITE, r=34)
    rect(96, 118, 416, 196, RED, r=34)
    rect(96, 160, 416, 196, RED)
    # とじ穴
    rect(170, 90, 196, 150, WHITE, r=12)
    rect(316, 90, 342, 150, WHITE, r=12)
    # 八分音符
    ellipse(222, 352, 38, 27, -25, NAVY)
    rect(250, 232, 266, 350, NAVY)
    for i in range(46):
        rect(258 + i * 1.1, 232 + i * 1.3, 266 + i * 1.1, 262 + i * 1.6, NAVY)
    # 金色の点（演奏会の目印）
    ellipse(350, 360, 22, 22, 0, GOLD)
    return px


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size in [("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)]:
        write_png(OUT / name, draw(size), size)
        print("作成:", OUT / name)


if __name__ == "__main__":
    main()
