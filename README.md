# Parth Soni - Portfolio

A single-page site about me and the tools I like to build: a data analyst and MSc Computer Science student who turns messy numbers into clear stories.

**Live:** https://parth-portfolio-wb.pages.dev

> *"Data is only as powerful as the story it tells."*

## What's on the page

- **About** - a short intro, my education, and a few non-work facts
- **Experience** - internships and what I worked on
- **Projects** - the tools and dashboards I've built, each with its own page and a link to the live site
- **Dashboard demo** - a working analytics dashboard whose charts you can filter by year
- **Skills**, **Certificates** and **Contact**

## What is live

- The **GitHub contribution graph** is read at runtime rather than pasted in
- The **dashboard preview** reads the Content Tracker's own store, so the two agree by construction
- **Share previews** carry a branded card when the link is posted anywhere
- **Self-hosted webfonts**, smooth scrolling, a mobile menu and calm, readable styling
- **Agent-ready pages** - the home page and `/privacy` answer `Accept: text/markdown`, `/index.md` and `/privacy.md` always return Markdown, unknown paths return a Markdown 404, and [`llms.txt`](https://parth-portfolio-wb.pages.dev/llms.txt) says when to use the site
- A real [privacy notice](https://parth-portfolio-wb.pages.dev/privacy) at a stable URL, linked from the footer

## Built with

Plain **HTML, CSS and JavaScript** - no frameworks, no build tools - plus two small **Cloudflare Pages Functions** that stand in for the third-party hosts the live sections would otherwise call, and one middleware that negotiates Markdown. Tests run with `node --test tests/*.test.mjs`.
