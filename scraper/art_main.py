"""3館の企画展を集めて docs/exhibitions.json に保存する。

使い方（orchestra_calendar フォルダで）:
    .venv/bin/python scraper/art_main.py
"""

import json
import traceback
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import mot
import nact
import tobikan

OUTPUT = Path(__file__).resolve().parent.parent / "docs" / "exhibitions.json"

# 何日先までの展覧会を集めるか（1年分）
DAYS_AHEAD = 365

# 特別な色で強調する画家（タイトルにこの言葉が入っていたら強調）
HIGHLIGHT_WORDS = ["ゴッホ", "Gogh"]

MUSEUMS = [
    {"id": "tobikan", "name": "東京都美術館", "short": "都美", "module": tobikan},
    {"id": "nact", "name": "国立新美術館", "short": "新美", "module": nact},
    {"id": "mot", "name": "東京都現代美術館", "short": "MOT", "module": mot},
]


def load_previous():
    if OUTPUT.exists():
        return json.loads(OUTPUT.read_text(encoding="utf-8"))
    return {"exhibitions": []}


def main():
    previous = load_previous()
    today = date.today().isoformat()
    last = (date.today() + timedelta(days=DAYS_AHEAD)).isoformat()
    all_ex, errors = [], []

    for mus in MUSEUMS:
        print(f"▶ {mus['name']} を取得中…")
        try:
            got = mus["module"].fetch()
            # 終わった展示と、1年より先に始まる展示は除く
            got = [e for e in got if e["end"] >= today and e["start"] <= last]
            print(f"  {len(got)} 展覧会")
            all_ex += got
        except Exception:
            # 1館が失敗しても、その館は前回のデータを残して続ける
            traceback.print_exc()
            errors.append(mus["id"])
            kept = [e for e in previous["exhibitions"] if e["museum"] == mus["id"] and e["end"] >= today]
            print(f"  ⚠ 失敗したので前回のデータ {len(kept)} 件を使います")
            all_ex += kept

    for e in all_ex:
        e["highlight"] = any(w.lower() in e["title"].lower() for w in HIGHLIGHT_WORDS)

    all_ex.sort(key=lambda e: (e["start"], e["end"], e["museum"]))
    jst = timezone(timedelta(hours=9))
    data = {
        "updated_at": datetime.now(jst).strftime("%Y-%m-%d %H:%M"),
        "museums": [{k: m[k] for k in ("id", "name", "short")} for m in MUSEUMS],
        "errors": errors,
        "exhibitions": all_ex,
    }
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"✅ {len(all_ex)} 展覧会を {OUTPUT} に保存しました")


if __name__ == "__main__":
    main()
