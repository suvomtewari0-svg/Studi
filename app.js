/* ============================================================
   Studi — gamified studying (standalone app)
   Vanilla JS. State persists in localStorage, so closing and
   reopening keeps everything. Notifications + audio are real.
   ============================================================ */

const KEY = "studi:v2";
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const THEMES = [
  { id: "nebula",  name: "Nebula",  a: "#7c5cff", b: "#22d3ee" },
  { id: "glacier", name: "Glacier", a: "#22d3ee", b: "#7c5cff" },
  { id: "ember",   name: "Ember",   a: "#ff7a3d", b: "#f5b942" },
  { id: "mint",    name: "Mint",    a: "#34d399", b: "#22d3ee" },
  { id: "bloom",   name: "Bloom",   a: "#fb6f92", b: "#a855f7" },
  { id: "royal",   name: "Royal",   a: "#f5b942", b: "#ffd479" },
];
const RANKS = [
  { name: "Beginner", min: 0 }, { name: "Scholar", min: 500 },
  { name: "Elite", min: 1500 }, { name: "Mastermind", min: 3500 }, { name: "Legendary", min: 7000 },
];
const ROOM_TILES = [
  { name: "Oak Desk", icon: "🪑", lvl: 1 }, { name: "Lo-fi Lamp", icon: "💡", lvl: 1 },
  { name: "Bookshelf", icon: "📚", lvl: 3 }, { name: "Plant", icon: "🪴", lvl: 5 },
  { name: "Pixel Pet", icon: "🐾", lvl: 8 }, { name: "Aurora Sky", icon: "🌌", lvl: 12 },
];
const SOUNDS = [
  { id: "lofi", label: "Lo-fi", icon: "🎵" }, { id: "rain", label: "Rain", icon: "🌧️" },
  { id: "forest", label: "Forest", icon: "🌲" }, { id: "synth", label: "Synth", icon: "🎹" },
  { id: "brown", label: "Brown noise", icon: "🟫" },
];
const BLOCK_SITES = ["Instagram", "TikTok", "YouTube", "X / Twitter", "Reddit", "Discord"];
const RARITY = { common:{l:"Common",c:"#94a3b8"}, rare:{l:"Rare",c:"#22d3ee"}, epic:{l:"Epic",c:"#a855f7"}, legendary:{l:"Legendary",c:"#f5b942"} };
const LOOT = [
  { r:"common", coins:30, xp:20 }, { r:"common", coins:45, xp:15, item:"Sticker Pack" },
  { r:"rare", coins:90, xp:60 }, { r:"rare", coins:70, xp:80, item:"Lo-fi Track" },
  { r:"epic", coins:180, xp:120, item:"Galaxy Wallpaper" }, { r:"epic", coins:150, xp:150, item:"Neon Shelf" },
  { r:"legendary", coins:400, xp:250, item:"Pixel Fox" }, { r:"legendary", coins:320, xp:300, item:"Golden Desk" },
];
const WEIGHTS = { common:30, rare:35, epic:25, legendary:10 };

/* ---------------- state + persistence ---------------- */
const fresh = () => ({
  onboarded: false, stage: "profile",
  username: "", pfp: null, avColor: "#7c5cff", themeId: "nebula", dark: true,
  xp: 0, coins: 0, streak: 0, lastStudyDate: null,
  tasks: [], schedule: [], sessions: [], inventory: [],
  lastCrate: null, strictFocus: false,
  blocked: {}, // site -> bool
  notify: false,
});
let S = load();
function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return Object.assign(fresh(), JSON.parse(raw)); }
  catch (e) {}
  return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;" }[c]));
const todayStr = () => new Date().toISOString().slice(0, 10);
const level = () => Math.floor(S.xp / 250) + 1;
const xpInto = () => S.xp % 250;
const rank = () => [...RANKS].reverse().find((r) => S.xp >= r.min).name;
const subColor = (s) => { let h = 0; for (const ch of s) h = ch.charCodeAt(0) + ((h << 5) - h); return `hsl(${h % 360} 70% 60%)`; };

