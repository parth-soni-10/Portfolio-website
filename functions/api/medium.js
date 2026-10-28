/* ---------------------------------------------------------------------------
 * GET /api/medium - the "Writing on Medium" list's feed, fetched by this site.
 *
 * What this replaces: the page used to read the feed through
 * api.rss2json.com, a free JSON proxy, because Medium answers a *browser*
 * request to its own feed with a Cloudflare challenge (HTTP 403) and sends no
 * Access-Control-Allow-Origin. Renting that one data path broke the section for
 * every visitor on 15 Oct 2026 - the proxy answered HTTP 500
 * `{"status":"error","message":"Internal error"}` while the feed itself was
 * returning 200 with 10 items, and nothing in the page could do about it.
 *
 * Server-side there is no CORS and no browser challenge, so this Function asks
 * Medium directly, parses the feed with the same `parseFeed()` the page and
 * tools/snapshot-medium-fallback.mjs use, and answers the page on this site's
 * own origin. The page therefore needs no third-party origin in `connect-src`,
 * and no service with no cache behind it stands between a visitor and the list.
 *
 * Cached in the colo cache for CACHE_SECONDS. A Function's own response is not
 * edge-cached by the platform, so the entry is put there explicitly (the same
 * reason RBI's router carries an edge-cache block). Ten minutes is a deliberate
 * middle: Medium's feed only changes when a post publishes, and the old proxy
 * could lag up to 30 minutes behind Medium, so this is both fresher than what it
 * replaced and no load on Medium's feed.
 *
 * Path: `functions/api/medium.js` is file-based routing - the route is exactly
 * `/api/medium`. This directory is compiled by the Pages build from the
 * repository root (not from the staged output), and `functions/` is listed in
 * .assetsignore so the sources are never uploaded as static files.
 *
 * Failure is reported, not hidden: a bad upstream read answers 502 with
 * `no-store`, and the page keeps its baked snapshot and says it is one. A 200
 * with an empty list would read as "no articles", which is a different and
 * false statement.
 * ------------------------------------------------------------------------ */
import feed from '../../medium-feed.js';

const { FEED_SOURCE, parseFeed } = feed;

/** How long one colo cache entry is reused, in seconds. */
const CACHE_SECONDS = 600;

/** The entry's key. Deliberately not the request URL: the query string is not
    part of what this endpoint answers, so a cache-busting `?t=` from a client
    must not be able to force an upstream fetch. */
const CACHE_KEY = 'https://medium-feed.internal/api/medium';

/** What Medium's own feed is asked with. A bare fetch is sometimes answered
    with the challenge page meant for browsers, so the request says what it is. */
const UPSTREAM_HEADERS = {
  'accept': 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1',
  'user-agent': 'parth-portfolio-wb/1.0 (+https://parth-portfolio-wb.pages.dev/; medium feed reader)',
};

function json(body, status) {
  /* `status` is normally omitted, so the comparison is against `code`, not
     against whatever the caller passed: comparing the argument sent every
     success out as `no-store`, which is also the one Cache-Control value the
     Cache API refuses to store, so the entries below were never written. */
  const code = status || 200;
  return new Response(JSON.stringify(body), {
    status: code,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': code === 200
        ? `public, max-age=${CACHE_SECONDS}`
        : 'no-store',
    },
  });
}

export const onRequestGet = async (context) => {
  const { waitUntil } = context;

  const hit = await caches.default.match(CACHE_KEY);
  if (hit) return hit;

  let res;
  try {
    res = await fetch(FEED_SOURCE, { headers: UPSTREAM_HEADERS, redirect: 'follow' });
  } catch (error) {
    console.error('medium feed fetch failed:', (error && error.stack) || error);
    return json({ error: 'medium feed unreachable' }, 502);
  }
  if (!res.ok) {
    console.error(`medium feed answered HTTP ${res.status}`);
    return json({ error: `medium feed HTTP ${res.status}` }, 502);
  }

  const items = parseFeed(await res.text());
  if (!items.length) {
    console.error('medium feed parsed to zero items');
    return json({ error: 'medium feed had no items' }, 502);
  }

  const response = json({ items });
  if (waitUntil) waitUntil(caches.default.put(CACHE_KEY, response.clone()).catch(() => {}));
  return response;
};
