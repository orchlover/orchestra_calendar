// オーケストラカレンダーの画面を作るプログラム
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
      dow === 0 ? "sun" : "", dow === 6 ? "sat" : "",
      key === today ? "today" : "", key < today ? "past" : "",
      key === state.selected ? "selected" : ""].filter(Boolean).join(" ");
    const tags = list.map((c) =>
      `<span class="tag ${c.sold_out ? "soldout" : ""}" style="--c:${color(c.orchestra)}">${esc(orchestra(c.orchestra).short)}</span>`
    ).join("");
    const label = `${month + 1}月${d}日` + (list.length ? `、${list.length}公演` : "");
    html += `<button type="button" class="${cls}" data-key="${key}" aria-label="${label}"><span class="num">${d}</span>${tags}</button>`;
  }
  $("grid").innerHTML = html;

  $("grid").querySelectorAll(".day[data-key]").forEach((cell) => {
    cell.addEventListener("click", () => {
      const key = cell.dataset.key;
      state.selected = state.selected === key ? null : key;
      renderCalendar();
      renderList();
      if (state.selected) $("list-title").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

// ---------- 公演の一覧 ----------
function concertCard(c) {
  const o = orchestra(c.orchestra);
  const today = todayKey();
  let saleNote = "";
  if (c.sale_date) {
    saleNote = c.sale_date > today
      ? `<span class="badge onsale-soon">${jpDate(c.sale_date, false)} 発売</span>`
      : `一般発売 ${jpDate(c.sale_date, false)}`;
  }
  return `
  <article class="concert" style="--c:${color(c.orchestra)}">
    <div class="meta">
      <span class="badge">${esc(o.short)}</span>
      <span class="when">${jpDate(c.date)} ${esc(c.time)}</span>
      ${c.sold_out ? `<span class="badge soldout">完売</span>` : ""}
    </div>
    <h3>${esc(c.title)}</h3>
    ${c.venue ? `<p class="venue">📍 ${esc(c.venue)}</p>` : ""}
    ${c.conductor ? `<p class="people">指揮：<strong>${esc(c.conductor)}</strong></p>` : ""}
    ${c.performers.length ? `<p class="people">${c.performers.map(esc).join(" ／ ")}</p>` : ""}
    ${c.program.length ? `<ul>${c.program.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""}
    <div class="links">
      <span>${saleNote}</span>
      ${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">公式サイトで見る ›</a>` : ""}
    </div>
  </article>`;
}

function renderList() {
  const { year, month, selected } = state;
  const monthPrefix = `${year}-${pad(month + 1)}-`;
  let list = visibleConcerts();

  if (selected) {
    list = list.filter((c) => c.date === selected);
    $("list-title").textContent = `${jpDate(selected)}の公演`;
  } else {
    list = list.filter((c) => c.date.startsWith(monthPrefix));
    $("list-title").textContent = `${month + 1}月の公演（${list.length}）`;
  }
  $("show-all").hidden = !selected;

  $("list").innerHTML = list.length
    ? list.map(concertCard).join("")
    : `<p class="empty-msg">${selected ? "この日の定期演奏会はありません" : "この月の定期演奏会はありません"}</p>`;
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
