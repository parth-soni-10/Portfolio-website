/**
 * Regenerate the dashboard section's embedded snapshot from the store.
 *
 *   node tools/snapshot-dashboard-fallback.mjs [--check]
 *
 * The portfolio's dashboard section reads the Content Tracking Dashboard's own
 * watchlist endpoint. When that read fails the section falls back to a snapshot
 * embedded in script.js, so the page still shows a dashboard instead of an empty
 * card — and a snapshot is a frozen copy, which is exactly how a page ends up
 * quietly disagreeing with the dashboard it describes.
 *
 * This tool is the answer to that: it fetches the same endpoint the page fetches
 * and runs the same `buildLive()` the page runs (dash-aggregate.js), then writes
 * the result into the SNAPSHOT:START/END block of script.js. The snapshot is
 * therefore never hand-typed and never drifts in method — only in time, which is
 * what `taken` records. Re-run it whenever the store has moved on.
 *
 *   --check   report whether the committed snapshot still matches the store;
 *             write nothing, exit 1 when it is stale
 *
 * No dependencies: Node's fetch, plus the module the page itself loads.
 * Exit codes are set through process.exitCode rather than process.exit(), so a
 * keep-alive socket from the fetch is never torn down mid-close (that crashes
 * libuv on Windows and turns a passing check into exit 127).
 */

import { readFile, writeFile } from 'node:fs/promises';
import aggregate from '../dash-aggregate.js';

const { buildLive } = aggregate;

const HERE = new URL('..', import.meta.url);
const SCRIPT = new URL('script.js', HERE);
const ENDPOINT = 'https://contenttrackerdashboard.pages.dev/.netlify/functions/watchlist';
const START_MARK = '  /* SNAPSHOT:START */';
const END_MARK = '  /* SNAPSHOT:END */';

/**
 * Format a value as a JS literal: objects expand, arrays of numbers/strings stay
 * on one line. Plain JSON.stringify(…, null, 2) would print every month series
 * one number per line and turn a 60-line block into 240 — and this block lives
 * inside script.js, which every visitor downloads.
 */
function format(value, depth = 0) {
  const pad = '  '.repeat(depth);
  if (Array.isArray(value)) {
    const inline = JSON.stringify(value);
    if (inline.length <= 110) return inline;
    return `[\n${value.map(v => pad + '  ' + format(v, depth + 1)).join(',\n')}\n${pad}]`;
  }
  if (value && typeof value === 'object') {
    const body = Object.keys(value)
      .map(key => `${pad}  ${JSON.stringify(key)}: ${format(value[key], depth + 1)}`)
      .join(',\n');
    return `{\n${body}\n${pad}}`;
  }
  return JSON.stringify(value);
}

/** The snapshot statement, indented to sit inside script.js's IIFE. */
function literal(built, taken) {
  const value = {
    taken,
    periods: built.periods,
    genres: built.genres,
    genreYears: built.genreYears,
    startYear: built.startYear,
    startC: built.startC,
    yearOrder: built.yearOrder,
  };
  return `  const FALLBACK = ${format(value, 1)};`;
}

async function main() {
  const check = process.argv.includes('--check');

  const res = await fetch(`${ENDPOINT}?_ts=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) {
    console.error(`✗ store answered HTTP ${res.status} — snapshot left alone`);
    return 1;
  }

  const built = buildLive(await res.json());
  const taken = new Date().toISOString().slice(0, 10);
  const next = literal(built, taken);

  const source = await readFile(SCRIPT, 'utf8');
  const from = source.indexOf(START_MARK);
  const to = source.indexOf(END_MARK);
  if (from < 0 || to < 0 || to < from) {
    console.error(`✗ ${START_MARK} / ${END_MARK} not found in script.js`);
    return 1;
  }

  // `current` is trimmed out of its surrounding blank lines (and its indent), so
  // compare against the same form of `next`. `next` itself is written verbatim.
  const current = source.slice(from + START_MARK.length, to).trim();
  const all = built.periods.all;
  const summary =
    `${all.titles} titles (${all.shows} shows / ${all.movies} movies) · ` +
    `${all.hours.toLocaleString('en-US')} hours · ${built.genres.length} genres · ` +
    `${built.yearOrder.length} years (${built.yearOrder.join(', ')})`;

  if (current === next.trim()) {
    console.log(`✓ snapshot already current — ${summary}`);
    return 0;
  }

  if (check) {
    const committed = (current.match(/"taken":\s*"([^"]+)"/) || [])[1] || 'unknown date';
    console.error(`✗ snapshot is stale — committed ${committed}; the store now holds ${taken}: ${summary}`);
    console.error('  run: node tools/snapshot-dashboard-fallback.mjs');
    return 1;
  }

  await writeFile(SCRIPT, source.slice(0, from + START_MARK.length) + '\n' + next + '\n' + source.slice(to));
  console.log(`✓ snapshot refreshed from the store — ${summary}`);
  console.log('  written into script.js');
  return 0;
}

process.exitCode = await main();
