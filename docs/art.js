// 「美」の画面：美術館の企画展を1年分の横棒グラフで表示する
// exhibitions.json（Pythonで集めたデータ）を読み込む
// 日付の道具（pad, toKey, parseKey, todayKey, esc など）は app.js のものを使う

const SPAN_MONTHS = 12; // 何ヶ月分を表示するか

const art = {
  data: null,
  hidden: new Set(JSON.parse(localStorage.getItem("hiddenMuseums") || "[]")),
  open: null, // 詳細を開いている展覧会のURL
};

const museum = (id) => art.data.museums.find((m) => m.id === id) || { id, name: id, short: id };
const visibleExhibitions = () => art.data.exhibitions.filter((e) => !art.hidden.has(e.museum));

// 表示する期間：今月1日〜12ヶ月後の月末
function span() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + SPAN_MONTHS, 1); // この日の0時まで
  return { start, end, total: end - start };
}
// 日付が期間のどこにあたるか（0〜100%）
function pos(date, s) {
  return Math.min(100, Math.max(0, ((date - s.start) / s.total) * 100));
}
const endOfDay = (k) => { const d = parseKey(k); d.setDate(d.getDate() + 1); return d; };
const shortDate = (k) => { const d = parseKey(k); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };

// ---------- 美術館の切り替え ----------
function renderArtFilters() {
  $("art-filters").innerHTML = art.data.museums.map((m) => `
    <button type="button" class="chip ${art.hidden.has(m.id) ? "off" : ""}"
            style="--c:var(--${m.id})" data-id="${m.id}" aria-pressed="${!art.hidden.has(m.id)}">
      ${esc(m.name)}
    </button>`).join("");
  $("art-filters").querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      art.hidden.has(id) ? art.hidden.delete(id) : art.hidden.add(id);
      localStorage.setItem("hiddenMuseums", JSON.stringify([...art.hidden]));
      renderArt();
    });
  });
}

// ---------- ゴッホのお知らせ ----------
function renderGoghBanner() {
  const goghs = visibleExhibitions().filter((e) => e.highlight);
  $("gogh-banner").innerHTML = goghs.map((e) => `
    <a class="gogh-banner" href="${esc(e.url)}" target="_blank" rel="noopener">
      <span class="star">★</span>
      <span><strong>ゴッホ展あり</strong>　${esc(museum(e.museum).name)}「${esc(e.title)}」
      <small>${shortDate(e.start)} 〜 ${shortDate(e.end)}</small></span>
    </a>`).join("");
}

// ---------- 横棒グラフ ----------
function renderGantt() {
  const s = span();

  // 月の目盛り
  let months = "";
  for (let i = 0; i < SPAN_MONTHS; i++) {
    const d = new Date(s.start.getFullYear(), s.start.getMonth() + i, 1);
    // 年は上の段（最初の月と1月だけ）、月は下の段に出す
    if (i === 0 || d.getMonth() === 0) months += `<span class="year" style="left:${pos(d, s)}%">${d.getFullYear()}年</span>`;
    months += `<span class="month" style="left:${pos(d, s)}%">${d.getMonth() + 1}月</span>`;
  }
  $("gantt-months").innerHTML = months;

  // 月の区切り線と、今日の線（各行の背景に引く）
  let lines = "";
  for (let i = 1; i < SPAN_MONTHS; i++) {
    lines += `<i class="mline" style="left:${pos(new Date(s.start.getFullYear(), s.start.getMonth() + i, 1), s)}%"></i>`;
  }
  lines += `<i class="today-line" style="left:${pos(new Date(), s)}%"></i>`;

  // ゴッホ展を一番上に、あとは始まる順
  const list = visibleExhibitions().slice().sort((a, b) =>
    (b.highlight - a.highlight) || a.start.localeCompare(b.start) || a.end.localeCompare(b.end));

  if (!list.length) {
    $("gantt").innerHTML = `<p class="empty-msg">表示する企画展はありません</p>`;
    return;
  }

  const today = todayKey();
  $("gantt").innerHTML = list.map((e) => {
    const left = pos(parseKey(e.start), s);
    const right = pos(endOfDay(e.end), s);
    const m = museum(e.museum);
    const now = e.start <= today && today <= e.end;
    const isOpen = art.open === e.url;
    return `
    <div class="ex-row ${e.highlight ? "gogh" : ""} ${isOpen ? "open" : ""}" style="--c:var(--${e.museum})">
      <button type="button" class="ex-head" data-url="${esc(e.url)}" aria-expanded="${isOpen}">
        <span class="badge">${esc(m.short)}</span>
        ${e.highlight ? `<span class="star">★</span>` : ""}
        <span class="ex-title">${esc(e.title)}</span>
        ${now ? `<span class="now">開催中</span>` : ""}
      </button>
      <div class="track">${lines}<b class="bar" style="left:${left}%;width:${Math.max(right - left, 0.8)}%"></b></div>
      ${isOpen ? `
      <div class="ex-detail">
        <p>📍 ${esc(m.name)}</p>
        <p>🗓 ${shortDate(e.start)}（${WEEK[parseKey(e.start).getDay()]}）〜 ${shortDate(e.end)}（${WEEK[parseKey(e.end).getDay()]}）</p>
        <a href="${esc(e.url)}" target="_blank" rel="noopener">公式サイトで見る ›</a>
      </div>` : ""}
    </div>`;
  }).join("");

  $("gantt").querySelectorAll(".ex-head").forEach((btn) => {
    btn.addEventListener("click", () => {
      art.open = art.open === btn.dataset.url ? null : btn.dataset.url;
      renderGantt();
    });
  });
}

function renderArt() {
  renderArtFilters();
  renderGoghBanner();
  renderGantt();
}

// ---------- オケ／美 の切り替え ----------
async function loadArt() {
  if (art.data) return;
  try {
    const res = await fetch("exhibitions.json", { cache: "no-cache" });
    art.data = await res.json();
  } catch (e) {
    $("gantt").innerHTML = `<p class="empty-msg">データを読み込めませんでした。通信状態を確認してください。</p>`;
    return;
  }
  $("art-updated").textContent = `最終更新：${art.data.updated_at}`;
  if (art.data.errors?.length) {
    const names = art.data.errors.map((id) => museum(id).short).join("・");
    $("art-updated").textContent += `（${names}は取得に失敗したため前回の情報）`;
  }
  renderArt();
}

function setMode(mode) {
  localStorage.setItem("mode", mode);
  const isArt = mode === "art";
  for (const id of ["view-orch", "orch-footer", "updated"]) $(id).hidden = isArt;
  for (const id of ["view-art", "art-footer", "art-updated"]) $(id).hidden = !isArt;
  document.querySelectorAll(".mode-switch button").forEach((b) => {
    b.setAttribute("aria-selected", String(b.dataset.mode === mode));
  });
  if (isArt) loadArt();
}

document.querySelectorAll(".mode-switch button").forEach((b) => {
  b.addEventListener("click", () => setMode(b.dataset.mode));
});
setMode(localStorage.getItem("mode") === "art" ? "art" : "orch");
