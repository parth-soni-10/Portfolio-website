import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  HOME_MARKDOWN,
  PRIVACY_MARKDOWN,
  NOT_ACCEPTABLE_MARKDOWN,
  MARKDOWN_ALIASES,
  negotiate,
  notFoundMarkdown,
} from "../functions/_agent-docs.js";
import { onRequest } from "../functions/_middleware.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => readFileSync(join(root, name), "utf8");
const SITE = "https://parth-portfolio-wb.pages.dev";

function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function call(path, accept, { method = "GET", nextStatus = 200, nextBody = "<!doctype html><html lang=\"en\"><h1>HTML</h1></html>" } = {}) {
  let nextCalls = 0;
  const headers = {};
  if (accept !== undefined) headers.Accept = accept;
  const request = new Request(`${SITE}${path}`, { method, headers });
  const context = {
    request,
    next: async () => {
      nextCalls += 1;
      return new Response(nextBody, {
        status: nextStatus,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  };
  return onRequest(context).then((response) => ({ response, nextCalls }));
}

/* -------------------------------------------------------------------------
 * Accept negotiation
 * ---------------------------------------------------------------------- */

test("absence of Accept, or a browser's header, still gets HTML", async () => {
  assert.equal(negotiate(null), "html");
  assert.equal(negotiate(""), "html");
  assert.equal(negotiate("*/*"), "html");
  assert.equal(negotiate("text/*"), "html");
  assert.equal(
    negotiate("text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"),
    "html"
  );
});

test("text/markdown is chosen only when it can compete with HTML", () => {
  assert.equal(negotiate("text/markdown"), "markdown");
  assert.equal(negotiate("text/markdown; charset=utf-8"), "markdown");
  assert.equal(negotiate("TEXT/MARKDOWN"), "markdown");
  assert.equal(negotiate("text/markdown, text/html"), "markdown");
  assert.equal(negotiate("text/markdown;q=1, text/html;q=0"), "markdown");
  assert.equal(negotiate("text/html, text/markdown;q=0.9"), "html");
  assert.equal(negotiate("text/markdown;q=0.4, text/html;q=0.9"), "html");
  assert.equal(negotiate("text/markdown;q=0, text/html"), "html");
  assert.equal(negotiate("text/*;q=0, text/markdown"), "markdown");
});

test("a request that excludes both representations is not acceptable", () => {
  assert.equal(negotiate("application/json"), "not-acceptable");
  assert.equal(negotiate("text/markdown;q=0"), "not-acceptable");
  assert.equal(negotiate("text/markdown;q=0, text/html;q=0"), "not-acceptable");
});

test("malformed Accept headers fall back to HTML rather than failing the request", () => {
  assert.equal(negotiate(",,,"), "html");
  assert.equal(negotiate("nonsense"), "html");
});

/* -------------------------------------------------------------------------
 * Middleware: negotiation at the public URL
 * ---------------------------------------------------------------------- */

test("GET / with Accept: text/markdown returns Markdown without touching the asset layer", async () => {
  const { response, nextCalls } = await call("/", "text/markdown");
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/markdown; charset=utf-8$/);
  assert.equal(response.headers.get("vary"), "Accept");
  assert.equal(nextCalls, 0);
  assert.ok(body.startsWith("# Parth Soni"));
  assert.ok(body.includes("soni.soni.parth@gmail.com"));
});

test("GET / with Accept: text/html serves the asset and advertises its Markdown alternate", async () => {
  const { response, nextCalls } = await call("/", "text/html");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.equal(response.headers.get("vary"), "Accept");
  assert.equal(nextCalls, 1);
  const link = response.headers.get("link");
  assert.ok(link.includes('</index.md>; rel="alternate"; type="text/markdown"'));
  assert.ok(link.includes('</llms.txt>; rel="describedby"'));
});

test("an existing Vary header is extended, not replaced", async () => {
  const request = new Request(`${SITE}/`, { headers: { Accept: "text/html" } });
  const response = await onRequest({
    request,
    next: async () =>
      new Response("ok", {
        status: 200,
        headers: { Vary: "Accept-Encoding", "Content-Type": "text/html" },
      }),
  });
  assert.equal(response.headers.get("vary"), "Accept-Encoding, Accept");
});

test("HEAD / with text/markdown carries the metadata and no body", async () => {
  const { response } = await call("/", "text/markdown", { method: "HEAD" });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/markdown/);
  assert.equal(await response.text(), "");
});

test("document aliases always answer Markdown", async () => {
  for (const [alias, expected] of [
    ["/index.md", HOME_MARKDOWN],
    ["/privacy.md", PRIVACY_MARKDOWN],
  ]) {
    const { response, nextCalls } = await call(alias, "text/html");
    assert.equal(response.status, 200);
    assert.equal(nextCalls, 0);
    assert.match(response.headers.get("content-type"), /^text\/markdown/);
    assert.equal(await response.text(), expected);
  }
});

test("GET /privacy negotiates Markdown and HTML like the home page", async () => {
  const md = await call("/privacy", "text/markdown");
  assert.equal(md.response.status, 200);
  assert.equal(md.nextCalls, 0);
  assert.equal(await md.response.text(), PRIVACY_MARKDOWN);

  const html = await call("/privacy", "text/html");
  assert.equal(html.response.status, 200);
  assert.equal(html.nextCalls, 1);
  assert.ok(html.response.headers.get("link").includes("</privacy.md>"));
});

test("GET / with an Accept that excludes both formats returns 406 with Markdown", async () => {
  const { response, nextCalls } = await call("/", "application/json");
  assert.equal(response.status, 406);
  assert.equal(nextCalls, 0);
  assert.match(response.headers.get("content-type"), /^text\/markdown/);
  assert.equal(response.headers.get("vary"), "Accept");
  assert.equal(await response.text(), NOT_ACCEPTABLE_MARKDOWN);
});

test("unknown paths keep their 404 status and gain a Markdown body for agents", async () => {
  const path = "/__ora-404-probe-9rgypv0z";
  const { response } = await call(path, "text/markdown", { nextStatus: 404, nextBody: read("404.html") });
  const body = await response.text();
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /^text\/markdown/);
  assert.equal(response.headers.get("vary"), "Accept");
  assert.ok(body.length > 20);
  assert.ok(body.includes(path));
  assert.ok(body.includes(`${SITE}/sitemap.xml`));
  assert.ok(body.includes(`${SITE}/llms.txt`));
});

