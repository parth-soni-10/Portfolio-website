/* ---------------------------------------------------------------------------
 * The site's agent-facing documents, in one place.
 *
 * `_middleware.js` serves these; nothing here touches a request or a Response,
 * so the negotiation and the copy can be tested with `node --test` without a
 * Pages runtime.
 *
 * Why the Markdown is written here rather than derived from index.html at
 * request time: the home page is an app shell whose live widgets fill in after
 * hydration (GitHub stats, the dashboard figures, the Medium list), and a
 * regex over its DOM would hand an agent the loading placeholders. This copy is
 * the stable part - who Parth is, what he has done, where the projects are -
 * and it is checked against the page by tests/agent-readiness.test.mjs.
 * ------------------------------------------------------------------------- */

export const SITE = "https://parth-portfolio-wb.pages.dev";
export const EMAIL = "soni.soni.parth@gmail.com";

const lines = (...parts) => parts.join("\n").trim() + "\n";

export const HOME_MARKDOWN = lines(
  "# Parth Soni - Data Analyst in Dublin",
  "",
  "Parth Shirish Soni is a data analyst based in Dublin, Ireland, completing an MSc in",
  "Computer Science (Negotiated Learning) at University College Dublin. He turns operational",
  "and product data into dashboards, analyses and written decisions with SQL, Python, Power BI",
  "and Tableau.",
  "",
  "- **Location:** Dublin, Ireland - open to remote work and relocation",
  "- **Current:** MSc Computer Science, University College Dublin (2025–2026)",
  "- **Availability:** Data Analyst, Business Analyst, BI Developer and Insights Analyst roles",
  "- **Email:** soni.soni.parth@gmail.com",
  "- **Portfolio:** https://parth-portfolio-wb.pages.dev/",
  "- **Resume:** https://rxresu.me/parth_soni_10/parth-resume-da-ba",
  "",
  "## What he does",
  "",
  "Parth builds the path from raw data to a decision: cleaning and modelling messy exports,",
  "writing the SQL and Python that answer a question, and publishing the result as a dashboard,",
  "report or short written analysis. His work leans toward analytics engineering and",
  "self-service BI - systems a non-analyst can keep using after handover.",
  "",
  "## Experience",
  "",
  "### Inventory Analyst, Intern - ANKO (KAS Services)",
  "",
  "Bengaluru, India · Nov 2023 – May 2024",
  "",
  "- Ran execution, deployment and monitoring of supply-chain metrics for a new product",
  "  division with roughly 1.8 million AUD in weekly sales revenue.",
  "- Analysed demand around peak periods (Mother's Day, Anzac Day, Christmas) and showed",
  "  that an average 15% inventory increase was needed to avoid stockouts.",
  "- Performed shrinkage analysis, introduced corrective measures that cut shrinkage by 7%,",
  "  and built monitoring for real-time stock and business metrics across the division.",
  "",
  "### Technical Writer, Intern - Nokia",
  "",
  "Bengaluru, India · Feb 2023 – Aug 2023",
  "",
  "- Redesigned more than 70 product documents and graphics during a company rebrand.",
  "- Wrote three product user manuals from scratch with the R&D team, plus installation and",
  "  troubleshooting guides.",
  "- Produced diagrams and infographics that made complex technical concepts legible, and",
  "  maintained weekly revisions from R&D input.",
  "",
  "## Selected projects",
  "",
  "Ten project pages, each with the problem, approach, stack and result:",
  "",
  "1. [UCD PolicyBot](https://parth-portfolio-wb.pages.dev/projects/ucd-policybot/) - a fully",
  "   local RAG chatbot over 200+ UCD policy documents, with cited answers and abstention when",
  "   the documents do not support one.",
  "2. [Content Tracking Dashboard](https://parth-portfolio-wb.pages.dev/projects/content-tracking-dashboard/)",
  "   - personal media analytics over a D1-backed watchlist, with KPIs, year-over-year",
  "   comparisons, filters and charts across six pages. Live at",
  "   https://contenttrackerdashboard.pages.dev/",
  "3. [Formula 1 Telemetry Analysis](https://parth-portfolio-wb.pages.dev/projects/formula-1-telemetry-analysis/)",
  "   - FastF1, pandas and NumPy applied to race pace, strategy and performance.",
  "4. [RBI Weekly Dashboard](https://parth-portfolio-wb.pages.dev/projects/rbi-weekly-dashboard/)",
  "   - a recurring data refresh published as a weekly dashboard.",
  "5. [Irish Visa Decision Tracker](https://parth-portfolio-wb.pages.dev/projects/irish-visa-decision-tracker/)",
  "   - daily decisions published by the Embassy of Ireland, New Delhi, made searchable.",
  "6. [Interactive Tableau Dashboards](https://parth-portfolio-wb.pages.dev/projects/interactive-tableau-dashboards/)",
  "   - published Tableau work built for exploration rather than a static screenshot.",
  "7. [Excel & Python EDA](https://parth-portfolio-wb.pages.dev/projects/excel-python-eda/)",
  "   - exploratory analysis and cleaning of a real dataset, from spreadsheets to Python.",
  "8. [CSNL Module Picker](https://parth-portfolio-wb.pages.dev/projects/csnl-module-picker/)",
  "    - an unofficial UCD module planner that checks timetable clashes.",
  "9. [cents. Personal Expense Tracker](https://parth-portfolio-wb.pages.dev/projects/cents-expense-tracker/)",
  "   - a privacy-first expense tracker with local-first storage and optional cloud sync.",
  "10. [Pink Eye Detection: CNN](https://parth-portfolio-wb.pages.dev/projects/pink-eye-cnn/)",
  "   - a CNN that classifies eye images as healthy or conjunctivitis-infected, wrapped in a",
  "   Flask app for real-time camera self-screening.",
  "",
  "The full list is also in the [sitemap](https://parth-portfolio-wb.pages.dev/sitemap.xml).",
  "",
  "## Education",
  "",
  "- **MSc Computer Science (Negotiated Learning)** - University College Dublin, 2025–2026.",
  "  Coursework in data analytics, machine learning, Python, SQL and Power BI.",
  "- **B.Tech Computer Science & Engineering** - Dayananda Sagar University, Bengaluru,",
  "  2019–2023. CGPA 8.15.",
  "",
  "## Skills",
  "",
  "- **Data:** SQL, Python (pandas, NumPy), Excel, data cleaning and wrangling, exploratory",
  "  analysis, machine learning fundamentals.",
  "- **BI and visualisation:** Power BI, Tableau, Chart.js, dashboard design, data storytelling.",
  "- **Platforms:** Snowflake, Cloudflare Workers and D1, Git, report automation.",
  "- **Communication:** technical writing, documentation, turning analysis into a decision.",
  "",
  "## Writing",
  "",
  "Parth publishes Formula 1 race-weekend analysis on",
  "[Medium](https://medium.com/@soni.soni.parth) - qualifying and race reports built from",
  "timing and telemetry data rather than race-day commentary.",
  "",
  "## Contact",
  "",
  "Email **soni.soni.parth@gmail.com** for analyst roles, freelance analysis or a question",
  "about a project. He replies within a day. The",
  "[contact section](https://parth-portfolio-wb.pages.dev/#contact) also links LinkedIn,",
  "GitHub, Tableau Public and the current resume.",
  "",
  "## Machine-readable",
  "",
  "- This page as Markdown: https://parth-portfolio-wb.pages.dev/index.md",
  "- Agent instructions: https://parth-portfolio-wb.pages.dev/llms.txt",
  "- Sitemap: https://parth-portfolio-wb.pages.dev/sitemap.xml",
  "- Privacy: https://parth-portfolio-wb.pages.dev/privacy",
  ""
);