/* ---------------- toast / notifications ---------------- */
let toastT = null;
function toast(msg) {
  let el = $("#toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg; el.style.display = "block";
  clearTimeout(toastT); toastT = setTimeout(() => { el.style.display = "none"; }, 2600);
}
async function ensureNotify() {
  if (!("Notification" in window)) { toast("Notifications aren't supported in this browser"); return false; }
  if (Notification.permission === "granted") { S.notify = true; save(); return true; }
  if (Notification.permission === "denied") { toast("Notifications are blocked in browser settings"); return false; }
  const p = await Notification.requestPermission();
  S.notify = p === "granted"; save();
  if (S.notify) toast("Notifications enabled ✓"); else toast("Notifications not enabled");
  return S.notify;
}
function notify(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    try { new Notification(title, { body, silent: false }); } catch (e) {}
  }
  toast(title + (body ? " — " + body : ""));
}

/* ---------------- rewards / streak / crate ---------------- */
let levelUpQueued = false;
function reward(xp, coins, silent) {
  const before = Math.floor(S.xp / 250);
  S.xp += xp; S.coins += coins;
  if (Math.floor(S.xp / 250) > before) levelUpQueued = true;
  save();
  if (!silent) toast(`+${xp} XP · +${coins} coins`);
}
function updateStreak() {
  const today = todayStr();
  if (S.lastStudyDate === today) return;          // already counted today
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  S.streak = (S.lastStudyDate === yesterday) ? S.streak + 1 : 1;
  S.lastStudyDate = today; save();
  toast(`🔥 ${S.streak}-day streak!`);
}
function refreshStreakOnLoad() {
  if (!S.lastStudyDate) { S.streak = 0; return; }
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  if (S.lastStudyDate !== todayStr() && S.lastStudyDate !== yesterday) { S.streak = 0; save(); }
}
function rollCrate() {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  let pick = Math.random() * total, chosen = "common";
  for (const [r, w] of Object.entries(WEIGHTS)) { if ((pick -= w) <= 0) { chosen = r; break; } }
  const pool = LOOT.filter((l) => l.r === chosen);
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ---------------- timer ---------------- */
let T = { running: false, total: 25 * 60, remaining: 25 * 60, handle: null, subject: "General" };
function fmt(s) { return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
function timerPct() { return 100 - (T.remaining / T.total) * 100; }
function paintTimer() {
  const c = $(".clock"); if (c) c.textContent = fmt(T.remaining);
  const r = $(".ring"); if (r) r.style.setProperty("--p", timerPct());
  const oc = $("#fo-clock"); if (oc) oc.textContent = fmt(T.remaining);
}
function startTimer() {
  if (T.running) return;
  const subj = $("#subject"); if (subj && subj.value.trim()) T.subject = subj.value.trim();
  if (!S.notify) ensureNotify();
  T.running = true;
  if (S.strictFocus) showFocusOverlay();
  T.handle = setInterval(() => {
    T.remaining--;
    paintTimer();
    if (T.remaining <= 0) completeTimer();
  }, 1000);
  render();
}
function pauseTimer() {
  T.running = false; clearInterval(T.handle); hideFocusOverlay(); render();
}
function resetTimer() {
  T.running = false; clearInterval(T.handle); T.remaining = T.total; hideFocusOverlay(); render();
}
function setTotal(mins, light) {
  mins = Math.max(1, Math.min(240, Math.round(mins)));
  T.total = mins * 60;
  if (!T.running) T.remaining = T.total;
  if (light) {
    paintTimer();
    const rd = $("#customRead"); if (rd) rd.textContent = mins + "m";
    document.querySelectorAll('[data-act="preset"]').forEach((b) => b.classList.toggle("on", +b.dataset.m === mins));
  } else { render(); }
}
function completeTimer() {
  clearInterval(T.handle); T.running = false;
  const mins = Math.round(T.total / 60);
  reward(mins * 4, mins * 2, true);
  S.sessions.push({ date: todayStr(), minutes: mins, subject: T.subject || "General" }); save();
  updateStreak();
  if (window.StudiAudio) window.StudiAudio.chime();
  notify("Session complete! 🎉", `+${mins * 4} XP · +${mins * 2} coins. Nice focus.`);
  hideFocusOverlay();
  T.remaining = T.total;
  render();
}

/* ---------------- focus mode (honest) ---------------- */
let slips = 0;
function onVisChange() {
  if (document.hidden && T.running && S.strictFocus) {
    slips++;
    const s = $("#fo-slips"); // updated when they return
  } else if (!document.hidden && S.strictFocus && T.running) {
    const s = $("#fo-slips");
    if (s && slips > 0) s.textContent = `You left ${slips} time${slips > 1 ? "s" : ""} — stay with it!`;
  }
}
function showFocusOverlay() {
  slips = 0;
  if ($("#focus-overlay")) return;
  const ov = document.createElement("div");
  ov.id = "focus-overlay"; ov.className = "focus-overlay";
  ov.innerHTML = `
    <div class="eyebrow">Focus mode — strict</div>
    <div class="big" id="fo-clock">${fmt(T.remaining)}</div>
    <div>Studying <b>${esc(T.subject || "General")}</b></div>
    <div class="fo-slips" id="fo-slips"></div>
    <button class="btn" data-act="endFocus">End session</button>
    <p class="muted" style="max-width:340px">Leaving this tab is detected and logged. A web page can't block other apps on your device — that needs the native app or a browser extension.</p>`;
  document.body.appendChild(ov);
  document.addEventListener("visibilitychange", onVisChange);
}
function hideFocusOverlay() {
  const ov = $("#focus-overlay"); if (ov) ov.remove();
  document.removeEventListener("visibilitychange", onVisChange);
}

/* ---------------- scheduler (fires while app is open) ---------------- */
const firedKeys = new Set();
function checkSchedule() {
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  const day = now.getDay();
  S.schedule.forEach((s) => {
    if (!s.on) return;
    if (s.time === hhmm && s.days.includes(day)) {
      const k = `${s.id}@${todayStr()}T${s.time}`;
      if (!firedKeys.has(k)) { firedKeys.add(k); notify("Time to study 📚", `Your ${s.subject} session is now.`); }
    }
  });
}
setInterval(checkSchedule, 20000);

/* ============================================================
   RENDERING
   ============================================================ */
let nav = "home";
function applyTheme() {
  const t = THEMES.find((x) => x.id === S.themeId) || THEMES[0];
  document.documentElement.style.setProperty("--accent", t.a);
  document.documentElement.style.setProperty("--accent2", t.b);
  document.body.className = S.dark ? "dark" : "light";
}
function avatar(size) {
  if (S.pfp) return `<img class="av-img" src="${S.pfp}" style="width:${size}px;height:${size}px" alt="">`;
  const initial = (S.username || "S")[0].toUpperCase();
  return `<div class="av-fallback" style="width:${size}px;height:${size}px;background:${S.avColor};font-size:${size * 0.42}px">${initial}</div>`;
}

function render() {
  applyTheme();
  const app = $("#app");
  if (!S.onboarded) { app.innerHTML = S.stage === "theme" ? themeScreen() : profileScreen(); bind(); return; }
  app.innerHTML = shell();
  if (levelUpQueued) { levelUpQueued = false; showLevelUp(); }
  bind();
}

/* ---------- onboarding ---------- */
function profileScreen() {
  return `<div class="ob-bg"><div class="ob-card">
    <div class="ob-top"><span class="logo">◆</span><span class="wordmark">Studi</span></div>
    <div class="ob-dots"><span class="on"></span><span></span></div>
    <h1 class="ob-title">Create your profile</h1>
    <p class="muted ob-sub">This is how friends will find you on Studi.</p>
    <div class="ob-avatar-wrap">
      <div class="ob-avatar" style="background:${S.pfp ? "transparent" : S.avColor}">
        ${S.pfp ? `<img src="${S.pfp}" alt="">` : (S.username || "S")[0].toUpperCase()}</div>
      <button class="btn sm" data-act="pickPhoto">＋ Upload photo</button>
      <input id="file" type="file" accept="image/*" class="hide">
    </div>
    ${S.pfp ? `<button class="link" data-act="rmPhoto">Remove photo</button>` :
      `<div class="ob-colors">${["#7c5cff","#22d3ee","#34d399","#f5b942","#fb6f92","#ff7a3d"]
        .map((c) => `<button class="swatch ${S.avColor === c ? "on" : ""}" data-act="avc" data-c="${c}" style="background:${c}"></button>`).join("")}</div>`}
    <input id="uname" class="input ob-input" placeholder="Choose a username" maxlength="20" value="${esc(S.username)}">
    <button class="btn primary lg full" data-act="toTheme" ${S.username.trim() ? "" : "disabled"}>Next ›</button>
  </div></div>`;
}
function themeScreen() {
  return `<div class="ob-bg"><div class="ob-card">
    <div class="ob-top"><span class="logo">◆</span><span class="wordmark">Studi</span></div>
    <div class="ob-dots"><span class="done"></span><span class="on"></span></div>
    <h1 class="ob-title">Pick your vibe</h1>
    <p class="muted ob-sub">Set the colors and mood — change it anytime later.</p>
    <div class="ob-seg">
      <button class="segbtn ${S.dark ? "on" : ""}" data-act="mode" data-m="dark">🌙 Dark</button>
      <button class="segbtn ${!S.dark ? "on" : ""}" data-act="mode" data-m="light">☀️ Light</button>
    </div>
    <div class="ob-themes">${THEMES.map((t) => `
      <button class="themecard ${S.themeId === t.id ? "on" : ""}" data-act="theme" data-t="${t.id}">
        <span class="tc-orb" style="background:linear-gradient(135deg,${t.a},${t.b})">${S.themeId === t.id ? "✓" : ""}</span>
        <span class="tc-name">${t.name}</span></button>`).join("")}</div>
    <div class="ob-nav">
      <button class="btn" data-act="toProfile">Back</button>
      <button class="btn primary lg" data-act="finish">Enter Studi ›</button>
    </div>
  </div></div>`;
}

/* ---------- shell ---------- */
function shell() {
  const items = [["home","🏠","Base"],["timer","⏱️","Focus"],["tasks","✅","Quests"],["sched","📅","Schedule"],["stats","📊","Stats"]];
  return `
  <header class="topbar">
    <div class="brand"><span class="logo">◆</span><span class="wordmark">Studi</span></div>
    <div class="hud">
      <div class="stat hud-streak">🔥 <span>${S.streak}d</span></div>
      <div class="stat hud-coins">🪙 <span>${S.coins}</span></div>
      <div class="stat hud-level">⭐ <span>Lv ${level()}</span></div>
    </div>
    <div class="topright">
      <div class="profilechip">${avatar(28)}<span class="pc-name">${esc(S.username || "Scholar")}</span></div>
      <button class="iconbtn" data-act="toggleTheme" title="Toggle theme">${S.dark ? "☀️" : "🌙"}</button>
    </div>
  </header>
  <div class="shell">
    <nav class="nav">${items.map(([id, ic, lbl]) =>
      `<button class="navitem ${nav === id ? "on" : ""}" data-act="nav" data-n="${id}">
        <span class="navic">${ic}</span><span class="navlbl">${lbl}</span></button>`).join("")}</nav>
    <main class="main">${
      nav === "home" ? homeScreen() :
      nav === "timer" ? timerScreen() :
      nav === "tasks" ? tasksScreen() :
      nav === "sched" ? schedScreen() : statsScreen()
    }</main>
  </div>`;
}

/* ---------- home ---------- */
function homeScreen() {
  const lv = level(), crateReady = S.lastCrate !== todayStr();
  const quests = [
    ["Complete a focus session", S.sessions.some((x) => x.date === todayStr())],
    ["Finish a task today", S.tasks.some((t) => t.done && t.doneDate === todayStr())],
    ["Keep your streak alive", S.lastStudyDate === todayStr()],
  ];
  return `<div class="grid">
    <section class="card hero">
      <div class="hero-row">
        <div>
          <p class="eyebrow">Welcome, ${esc(S.username || "Scholar")}</p>
          <h1 class="rank-title">${rank()}</h1>
          <p class="muted">Level ${lv} · ${S.streak > 0 ? `🔥 ${S.streak}-day streak` : "start your streak today"}</p>
        </div>
        <div class="rankring" style="--p:${(xpInto() / 250) * 100}"><div class="rr-in"><b>${lv}</b><span>LVL</span></div></div>
      </div>
      <div class="xpbar"><div class="xpfill" style="width:${(xpInto() / 250) * 100}%"></div><span class="xptxt">${xpInto()} / 250 XP</span></div>
    </section>

    <section class="card">
      <div class="cardhead"><span class="ch-ic">🏠</span><h3>Your Base</h3></div>
      <div class="room">${ROOM_TILES.map((it) => {
        const on = lv >= it.lvl;
        return `<div class="roomtile ${on ? "" : "locked"}"><span style="font-size:20px">${on ? it.icon : "🔒"}</span>
          <span>${it.name}</span><span class="lvl">${on ? "unlocked" : "Lv " + it.lvl}</span></div>`;
      }).join("")}</div>
    </section>

    <section class="card">
      <div class="cardhead"><span class="ch-ic">🏆</span><h3>Today's quests</h3></div>
      <ul class="checklist">${quests.map(([t, d]) =>
        `<li class="${d ? "done" : ""}"><span class="tick">${d ? "✓" : ""}</span>${t}</li>`).join("")}</ul>
    </section>

    <section class="card">
      <div class="cardhead"><span class="ch-ic">🪙</span><h3>Daily reward crate</h3></div>
      <div class="crate">
        <div class="crate-box ${crateReady ? "" : "claimed"}">${crateReady ? "◆" : "✓"}</div>
        <div class="crate-body">
          ${crateReady ? `<p class="muted">A crate is ready to open.</p><button class="btn primary" data-act="openCrate">Open crate</button>`
            : `<p class="muted">Claimed today — next crate tomorrow.</p>`}
        </div>
      </div>
      ${S.inventory.length ? `<div class="inv"><span class="inv-h">Inventory</span><div class="inv-items">${
        S.inventory.map((i) => `<span class="inv-pill">✨ ${esc(i)}</span>`).join("")}</div></div>` : ""}
    </section>
  </div>`;
}

/* ---------- timer ---------- */
function timerScreen() {
  const playing = window.StudiAudio ? window.StudiAudio.playing() : null;
  const mins = Math.round(T.total / 60);
  return `<div class="grid">
    <section class="card focuscard">
      <div class="cardhead"><span class="ch-ic">⏱️</span><h3>Focus session</h3></div>
      <div class="ring-wrap"><div class="ring" style="--p:${timerPct()}">
        <div class="ring-in"><span class="clock">${fmt(T.remaining)}</span><span class="muted">${T.running ? "studying…" : "ready"}</span></div></div></div>
      <div class="presets">
        ${[15, 25, 50].map((p) => `<button class="chip ${mins === p && !isCustom() ? "on" : ""}" data-act="preset" data-m="${p}" ${T.running ? "disabled" : ""}>${p}m</button>`).join("")}
      </div>
      <div class="custom-wrap">
        <div class="custom-head"><span class="muted">Custom length</span><b id="customRead">${mins}m</b></div>
        <div class="custom-row">
          <button class="iconbtn" data-act="stepMin" data-d="-5" ${T.running ? "disabled" : ""}>−</button>
          <input id="customMin" class="slider" type="range" min="5" max="120" step="5" value="${Math.min(120, Math.max(5, mins))}" ${T.running ? "disabled" : ""}>
          <button class="iconbtn" data-act="stepMin" data-d="5" ${T.running ? "disabled" : ""}>+</button>
        </div>
      </div>
      <input id="subject" class="input" style="max-width:260px;margin:12px auto 0;display:block;text-align:center" placeholder="Subject (e.g. Math)" value="${esc(T.subject)}" ${T.running ? "disabled" : ""}>
      <div class="ctrls">
        <button class="iconbtn lg" data-act="resetTimer" title="Reset">↺</button>
        <button class="btn primary lg" data-act="${T.running ? "pauseTimer" : "startTimer"}">${T.running ? "❚❚ Pause" : "▶ Start"}</button>
      </div>
      <p class="reward-note">⚡ Finish to earn ${mins * 4} XP and ${mins * 2} coins · you'll get a notification when it ends</p>
    </section>

    <section class="card">
      <div class="cardhead"><span class="ch-ic">🎧</span><h3>Focus sounds</h3></div>
      <div class="sounds">${SOUNDS.map((s) =>
        `<button class="soundbtn ${playing === s.id ? "on" : ""}" data-act="sound" data-s="${s.id}">${s.icon} ${s.label}</button>`).join("")}</div>
      <div class="vol-row">🔉<input id="vol" type="range" min="0" max="100" value="60">🔊</div>
      <p class="muted" style="margin-top:8px">All sounds are generated live in your browser — no files, nothing copyrighted.</p>
    </section>

    <section class="card">
      <div class="cardhead"><span class="ch-ic">🛡️</span><h3>Focus mode</h3></div>
      <div class="blockrow">Strict focus (full-screen + leave detection)
        <button class="toggle ${S.strictFocus ? "on" : ""}" data-act="toggleStrict"></button></div>
      <div class="blocklist">${BLOCK_SITES.map((site) =>
        `<div class="blockrow">${esc(site)}<button class="toggle ${S.blocked[site] ? "on" : ""}" data-act="block" data-site="${esc(site)}"></button></div>`).join("")}</div>
      <div class="focusinfo">Strict focus fills the screen during a session and detects when you switch away, nudging you back and logging slips.
      <br><br><b>Heads up:</b> a website can't truly block other apps on your phone or computer — that needs the native Studi app or a browser extension. The toggles above are a commitment list to keep you honest.</div>
    </section>
  </div>`;
}
function isCustom() { return ![15, 25, 50].includes(Math.round(T.total / 60)); }

/* ---------- tasks ---------- */
function tasksScreen() {
  const active = S.tasks.filter((t) => !t.done).length;
  return `<div class="grid"><section class="card wide">
    <div class="cardhead"><span class="ch-ic">✅</span><h3>Quest log</h3><span class="ch-tag">${active} active</span></div>
    <div class="addrow">
      <input id="taskTitle" class="input" placeholder="Add a quest…">
      <input id="taskSubject" class="input" style="max-width:130px" placeholder="Subject">
      <button class="btn primary" data-act="addTask">＋ Add</button>
    </div>
    ${S.tasks.length ? `<ul class="tasks">${S.tasks.map((t) => `
      <li class="${t.done ? "done" : ""}">
        <span class="tdot" style="background:${subColor(t.subject || "General")}"></span>
        <span class="ttitle">${esc(t.title)}</span>
        <span class="tsub">${esc(t.subject || "General")}</span>
        <span class="tcheck" data-act="toggleTask" data-id="${t.id}">${t.done ? "✓" : "›"}</span>
        <button class="tdel" data-act="delTask" data-id="${t.id}">✕</button>
      </li>`).join("")}</ul>` : `<p class="empty">No quests yet. Add your first one above.</p>`}
    <p class="reward-note">⚡ Completing a quest grants +40 XP · +15 coins</p>
  </section></div>`;
}

/* ---------- schedule ---------- */
let draftDays = [1, 3, 5];
function schedScreen() {
  return `<div class="grid">
    <section class="card wide">
      <div class="cardhead"><span class="ch-ic">📅</span><h3>Study schedule</h3>
        <button class="btn sm ch-tag" data-act="enableNotify" style="cursor:pointer">${S.notify ? "🔔 Notifications on" : "Enable notifications"}</button></div>
      <div class="addrow">
        <input id="schSubject" class="input" placeholder="Subject (e.g. Math)">
        <input id="schTime" class="input" type="time" style="max-width:150px" value="19:00">
      </div>
      <div class="daybtns" style="margin-bottom:12px">${DAYS.map((d, i) =>
        `<button class="daybtn ${draftDays.includes(i) ? "on" : ""}" data-act="draftDay" data-i="${i}">${d[0]}</button>`).join("")}</div>
      <button class="btn primary" data-act="addSched">＋ Add session</button>
      ${S.schedule.length ? `<ul class="sched" style="margin-top:16px">${S.schedule.map((s) => `
        <li><b>${esc(s.subject)}</b><span class="stime">${s.time}</span>
          <span class="sdays">${s.days.map((d) => DAYS[d]).join(" · ")}</span>
          <button class="toggle ${s.on ? "on" : ""}" data-act="schToggle" data-id="${s.id}"></button>
          <button class="tdel" data-act="delSched" data-id="${s.id}">✕</button></li>`).join("")}</ul>`
        : `<p class="empty" style="margin-top:16px">No sessions scheduled. Add one to get a reminder.</p>`}
      <p class="muted" style="margin-top:12px">Reminders fire at the set time while Studi is open in a tab. True background reminders (app closed) need the native app or a push server.</p>
    </section>
  </div>`;
}

/* ---------- stats ---------- */
function statsScreen() {
  const days = []; const now = new Date();
  for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days.push(d.toISOString().slice(0, 10)); }
  const perDay = days.map((d) => S.sessions.filter((s) => s.date === d).reduce((a, s) => a + s.minutes, 0) / 60);
  const maxH = Math.max(1, ...perDay);
  const weekH = perDay.reduce((a, b) => a + b, 0);
  const bySubj = {};
  S.sessions.forEach((s) => { bySubj[s.subject || "General"] = (bySubj[s.subject || "General"] || 0) + s.minutes; });
  const subjTotal = Object.values(bySubj).reduce((a, b) => a + b, 0) || 1;
  const tasksDone = S.tasks.filter((t) => t.done).length;
  return `<div class="grid">
    <section class="card wide">
      <div class="cardhead"><span class="ch-ic">📊</span><h3>This week</h3></div>
      <div class="kpis">
        <div class="kpi"><b>${weekH.toFixed(1)}h</b><span>studied</span></div>
        <div class="kpi"><b>${S.streak}</b><span>day streak</span></div>
        <div class="kpi"><b>${S.sessions.length}</b><span>sessions</span></div>
        <div class="kpi"><b>${tasksDone}</b><span>tasks done</span></div>
      </div>
    </section>
    <section class="card">
      <div class="cardhead"><span class="ch-ic">📈</span><h3>Study hours (7 days)</h3></div>
      <div class="barchart">${perDay.map((h, i) => `
        <div class="barcol"><div class="bar" style="height:${(h / maxH) * 100}%"></div>
          <small>${DAYS[new Date(days[i]).getDay()][0]}</small></div>`).join("")}</div>
    </section>
    <section class="card">
      <div class="cardhead"><span class="ch-ic">🧠</span><h3>By subject</h3></div>
      ${Object.keys(bySubj).length ? `<div class="subjects">${Object.entries(bySubj).map(([s, m]) => `
        <div class="subrow"><span>${esc(s)}</span><div class="subbar"><span style="width:${(m / subjTotal) * 100}%;background:${subColor(s)}"></span></div>
          <b>${Math.round((m / subjTotal) * 100)}%</b></div>`).join("")}</div>`
        : `<p class="empty">Complete focus sessions to see your breakdown.</p>`}
    </section>
  </div>`;
}

/* ---------- crate / levelup modals ---------- */
function showCrate(prize) {
  const rar = RARITY[prize.r];
  const icon = prize.r === "legendary" ? "👑" : prize.r === "epic" ? "💎" : "🪙";
  const m = document.createElement("div"); m.className = "modal-bg"; m.id = "crateModal";
  m.innerHTML = `<div class="reveal" style="--rar:${rar.c}">
    <span class="reveal-rarity" style="color:${rar.c}">${rar.l}</span>
    <div class="reveal-icon">${icon}</div><h3>You got a prize!</h3>
    <div class="reveal-loot">
      <span class="loot-pill">🪙 +${prize.coins}</span><span class="loot-pill">⚡ +${prize.xp} XP</span>
      ${prize.item ? `<span class="loot-pill">✨ ${esc(prize.item)}</span>` : ""}</div>
    <button class="btn primary lg" data-act="closeModal">Awesome</button></div>`;
  m.addEventListener("click", (e) => { if (e.target === m || e.target.dataset.act === "closeModal") m.remove(); });
  document.body.appendChild(m);
}
function showLevelUp() {
  const m = document.createElement("div"); m.className = "modal-bg levelup";
  m.innerHTML = `<div class="reveal" style="--rar:var(--accent)">
    <div class="reveal-icon">👑</div><h3>LEVEL UP</h3><p class="muted">You reached Level ${level()}</p>
    <button class="btn primary lg" data-act="closeModal" style="margin-top:14px">Let's go</button></div>`;
  m.addEventListener("click", (e) => { if (e.target === m || e.target.dataset.act === "closeModal") m.remove(); });
  document.body.appendChild(m);
}

/* ============================================================
   EVENT BINDING
   ============================================================ */
function bind() {
  // file input (profile)
  const file = $("#file");
  if (file) file.onchange = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { S.pfp = r.result; save(); render(); }; r.readAsDataURL(f);
  };
  const uname = $("#uname");
  if (uname) uname.oninput = (e) => {
    S.username = e.target.value.replace(/\s/g, "_"); save();
    const btn = document.querySelector('[data-act="toTheme"]'); if (btn) btn.disabled = !S.username.trim();
    const av = $(".ob-avatar"); if (av && !S.pfp) av.textContent = (S.username || "S")[0].toUpperCase();
  };
  const vol = $("#vol");
  if (vol) vol.oninput = (e) => { if (window.StudiAudio) window.StudiAudio.setVolume(e.target.value / 100); };
  const subj = $("#subject");
  if (subj) subj.oninput = (e) => { T.subject = e.target.value.trim() || "General"; };
  const slider = $("#customMin");
  if (slider) slider.oninput = (e) => setTotal(+e.target.value, true);
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act, d = el.dataset;
  switch (a) {
    /* onboarding */
    case "pickPhoto": $("#file").click(); break;
    case "rmPhoto": S.pfp = null; save(); render(); break;
    case "avc": S.avColor = d.c; save(); render(); break;
    case "toTheme": if (S.username.trim()) { S.stage = "theme"; save(); render(); } break;
    case "toProfile": S.stage = "profile"; save(); render(); break;
    case "mode": S.dark = d.m === "dark"; save(); render(); break;
    case "theme": S.themeId = d.t; save(); render(); break;
    case "finish": S.onboarded = true; save(); refreshStreakOnLoad(); render(); break;
    /* shell */
    case "nav": nav = d.n; render(); break;
    case "toggleTheme": S.dark = !S.dark; save(); render(); break;
    /* home */
    case "openCrate": {
      if (S.lastCrate === todayStr()) break;
      const p = rollCrate(); reward(p.xp, p.coins, true);
      if (p.item && !S.inventory.includes(p.item)) S.inventory.push(p.item);
      S.lastCrate = todayStr(); save(); showCrate(p); render();
      break;
    }
    /* timer */
    case "startTimer": startTimer(); break;
    case "pauseTimer": pauseTimer(); break;
    case "resetTimer": resetTimer(); break;
    case "preset": setTotal(+d.m); break;
    case "stepMin": { const cur = Math.round(T.total / 60); setTotal(Math.min(120, Math.max(5, cur + (+d.d)))); break; }
    case "sound": if (window.StudiAudio) { window.StudiAudio.play(d.s); render(); } break;
    case "toggleStrict": S.strictFocus = !S.strictFocus; save(); render(); break;
    case "block": S.blocked[d.site] = !S.blocked[d.site]; save(); render(); break;
    case "endFocus": resetTimer(); break;
    /* tasks */
    case "addTask": {
      const t = $("#taskTitle"), su = $("#taskSubject"); const title = t.value.trim(); if (!title) break;
      S.tasks.unshift({ id: Date.now(), title, subject: (su.value.trim() || "General"), done: false });
      save(); render(); break;
    }
    case "toggleTask": {
      const t = S.tasks.find((x) => x.id == d.id); if (!t) break;
      if (!t.done) { t.done = true; t.doneDate = todayStr(); reward(40, 15); } else { t.done = false; delete t.doneDate; }
      save(); render(); break;
    }
    case "delTask": S.tasks = S.tasks.filter((x) => x.id != d.id); save(); render(); break;
    /* schedule */
    case "draftDay": { const i = +d.i; draftDays = draftDays.includes(i) ? draftDays.filter((x) => x !== i) : [...draftDays, i]; render(); break; }
    case "addSched": {
      const su = $("#schSubject").value.trim(), tm = $("#schTime").value;
      if (!su || !tm || !draftDays.length) { toast("Add a subject, time, and at least one day"); break; }
      S.schedule.push({ id: Date.now(), subject: su, time: tm, days: [...draftDays].sort(), on: true });
      save(); ensureNotify(); render(); break;
    }
    case "schToggle": { const s = S.schedule.find((x) => x.id == d.id); if (s) { s.on = !s.on; save(); render(); } break; }
    case "delSched": S.schedule = S.schedule.filter((x) => x.id != d.id); save(); render(); break;
    case "enableNotify": ensureNotify(); break;
    /* modal */
    case "closeModal": { const m = el.closest(".modal-bg"); if (m) m.remove(); break; }
  }
});

/* boot */
refreshStreakOnLoad();
render();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
