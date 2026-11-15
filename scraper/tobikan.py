"""東京都美術館：展覧会一覧ページから、特別展・企画展を集める。"""

import re

from bs4 import BeautifulSoup

from common import clean, get, ymd

BASE = "https://www.tobikan.jp/exhibition/"
ID = "tobikan"

# 一覧ページのカテゴリー表示のうち、集めるもの（コレクション展や無料のグループ展は除く）
CATEGORIES = ("特別展", "企画展")


def parse_period(text):
    """「2027年4月24日(土)～8月22日(日)」→ ('2027-04-24', '2027-08-22')"""
    nums = re.findall(r"(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日", text)
    if len(nums) < 2:
        return None
    (y1, m1, d1), (y2, m2, d2) = nums[0], nums[1]
    if not y1:
        return None
    if not y2:
        # 終わりの年が省略されていたら、開始と同じ年（月が戻っていれば翌年）
        y2 = int(y1) + (1 if int(m2) < int(m1) else 0)
    return ymd(y1, m1, d1), ymd(y2, m2, d2)


def fetch():
    soup = BeautifulSoup(get(BASE + "index.html").text, "html.parser")
    exhibitions = {}
    for a in soup.select("a.exhibition-item"):
        cats = [s.get_text(strip=True) for s in a.select(".-category span")]
        if not any(c in CATEGORIES for c in cats):
            continue
        title_el, period_el = a.select_one(".-title"), a.select_one(".-period")
        if not (title_el and period_el):
            continue
        period = parse_period(period_el.get_text(" "))
        if not period:
            continue
        url = BASE + a["href"]
        # 「東京都美術館開館100周年記念」のような冠は長いので外す
        title = re.sub(r"^\S*記念\s+", "", clean(title_el.get_text(" ")))
        exhibitions[url] = {
            "museum": ID,
            "title": title,
            "start": period[0],
            "end": period[1],
            "url": url,
        }
    return list(exhibitions.values())
