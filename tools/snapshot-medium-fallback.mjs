/**
 * Regenerate the "Writing on Medium" list's embedded snapshot from the feed.
 *
 *   node tools/snapshot-medium-fallback.mjs [--check]
 *
 * The portfolio's Medium callout shows the newest articles, read at runtime from
 * this site's own /api/medium endpoint (functions/api/medium.js). That read can
 * still fail — Medium itself can be unreachable, and a deploy is a deploy — so
 * index.html ships a snapshot of the same articles. A snapshot is a frozen copy,
 * which is exactly how a page ends up quietly listing articles from last season
 * as if they were current, and the section used to do worse than that: it fell
 * back to two hand-typed articles from September and said nothing about it.
 *
 * This tool is the answer to the staleness half. It reads Medium's own feed
 * (FEED_SOURCE) and runs the same `parseFeed()` + `latestPosts()` that the
 * Function and the page run (medium-feed.js), then writes the result into the
 * MEDIUM:START/END block of index.html. The snapshot is therefore never
 * hand-typed and never drifts in method — only in time, which is what the
 * `data-taken` stamp records. Re-run it after publishing.
 *
 * It reads Medium directly rather than through /api/medium so that it works
 * before the Function is deployed: in Node there is no CORS to work around, and
 * the parsing and the choosing are the same code either way.
 *
 * The page still refreshes the list on every load, so this snapshot is what a
 * visitor sees when the live read fails (and, in the labels, that it is one).
 *
 *   --check   report whether the committed snapshot still lists the newest
 *             articles; write nothing, exit 1 when it does not
 *
 * No dependencies: Node's fetch, plus the module the page itself loads. Exit
 * codes go through process.exitCode rather than process.exit(), so a keep-alive
 * socket from the fetch is never torn down mid-close (that crashes libuv on
 * Windows and turns a passing check into exit 127).
 */

import { readFile, writeFile } from 'node:fs/promises';
import feed from '../medium-feed.js';

const { FEED_SOURCE, parseFeed, latestPosts } = feed;

const HERE = new URL('..', import.meta.url);
const PAGE = new URL('index.html', HERE);
const START_MARK = '<!-- MEDIUM:START -->';
const END_MARK = '<!-- MEDIUM:END -->';

/** Text for an HTML text node or attribute: escape first, then the house dash. */
function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    /* Matching the markup this replaced: titles carry em dashes and the page
       writes them as an entity, so keep that rather than a raw byte. */
    .replace(/\u2014/g, '&mdash;');
}

/**
 * The inverse of esc(), for reading the committed markup back.
 *
 * Without this the check can never pass: the block stores `&mdash;` where the
 * feed gives an em dash, so comparing the file against the feed would report
 * every run as stale and the check would be worse than none — the thing a
 * permanently-red guard teaches a reader is to ignore it. `&amp;` is undone last
 * so an escaped ampersand is not read as the start of another entity.
 */
function unesc(text) {
  return String(text)
    .replace(/&mdash;/g, '\u2014')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

/** The generated block, indented to sit inside the callout in index.html. */
function block(posts, taken) {
  const items = posts.map(p =>
    `            <li><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a><span>${esc(p.label)}</span></li>`
  ).join('\n');
  return [
    '          <ul class="medium-recent">',
    items,
    '          </ul>',
    '          <!-- Shown by script.js only when the live read fails: a snapshot that',
    '               reads as live is what this list used to be. -->',
    `          <p class="medium-snapshot-note" id="mediumSnapshotNote" role="status" hidden data-taken="${esc(taken)}"></p>`,
  ].join('\n');
}

/** The articles the block lists, as "title|label", for comparing runs. */
function fingerprint(posts) {
  return posts.map(p => `${p.title}|${p.label}`).join('\n');
}

/** The same fingerprint read back out of the committed markup. */
function currentFingerprint(html) {
  const rows = [...html.matchAll(
    /<li><a href="[^"]*"[^>]*>([\s\S]*?)<\/a><span>([^<]*)<\/span><\/li>/g)];
  return rows.map(m => `${unesc(m[1])}|${unesc(m[2])}`).join('\n');
}

async function main() {
  const check = process.argv.includes('--check');

  const res = await fetch(FEED_SOURCE, {
    cache: 'no-store',
    headers: { 'user-agent': 'parth-portfolio-wb/1.0 (+snapshot tool)' },
  });
  if (!res.ok) {
    console.error(`✗ medium's feed answered HTTP ${res.status} — snapshot left alone`);
    return 1;
  }

  const posts = latestPosts(parseFeed(await res.text()));
  if (!posts.length) {
    console.error('✗ the feed yielded no usable Medium links — snapshot left alone');
    return 1;
  }
  const taken = new Date().toISOString().slice(0, 10);

  const source = await readFile(PAGE, 'utf8');
  const from = source.indexOf(START_MARK);
  const to = source.indexOf(END_MARK);
  if (from < 0 || to < 0 || to < from) {
    console.error(`✗ ${START_MARK} / ${END_MARK} not found in index.html`);
    return 1;
  }

  const current = currentFingerprint(source.slice(from + START_MARK.length, to));
  const next = fingerprint(posts);
  const summary = posts.map(p => `  · ${p.label}  ${p.title}`).join('\n');

  if (current === next) {
    console.log(`✓ snapshot already lists the newest ${posts.length} — ${taken}`);
    console.log(summary);
    return 0;
  }

  if (check) {
    const committed = (source.match(/data-taken="([^"]+)"/) || [])[1] || 'unknown date';
    console.error(`✗ snapshot is stale — taken ${committed}, and the feed now lists:`);
    console.error(summary);
    if (current) console.error('  (committed:)\n' + current.split('\n').map(l => '  · ' + l).join('\n'));
    console.error('  run: node tools/snapshot-medium-fallback.mjs');
    return 1;
  }

  await writeFile(PAGE, source.slice(0, from + START_MARK.length) + '\n' + block(posts, taken) + '\n          ' + source.slice(to));
  console.log(`✓ snapshot refreshed from the feed — taken ${taken}`);
  console.log(summary);
  console.log('  written into index.html');
  return 0;
}

process.exitCode = await main();