test("unknown paths still get the branded HTML 404, now marked as varying on Accept", async () => {
  const html = read("404.html");
  const { response } = await call("/missing", "text/html", { nextStatus: 404, nextBody: html });
  assert.equal(response.status, 404);
  assert.equal(await response.text(), html);
  assert.equal(response.headers.get("vary"), "Accept");
});

test("non-GET requests are never rewritten", async () => {
  const { response, nextCalls } = await call("/", "text/markdown", { method: "POST" });
  assert.equal(response.status, 200);
  assert.equal(nextCalls, 1);
  assert.match(response.headers.get("content-type"), /^text\/html/);
});

/* -------------------------------------------------------------------------
 * The documents themselves
 * ---------------------------------------------------------------------- */

test("the Markdown home page is a substantial, standalone profile", () => {
  assert.ok(HOME_MARKDOWN.length > 1500);
  assert.ok(HOME_MARKDOWN.startsWith("# Parth Soni"));
  assert.ok(HOME_MARKDOWN.includes("## Experience"));
  assert.ok(HOME_MARKDOWN.includes("## Selected projects"));
  assert.ok(HOME_MARKDOWN.includes("## Contact"));
  assert.ok(HOME_MARKDOWN.includes("soni.soni.parth@gmail.com"));
  assert.equal(MARKDOWN_ALIASES.get("/index.md"), HOME_MARKDOWN);

  for (const project of [
    "content-tracking-dashboard",
    "ucd-policybot",
    "irish-visa-decision-tracker",
    "formula-1-telemetry-analysis",
    "excel-python-eda",
    "interactive-tableau-dashboards",
    "pink-eye-cnn",
    "cents-expense-tracker",
    "rbi-weekly-dashboard",
    "csnl-module-picker",
  ]) {
    assert.ok(
      HOME_MARKDOWN.includes(`/projects/${project}/`),
      `Markdown home page is missing ${project}`
    );
  }
});

test("the Markdown privacy notice matches what the site actually does", () => {
  assert.ok(PRIVACY_MARKDOWN.length > 1000);
  assert.ok(PRIVACY_MARKDOWN.startsWith("# Privacy"));
  assert.ok(PRIVACY_MARKDOWN.includes("sets no cookies"));
  assert.ok(PRIVACY_MARKDOWN.includes("ps-splash-seen"));
  assert.ok(PRIVACY_MARKDOWN.includes("Cloudflare Pages"));
  assert.ok(PRIVACY_MARKDOWN.includes("soni.soni.parth@gmail.com"));
});

test("the not-found body names the path and two places to recover", () => {
  const body = notFoundMarkdown("/nope");
  assert.ok(body.length > 20);
  assert.ok(body.includes("`/nope`"));
  assert.ok(body.includes("/sitemap.xml"));
  assert.ok(body.includes("/llms.txt"));
  assert.ok(body.includes("Page not found"));
});

/* -------------------------------------------------------------------------
 * The published pages and machine-readable files
 * ---------------------------------------------------------------------- */

const index = read("index.html");
const privacy = read("privacy.html");

function jsonLd(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, "the page carries a JSON-LD block");
  return JSON.parse(match[1]);
}

