"""オーケストラ・アンサンブル金沢：シーズンの年間スケジュールから定期公演を集める。"""

import re
from datetime import date

import requests
from bs4 import BeautifulSoup

from common import clean, date_range, find_date, get, make_concert, ymd

BASE = "https://www.oek.jp"
ID = "oek"


def season_urls(start, end):
    """シーズンは4月始まり。期間にかかるシーズンの年間スケジュールページ（例：/26-27-schedule）"""
    first = start.year if start.month >= 4 else start.year - 1
    last = end.year if end.month >= 4 else end.year - 1
    return [f"{BASE}/{y % 100:02d}-{(y + 1) % 100:02d}-schedule" for y in range(first, last + 1)]


def parse_detail(url):
    soup = BeautifulSoup(get(url).text, "html.parser")
    conductor, performers = "", []
    for li in soup.select(".artist_img > ul > li"):
        name_el = li.select_one("a .artist_name")
        if not name_el:
            continue
        name = clean(name_el.strong.get_text()) if name_el.strong else ""
        role = clean(name_el.get_text(" ").replace(name, "", 1))
        if not conductor and ("指揮" in role or "コンダクター" in role):
            conductor = name
        else:
            performers.append(f"{role}：{name}" if role else name)
    program = []
    for tr in soup.select("table.separate_table tr"):
        tds = [clean(td.get_text(" ")) for td in tr.find_all("td")]
        program.append("：".join(t for t in tds if t))
    text = soup.get_text("\n")
    return {
        "conductor": conductor,
        "performers": performers,
        "program": program,
        "sale_date": find_date(text, r"一般発売日：\s*(\d{4})年(\d+)月(\d+)日"),
        "sold_out": "完売" in text,
    }


def fetch():
    start, end = date_range()
    concerts = []
    for list_url in season_urls(start, end):
        try:
            html = get(list_url).text
        except requests.HTTPError:
            continue  # 次のシーズンのページがまだ無いときは飛ばす
        soup = BeautifulSoup(html, "html.parser")
        for a in soup.select("a[href*='/event/']"):
            box = a.select_one(".con_title")
            if not box or not box.h3:
                continue
            title = clean(box.h3.get_text())
            # フィルハーモニー・シリーズとマイスター・シリーズ（「第◯回定期公演」）だけ
            if not re.match(r"第\d+回定期公演", title):
                continue
            times = [t.get_text(strip=True) for t in box.find_all("time")]
            m = re.match(r"(\d{4})\.(\d{2})\.(\d{2})", times[0] if times else "")
            if not m:
                continue
            d = ymd(*m.groups())
            if not (start <= date.fromisoformat(d) <= end):
                continue
            venue = clean(box.p.get_text()).removeprefix("会場：") if box.p else ""
            detail = parse_detail(a["href"])
            concerts.append(make_concert(ID, title=title, date=d, time=times[1] if len(times) > 1 else "",
                                         venue=venue, url=a["href"], **detail))
    return concerts
