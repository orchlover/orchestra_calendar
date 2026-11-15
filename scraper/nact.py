"""国立新美術館：企画展ページが読み込んでいる展覧会データ（JSON）から集める。"""

from common import clean, get

BASE = "https://www.nact.jp"
ID = "nact"


def fetch():
    data = get(BASE + "/exhibition_special/exhibition_special.json").json()
    exhibitions = []
    for ex in data:
        # 「小企画」は除いて「企画展」だけ
        if ex.get("sp_ex_category") != "企画展":
            continue
        if not (ex.get("sp_ex_from") and ex.get("sp_ex_to")):
            continue
        exhibitions.append({
            "museum": ID,
            "title": clean(ex["sp_ex_title"]),
            "start": ex["sp_ex_from"],
            "end": ex["sp_ex_to"],
            "url": BASE + ex.get("sp_ex_permalink", "/exhibition_special/"),
        })
    return exhibitions
