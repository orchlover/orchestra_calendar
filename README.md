# 芸術

右上の「オケ｜美」で2つの画面を切り替えるWebページ。

- **オケ**：N響・読響・新日本フィル・神奈川フィル・日本フィル・アンサンブル金沢の**定期演奏会**を、直近6ヶ月分カレンダーにまとめる。小林研一郎さん指揮の公演は金色で強調（日本フィルは定期以外のコバケン公演も入れる）。同じ演目の2回目以降は一覧で1行にまとめる
- **美**：東京都美術館・国立新美術館・東京都現代美術館の**企画展**を、1年分の横棒グラフで並べる。ゴッホ展は金色で強調する
iPhoneではホーム画面に追加すると、アプリのように使える。

## フォルダの中身

| 場所 | 中身 |
|---|---|
| `scraper/` | 公演情報を集めるPython。団体ごとに1ファイル（`nhk.py` など）、`main.py` が全部まとめる。強調する指揮者（`HIGHLIGHT_CONDUCTORS`）も `main.py` |
| `scraper/art_main.py` | 美術館3館（`tobikan.py` / `nact.py` / `mot.py`）の企画展をまとめて `docs/exhibitions.json` に保存する。強調する画家（`HIGHLIGHT_WORDS`）もここ |
| `scraper/common.py` | 共通の設定。**何ヶ月先まで集めるか（`MONTHS_AHEAD`）** もここ |
| `docs/` | 公開されるWebページ（`index.html` / `style.css` / `app.js`＝オケ / `art.js`＝美）と、集めたデータ `concerts.json` / `exhibitions.json` |
| `.github/workflows/update.yml` | 毎週日曜 夜7時に自動で公演・展覧会データを更新する設定 |
| `tools/make_icons.py` | ホーム画面用アイコンを作るスクリプト |

## 手元で動かす

```bash
cd ~/python_practice/orchestra_calendar
.venv/bin/python scraper/main.py          # 公演情報を集め直す
.venv/bin/python scraper/art_main.py      # 展覧会情報を集め直す
python3 -m http.server 8793 --directory docs   # http://localhost:8793 で見られる
```

## 公開する（GitHub Pages）

1. GitHubのアカウントを作る（https://github.com/signup）。ユーザー名はURLに入るので本名でなくてOK
2. 新しいリポジトリを **Public** で作る（例：`orchestra-calendar`）
3. このフォルダをアップロードする（git の操作は Claude と一緒にやる）
4. リポジトリの **Settings → Pages** で、Source を「Deploy from a branch」、Branch を `main` / `/docs` にして Save
5. 数分後、`https://ユーザー名.github.io/orchestra-calendar/` で見られる
6. **Actions** タブで「公演情報を更新」を一度手動実行（Run workflow）して、自動更新が動くか確認する

## iPhoneのホーム画面に追加する

1. iPhoneの **Safari** で上のURLを開く
2. 下の共有ボタン（□に↑）→「ホーム画面に追加」
3. 「芸術」のアイコンができる（前の「オケカレ」は削除して、追加し直す）

## 注意

- 各公式サイトの構造が変わると、その団体だけ取得に失敗することがある。そのときは前回のデータを残し、画面上部に表示される
- 情報は週1回の更新なので、チケット購入前は必ず公式サイトで確認する
