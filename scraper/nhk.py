"""NHK交響楽団：公式サイトが公開しているJSONから定期公演を集める。"""

import re
from datetime import date

from bs4 import BeautifulSoup

from common import clean, date_range, find_date, get, make_concert

BASE = "https://www.nhkso.or.jp"
ID = "nhk"


def to_24h(text):
    """'6:00pm' → '18:00'"""
    m = re.match(r"(\d+):(\d+)\s*(am|pm)", text or "", re.I)
    if not m:
        return clean(text)
    h, mi, ap = int(m.group(1)), m.group(2), m.group(3).lower()
    if ap == "pm" and h != 12:
        h += 12
    if ap == "am" and h == 12:
        h = 0
    return f"{h:02d}:{mi}"


def strip_tags(text):
    return clean(re.sub(r"<[^>]+>", " ", text or ""))


def fetch():
    start, end = date_range()
    halls = get(BASE + "/concert/hall/json/hall_all.json").json()["hall_info"]
    year_files = get(BASE + "/concert/json/list_archive_concert.json").json()["year_list"]

    # シーズン（年）ごとのファイル。今年と去年のぶんだけ見れば足りる
    wanted = [f for f in year_files if int(re.search(r"(\d{4})", f).group(1)) >= start.year - 1]

    concerts = []
    for path in wanted:
        for c in get(BASE + path).json()["concerts"]:
            if c["category"] != "subscription":
                continue
            songs = [strip_tags(s["name"]) for s in c["songs"]]
            days = [d for d in c["details"] if start <= date.fromisoformat(d["date"]) <= end]
            if not days:
                continue

            url = BASE + c["details_url"]
            # 一般発売日は公演ページにだけ書いてある
            page = BeautifulSoup(get(url).text, "html.parser").get_text(" ")
            sale = find_date(page, r"一般発売日\s*[：:]\s*(\d{4})年(\d+)月(\d+)日")

            conductor, performers = "", []
            for p in c["main_performers"]:
                t = strip_tags(p["text"])
                if t.startswith("指揮"):
                    conductor = re.sub(r"^指揮\s*[:：]\s*", "", t)
                else:
                    performers.append(t)

            for d in days:
                concerts.append(make_concert(
                    ID,
                    title=strip_tags(c["title"]),
                    date=d["date"],
                    time=to_24h(d["start_time"]),
                    venue=halls.get(c["hall_id"], {}).get("name", ""),
                    conductor=conductor,
                    performers=performers,
                    program=songs,
                    url=url,
                    sale_date=sale,
                ))
    return concerts