test("the home page has all four metadata signals a scanner looks for", () => {
  assert.match(index, /<html lang="en">/);
  assert.match(index, /<meta property="og:type" content="profile"\s*\/?>/);
  assert.match(index, /<meta property="og:image" content="https:\/\/parth-portfolio-wb\.pages\.dev\/og-card\.png"\s*\/?>/);
  assert.match(index, /<link rel="canonical" href="https:\/\/parth-portfolio-wb\.pages\.dev\/">/);
});

test("the home page advertises its Markdown and agent description", () => {
  assert.match(index, /<link rel="alternate" type="text\/markdown" href="\/index\.md"/);
  assert.match(index, /<link rel="describedby" href="\/llms\.txt"/);
  assert.match(index, /<a href="\/privacy">Privacy<\/a>/);
});

test("the Organization node has a contact point and a postal address", () => {
  const graph = jsonLd(index)["@graph"];
  const org = graph.find((node) => node["@type"] === "Organization");
  assert.ok(org, "Organization is present");
  assert.ok(org.contactPoint);
  assert.ok(org.contactPoint.email);
  assert.ok(org.contactPoint.contactType);
  assert.equal(org.address["@type"], "PostalAddress");
  assert.equal(org.address.addressLocality, "Dublin");
  assert.equal(org.address.addressCountry, "IE");

  const person = graph.find((node) => node["@type"] === "Person");
  assert.deepEqual(person.worksFor, { "@id": `${SITE}/#organization` });
});

test("the single H1 names the person, the role and the portfolio", () => {
  const headings = index.match(/<h1[^>]*>([\s\S]*?)<\/h1>/g) ?? [];
  assert.equal(headings.length, 1);
  const text = visibleText(headings[0]);
  assert.match(text, /Parth Soni/);
  assert.match(text, /Data Analyst/);
  assert.match(text, /portfolio/i);
});

test("the title and description pair the brand with the role and the portfolio", () => {
  const title = index.match(/<title>([^<]*)<\/title>/)[1];
  assert.match(title, /Parth Soni/);
  assert.match(title, /Data Analyst/);
  assert.match(title, /Portfolio/);
  assert.match(index, /<meta name="description" content="[^"]*data analytics portfolio/i);
});

test("the privacy page is a real, indexable page with one H1 and enough text", () => {
  assert.match(privacy, /<html lang="en">/);
  assert.match(privacy, /<link rel="canonical" href="https:\/\/parth-portfolio-wb\.pages\.dev\/privacy">/);
  assert.equal((privacy.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((privacy.match(/<h2\b/g) ?? []).length, 7);
  assert.ok(visibleText(privacy).length > 3000);
  assert.ok(visibleText(privacy).includes("sets no cookies"));
  assert.ok(visibleText(privacy).includes("sessionStorage"));
  assert.ok(visibleText(privacy).includes("Cloudflare Pages"));
  assert.ok(!/<script\b/i.test(privacy), "the legal page needs no script");
  assert.ok(!/\sstyle="/.test(privacy), "no inline styles under style-src 'self'");
});

test("llms.txt follows the llms.txt shape and says when to use the site", () => {
  const llms = read("llms.txt");
  assert.ok(llms.startsWith("# Parth Soni"));
  assert.match(llms, /^> /m);
  assert.match(llms, /^## When to use this$/m);
  assert.match(llms, /^## Contact$/m);
  assert.match(llms, /Accept: text\/markdown/);
  assert.ok(llms.includes(`${SITE}/sitemap.xml`));
  assert.ok(llms.includes(`${SITE}/privacy`));
  assert.ok(llms.includes("soni.soni.parth@gmail.com"));
  assert.ok(llms.includes("Do **not** use this site as an API"));
  assert.ok(llms.length > 2500);
});

test("the sitemap lists every published page, and every listed page exists", () => {
  const sitemap = read("sitemap.xml");
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.ok(urls.includes(`${SITE}/`));
  assert.ok(urls.includes(`${SITE}/privacy`));
  assert.equal(urls.length, 12);

  for (const url of urls) {
    const path = new URL(url).pathname;
    const file =
      path === "/"
        ? "index.html"
        : path.endsWith("/")
          ? `${path.slice(1)}index.html`
          : `${path.slice(1)}.html`;
    assert.ok(existsSync(join(root, file)), `sitemap URL ${url} maps to missing ${file}`);
  }
});

test("robots.txt points at the sitemap on the canonical host", () => {
  const robots = read("robots.txt");
  assert.match(robots, /^User-agent: \*$/m);
  assert.ok(robots.includes(`Sitemap: ${SITE}/sitemap.xml`));
});

test("_routes.json is valid and does not exclude the document routes", () => {
  const routes = JSON.parse(read("_routes.json"));
  assert.equal(routes.version, 1);
  assert.deepEqual(routes.include, ["/*"]);
  assert.ok(!routes.exclude.includes("/"));
  assert.ok(!routes.exclude.includes("/privacy"));
  assert.ok(routes.exclude.includes("/style.css"));
  assert.ok(routes.exclude.includes("/fonts/*"));
});
