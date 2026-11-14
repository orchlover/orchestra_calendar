"""神奈川フィルハーモニー管弦楽団：定期演奏会の一覧ページと各公演ページから集める。"""

import re
from datetime import date

from bs4 import BeautifulSoup

from common import date_range, find_date, get, lines, make_concert, ymd

BASE = "https://www.kanaphil.or.jp"
ID = "kanaphil"


def parse_detail(url):
    soup = BeautifulSoup(get(url).text, "html.parser")
    info = {}
    # 「開演時間」「公演場所」などは <dt>見出し</dt><dd>中身</dd> の形で並んでいる
    for dt in soup.select("dl.c-desc-list dt"):
        dd = dt.find_next_sibling("dd")
        if dd:
            info[dt.get_text(strip=True)] = dd
    get_lines = lambda key: lines(info[key]) if key in info else []

    time = next(iter(get_lines("開演時間")), "")
    m = re.search(r"\d{1,2}:\d{2}", time)
    sale_text = " ".join(get_lines("チケット発売日"))
    return {
        "time": m.group(0) if m else time,
        "venue": " ".join(get_lines("公演場所")),
        "conductor": " ".join(get_lines("指揮者")),
        "performers": get_lines("共演者"),
        "program": get_lines("主な演目"),
        "sale_date": find_date(sale_text, r"一般発売日\s*(\d{4})年(\d+)月(\d+)日"),
    }


def fetch():
    start, end = date_range()
    # 今のシーズンと次のシーズンの一覧を見る
    list_urls = [
        BASE + "/concert/subscription/",
        BASE + f"/concert/subscription/?season={start.year + 1}",
    ]

    items = {}
    for list_url in list_urls:
        soup = BeautifulSoup(get(list_url).text, "html.parser")
        for li in soup.select("li.concert-list__item"):
            a = li.find("a")
            m = re.search(r"(\d{4})年(\d+)月(\d+)日", li.select_one(".concert-list__date").get_text())
            if not (a and m):
                continue
            d = ymd(*m.groups())
            if start <= date.fromisoformat(d) <= end:
                items[a["href"]] = (d, li.select_one(".concert-list__ttl").get_text(strip=True))

    concerts = []
    for url, (d, title) in sorted(items.items(), key=lambda x: x[1][0]):
        detail = parse_detail(url)
        sold_out = "完売" in title
        title = re.sub(r"【[^】]*】", "", title)
        concerts.append(make_concert(ID, title=title, date=d, url=url, sold_out=sold_out, **detail))
    return concerts
