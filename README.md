# Studi — gamified studying

A standalone web app. Your data is saved in your browser, so closing the tab
and reopening it later keeps your level, streak, coins, tasks, schedule, and stats.

## How to run

Studi is plain HTML/CSS/JS — no build step. But two features (browser
**notifications** and the PWA **service worker**) are blocked on the `file://`
protocol by browsers, so don't just double-click `index.html` if you want those.
Run a tiny local server instead:

**Option A — Python (already on most machines):**
```bash
cd studi
python3 -m http.server 8000
```
Then open http://localhost:8000

**Option B — Node:**
```bash
cd studi
npx serve .
```

**Option C — just open `index.html`:** everything works *except* desktop
notifications and offline caching (the in-app toast still shows instead).

When you first start a timer or add a schedule, the browser will ask permission
for notifications — click **Allow**.

To put it online (so notifications work everywhere and you can install it on a
phone), drop this folder on any static host (Netlify, GitHub Pages, Vercel, Cloudflare Pages).

## What's included / what's real

- **Saved data** — everything persists via `localStorage`. Close and reopen freely.
- **Custom timer** — type any length (1–240 min) and press *Set custom*, alongside the 15/25/50 presets.
- **Streaks that actually work** — your streak goes up once per day when you finish a
  session, and resets if you skip a day. No fake numbers; you start at Level 1, 0 XP, 0 streak.
- **Timer-done notification** — fires a real browser notification plus a chime when a session ends.
- **Scheduled-session notifications** — set subject + time + days; Studi notifies you at that time
  *while a Studi tab is open*. (Reminders when the app is fully closed need the native app or a push server.)
- **Real audio** — Lo-fi, Rain, Forest, Synth, and Brown noise are **synthesized live** with the
  Web Audio API. Nothing is a copyrighted file; "Lo-fi" is a generative lo-fi-style loop.
- **Focus mode** — "Strict focus" goes full-screen and uses the Page Visibility API to detect when
  you switch away, nudging you back and logging slips. The site blocklist is a commitment list.

## Honest limitation: blocking other apps

A web page **cannot block other apps** on your phone or computer — that's an
operating-system power websites don't have. Strict focus does the most a web app
honestly can (full-screen lock-in + leave detection + logging). To truly block
apps you'd need:
- a **native app** (iOS Screen Time API / Android usage-access + accessibility), or
- a **browser extension** (which can block *websites* in the browser).

If you want, that native/extension piece can be built as a follow-up.

## Files
```
index.html      app shell
styles.css      all styling (dark/light + themes)
app.js          state, persistence, timer, streaks, scheduler, focus mode, screens
audio.js        Web Audio synthesis for the five sounds
sw.js           offline cache (PWA)
manifest.json   PWA manifest
icon.svg        app icon
```
