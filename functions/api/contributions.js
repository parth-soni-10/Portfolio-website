/* ---------------------------------------------------------------------------
 * GET /api/contributions — the GitHub contribution calendar, fetched and cached
 * by this site.
 *
 * The heatmap used to be drawn from a request this page made straight to
 * github-contributions-api.jogruber.de, a community-run service in front of
 * GitHub's (GraphQL-only, authenticated) contribution calendar. That made every
 * visitor's heatmap depend on one third-party host answering, on every load, and
 * put a host with no commitment to this site in the browser's connect-src.
 *
 * GitHub's REST API — which this page already calls for the repo and follower
 * counts — does not expose the calendar at all, so "compute it ourselves from
 * api.github.com" is not available without a token this site should not hold.
 * The honest fix is the other half of the report's suggestion: fetch it once,
 * server-side, and cache it. Contributions are counted per day, so a day-old
 * answer is not a stale answer; the entry is held for CACHE_SECONDS and repeat
 * visitors never touch the service at all.
 *
 * What this does not do, plainly: jogruber.de is still the source. If it is down
 * when the cache is cold, the graph is still unavailable — but the failure now
 * reaches one request per colo per 12 hours rather than every visitor's browser,
 * and the page keeps its existing quiet fallback. Dropping the dependency
 * entirely would mean an authenticated GraphQL token on the server, which is a
 * decision to make on purpose, not a side effect of a polish pass.
 * ------------------------------------------------------------------------ */

/** The account whose calendar this is. One login, named once. */
const LOGIN = 'parth-soni-10';

const SOURCE = `https://github-contributions-api.jogruber.de/v4/${LOGIN}`;

/** 12 hours: the upstream counts days, not minutes. */
const CACHE_SECONDS = 43200;

const CACHE_KEY = 'https://github-contributions.internal/api/contributions';

export const onRequestGet = async (context) => {
  const { waitUntil } = context;

  const hit = await caches.default.match(CACHE_KEY);
  if (hit) return hit;

  let upstream;
  try {
    upstream = await fetch(SOURCE, { headers: { accept: 'application/json' } });
  } catch (error) {
    console.error('contributions fetch failed:', (error && error.stack) || error);
    return json({ error: 'contributions unreachable' }, 502);
  }
  if (!upstream.ok) {
    console.error(`contributions answered HTTP ${upstream.status}`);
    return json({ error: `contributions HTTP ${upstream.status}` }, 502);
  }

  // Passed through as-is: the page reads `contributions[].date/.count`, and this
  // endpoint's job is to own the fetch, not to reshape what the upstream means.
  const response = new Response(await upstream.text(), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
  if (waitUntil) waitUntil(caches.default.put(CACHE_KEY, response.clone()).catch(() => {}));
  return response;
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
