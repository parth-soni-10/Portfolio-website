#!/usr/bin/env node
/**
 * Build the portfolio's project pages from the panels on the home page.
 *
 *   node tools/build-projects.mjs            write projects/<slug>/index.html
 *   node tools/build-projects.mjs --check    verify the committed pages match, exit 1 if not
 *
 * The home page already carries every project's title, status badge, image,
 * description, stack tags and links — the `#projects` panels. A project page
 * that retyped any of that would be a second copy of the same content, free to
 * drift the moment the panel changes, which is exactly the failure the
 * dashboard section was rewritten to remove. So the panels are the source and
 * these pages are generated: edit index.html, run this tool.
 *
 * The CSP is copied out of index.html rather than written here, because the
 * policy exists twice (meta + _headers) and a third hand-kept copy inside this
 * file would be a third thing to forget. `tools/check-headers.mjs` keeps the
 * first two in step; this keeps every project page on the same string.
 *
 * Slugs are keyed by the panel's own id, not by its position: the panels are
 * numbered in display order but their ids are not sequential, and a slug is a
 * URL someone may have linked to. Adding a project means adding its panel and
 * one line to SLUGS.
 *
 * The one exception to "everything comes from the panel" is CASE_STUDIES below:
 * the dashboard, PolicyBot and F1 pages carry a short case study (question,
 * contribution, source, method, evidence, limitations) that exists nowhere on
 * the home page. It is hand-written here - once, in the generator, so the page
 * and the panel still cannot disagree about the facts they share - and only
 * for those three slugs; every other project page stays exactly what its panel
 * says. Every number in a case study is one the panel already publishes, and
 * the precision figure is attributed to its own evaluation; the dashboard evidence figures are computed from the live public watchlist and rounded.
 */

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('..', import.meta.url);
const SITE = 'https://parth-portfolio-wb.pages.dev';

/** panel id → slug. URLs, so never derive these from a title. */
const SLUGS = {
  '01': 'content-tracking-dashboard',
  '02': 'formula-1-telemetry-analysis',
  '03': 'ucd-policybot',
  '04': 'irish-visa-decision-tracker',
  '05': 'cents-expense-tracker',
  '06': 'excel-python-eda',
  '07': 'pink-eye-cnn',
  '08': 'interactive-tableau-dashboards',
  '09': 'rbi-weekly-dashboard',
  '10': 'csnl-module-picker',
};

const collapse = (html) => html.replace(/\s+/g, ' ').trim();

/**
 * Case studies for the three project pages a search visitor should not have to
 * bounce back from: original depth (question, contribution, source, method,
 * evidence, limitations) instead of the home summary repeated. Keyed by slug;
 * a project with no entry gets the plain generated page.
 */
const CASE_STUDIES = {
  'content-tracking-dashboard': {
    question: 'What did I watch \u2014 and how has my taste changed year over year?',
    contribution:
      'I built the whole thing end to end: the front end in vanilla HTML, CSS and JavaScript, and the backend as a Cloudflare Worker reading a D1 database \u2014 no framework, no build step.',
    source:
      'My own logged watch history: 380+ titles stored in D1, the same store the dashboard\u2019s watchlist endpoint serves.',
    method:
      'Calculated KPIs and derived metrics over the log, year-over-year comparisons, dynamic filtering and interactive visualisations across eight views - the six dashboard pages plus Random Pick and Submit (Chart.js).',
    evidence:
      'Across about 380 logged titles: 3,090+ hours watched, 44% of that time on Netflix, and 29% in Drama, the largest genre. The dashboard computes these figures from the same D1 store.',
    limitations:
      'A single person\u2019s log, not a representative sample: the figures describe what was logged, not what was watched, and 380+ titles is a personal history, not a market.',
  },
  'ucd-policybot': {
    question: 'Find the right UCD policy, with sources you can check.',
    contribution:
      'I built the ingestion pipeline (BeautifulSoup, markdownify, PyMuPDF) that converts 200+ policy documents into structured Markdown while preserving their hierarchy, plus automated dedup and validation; and the retrieval stack \u2014 BGE-M3 embeddings in Qdrant, answered by Qwen2.5-1.5B via Ollama, the lowest-latency pick from four local models I stress-tested.',
    source:
      '200+ UCD academic and administrative policy documents, converted to structured Markdown for vector indexing.',
    method:
      'Retrieve first, then answer only from retrieved context: every answer carries a mandatory citation (URL + page number) and the model abstains when the documents do not support an answer. My evaluation put retrieval precision above 80%, after dedup and validation cut malformed records by ~30%.',
    evidence:
      'The project repository: the local RAG stack and the ingestion pipeline that turns policy PDFs into cited answers.',
    limitations:
      'Runs 100% locally, so there is no cloud fallback and answers only cover the 200+ documents ingested; the 1.5B model trades depth for latency; the precision figure is from my own evaluation, not an independent benchmark.',
  },
  'formula-1-telemetry-analysis': {
    question: 'How did each driver gain or lose time, lap by lap?',
    contribution:
      'I built the pipeline in Python with FastF1, pandas and NumPy \u2014 collecting, cleaning, transforming and analysing race telemetry across the 2026 season \u2014 and published weekly performance reports as 10+ articles on Medium.',
    source: 'Race telemetry from FastF1 across the 2026 Formula 1 season.',
    method:
      'Clean and transform the raw timing and telemetry, then build 9+ visualisation types \u2014 lap-time evolution, tyre strategy, minisector dominance, cumulative lap delta and sector performance \u2014 as audience-friendly visual stories.',
    evidence:
      'Lap-time evolution across a race: tyre degradation and strategy windows read off the shape of the line.',
    limitations:
      'The analysis only covers sessions FastF1 publishes, and the 2026 season is still in progress; the reports describe pace and strategy, they do not predict results.',
  },
};