export const PRIVACY_MARKDOWN = lines(
  "# Privacy - Parth Soni Portfolio",
  "",
  "Last updated: 21 October 2026",
  "",
  "This is a personal portfolio at https://parth-portfolio-wb.pages.dev/. It has no accounts,",
  "no sign-in, no newsletter and no contact form. This page explains the small amount of data",
  "that still moves when someone visits, and what happens to an email sent to Parth.",
  "",
  "## What the site stores on your device",
  "",
  "The site sets no cookies and writes no localStorage entries. It writes one sessionStorage",
  "key, `ps-splash-seen`, so the opening animation plays once per browser tab and is skipped on",
  "a repeat visit. That value stays in the tab, is readable only by this origin, and disappears",
  "when the tab closes. There is no analytics script, no advertising pixel and no cross-site",
  "tracker on any page.",
  "",
  "## Requests your browser makes",
  "",
  "- **GitHub API** (api.github.com) - public profile, repository and follower counts for the",
  "  connect card. GitHub receives the request and the usual connection metadata.",
  "- **This site's own Functions** - `/api/contributions` returns the public contribution",
  "  calendar and `/api/medium` returns the public Medium feed. The Function fetches the source",
  "  server-side and caches it; your browser talks only to this origin.",
  "- **Content Tracking Dashboard** (contenttrackerdashboard.pages.dev) - the public watchlist",
  "  rows behind the dashboard section's figures.",
  "- **Self-hosted fonts and assets** - served from this domain; no font CDN is contacted.",
  "",
  "Following a link to LinkedIn, GitHub, Tableau Public, Medium, RxResu or a project's own site",
  "leaves this site, and that destination's privacy policy applies from then on.",
  "",
  "## Hosting and server logs",
  "",
  "The site is hosted by Cloudflare Pages. Cloudflare processes the request needed to serve a",
  "page - including IP address, requested URL, user agent and timestamp - under its own privacy",
  "terms, and may keep security and operational logs. Parth does not run an analytics product",
  "over those logs, does not build visitor profiles from them and does not sell or share them.",
  "",
  "## Email",
  "",
  "If you email soni.soni.parth@gmail.com, the message and your address are processed by the",
  "email provider so the message can be delivered and answered. They are used to reply to you",
  "and to keep a record of the conversation; they are not added to a marketing list and are not",
  "sold. Ask for a message to be deleted and it will be, unless a legal obligation requires it",
  "to be kept.",
  "",
  "## Your rights",
  "",
  "Under the GDPR you can ask what personal data is held about you, ask for a copy, ask for it",
  "to be corrected or erased, or object to its processing. Because this site collects so little,",
  "the practical route for any request is email to **soni.soni.parth@gmail.com**. You also have",
  "the right to complain to the Irish Data Protection Commission (dataprotection.ie).",
  "",
  "## Changes",
  "",
  "If this page changes, the date at the top changes with it. The site has no cookies to",
  "consent to, so there is no banner to dismiss.",
  "",
  "## Contact",
  "",
  "Questions about this page: **soni.soni.parth@gmail.com**. More about Parth at",
  "https://parth-portfolio-wb.pages.dev/ and in https://parth-portfolio-wb.pages.dev/llms.txt.",
  ""
);

