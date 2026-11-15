"""日本フィルハーモニー交響楽団：東京定期・横浜定期の一覧ページから集める。
小林研一郎さんが指揮する公演は、定期以外も入れる（強調表示するため）。"""

import re
from datetime import date

from bs4 import BeautifulSoup

from common import clean, date_range, get, lines, make_concert, ymd

BASE = "https://japanphil.or.jp/concert/"
ID = "jpo"
LIST_QUERIES = [
    "p_genre=tokyo-subscription-concert",
    "p_genre=yokohama-subscription-concert",
    "p_keywords=kobaken",
]


def sale_date_of(url, concert_date):
    """公演ページの「一般発売：01月26日」から発売日を出す（年は書かれていないので公演日から考える）。"""
    text = BeautifulSoup(get(url).text, "html.parser").get_text("\n")
    m = re.search(r"一般発売：\s*(\d{1,2})月(\d{1,2})日", text)
    if not m:
        return None
    y = concert_date.year
    # 発売日は公演日より前なので、公演日より後になってしまうなら前の年
    if (int(m.group(1)), int(m.group(2))) > (concert_date.month, concert_date.day):
        y -= 1
    return ymd(y, m.group(1), m.group(2))


def fetch():
    start, end = date_range()
    found = {}
    for q in LIST_QUERIES:
        page = 1
        while True:
            soup = BeautifulSoup(get(f"{BASE}?p_type=performance&{q}&p_page={page}").text, "html.parser")
            cards = soup.select("article.cardPostDetail")
            past_end = False
            for card in cards:
                a = card.select_one(".cardPostDetail__ttl a")
                notes = card.select(".noteIcon")
                m = re.search(r"(\d{4})年(\d+)月(\d+)日.*?(\d{1,2}:\d{2})", notes[0].get_text(" ") if notes else "")
                if not (a and m):
                    continue
                d = date.fromisoformat(ymd(*m.groups()[:3]))
                if d > end:
                    past_end = True
                    continue
                if d < start:
                    continue
                paras = card.select(".cardPostDetail__textarea p")
                people = lines(paras[0]) if paras else []
                program = lines(paras[1]) if len(paras) > 1 else []
                conductor = next((p.split("：", 1)[1] for p in people if p.startswith("指揮：")), "")
                conductor = re.sub(r"［[^］]*］", "", conductor)
                is_subscription = "定期演奏会" in a.get_text()
                if not is_subscription and "小林研一郎" not in conductor:
                    continue
                found[a["href"]] = dict(
                    title=a.get_text(strip=True),
                    date=d.isoformat(),
                    time=m.group(4),
                    venue=notes[1].get_text(strip=True) if len(notes) > 1 else "",
                    conductor=conductor,
                    performers=[re.sub(r"［[^］]*］", "", p) for p in people if not p.startswith("指揮：")],
                    program=program,
                    url=a["href"],
                    sold_out="完売" in card.select_one(".cardPostDetail__tags").get_text() if card.select_one(".cardPostDetail__tags") else False,
                    _before_sale="販売前" in (card.select_one(".cardPostDetail__tags").get_text() if card.select_one(".cardPostDetail__tags") else ""),
                )
            # 一覧は日付順なので、期間を過ぎたか、最後のページなら終わり
            if past_end or not cards or not soup.find("a", class_="page-numbers", string=str(page + 1)):
                break
            page += 1

    concerts = []
    for c in sorted(found.values(), key=lambda c: c["date"]):
        before_sale = c.pop("_before_sale")
        # 発売前の公演だけ、詳細ページで一般発売日を調べる（アクセスを減らすため）
        sale = sale_date_of(c["url"], date.fromisoformat(c["date"])) if before_sale else None
        concerts.append(make_concert(ID, sale_date=sale, **c))
    return concerts