/** Attribute value of the first tag matching `pattern`. */
const attr = (html, pattern, name) => {
  const tag = html.match(pattern);
  if (!tag) return null;
  const found = tag[0].match(new RegExp(`${name}="([^"]*)"`));
  return found ? found[1] : null;
};

const panelChunks = (html) => {
  const start = html.indexOf('<div class="spot-panels"');
  const end = html.indexOf('<p class="spot-hint">', start);
  if (start < 0 || end < 0) throw new Error('could not find the #projects panels in index.html');
  const body = html.slice(start, end);
  return body
    .split(/(?=<div class="spot-card)/)
    .filter((chunk) => chunk.startsWith('<div class="spot-card'));
};

const parsePanel = (chunk) => {
  const id = attr(chunk, /<div class="spot-card[^>]*>/, 'id')?.match(/spotPanel-(\d+)/)?.[1];
  const num = chunk.match(/<span class="sc-num">(\d+)<\/span>/)?.[1];
  const title = chunk.match(/<h3 class="sc-title">([\s\S]*?)<\/h3>/)?.[1];
  if (!id || !num || !title) throw new Error(`unreadable project panel: ${chunk.slice(0, 120)}`);

  const media = chunk.match(/<div class="sc-media">([\s\S]*?)<\/div>/)?.[1] ?? '';
  const img = media.match(/<img\b[^>]*>/)?.[0] ?? '';
  const webp = media.match(/<source\b[^>]*srcset="([^"]+)"[^>]*type="image\/webp"/)?.[1] ?? null;
  const tags = [...(chunk.match(/<div class="sc-tags">([\s\S]*?)<\/div>/)?.[1] ?? '')
    .matchAll(/<span class="ptag">([\s\S]*?)<\/span>/g)].map((m) => collapse(m[1]));

  const links = [...(chunk.match(/<div class="spot-links">([\s\S]*?)<\/div>/)?.[1] ?? '')
    .matchAll(/<a class="spot-link" href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g)]
    .map((m) => ({ href: m[1], attrs: m[2], label: collapse(m[3]) }));

  const desc = chunk.match(/<p class="sc-desc">([\s\S]*?)<\/p>/)?.[1];
  if (!desc) throw new Error(`project panel ${id} has no .sc-desc`);

  return {
    id,
    slug: SLUGS[id],
    num,
    title: collapse(title),
    badge: chunk.match(/<span class="proj-featured-badge">([\s\S]*?)<\/span>/)?.[1]?.trim() ?? null,
    description: collapse(desc),
    tags,
    links,
    media: img
      ? {
          src: attr(img, /<img\b[^>]*>/, 'src'),
          webp,
          alt: attr(img, /<img\b[^>]*>/, 'alt') ?? '',
          width: attr(img, /<img\b[^>]*>/, 'width') ?? '800',
          height: attr(img, /<img\b[^>]*>/, 'height') ?? '450',
        }
      : null,
  };
};

const decode = (text) =>
  text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '–')
    .replace(/&rsquo;|&#8217;/g, '’')
    .replace(/&lsquo;|&#8216;/g, '‘')
    .replace(/&ldquo;|&#8220;/g, '“')
    .replace(/&rdquo;|&#8221;/g, '”')
    .replace(/&hellip;/g, '…')
    .replace(/&times;/g, '×')
    .replace(/&bull;/g, '•')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/** Meta descriptions are read in a search result, so trim on a word boundary. */
const summarise = (text, limit = 158) => {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > 80 ? space : limit).replace(/[ ,.;:—-]+$/, '')}…`;
};

const escapeAttr = (text) => text.replace(/&(?![a-z#0-9]+;)/gi, '&amp;').replace(/"/g, '&quot;');

const header = () => `  <header id="site-header">
    <div class="header-blur" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="header-inner">
      <a class="logo-box" href="/">PARTH SONI<sup>PORTFOLIO</sup></a>
      <nav aria-label="Main navigation">
        <a href="/#about">About</a>
        <a href="/#experience">Experience</a>
        <a href="/#projects">Projects</a>
        <a href="/#skills">Skills</a>
        <a href="/#certificates">Certificates</a>
        <a href="/#contact">Get In Touch</a>
      </nav>
      <button class="menu-toggle" id="menuToggle" aria-label="Toggle menu" aria-controls="mobileNav" aria-expanded="false">&#9776;</button>
    </div>
  </header>

  <nav class="mobile-nav" id="mobileNav" aria-label="Mobile navigation">
    <a href="/#about" class="mobile-link">About</a>
    <a href="/#experience" class="mobile-link">Experience</a>
    <a href="/#projects" class="mobile-link">Projects</a>
    <a href="/#skills" class="mobile-link">Skills</a>
    <a href="/#certificates" class="mobile-link">Certificates</a>
    <a href="/#contact" class="mobile-link">Get In Touch</a>
  </nav>
`;

const page = ({ project, previous, next, csp, referrer }) => {
  const url = `${SITE}/projects/${project.slug}/`;
  const title = `${project.title} | Parth Soni`;
  const summary = escapeAttr(summarise(decode(project.description)));
  const ogTitle = escapeAttr(`${decode(project.title)} - Parth Soni`);
  const image = project.media?.src
    ? `${SITE}/${project.media.src}`
    : `${SITE}/og-card.png`;
  const imageAlt = escapeAttr(project.media?.alt || `${decode(project.title)} preview`);  const media = project.media
    ? `      <div class="pp-media">
        <picture>
${project.media.webp ? `          <source srcset="/${project.media.webp}" type="image/webp" />
` : ''}          <img src="/${project.media.src}" alt="${escapeAttr(project.media.alt)}" width="${project.media.width}" height="${project.media.height}" loading="eager" decoding="async" />
        </picture>
      </div>
`
    : '';

  // The panel links to this very page; a page linking to itself is noise.
  const outward = project.links.filter((link) => link.href !== `/projects/${project.slug}/`);
  const links = outward.length
    ? `      <div class="pp-links">
${outward
  .map(
    (link) =>
      `        <a class="spot-link" href="${link.href}"${link.attrs ? link.attrs : ''}>${link.label}</a>`,
  )
  .join('\n')}
      </div>
`
    : '';

  const study = CASE_STUDIES[project.slug];
  const caseHtml =
    study && project.media
      ? `      <section class="pp-case" aria-label="Case study">
        <h2>Question</h2>
        <p>${study.question}</p>
      </section>
      <section class="pp-case" aria-label="My contribution">
        <h2>My contribution</h2>
        <p>${study.contribution}</p>
      </section>
      <section class="pp-case" aria-label="Data source">
        <h2>Data source</h2>
        <p>${study.source}</p>
      </section>
      <section class="pp-case" aria-label="Method">
        <h2>Method</h2>
        <p>${study.method}</p>
      </section>
      <section class="pp-case" aria-label="Evidence">
        <h2>Evidence</h2>
        <figure>
          <picture>
${project.media.webp ? `            <source srcset="/${project.media.webp}" type="image/webp" />\n` : ''}            <img src="/${project.media.src}" alt="${escapeAttr(project.media.alt)}" width="${project.media.width}" height="${project.media.height}" loading="lazy" decoding="async" />
          </picture>
          <figcaption>${study.evidence}</figcaption>
        </figure>
      </section>
      <section class="pp-case" aria-label="Limitations">
        <h2>Limitations</h2>
        <p>${study.limitations}</p>
      </section>
`
      : '';

  const navLink = (item, direction) =>
    `        <a class="pp-nav-link${direction === 'next' ? ' pp-nav-next' : ''}" href="/projects/${item.slug}/" rel="${direction}">
          <span class="pp-nav-kicker">${direction === 'next' ? 'Next project &rarr;' : '&larr; Previous project'}</span>
          <span class="pp-nav-title">${item.title}</span>
        </a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <!-- GENERATED FILE - do not edit by hand.
       tools/build-projects.mjs writes this page from the #projects panel for
       "${project.title}" in index.html, so the page and the panel cannot disagree.
       Edit the panel (or the slug table in the tool), then run:
         node tools/build-projects.mjs
       The CSP below is copied from index.html; _headers carries the full policy
       for every path, so these pages need no second declaration there. -->

  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="referrer" content="${referrer}" />
  <meta name="description" content="${summary}" />
  <link rel="canonical" href="${url}" />
  <meta name="theme-color" content="#f6f5f1" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Parth Soni | Data Analyst" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${summary}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:type" content="image/${image.endsWith('.png') ? 'png' : 'jpeg'}" />
  <meta property="og:image:alt" content="${imageAlt}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${summary}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:image:alt" content="${imageAlt}" />
  <title>${title}</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%230f0f0f'/%3E%3Ctext x='32' y='43' font-family='Georgia,serif' font-size='32' font-weight='bold' fill='%23ff7a1a' text-anchor='middle'%3EPS%3C/text%3E%3C/svg%3E" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="preload" href="/fonts/dmsans.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="/fonts/dmsans-italic.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="/style.css" />
</head>
<body>

  <a class="skip-link" href="#main">Skip to content</a>

${header()}
  <main id="main">
    <article class="project-page" aria-labelledby="project-title">
      <a class="pp-back" href="/#projects"><span aria-hidden="true">&larr;</span> All projects</a>
      <p class="section-kicker"><b>03</b>Projects</p>
      <div class="pp-head">
        <span class="sc-num">${project.num}</span>
        <h1 class="pp-title" id="project-title">${project.title}</h1>
${project.badge ? `        <span class="proj-featured-badge">${project.badge}</span>
` : ''}      </div>
${media}      <p class="pp-desc">${project.description}</p>
      <div class="pp-tags">
${project.tags.map((tag) => `        <span class="ptag">${tag}</span>`).join('\n')}
      </div>
${links}${caseHtml}      <nav class="pp-nav" aria-label="More projects">
${navLink(previous, 'prev')}
${navLink(next, 'next')}
      </nav>
    </article>
  </main>

  <footer class="pp-footer">
    <div class="pp-footer-inner">
      <p class="pp-footer-copy">&copy; 2026 Parth Soni &bull; Dublin, Ireland</p>
      <div class="pp-footer-links">
        <a href="/">Portfolio</a>
        <a href="/#projects">All projects</a>
        <a href="mailto:soni.soni.parth@gmail.com">Get in touch</a>
      </div>
    </div>
  </footer>

  <script src="/script.js"></script>
</body>
</html>
`;
};

/** Every generated page, keyed by workspace-relative path. */
export const buildAll = async () => {
  const index = await readFile(new URL('index.html', ROOT), 'utf8');
  const csp = index.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1];
  const referrer = index.match(/<meta\s+name="referrer"\s+content="([^"]+)"/i)?.[1];
  if (!csp || !referrer) throw new Error('index.html has no meta CSP / referrer to copy');

  const projects = panelChunks(index).map(parsePanel).sort((a, b) => Number(a.num) - Number(b.num));

  const missing = projects.filter((project) => !project.slug);
  if (missing.length) {
    throw new Error(
      `no slug for panel(s) ${missing.map((project) => project.id).join(', ')} — add them to SLUGS`,
    );
  }
  const seen = new Set();
  for (const project of projects) {
    if (seen.has(project.slug)) throw new Error(`two panels share the slug "${project.slug}"`);
    seen.add(project.slug);
  }

  const pages = new Map();
  projects.forEach((project, i) => {
    const previous = projects[(i - 1 + projects.length) % projects.length];
    const next = projects[(i + 1) % projects.length];
    pages.set(`projects/${project.slug}/index.html`, page({ project, previous, next, csp, referrer }));
  });
  return { pages, projects, csp };
};

const readIfExists = async (path) => {
  try {
    return await readFile(new URL(path, ROOT), 'utf8');
  } catch {
    return null;
  }
};

const sitemapProblems = async (projects) => {
  const sitemap = (await readIfExists('sitemap.xml')) ?? '';
  return projects
    .filter((project) => !sitemap.includes(`<loc>${SITE}/projects/${project.slug}/</loc>`))
    .map((project) => `sitemap.xml is missing /projects/${project.slug}/`);
};

const main = async () => {
  const check = process.argv.includes('--check');
  const { pages, projects, csp } = await buildAll();
  const problems = [];

  const stale = [];
  for (const [path, content] of pages) {
    const onDisk = await readIfExists(path);
    if (onDisk === content) continue;
    if (check) stale.push(path);
    else {
      await mkdir(new URL(path.replace(/index\.html$/, ''), ROOT), { recursive: true });
      await writeFile(new URL(path, ROOT), content);
    }
  }

  if (check) {
    for (const path of stale) problems.push(`${path} is out of date — run node tools/build-projects.mjs`);
    problems.push(...(await sitemapProblems(projects)));

    // Both published totals must agree with the panels they count, or the page
    // contradicts itself the moment a project is added or removed.
    const home = await readIfExists('index.html');
    const heading = home?.match(/<span class="proj-count-label">(\d+) works<\/span>/)?.[1];
    const footer = home?.match(/<div class="footer-grey-num" data-project-count>(\d+)<\/div>/)?.[1];
    if (heading !== String(projects.length)) {
      problems.push(`index.html heading says "${heading ?? '(missing)'} works" for ${projects.length} project panels`);
    }
    if (footer !== String(projects.length).padStart(2, '0')) {
      problems.push(`index.html footer says "${footer ?? '(missing)'} Projects" for ${projects.length} project panels`);
    }

    // A generated page whose CSP meta differs from index.html would enforce an
    // intersection with _headers on that path only, so re-read every page
    // rather than trusting the build we just did.
    for (const project of projects) {
      const path = `projects/${project.slug}/index.html`;
      const onDisk = await readIfExists(path);
      if (!onDisk) {
        problems.push(`${path} does not exist`);
        continue;
      }
      const pageCsp = onDisk.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1];
      if (pageCsp !== csp) problems.push(`${path} carries a different CSP from index.html`);
      const canonical = onDisk.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      if (canonical !== `${SITE}/projects/${project.slug}/`) {
        problems.push(`${path} canonical is ${canonical ?? '(missing)'}`);
      }
      for (const src of onDisk.matchAll(/(?:href|src)="(\/[^"]+)"/g)) {
        const target = src[1].split('#')[0];
        if (target.startsWith('/projects/')) continue;
        if (target === '/') continue;
        if (!existsSync(new URL(`.${target}`, ROOT))) problems.push(`${path} links ${src[1]}, which does not exist`);
      }
    }
  }

  // A project that disappears from index.html should not leave a page behind.
  const dir = new URL('projects/', ROOT);
  if (existsSync(dir)) {
    const present = await readdir(dir, { withFileTypes: true });
    const expected = new Set(projects.map((project) => project.slug));
    for (const entry of present) {
      if (!entry.isDirectory()) continue;
      if (expected.has(entry.name)) continue;
      const message = `projects/${entry.name}/ has no panel in index.html`;
      if (check) problems.push(message);
      else {
        await rm(new URL(`${entry.name}/`, dir), { recursive: true, force: true });
        console.log(`removed ${message.slice(0, -' has no panel in index.html'.length)}`);
      }
    }
  }

  if (!check) {
    for (const [path] of pages) console.log(`wrote ${path}`);
    for (const problem of await sitemapProblems(projects)) console.warn(`warning: ${problem}`);
  }

  if (problems.length) {
    console.error(`\nproject pages FAILED (${problems.length} problem${problems.length === 1 ? '' : 's'})`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  if (check) console.log(`project pages OK (${pages.size} pages: ${projects.map((p) => p.slug).join(', ')})`);
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