export function notFoundMarkdown(pathname) {
  const path = pathname && pathname !== "/" ? pathname : "this address";
  return lines(
    "# Page not found",
    "",
    `Nothing is published at \`${path}\` on parth-portfolio-wb.pages.dev. The page may have`,
    "moved, or the link may be mistyped.",
    "",
    "Start from the [portfolio home page](https://parth-portfolio-wb.pages.dev/). Every",
    "published page is listed in the [sitemap](https://parth-portfolio-wb.pages.dev/sitemap.xml),",
    "and [llms.txt](https://parth-portfolio-wb.pages.dev/llms.txt) explains what this site",
    "contains and when to use it.",
    ""
  );
}

export const NOT_ACCEPTABLE_MARKDOWN = lines(
  "# Not acceptable",
  "",
  "This site publishes HTML and Markdown. The request's `Accept` header excludes both, so no",
  "representation can be returned.",
  "",
  "Ask for `text/html` or `text/markdown`. The Markdown home page is at",
  "https://parth-portfolio-wb.pages.dev/index.md, and",
  "https://parth-portfolio-wb.pages.dev/llms.txt describes the site.",
  ""
);

/* ---------------------------------------------------------------------------
 * Content negotiation (RFC 9110 §12.5.1).
 *
 * A request is served Markdown only when `text/markdown` was named explicitly
 * and its quality is at least the quality of `text/html`; a browser's
 * A browser's own header therefore still gets HTML, and curl's default
 * wildcard does too. Wildcards contribute quality but never select Markdown
 * on their own. `text/markdown;q=0` is a refusal, not a request.
 * ------------------------------------------------------------------------- */

