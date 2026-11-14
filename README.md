# オーケストラカレンダー

N響・読響・新日本フィル・神奈川フィルの**定期演奏会**を、直近4ヶ月分カレンダーにまとめるWebページ。
iPhoneではホーム画面に追加すると、アプリのように使える。

## フォルダの中身

| 場所 | 中身 |
|---|---|
| `scraper/` | 公演情報を集めるPython。団体ごとに1ファイル（`nhk.py` など）、`main.py` が全部まとめる |
| `scraper/common.py` | 共通の設定。**何ヶ月先まで集めるか（`MONTHS_AHEAD`）** もここ |
| `docs/` | 公開されるWebページ（`index.html` / `style.css` / `app.js`）と、集めたデータ `concerts.json` |
| `.github/workflows/update.yml` | 毎週月曜 朝6時に自動でデータを更新する設定 |
| `tools/make_icons.py` | ホーム画面用アイコンを作るスクリプト |

## 手元で動かす

```bash
cd ~/python_practice/orchestra_calendar
.venv/bin/python scraper/main.py          # 公演情報を集め直す
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
3. 「オケカレ」のアイコンができる

## 注意

- 各公式サイトの構造が変わると、その団体だけ取得に失敗することがある。そのときは前回のデータを残し、画面上部に表示される
- 情報は週1回の更新なので、チケット購入前は必ず公式サイトで確認する
