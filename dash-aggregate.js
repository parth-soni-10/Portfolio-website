/* dash-aggregate.js - the Content Tracker slice's data shaping, in one place.
 *
 * The dashboard section reads the Content Tracking Dashboard's own store (its
 * `watchlist` read endpoint, D1 behind `lib/db.js`) and turns those rows into the
 * per-period KPIs and chart series the section draws. That shaping lives here
 * rather than inside the section's IIFE for one reason: the section falls back to
 * an embedded snapshot when the store cannot be reached, and
 * tools/snapshot-dashboard-fallback.mjs regenerates that snapshot by running this
 * exact function over the store's rows. One implementation means the live figures
 * and the snapshot cannot disagree about how a row is counted.
 *
 * Loaded as a plain <script> (it attaches window.DashAggregate) and require()d by
 * that tool under Node - hence the small UMD wrapper at the bottom. No DOM, no
 * fetch, no globals beyond its own.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DashAggregate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Locale-aware month labels (Intl, not a hardcoded array) */
  const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleString('en-US', { month: 'short' }));

  /* Parser for the store's `Month` column. The dashboard writes full names
     (e.g. "August"); short names are accepted too as a safety net. */
  const MONTH_IDX = {};
  ['January', 'February', 'March', 'April', 'May', 'June', 'July',
   'August', 'September', 'October', 'November', 'December']
    .forEach((m, i) => { MONTH_IDX[m] = i; });
  MONTH_NAMES.forEach((m, i) => { MONTH_IDX[m] = i; });

  /* One field off a row, by header-style key. The endpoint's keys are fixed
     ('Details/Genre', 'Screentime', …) but the lookup stays tolerant of case and
     of the Sheet-era alternative a name is given, the way the CSV header lookup
     it replaces was. Blank values fall through to the next name. */
  function pick(row, ...names) {
    const keys = Object.keys(row);
    for (const name of names) {
      const want = String(name).toLowerCase();
      const key = keys.find(k => k.toLowerCase() === want);
      if (key === undefined) continue;
      const value = row[key];
      if (value === null || value === undefined) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return '';
  }

  /**
   * Store rows → the periods / genres / series the section renders.
   *
   * @param {Array<Object>} rows wire rows from the watchlist endpoint
   * @returns {{periods: Object, genres: string[], genreYears: Object,
   *            startYear: number, startC: number, yearOrder: string[]}}
   */
  function buildLive(rows) {
    if (!Array.isArray(rows)) throw new Error('Store rows expected');

    const records = [];
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const name = pick(row, 'Name');
      if (!name) continue;
      /* Same row rule as the full Content Tracking Dashboard (its mapRows
         keeps only `name && year > 0`): a title without a year can't be
         bucketed into any period, and counting it in All Time only is what
         made this section disagree with the live dashboard - and with the
         sum of its own year tabs. */
      const yv = parseInt(pick(row, 'Year'), 10);
      if (!(yv > 0)) continue;
      const st = parseFloat(pick(row, 'Screentime'));
      const type = pick(row, 'Type').toLowerCase();
      const mo = MONTH_IDX[pick(row, 'Month')];
      records.push({
        genre: pick(row, 'Details/Genre', 'Genre'),
        month: mo === undefined ? -1 : mo,
        year: String(yv),
        min: isFinite(st) && st > 0 ? st : 0,
        movie: type === 'movie',                                  /* exact match, as the live KPIs do */
        show: type.includes('series') || type.includes('show')
      });
    }
    if (!records.length) throw new Error('No rows parsed');

    const years = [...new Set(records.map(r => r.year))].sort();
    const minYear = Number(years[0]);
    const maxYear = years[years.length - 1];

    const sumMin = list => list.reduce((s, r) => s + r.min, 0);
    const H = m => Math.round(m / 60);

    /* All genres (all-time hours) drive the bar chart order - no top-N cut:
       with only six bars the full-width card sat mostly empty. */
    const gHours = {};
    records.forEach(r => { if (r.genre) gHours[r.genre] = (gHours[r.genre] || 0) + r.min; });
    const ALL_GENRES = Object.keys(gHours)
      .sort((a, b) => gHours[b] - gHours[a]);

    /* hours by genre per period, aligned to the all-genre order */
    const genreYears = {};
    ['all'].concat(years).forEach(p => {
      const list = p === 'all' ? records : records.filter(r => r.year === p);
      genreYears[p] = ALL_GENRES.map(g => H(list.reduce((s, r) => (r.genre === g ? s + r.min : s), 0)));
    });

    /* continuous month series (gap-filled) for the line chart */
    const mc = r => (Number(r.year) - minYear) * 12 + r.month;
    const dated = records.filter(r => r.year && r.month >= 0);
    const startC = dated.length ? Math.min.apply(null, dated.map(mc)) : 0;
    const maxC   = dated.length ? Math.max.apply(null, dated.map(mc)) : 0;
    const bucket = (y, mo) => H(records.reduce((s, r) =>
      (r.year === y && r.month === mo ? s + r.min : s), 0));
    const allMonths = [];
    for (let c = startC; c <= maxC; c++) allMonths.push(bucket(String(minYear + Math.floor(c / 12)), c % 12));
    const firstY = minYear + Math.floor(startC / 12);
    const lastY  = minYear + Math.floor(maxC / 12);

    /* Show/movie share, printed exactly the way the full dashboard prints
       it: one decimal on All Time, whole percents on a year page, each
       share computed against the period's title count. */
    const shares = (list, dec) => {
      const p = n => (list.length ? (100 * n / list.length) : 0).toFixed(dec);
      return [p(list.filter(r => r.show).length), p(list.filter(r => r.movie).length)];
    };
    const [allS, allM] = shares(records, 1);

    const periods = {
      all: {
        name: 'All Time',
        months: allMonths,
        titles: records.length,
        hours: H(sumMin(records)),
        shows: records.filter(r => r.show).length,
        movies: records.filter(r => r.movie).length,
        sub: ['series + movies', 'since ' + MONTH_NAMES[startC % 12] + ' ' + firstY,
              allS + '% of titles', allM + '% of titles'],
        monthsLabel: MONTH_NAMES[startC % 12] + ' ' + firstY + '-' +
                     MONTH_NAMES[maxC % 12] + ' ' + lastY
      }
    };

    years.forEach(y => {
      const titled = records.filter(r => r.year === y);
      const isLast = y === maxYear;
      const lastMonth = isLast
        ? dated.filter(r => r.year === y).reduce((mx, r) => Math.max(mx, r.month), 0)
        : 11;
      const months = [];
      for (let mo = 0; mo <= lastMonth; mo++) months.push(bucket(y, mo));
      const [sp, mp] = shares(titled, 0);
      const label = isLast
        ? 'Jan-' + MONTH_NAMES[lastMonth] + ' ' + y
        : 'Jan-Dec ' + y;
      periods[y] = {
        name: y,
        months,
        titles: titled.length,
        hours: H(sumMin(titled)),
        shows: titled.filter(r => r.show).length,
        movies: titled.filter(r => r.movie).length,
        sub: ['active in period', label, sp + '% of titles', mp + '% of titles'],
        monthsLabel: label
      };
    });

    return {
      periods,
      genres: ALL_GENRES,
      genreYears,
      startYear: minYear,
      startC,
      yearOrder: years.slice().reverse()   /* newest first - drives the filter tabs */
    };
  }

  return { buildLive, MONTH_NAMES, MONTH_IDX, pick };
});