function parseAccept(header) {
  return header
    .split(",")
    .map((part) => {
      const [rawType, ...params] = part.trim().split(";");
      const [type, subtype] = rawType.trim().toLowerCase().split("/");
      if (!type || !subtype) return null;
      let q = 1;
      for (const param of params) {
        const [key, value] = param.trim().split("=");
        if (key && key.trim().toLowerCase() === "q") {
          const parsed = Number.parseFloat(value);
          q = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
        }
      }
      return { type, subtype, q };
    })
    .filter(Boolean);
}

function qualityFor(type, subtype, ranges) {
  let best = null;
  for (const range of ranges) {
    if (range.type !== "*" && range.type !== type) continue;
    if (range.subtype !== "*" && range.subtype !== subtype) continue;
    const specificity = range.type === "*" ? 0 : range.subtype === "*" ? 1 : 2;
    if (!best || specificity > best.specificity) best = { specificity, q: range.q };
  }
  return best ? best.q : 0;
}

/**
 * @param {string | null} header the request's Accept header
 * @returns {"markdown" | "html" | "not-acceptable"}
 */
export function negotiate(header) {
  if (!header || !header.trim()) return "html";
  const ranges = parseAccept(header);
  if (ranges.length === 0) return "html";

  const namedMarkdown = ranges.some(
    (range) => range.type === "text" && range.subtype === "markdown"
  );
  const markdown = qualityFor("text", "markdown", ranges);
  const html = qualityFor("text", "html", ranges);

  if (namedMarkdown && markdown > 0 && markdown >= html) return "markdown";
  if (html > 0) return "html";
  if (!namedMarkdown && markdown > 0) return "markdown";
  return "not-acceptable";
}

export const DOCUMENTS = new Map([
  ["/", { markdown: HOME_MARKDOWN, alternate: "/index.md" }],
  ["/privacy", { markdown: PRIVACY_MARKDOWN, alternate: "/privacy.md" }],
]);

export const MARKDOWN_ALIASES = new Map([
  ["/index.md", HOME_MARKDOWN],
  ["/privacy.md", PRIVACY_MARKDOWN],
]);

/** Add Accept to a Vary header without dropping what is already there. */
export function mergeVary(headers) {
  const current = headers.get("Vary");
  if (!current) {
    headers.set("Vary", "Accept");
    return headers;
  }
  if (current.trim() === "*") return headers;
  const values = current.split(",").map((value) => value.trim().toLowerCase());
  if (!values.includes("accept")) headers.set("Vary", `${current}, Accept`);
  return headers;
}

export function markdownResponse(body, status = 200, method = "GET") {
  const headers = new Headers({
    "Content-Type": "text/markdown; charset=utf-8",
    Vary: "Accept",
    "Cache-Control": "public, max-age=0, must-revalidate",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  return new Response(method === "HEAD" ? null : body, { status, headers });
}
