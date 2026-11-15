// 「オケ」の画面：オーケストラの定期演奏会カレンダーを作るプログラム
// concerts.json（Pythonで集めたデータ）を読み込んで表示する

const SALE_NOTICE_DAYS = 30; // 何日先までの発売をお知らせするか
const SALE_RECENT_DAYS = 7;  // 何日前までの発売を「発売しました」として残すか
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

const state = {
  data: null,
  year: 0,
  month: 0,          // 0 = 1月
  selected: null,    // 選んだ日（"YYYY-MM-DD"）
  hidden: new Set(JSON.parse(localStorage.getItem("hiddenOrchestras") || "[]")),
  favs: new Set(JSON.parse(localStorage.getItem("favoriteConcerts") || "[]")), // ★を付けた公演
  favView: false,    // ★の公演だけを一覧に出しているか
};

const $ = (id) => document.getElementById(id);

// ---------- 日付の道具 ----------
const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const todayKey = () => toKey(new Date());
const daysBetween = (fromKey, toKeyStr) => Math.round((parseKey(toKeyStr) - parseKey(fromKey)) / 86400000);
const jpDate = (k, withWeek = true) => {
  const d = parseKey(k);
  return `${d.getMonth() + 1}月${d.getDate()}日` + (withWeek ? `（${WEEK[d.getDay()]}）` : "");
};
// ---------- 日本の祝日（計算で出す。外部のデータは使わない） ----------
const holidayCache = {};
function holidaysOf(y) {
  if (holidayCache[y]) return holidayCache[y];
  const h = new Set();
  const key = (m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const nthMonday = (m, n) => 1 + ((8 - new Date(y, m - 1, 1).getDay()) % 7) + (n - 1) * 7;
  const shift = y - 1980;
  [[1, 1], [2, 11], [2, 23], [4, 29], [5, 3], [5, 4], [5, 5], [8, 11], [11, 3], [11, 23]]
    .forEach(([m, d]) => h.add(key(m, d)));
  h.add(key(1, nthMonday(1, 2)));   // 成人の日
  h.add(key(7, nthMonday(7, 3)));   // 海の日
  h.add(key(9, nthMonday(9, 3)));   // 敬老の日
  h.add(key(10, nthMonday(10, 2))); // スポーツの日
  h.add(key(3, Math.floor(20.8431 + 0.242194 * shift - Math.floor(shift / 4)))); // 春分の日
  h.add(key(9, Math.floor(23.2488 + 0.242194 * shift - Math.floor(shift / 4)))); // 秋分の日
  // 国民の休日：祝日にはさまれた平日（9月の連休など）
  for (let d = 2; d <= 29; d++) {
    if (h.has(key(9, d - 1)) && h.has(key(9, d + 1)) && !h.has(key(9, d)) && new Date(y, 8, d).getDay() !== 0) h.add(key(9, d));
  }
  // 振替休日：日曜の祝日の次の、祝日でない日
  for (const k of [...h].sort()) {
    const d = parseKey(k);
    if (d.getDay() !== 0) continue;
    do d.setDate(d.getDate() + 1); while (h.has(toKey(d)));
    h.add(toKey(d));
  }
  return (holidayCache[y] = h);
}
const isHoliday = (k) => holidaysOf(Number(k.slice(0, 4))).has(k);
// 土日・祝日（演奏会に行ける日）
const isOffDay = (k) => { const w = parseKey(k).getDay(); return w === 0 || w === 6 || isHoliday(k); };

// ---------- ★（お気に入り） ----------
const favId = (c) => `${c.url}|${c.date}|${c.time}`;
const isFav = (c) => state.favs.has(favId(c));
function toggleFav(ids) {
  const on = ids.some((id) => state.favs.has(id));
  ids.forEach((id) => (on ? state.favs.delete(id) : state.favs.add(id)));
  localStorage.setItem("favoriteConcerts", JSON.stringify([...state.favs]));
  renderCalendar();
  renderList();
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- データ ----------
function orchestra(id) {
  return state.data.orchestras.find((o) => o.id === id) || { id, name: id, short: id };
}
function visibleConcerts() {
  return state.data.concerts.filter((c) => !state.hidden.has(c.orchestra));
}
const color = (id) => `var(--${id})`;

// ---------- 団体の切り替え ----------
function renderFilters() {
  $("filters").innerHTML = state.data.orchestras.map((o) => `
    <button type="button" class="chip ${state.hidden.has(o.id) ? "off" : ""}"
            style="--c:${color(o.id)}" data-id="${o.id}" aria-pressed="${!state.hidden.has(o.id)}">
      ${esc(o.short)}
    </button>`).join("");

  $("filters").querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      state.hidden.has(id) ? state.hidden.delete(id) : state.hidden.add(id);
      localStorage.setItem("hiddenOrchestras", JSON.stringify([...state.hidden]));
      renderAll();
    });
  });
}

