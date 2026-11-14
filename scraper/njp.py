"""新日本フィルハーモニー交響楽団：定期演奏会の一覧（複数ページ）と各公演ページから集める。"""

import re
from datetime import date

from bs4 import BeautifulSoup

from common import clean, date_range, find_date, get, lines, make_concert, ymd

BASE = "https://www.njp.or.jp"
ID = "njp"
MAX_PAGES = 10


def sale_date_for(url):
    """「上記以外のお客様（一般発売）」の行の［一回券］の日付を取る。"""
    soup = BeautifulSoup(get(url).text, "html.parser")
    for tr in soup.select("table tr"):
        th = tr.find("th")
        if th and "一般発売" in th.get_text():
            text = tr.get_text(" ")
            return (find_date(text, r"一回券］\s*(\d{4})年(\d+)月(\d+)日")
                    or find_date(text, r"(\d{4})年(\d+)月(\d+)日"))
    return None


def fetch():
    start, end = date_range()
    concerts = []
    for page in range(1, MAX_PAGES + 1):
        url = BASE + "/concerts/subscription/" + (f"page/{page}/" if page > 1 else "")
        try:
            soup = BeautifulSoup(get(url).text, "html.parser")
        except Exception:
            break  # ページがもう無い

        items = soup.select("div.concertsList__item")
        if not items:
            break

        past_end = False
        for item in items:
            title_el = item.select_one("div.--title")
            date_el = item.select_one("div.--date")
            if not (title_el and date_el):
                continue
            m = re.search(r"(\d{4})年(\d+)月(\d+)日", date_el.get_text())
            if not m:
                continue
            d = date.fromisoformat(ymd(*m.groups()))
            if d > end:
                past_end = True
                continue
            if d < start:
                continue

            t = re.search(r"(\d{1,2}:\d{2})", date_el.get_text())
            detail = item.select_one("a.--detail")
            detail_url = detail["href"] if detail else ""

            conductor, performers, program = "", [], []
            prog = item.select_one("ul.program__list")
            if prog:
                program = lines(prog)
            box = item.select_one("div.--box")
            if box:
                text = box.get_text("\n")
                if "出演者" in text:
                    for line in text.split("出演者", 1)[1].split("\n"):
                        line = clean(line)
                        if not line:
                            continue
                        role, _, name = line.partition("：")
                        if role.startswith("指揮"):
                            conductor = name if role == "指揮" else f"{name}（{role}）"
                        elif name:
                            performers.append(f"{name}（{role}）")
                        else:
                            performers.append(line)

            concerts.append(make_concert(
                ID,
                title=title_el.get_text(),
                date=d.isoformat(),
                time=t.group(1) if t else "",
                venue=item.select_one("div.--place").get_text() if item.select_one("div.--place") else "",
                conductor=conductor,
                performers=performers,
                program=program,
                url=detail_url,
                sale_date=sale_date_for(detail_url) if detail_url else None,
                sold_out="完売" in item.get_text(),
            ))

        # 一覧は日付順なので、期間の外に出たらそれ以降のページは見ない
        if past_end:
            break
    return concerts
