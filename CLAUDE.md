# Portfolio Website — Project Instructions

## Overview
Single-page personal portfolio for Parth Soni (Data Analyst). Fully hand-coded: pure HTML/CSS/JS, no framework, no build step. Live metrics (GitHub contribution graph, content-dashboard stats) are fetched at runtime; webfonts are self-hosted.

## Tech Stack
- Vanilla HTML + CSS + JS — no npm, no build, no package.json
- Fonts: self-hosted woff2 (Playfair, DM Sans) in `fonts/`
- Icons: inline `<svg class="icon">` (Font Awesome 6 free path data inlined, `aria-hidden` + `focusable="false"`) for buttons, connect tabs, social links. No icon CDN — the old Font Awesome stylesheet/webfonts were replaced by these SVGs
- Runtime APIs: GitHub REST + github-contributions-api (contribution graph), Google Sheets (dashboard metrics)

## Files
```
index.html  → the entire page markup + content (about, experience, projects, skills, certs, contact)
style.css   → design system — dark theme, orange (#ff7a1a) accent
script.js   → interactivity (connect tabs, GitHub graph render, live dashboard fetch)
fonts/      → self-hosted webfonts
*.jpeg/png  → certificates and resume image
```

## Code Style / Conventions
- Semantic class names; keep inline `style=""` out of new markup and add classes to `style.css`
- Icons: add `<svg class="icon" aria-hidden="true" focusable="false" viewBox="…"><path d="…"/></svg>` (copy `<path>` from Font Awesome 6 free SVGs). Icon spacing/size CSS lives at the bottom of `style.css` under "Inline icon SVGs" — `svg.icon`, `.footer-link svg.icon`, `.connect-tab svg.icon`, etc.
- CTA buttons get a leading/trailing arrow icon; social/connect links use brand icons (GitHub, LinkedIn, Medium, X, and `fa-chart-simple` for Tableau)

## Build & Run
- No build step. Serve the folder with any static server (`python -m http.server`) and open `index.html`. Font Awesome + runtime APIs require network.

## Deploy
- The site is a **static-assets-only Worker** named `portfolio` (the URL reads `portfolio.parth10.workers.dev`; the account subdomain became `parth10` on 13 Oct 2026, and the Worker was renamed so "parth" appears once, not twice) — no Worker script, `wrangler.toml` just sets `[assets] directory = "."`, and `_headers` is applied by the assets layer.
- A push to `main` publishes it: the repo is connected to that Worker in **Cloudflare Workers Builds** (production branch `main`, deploy command `npx wrangler deploy`, preview builds off). `npx wrangler deploy` on your own machine publishes exactly the same thing.
- `.assetsignore` is what keeps `tools/`, the docs, `.git` and the config files out of the upload — a file that is never uploaded cannot be served, which is stronger than the 404 rules this site used to rely on.

## Git
- Work on `main`; imperative one-line commit messages, pushed straight to main.
- The icon set is inline SVG; there is no Font Awesome `<link>` anymore. If you swap an icon, inline the new `<path>` — nothing to remove from the CSP