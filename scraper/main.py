"""6団体の定期演奏会を集めて docs/concerts.json に保存する。

使い方（orchestra_calendar フォルダで）:
    .venv/bin/python scraper/main.py
"""

import json
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jpo
import kanaphil
import nhk
import njp
import oek
import yomikyo

OUTPUT = Path(__file__).resolve().parent.parent / "docs" / "concerts.json"

ORCHESTRAS = [
    {"id": "nhk", "name": "NHK交響楽団", "short": "N", "module": nhk},
    {"id": "yomikyo", "name": "読売日本交響楽団", "short": "読", "module": yomikyo},
    {"id": "njp", "name": "新日本フィルハーモニー交響楽団", "short": "新日", "module": njp},
    {"id": "kanaphil", "name": "神奈川フィルハーモニー管弦楽団", "short": "神奈川フィル", "tag": "神奈川", "module": kanaphil},
    {"id": "jpo", "name": "日本フィルハーモニー交響楽団", "short": "日フィル", "module": jpo},
    {"id": "oek", "name": "オーケストラ・アンサンブル金沢", "short": "OEK", "module": oek},
]

# 強調する指揮者（指揮者名にこの名前が入っていたら強調）
HIGHLIGHT_CONDUCTORS = ["小林研一郎"]


def load_previous():
    if OUTPUT.exists():
        return json.loads(OUTPUT.read_text(encoding="utf-8"))
    return {"concerts": []}


def main():
    previous = load_previous()
    all_concerts, errors = [], []

    for orch in ORCHESTRAS:
        print(f"▶ {orch['name']} を取得中…")
        try:
            got = orch["module"].fetch()
            print(f"  {len(got)} 公演")
            all_concerts += got
        except Exception:
            # 1団体が失敗しても、その団体は前回のデータを残して続ける
            traceback.print_exc()
            errors.append(orch["id"])
            kept = [c for c in previous["concerts"] if c["orchestra"] == orch["id"]]
            print(f"  ⚠ 失敗したので前回のデータ {len(kept)} 件を使います")
            all_concerts += kept

    for c in all_concerts:
        name = c["conductor"].replace(" ", "")
        c["highlight"] = any(h in name for h in HIGHLIGHT_CONDUCTORS)

    all_concerts.sort(key=lambda c: (c["date"], c["time"], c["orchestra"]))
    jst = timezone(timedelta(hours=9))
    data = {
        "updated_at": datetime.now(jst).strftime("%Y-%m-%d %H:%M"),
        # tag はカレンダーのマスに出す短い名前（無ければ short）
        "orchestras": [{"id": o["id"], "name": o["name"], "short": o["short"], "tag": o.get("tag", o["short"])} for o in ORCHESTRAS],
        "errors": errors,
        "concerts": all_concerts,
    }
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"✅ {len(all_concerts)} 公演を {OUTPUT} に保存しました")


if __name__ == "__main__":
    main()
