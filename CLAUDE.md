# Portfolio Website — Project Instructions

## Overview
Single-page personal portfolio for Parth Soni (Data Analyst). Fully hand-coded: pure HTML/CSS/JS, no framework, no build step. Live metrics (GitHub contribution graph, content-dashboard stats) are fetched at runtime; webfonts are self-hosted.

## Tech Stack
- Vanilla HTML + CSS + JS — no npm, no build, no package.json
- Fonts: self-hosted woff2 (Playfair, DM Sans) in `fonts/`
- Icons: inline `<svg class="icon">` (Font Awesome 6 free path data inlined, `aria-hidden` + `focusable="false"`) for buttons, connect tabs, social links. No icon CDN — the old Font Awesome stylesheet/webfonts were replaced by these SVGs
- Runtime APIs: GitHub REST + github-contributions-api (contribution graph), the Content Tracking Dashboard's own watchlist endpoint (dashboard metrics — see "The dashboard section" below), Medium's RSS through rss2json

## Files
```
index.html  → the entire page markup + content (about, experience, projects, skills, certs, contact)
style.css   → design system — dark theme, orange (#ff7a1a) accent
script.js   → interactivity (connect tabs, GitHub graph render, live dashboard fetch, the embedded snapshot)
dash-aggregate.js → the dashboard section's row→figure shaping, loaded before script.js and require()d by tools/snapshot-dashboard-fallback.mjs
fonts/      → self-hosted webfonts
tools/      → check-headers.mjs (the two CSP copies must stay in step), snapshot-dashboard-fallback.mjs
*.jpeg/png  → certificates and resume image
```

## Code Style / Conventions
- Semantic class names; keep inline `style=""` out of new markup and add classes to `style.css`
- Icons: add `<svg class="icon" aria-hidden="true" focusable="false" viewBox="…"><path d="…"/></svg>` (copy `<path>` from Font Awesome 6 free SVGs). Icon spacing/size CSS lives at the bottom of `style.css` under "Inline icon SVGs" — `svg.icon`, `.footer-link svg.icon`, `.connect-tab svg.icon`, etc.
- CTA buttons get a leading/trailing arrow icon; social/connect links use brand icons (GitHub, LinkedIn, Medium, X, and `fa-chart-simple` for Tableau)

## The dashboard section (`#dashboard`)
- It reads **the Content Tracking Dashboard's own store**: `https://contenttrackerdashboard.pages.dev/.netlify/functions/watchlist`, the rows that dashboard's SPA renders off its D1 watchlist. It deliberately does **not** read the dashboard's Google Sheet, which is what it used to do — the Sheet stopped being that store when the dashboard moved to D1, so the two were copies free to drift, and they did (a title saved without a year was counted here and not there). Reading the store is what makes them agree by construction.
- That host is in `connect-src` in **both** CSP copies (the `<meta>` tag and `_headers`) and is pinned by `tools/check-headers.mjs`. The dashboard's `netlify/functions/watchlist.js` answers this origin and no other through an origin-scoped CORS allowance (`ALLOWED_ORIGINS`, plus `localhost` on any port for local dev). If this site ever moves host, that list needs the new origin — otherwise the section silently falls back to its snapshot instead of failing loudly.
- Figures are never typed into the markup. The four KPI cards and the header count are written by `script.js` from the rows it read (`&hellip;` until then), and the shaping that turns rows into periods, genres and series lives once, in `dash-aggregate.js`.
- When the read fails, the section renders an embedded snapshot from `script.js` and says so in `.dash-snapshot-note` above the figures — a stale snapshot that reads as live is the disagreement this section exists to remove, so it is never silent.
- Refresh the snapshot after the store has moved on: `node tools/snapshot-dashboard-fallback.mjs` (`--check` reports staleness and writes nothing). It fetches the same endpoint and runs the same `buildLive()`, so the snapshot can drift in time but never in method. Never hand-edit the `SNAPSHOT:START/END` block.

## Build & Run
- No build step. Serve the folder with any static server (`python -m http.server`) and open `index.html`. Font Awesome + runtime APIs require network.

## Deploy
- The site is deployed twice and the two copies share nothing but the repo: a **static-assets-only Worker** named `portfolio` (`portfolio.parth10.workers.dev`) and a **Pages** project named `parth-portfolio-wb` (`parth-portfolio-wb.pages.dev`). **Every link and self-reference in the repo names the Pages URL** — the manifest, sitemap and robots here, and the portfolio links in the portal and UCD. The Worker keeps answering; it is simply no longer the address anything points at. Neither deployment has a Worker script: `wrangler.toml` only sets `[assets] directory = "."`, and `_headers` is applied by the assets layer (Pages reads it from the staged copy, which keeps it while every other ignored file is left out).
- A push to `main` publishes it: the repo is connected to that Worker in **Cloudflare Workers Builds** (production branch `main`, deploy command `npx wrangler deploy`, preview builds off). `npx wrangler deploy` on your own machine publishes exactly the same thing.
- The Pages project is connected to this repository too — **Cloudflare Pages**, production branch `main`, preview builds off, build command `node tools/deploy-pages.mjs --assets . --out .pages-dist`, output directory `.pages-dist`. So the same push republishes both copies, and the Pages one goes through the same staging: `tools/`, the docs and the config files are left out, `_headers` is kept for Pages to read, and a `404.html` is generated so an unknown path is a 404 rather than the home page. `Misc/pages-deploy.sh portfolio` uploads that same staged directory by hand and is the fallback path, not the only one.
- `.assetsignore` is what keeps `tools/`, the docs, `.git` and the config files out of the upload — a file that is never uploaded cannot be served, which is stronger than the 404 rules this site used to rely on.

## Git
- Work on `main`; imperative one-line commit messages, pushed straight to main.
- The icon set is inline SVG; there is no Font Awesome `<link>` anymore. If you swap an icon, inline the new `<path>` — nothing to remove from the CSP