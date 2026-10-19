/* medium-feed.js — the "Writing on Medium" list's feed rules, in one place.
 *
 * The section shows the three newest Medium articles, refreshed on every load.
 * It used to read them through api.rss2json.com — a free JSON proxy in front of
 * Medium's RSS, because Medium answers a *browser* request to its own feed with
 * a Cloudflare challenge (HTTP 403) and without CORS headers. On 15 Oct 2026 the
 * proxy answered HTTP 500 `{"status":"error","message":"Internal error"}` while
 * Medium's own feed was returning 200 with 10 items, so the list went empty for
 * every visitor: the section was renting its only data path from a service with
 * no cache behind it and no promise to answer.
 *
 * The fetch is now this site's own. `functions/api/medium.js` (a Pages Function,
 * compiled by the Pages build from `functions/` at the repository root) asks
 * Medium for the feed — server-side there is no CORS and no browser challenge —
 * parses it here, and answers the page on the same origin at FEED_URL. Nothing
 * third-party is in the path any more, and the page needs no new CSP origin.
 *
 * Why this file exists rather than that logic living in the section's IIFE:
 * three callers need to agree on what "the newest three" means — the page, the
 * Pages Function, and tools/snapshot-medium-fallback.mjs, which bakes the
 * fallback list into index.html. The tool reads Medium directly (Node has no
 * CORS either) and runs this exact `parseFeed()` + `latestPosts()`, so the three
 * on screen and the three baked into the page cannot be chosen two ways, and the
 * snapshot cannot disagree with the feed it claims to summarise.
 *
 * Loaded as a plain <script> (attaches window.MediumFeed), imported by the Pages
 * Function, and require()d by that tool under Node — hence the small UMD wrapper
 * at the bottom. No DOM, no fetch, no state beyond its own.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MediumFeed = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* One handle. FEED_SOURCE is what a server-side caller fetches (Medium
     directly); FEED_URL is what the browser fetches, which is this site's own
     Function — same origin, so `connect-src 'self'` covers it. */
  const HANDLE      = 'soni.soni.parth';
  const FEED_SOURCE = 'https://medium.com/feed/@' + HANDLE;
  const FEED_URL    = '/api/medium';

  /* How many articles the section shows. Three fits the callout without
     pushing the "Read Articles" button out of the card. */
  const WANT = 3;

  /* A hardcoded array rather than Intl: the labels are three letters and a
     four-digit year from a fixed-width date, so a locale-sensitive formatter
     would only add a way for the label to differ between the page and the tool. */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** "Oct 2026" from a normalized "YYYY-MM-DD HH:MM:SS", or '' if it is not one. */
  function monthLabel(pubDate) {
    const m = /^(\d{4})-(\d{2})/.exec(String(pubDate || ''));
    if (!m) return '';
    const month = Number(m[2]);
    return month >= 1 && month <= 12 ? MONTHS[month - 1] + ' ' + m[1] : '';
  }

  /**
   * The five entities an RSS title actually carries, plus numeric references.
   * Titles arrive as <![CDATA[…]]> or escaped text depending on the title, so
   * both are handled before anything is compared or printed.
   */
  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

  function decode(text) {
    return String(text || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&([a-z]+);/gi, (whole, name) => (name.toLowerCase() in ENTITIES ? ENTITIES[name.toLowerCase()] : whole))
      .trim();
  }

  /**
   * One tag's text out of an <item>: `<title><![CDATA[…]]></title>`.
   * Non-greedy, and anchored on the tag name so <atom:link> is not read as
   * <link> — the `(?![\w:-])` is what keeps `link` from matching `atom:link`.
   */
  function tag(item, name) {
    const m = new RegExp(`<${name}(?![\\w:-])[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(item);
    return m ? decode(m[1]) : '';
  }

  /**
   * Medium's RSS as the items `latestPosts()` expects.
   *
   * `pubDate` is normalized to the fixed-width `YYYY-MM-DD HH:MM:SS` (UTC): the
   * feed sends RFC-822 ("Tue, 14 Oct 2026 19:09:22 GMT"), and a fixed-width form
   * is what lets the ordering below be a plain string compare. An unparseable
   * date is left as the empty string, which sorts last rather than throwing.
   */
  function parseFeed(xml) {
    const items = String(xml || '').match(/<item(?![\\w:-])[\s\S]*?<\/item>/gi) || [];
    return items.map(item => {
      const link    = tag(item, 'link') || tag(item, 'guid');
      const title   = tag(item, 'title');
      const rawDate = tag(item, 'pubDate') || tag(item, 'published') || tag(item, 'updated');
      const when    = Date.parse(rawDate);
      return {
        title,
        link: link.split('?')[0],
        pubDate: Number.isFinite(when) ? new Date(when).toISOString().slice(0, 19).replace('T', ' ') : '',
      };
    });
  }

  /**
   * The newest `want` articles, newest first, as `{ title, url, pub, label }`.
   * Anything that is not a titled, plain-https Medium link is dropped rather
   * than rendered — the hrefs are written into the page, so a link that is not
   * one is not something to link.
   *
   * The order is decided here rather than trusted from upstream: items are
   * sorted on `pub`, the fixed-width `YYYY-MM-DD HH:MM:SS`, so a string compare
   * orders them correctly and a feed served in the wrong order still comes out
   * newest-first.
   */
  function latestPosts(items, want = WANT) {
    if (!Array.isArray(items)) return [];
    return items
      .filter(it => it && typeof it.title === 'string' && it.title.trim()
                 && typeof it.link === 'string')
      .map(it => ({
        title: it.title.trim(),
        url:   it.link.split('?')[0],
        pub:   String(it.pubDate || ''),
      }))
      .filter(it => {
        try {
          const u = new URL(it.url);
          return u.protocol === 'https:' && /(^|\.)medium\.com$/.test(u.hostname);
        } catch (e) {
          return false;
        }
      })
      .sort((a, b) => b.pub.localeCompare(a.pub))
      .slice(0, want)
      .map(it => ({ ...it, label: monthLabel(it.pub) }));
  }

  return { HANDLE, FEED_SOURCE, FEED_URL, WANT, MONTHS, monthLabel, parseFeed, latestPosts };
});
