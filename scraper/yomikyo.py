"""読売日本交響楽団：公式サイトの検索で「定期演奏会」に絞って集める。"""

import re
from datetime import date

from bs4 import BeautifulSoup

from common import clean, date_range, get, lines, make_concert, ymd

BASE = "https://yomikyo.or.jp"
ID = "yomikyo"
SERIES_TEIKI = "191"  # 検索フォームの「定期演奏会」の番号


def sale_date_for(url, concert_date):
    """公演ページの「【発売日】10月11日(日) 一般発売」から日付を取る。

    年が書かれていないので、公演日より前で一番近い年を当てはめる。
    """
    text = BeautifulSoup(get(url).text, "html.parser").get_text(" ")
    m = re.search(r"(\d{1,2})月(\d{1,2})日[^／/]{0,8}一般発売", text)
    if not m:
        return None
    month, day = int(m.group(1)), int(m.group(2))
    year = concert_date.year
    if date(year, month, day) > concert_date:
        year -= 1
    return ymd(year, month, day)


def fetch():
    start, end = date_range()
    html = get(BASE + "/concert/", files={"search1": (None, "all"), "search2": (None, SERIES_TEIKI)}).text
    soup = BeautifulSoup(html, "html.parser")

    concerts = []
    for art in soup.select("article.search_result"):
        title = clean(art.select_one("h2").get_text())
        # 「第665回定期演奏会」だけ（大阪定期演奏会は除く）
        if not re.match(r"第\d+回定期演奏会$", title):
            continue

        # 例: 「2027 2.19〈金〉 19時開演 サントリーホール」
        hall = clean(art.select_one("p.hall").get_text(" "))
        m = re.search(r"(\d{4})\s+(\d{1,2})\.(\d{1,2}).*?(\d{1,2})時(?:(\d{1,2})分)?開演\s*(.*)", hall)
        if not m:
            continue
        y, mo, d, h, mi, venue = m.groups()
        concert_date = date(int(y), int(mo), int(d))
        if not (start <= concert_date <= end):
            continue

        conductor, performers, program = "", [], []
        for line in lines(art.select_one(".concert_info_detail")):
            if "＝" in line:
                role, name = line.split("＝", 1)
                if role == "指揮":
                    conductor = name
                else:
                    performers.append(f"{name}（{role}）")
            else:
                program.append(line)

        # 席の空き状況：○△× がすべて × なら完売
        marks = [img.get("alt") for img in art.select("p.ticket img")]
        sold_out = bool(marks) and all(mk == "×" for mk in marks)

        url = BASE + art.select_one(".concert_info_main a")["href"]
        concerts.append(make_concert(
            ID,
            title=title,
            date=concert_date.isoformat(),
            time=f"{int(h):02d}:{int(mi or 0):02d}",
            venue=venue,
            conductor=conductor,
            performers=performers,
            program=program,
            url=url,
            sale_date=sale_date_for(url, concert_date),
            sold_out=sold_out,
        ))
    return concerts
