"""4団体の定期演奏会を集めて docs/concerts.json に保存する。

使い方（orchestra_calendar フォルダで）:
    .venv/bin/python scraper/main.py
"""

import json
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path

import kanaphil
import nhk
import njp
import yomikyo

OUTPUT = Path(__file__).resolve().parent.parent / "docs" / "concerts.json"

ORCHESTRAS = [
    {"id": "nhk", "name": "NHK交響楽団", "short": "N響", "module": nhk},
    {"id": "yomikyo", "name": "読売日本交響楽団", "short": "読響", "module": yomikyo},
    {"id": "njp", "name": "新日本フィルハーモニー交響楽団", "short": "新日本フィル", "module": njp},
    {"id": "kanaphil", "name": "神奈川フィルハーモニー管弦楽団", "short": "神奈川フィル", "module": kanaphil},
]


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

    all_concerts.sort(key=lambda c: (c["date"], c["time"], c["orchestra"]))
    jst = timezone(timedelta(hours=9))
    data = {
        "updated_at": datetime.now(jst).strftime("%Y-%m-%d %H:%M"),
        "orchestras": [{k: o[k] for k in ("id", "name", "short")} for o in ORCHESTRAS],
        "errors": errors,
        "concerts": all_concerts,
    }
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"✅ {len(all_concerts)} 公演を {OUTPUT} に保存しました")


if __name__ == "__main__":
    main()
