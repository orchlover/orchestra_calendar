"""各団体・各館の収集スクリプトで共通して使う道具。"""

import re
import time
from datetime import date, timedelta

import requests

# 何ヶ月先までの公演を集めるか
MONTHS_AHEAD = 6

# サイトに負担をかけないよう、1回アクセスするごとに待つ秒数
WAIT_SECONDS = 1.5

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; personal-orchestra-calendar/1.0; weekly)"
}

_session = requests.Session()
_session.headers.update(HEADERS)


def get(url, **kwargs):
    """ページを取得する（毎回少し待つ）。"""
    time.sleep(WAIT_SECONDS)
    method = "POST" if "data" in kwargs or "files" in kwargs else "GET"
    res = _session.request(method, url, timeout=30, **kwargs)
    res.raise_for_status()
    res.encoding = res.apparent_encoding if res.encoding in (None, "ISO-8859-1") else res.encoding
    return res


def date_range():
    """集める期間（今日〜MONTHS_AHEAD ヶ月後）を返す。"""
    start = date.today()
    end = start + timedelta(days=round(MONTHS_AHEAD * 30.5))
    return start, end


def clean(text):
    """余分な空白や改行を整える。"""
    if text is None:
        return ""
    # 神奈川フィルの「♭」、新日本フィルの「*」はソリストと曲を結ぶ目印なので外す
    for mark in ("♭", "*", "＊"):
        text = text.replace(mark, "")
    text = text.replace("　", " ")
    return re.sub(r"\s+", " ", text).strip()


def lines(element):
    """HTML要素の中身を、<br>や段落ごとの行リストにする。"""
    text = element.get_text("\n")
    return [clean(t) for t in text.split("\n") if clean(t)]


def ymd(y, m, d):
    return date(int(y), int(m), int(d)).isoformat()


def find_date(text, pattern):
    """文章から「2026年10月25日」のような日付を探して YYYY-MM-DD で返す。"""
    m = re.search(pattern, text)
    if not m:
        return None
    return ymd(*m.groups()[:3])


def make_concert(orchestra, *, title, date, time="", venue="", conductor="",
                 performers=None, program=None, url="", sale_date=None, sold_out=False):
    """1公演分のデータをそろった形で作る。"""
    return {
        "orchestra": orchestra,
        "title": clean(title),
        "date": date,
        "time": time,
        "venue": clean(venue),
        "conductor": clean(conductor),
        "performers": [clean(p) for p in (performers or []) if clean(p)],
        "program": [clean(p) for p in (program or []) if clean(p)],
        "url": url,
        "sale_date": sale_date,
        "sold_out": sold_out,
    }