// ---------- カレンダー ----------
function monthBounds() {
  // データがある範囲の月だけ移動できるようにする
  const keys = state.data.concerts.map((c) => c.date).sort();
  const first = parseKey(keys[0] || todayKey());
  const last = parseKey(keys[keys.length - 1] || todayKey());
  const now = new Date();
  const min = Math.min(first.getFullYear() * 12 + first.getMonth(), now.getFullYear() * 12 + now.getMonth());
  const max = Math.max(last.getFullYear() * 12 + last.getMonth(), now.getFullYear() * 12 + now.getMonth());
  return { min, max };
}

function renderCalendar() {
  const { year, month } = state;
  $("month-title").textContent = `${year}年${month + 1}月`;

  const { min, max } = monthBounds();
  const cur = year * 12 + month;
  $("prev").disabled = cur <= min;
  $("next").disabled = cur >= max;

  const byDay = {};
  for (const c of visibleConcerts()) (byDay[c.date] ||= []).push(c);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayKey();
  let html = "";

  for (let i = 0; i < firstDow; i++) html += `<div class="day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${pad(month + 1)}-${pad(d)}`;
    const dow = (firstDow + d - 1) % 7;
    const list = byDay[key] || [];
    const cls = ["day",
      dow === 0 || isHoliday(key) ? "sun" : "", dow === 6 && !isHoliday(key) ? "sat" : "",
      key === today ? "today" : "", key < today ? "past" : "",
      key === state.selected ? "selected" : ""].filter(Boolean).join(" ");
    const tags = list.map((c) =>
      `<span class="tag ${c.sold_out ? "soldout" : ""} ${c.highlight ? "kobaken" : ""}" style="--c:${color(c.orchestra)}">${esc(orchestra(c.orchestra).tag || orchestra(c.orchestra).short)}</span>`
    ).join("");
    const label = `${month + 1}月${d}日` + (list.length ? `、${list.length}公演` : "");
    const fav = list.some(isFav) ? `<span class="fav-mark">★</span>` : "";
    html += `<button type="button" class="${cls}" data-key="${key}" aria-label="${label}"><span class="num">${d}${fav}</span>${tags}</button>`;
  }
  $("grid").innerHTML = html;

  $("grid").querySelectorAll(".day[data-key]").forEach((cell) => {
    cell.addEventListener("click", () => {
      const key = cell.dataset.key;
      state.selected = state.selected === key ? null : key;
      state.favView = false;
      renderCalendar();
      renderList();
      if (state.selected) $("list-title").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// ---------- 公演の一覧 ----------
// 同じ団体・同じ指揮者・同じ曲目なら「同じ演目」とみなす
const programKey = (c) =>
  [c.orchestra, c.conductor, c.program.length ? c.program.join("|") : c.title.replace(/［.］|\s/g, "")].join("#");

// 公演カード。group は同じ演目の公演（日付順）で、1枚にまとめて日付を並べる
// folded = true なら、1行だけ見せて、タップで開く
function concertCard(c, group = [c], folded = false) {
  const o = orchestra(c.orchestra);
  const today = todayKey();
  let saleNote = "";
  if (c.sale_date) {
    saleNote = c.sale_date > today
      ? `<span class="badge onsale-soon">${jpDate(c.sale_date, false)} 発売</span>`
      : `一般発売 ${jpDate(c.sale_date, false)}`;
  }
  // 会場が日によって違うときは、日付の横に会場を書く
  const sameVenue = group.every((g) => g.venue === c.venue);
  const whens = group.map((g) =>
    `<span class="when">${jpDate(g.date)} ${esc(g.time)}${sameVenue ? "" : `（${esc(g.venue)}）`}` +
    `${g.sold_out ? ` <span class="badge soldout">完売</span>` : ""}</span>`
  ).join(`<span class="sep">／</span>`);
  // 「［金］」「［土］」のような曜日の印は、まとめたときは外す
  const title = group.length > 1 ? c.title.replace(/［.］/g, "") : c.title;
  const fav = group.some(isFav);
  const star = `<button type="button" class="star-btn ${fav ? "on" : ""}" data-ids="${esc(group.map(favId).join("\n"))}"
      aria-label="${fav ? "★を外す" : "★を付ける"}" aria-pressed="${fav}">${fav ? "★" : "☆"}</button>`;
  const head = `
    <div class="meta">
      <span class="badge">${esc(o.short)}</span>
      ${whens}
      ${star}
    </div>
    <h3>${esc(title)}</h3>`;
  const body = `
    ${c.venue && sameVenue ? `<p class="venue">📍 ${esc(c.venue)}</p>` : ""}
    ${c.conductor ? `<p class="people">指揮：<strong>${c.highlight ? "★ " : ""}${esc(c.conductor)}</strong></p>` : ""}
    ${c.performers.length ? `<p class="people">${c.performers.map(esc).join(" ／ ")}</p>` : ""}
    ${c.program.length ? `<ul>${c.program.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
    <div class="links">
      <span>${saleNote}</span>
      ${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">公式サイトで見る ›</a>` : ""}
    </div>`;
  const cls = `concert ${c.highlight ? "kobaken" : ""} ${fav ? "fav" : ""}`;
  return folded
    ? `<details class="${cls} folded" style="--c:${color(c.orchestra)}"><summary>${head}</summary>${body}</details>`
    : `<article class="${cls}" style="--c:${color(c.orchestra)}">${head}${body}</article>`;
}

function renderList() {
  const { year, month, selected, favView } = state;
  const monthPrefix = `${year}-${pad(month + 1)}-`;
  let list = visibleConcerts();

  if (favView) {
    list = list.filter(isFav);
    $("list-title").textContent = `★の公演（${list.length}）`;
  } else if (selected) {
    list = list.filter((c) => c.date === selected);
    $("list-title").textContent = `${jpDate(selected)}の公演`;
  } else {
    list = list.filter((c) => c.date.startsWith(monthPrefix));
    $("list-title").textContent = `${month + 1}月の公演（${list.length}）`;
  }
  $("show-all").hidden = !selected || favView;
  $("fav-toggle").textContent = favView ? "月の一覧に戻る" : `★の公演（${visibleConcerts().filter(isFav).length}）`;
  $("fav-toggle").classList.toggle("on", favView);

  // 同じ演目の公演を1枚のカードにまとめる（日付を選んだときはそのまま）
  const groups = new Map();
  for (const c of list) {
    const key = selected && !favView ? favId(c) : programKey(c);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  // 月の一覧では、平日だけの公演は折りたたむ（土日・祝日を含むものは開いたまま）
  const foldWeekdays = !selected && !favView;
  const html = [...groups.values()]
    .map((g) => concertCard(g[0], g, foldWeekdays && !g.some((c) => isOffDay(c.date))))
    .join("");

  const empty = favView ? "☆を押すと、ここに集まります"
    : selected ? "この日の定期演奏会はありません" : "この月の定期演奏会はありません";
  $("list").innerHTML = list.length ? html : `<p class="empty-msg">${empty}</p>`;

  $("list").querySelectorAll(".star-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault(); // 折りたたみが開いたり閉じたりしないように
      toggleFav(btn.dataset.ids.split("\n"));
    });
  });
}

// ---------- 発売のお知らせ ----------
function renderSales() {
  const today = todayKey();
  // 同じ団体・同じ発売日・同じ公演名（2日公演など）はまとめる
  const groups = new Map();
  for (const c of visibleConcerts()) {
    if (!c.sale_date) continue;
    const diff = daysBetween(today, c.sale_date);
    if (diff > SALE_NOTICE_DAYS || diff < -SALE_RECENT_DAYS) continue;
    const key = `${c.orchestra}|${c.sale_date}|${c.title}`;
    if (!groups.has(key)) groups.set(key, { ...c, dates: [], diff });
    groups.get(key).dates.push(c.date);
  }
  const items = [...groups.values()].sort((a, b) => a.sale_date.localeCompare(b.sale_date) || a.date.localeCompare(b.date));

  if (!items.length) {
    $("sales").innerHTML = `<p class="empty-msg">これから${SALE_NOTICE_DAYS}日以内に一般発売される公演はありません</p>`;
    return;
  }

  $("sales").innerHTML = items.map((g) => {
    const o = orchestra(g.orchestra);
    const dates = g.dates.map((d) => jpDate(d, false)).join("・");
    let count, message;
    if (g.diff > 0) {
      count = `<small>あと</small><b>${g.diff}</b><small>日</small>`;
      message = `<strong>${esc(o.short)}</strong>の${dates}の演奏会、販売日が近づいています`;
    } else if (g.diff === 0) {
      count = `<b>今日</b>`;
      message = `<strong>${esc(o.short)}</strong>の${dates}の演奏会、今日から一般発売です`;
    } else {
      count = `<small>発売中</small>`;
      message = `<strong>${esc(o.short)}</strong>の${dates}の演奏会、一般発売が始まりました`;
    }
    return `
    <div class="sale-item ${g.diff < 0 ? "done" : ""}" style="--c:${color(g.orchestra)}">
      <div class="countdown">${count}</div>
      <div class="text">
        ${message}${g.sold_out ? "（完売）" : ""}<br>
        <span class="sub">${esc(g.title)} ／ 一般発売 ${jpDate(g.sale_date)}</span>
        ${g.url ? `<br><a class="sub" href="${esc(g.url)}" target="_blank" rel="noopener" style="color:${color(g.orchestra)}">公式サイト ›</a>` : ""}
      </div>
    </div>`;
  }).join("");
}

// ---------- 全体 ----------
function renderAll() {
  renderFilters();
  renderCalendar();
  renderList();
  renderSales();
}

function moveMonth(step) {
  const d = new Date(state.year, state.month + step, 1);
  state.year = d.getFullYear();
  state.month = d.getMonth();
  state.selected = null;
  renderCalendar();
  renderList();
}

async function init() {
  $("prev").addEventListener("click", () => moveMonth(-1));
  $("next").addEventListener("click", () => moveMonth(1));
  $("show-all").addEventListener("click", () => { state.selected = null; renderCalendar(); renderList(); });
  $("fav-toggle").addEventListener("click", () => {
    state.favView = !state.favView;
    state.selected = null;
    renderCalendar();
    renderList();
    $("list-title").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const now = new Date();
  state.year = now.getFullYear();
  state.month = now.getMonth();

  try {
    const res = await fetch("concerts.json", { cache: "no-cache" });
    state.data = await res.json();
  } catch (e) {
    $("list").innerHTML = `<p class="empty-msg">データを読み込めませんでした。通信状態を確認してください。</p>`;
    return;
  }
  $("updated").textContent = `最終更新：${state.data.updated_at}`;
  if (state.data.errors?.length) {
    const names = state.data.errors.map((id) => orchestra(id).short).join("・");
    $("updated").textContent += `（${names}は取得に失敗したため前回の情報）`;
  }
  renderAll();
}

init();
