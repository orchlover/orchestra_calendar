"""東京都現代美術館：展覧会ページが読み込んでいる展覧会データ（JSON）から集める。"""

import re

from common import clean, get, ymd

BASE = "https://www.mot-art-museum.jp"
ID = "mot"


def to_date(s):
    """'20270206' → '2027-02-06'"""
    return ymd(s[:4], s[4:6], s[6:8])


def fetch():
    data = get(BASE + "/json/exhibitions/exhibitions.json").json()
    exhibitions = []
    for ex in data:
        # 企画展だけ（コレクション展示や、数日だけのフェスなどのイベントは除く）
        if ex.get("type") != "exhibitions" or "MOT Plus" in (ex.get("crownName") or ""):
            continue
        if not (re.fullmatch(r"\d{8}", ex.get("start", "")) and re.fullmatch(r"\d{8}", ex.get("end", ""))):
            continue
        title = re.sub(r"<br\s*/?>", " ", ex.get("title", ""))
        crown = ex.get("crownName") or ""
        if crown and "記念" not in crown:
            title = crown + "：" + title
        if ex.get("subTitle"):
            title += " " + ex["subTitle"]
        url = ex.get("permalink", "/exhibitions/")
        exhibitions.append({
            "museum": ID,
            "title": clean(title),
            "start": to_date(ex["start"]),
            "end": to_date(ex["end"]),
            "url": url if url.startswith("http") else BASE + url,
        })
    return exhibitions
