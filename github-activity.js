/* GitHub Activity - a contribution-style heatmap for any dated metric.
 *
 *   <div data-github-activity data-ga-dates="2025-01-04,2025-01-04,2025-02-11"
 *        data-ga-label="Visa decisions"></div>
 *
 *   ActivityHeatmap.render(el, [{ date: '2025-01-04', value: 3 }], { label: '…' })
 *
 * A year of squares, one per day, shaded by how much happened. Any series of
 * dates will do - commits, decisions, watch entries, laps - which is why the
 * kit takes dates rather than a GitHub response: the same grid answers "when do
 * decisions land" as easily as "when do I commit".
 *
 * The grid is one image to a screen reader ("1,204 entries over 53 weeks,
 * busiest 9–15 March"), and the ranked footer underneath is real list markup,
 * because nobody should have to walk 365 cells to read a heatmap.
 *
 * Sizing is the kit's job: it measures its own box and picks the largest square
 * that still fits all 53 columns, then follows the box with a ResizeObserver.
 * A host sets a width, not a cell size - pass { fit: false } (or
 * data-ga-fit="false") only if the cell size really is fixed by design.
 *
 * Dates outside the drawn window are ignored everywhere - squares, shades, the
 * ranking and the total - so a feed that carries several years still reads as
 * one year.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var STATES = 4;            // shades above zero
  var MIN_CELL = 5;          // below this the grid scrolls rather than turns to dust
  var BODY_GAP = 6;          // between the day-label gutter and the columns
  var sessions = [];
  var observers = typeof WeakMap === 'function' ? new WeakMap() : null;

  function reduced() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function iso(date) {
    var m = date.getMonth() + 1;
    var d = date.getDate();
    return date.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }

  function dayKey(value) {
    if (!value) return null;
    if (value instanceof Date) return iso(value);
    var s = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }

  // Dates in, or entries with a value: both collapse to a day -> count map.
  function tally(entries) {
    var counts = {};
    var total = 0;
    (entries || []).forEach(function (entry) {
      var key = dayKey(entry && entry.date ? entry.date : entry);
      if (!key) return;
      var weight = entry && typeof entry.value === 'number' ? entry.value : 1;
      counts[key] = (counts[key] || 0) + weight;
      total += weight;
    });
    return { counts: counts, total: total };
  }

  function parseAttr(el) {
    var raw = el.getAttribute('data-ga-dates') || '';
    if (raw.trim()) { return raw.split(',').map(function (s) { return s.trim(); }); }
    try {
      var json = el.getAttribute('data-ga-entries');
      if (json) return JSON.parse(json);
    } catch (err) { /* a broken attribute is a broken chart, not a crash */ }
    return [];
  }

  // Shading is by quartile of the non-zero days, not by a fraction of the
  // busiest one: a single release week would otherwise wash the other 364 days
  // into one flat shade. Ties collapse the quartiles, which is why the rule is
  // "above" each threshold rather than "in a bucket" - a year of ones is one
  // shade, not four.
  function thresholds(counts) {
    var values = Object.keys(counts).map(function (k) { return counts[k]; })
      .filter(function (n) { return n > 0; })
      .sort(function (a, b) { return a - b; });
    if (!values.length) return [];
    return [0.25, 0.5, 0.75].map(function (p) {
      return values[Math.floor((values.length - 1) * p)];
    });
  }

  function levelOf(count, cuts) {
    if (!count) return 0;
    for (var i = STATES - 1; i >= 1; i--) {
      if (cuts[i - 1] !== undefined && count > cuts[i - 1]) return i + 1;
    }
    return 1;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* The gap and the gutter are read from layout, not from the custom properties:
     a custom property computes to a token stream (calc() and all), so parsing it
     would be a second, weaker copy of what the browser already resolved. */
  function fit(el) {
    var cells = el.querySelector('.ga-cells');
    var days = el.querySelector('.ga-days');
    if (!cells || !days) return;
    var cs = global.getComputedStyle(el);
    var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    var width = el.clientWidth - pad;
    if (width < 160) return;        // a hidden pane measures 0; the observer fires on show

    var cols = cells.querySelectorAll('.ga-col').length;
    if (!cols) return;
    var gap = parseFloat(global.getComputedStyle(cells).columnGap) || 0;
    var gutter = days.offsetWidth + BODY_GAP;
    var cell = Math.floor((width - gutter - gap * (cols - 1)) / cols);
    if (cell < MIN_CELL) cell = MIN_CELL;
    el.style.setProperty('--ga-cell', cell + 'px');
  }

  function watch(el) {
    if (!global.ResizeObserver || !observers || observers.has(el)) return;
    var ro = new global.ResizeObserver(function () { fit(el); });
    observers.set(el, ro);
    ro.observe(el);
  }

  function rankWeeks(weeks, counts, today) {
    var rows = [];
    weeks.forEach(function (col) {
      var count = 0;
      var first = null;
      var last = null;
      col.forEach(function (day) {
        if (day > today) return;
        var n = counts[iso(day)] || 0;
        if (!n) return;
        count += n;
        if (!first || day < first) first = day;
        if (!last || day > last) last = day;
      });
      if (!count) return;
      var from = first || col[0];
      var to = last || col[6];
      rows.push({
        count: count,
        label: from.toDateString() === to.toDateString()
          ? from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' – ' +
            to.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      });
    });
    // Ties keep calendar order rather than an arbitrary one.
    return rows.sort(function (a, b) { return b.count - a.count; });
  }

  function render(el, entries, opts) {
    opts = opts || {};
    if (!el) return null;
    var data = tally(entries);
    var label = opts.label || el.getAttribute('data-ga-label') || 'entries';
    var today = opts.end ? new Date(opts.end) : new Date();
    today.setHours(0, 0, 0, 0);
    var span = opts.days || 365;

    var start = new Date(today.getTime());
    start.setDate(start.getDate() - (span - 1));
    var gridStart = new Date(start.getTime());
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());   // a Sunday

    var weeks = [];
    var cursor = new Date(gridStart.getTime());
    while (cursor <= today) {
      var col = [];
      for (var d = 0; d < 7; d++) {
        col.push(new Date(cursor.getTime()));
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(col);
    }

    /* Only the drawn window counts. An endpoint may hand over much more than a
       year (the portfolio's own calendar carries several), and a total, a shade
       scale or a ranking that adds days no square on screen shows is a number
       the picture cannot explain. */
    var counts = {};
    var total = 0;
    var max = 0;
    weeks.forEach(function (col) {
      col.forEach(function (day) {
        if (day > today) return;
        var key = iso(day);
        var n = data.counts[key] || 0;
        if (!n) return;
        counts[key] = n;
        total += n;
        if (n > max) max = n;
      });
    });

    var cuts = thresholds(counts);
    var ranked = rankWeeks(weeks, counts, today);
    var summary = total.toLocaleString('en-US') + ' ' + label + ' over ' +
      weeks.length + ' weeks' +
      (ranked.length ? ', busiest ' + ranked[0].label : '');

    while (el.firstChild) el.removeChild(el.firstChild);
    el.classList.add('ga');

    var grid = doc.createElement('div');
    grid.className = 'ga-grid';
    grid.setAttribute('role', 'img');
    grid.setAttribute('aria-label', summary);

    // One scroller holds the month row and the squares, so the labels cannot
    // drift from the columns they name when the year is wider than the card.
    var scroll = doc.createElement('div');
    scroll.className = 'ga-scroll';
    grid.appendChild(scroll);

    var months = doc.createElement('div');
    months.className = 'ga-months';
    months.style.gridTemplateColumns = 'repeat(' + weeks.length + ', var(--ga-cell))';
    scroll.appendChild(months);

    var body = doc.createElement('div');
    body.className = 'ga-body';
    scroll.appendChild(body);

    var days = doc.createElement('div');
    days.className = 'ga-days';
    ['', 'Mon', '', 'Wed', '', 'Fri', ''].forEach(function (name) {
      var cell = doc.createElement('span');
      cell.textContent = name;
      days.appendChild(cell);
    });
    body.appendChild(days);

    var cells = doc.createElement('div');
    cells.className = 'ga-cells';
    body.appendChild(cells);

    var seenMonth = -1;
    weeks.forEach(function (col, w) {
      var column = doc.createElement('div');
      column.className = 'ga-col';
      col.forEach(function (day) {
        var key = iso(day);
        var count = counts[key] || 0;
        var future = day > today;
        var cell = doc.createElement('span');

        cell.className = 'ga-cell' + (future ? ' is-future' : '') + (!future && count ? ' is-on' : '');
        cell.setAttribute('data-ga-level', String(future ? 0 : levelOf(count, cuts)));
        cell.setAttribute('data-ga-date', key);
        cell.setAttribute('data-ga-count', String(count));
        cell.style.setProperty('--ga-delay', (reduced() ? 0 : Math.min(w * 6, 180)) + 'ms');
        if (!future) {
          cell.title = day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
            ' - ' + count + ' ' + label;
        }
        column.appendChild(cell);
      });
      cells.appendChild(column);

      // The first full week of each month gets the label, spanning the columns
      // that month will occupy.
      var firstOfMonth = null;
      col.forEach(function (day) {
        if (day > today) return;
        if (day.getDate() === 1 && !firstOfMonth) firstOfMonth = day;
      });
      if (firstOfMonth && firstOfMonth.getMonth() !== seenMonth) {
        seenMonth = firstOfMonth.getMonth();
        var tick = doc.createElement('span');
        tick.className = 'ga-month';
        tick.textContent = firstOfMonth.toLocaleString('en-US', { month: 'short' });
        tick.style.gridColumn = (w + 1) + ' / span 4';
        months.appendChild(tick);
      }
    });

    el.appendChild(grid);

    // Footer: the five busiest weeks as a ranked list, which is also the
    // accessible form of the chart.
    var foot = doc.createElement('div');
    foot.className = 'ga-foot';

    var head = doc.createElement('p');
    head.className = 'ga-total';
    head.innerHTML = '<b>' + total.toLocaleString('en-US') + '</b> ' + esc(label) +
      ' across ' + weeks.length + ' weeks' +
      (ranked.length ? ' &middot; busiest ' + esc(ranked[0].label) : '');
    foot.appendChild(head);

    if (ranked.length) {
      var list = doc.createElement('ol');
      list.className = 'ga-rank';
      var top = ranked[0].count || 1;
      ranked.slice(0, 5).forEach(function (row) {
        var li = doc.createElement('li');
        var name = doc.createElement('span');
        var track = doc.createElement('span');
        var bar = doc.createElement('span');
        var n = doc.createElement('span');

        name.className = 'ga-rank-label';
        name.textContent = row.label;
        track.className = 'ga-rank-bar';
        bar.className = 'ga-bar';
        bar.style.setProperty('--ga-w', Math.round((row.count / top) * 100) + '%');
        n.className = 'ga-rank-n';
        n.textContent = row.count.toLocaleString('en-US');

        track.appendChild(bar);
        li.appendChild(name);
        li.appendChild(track);
        li.appendChild(n);
        list.appendChild(li);
      });
      foot.appendChild(list);
    }

    el.appendChild(foot);

    if (opts.fit === false) el.style.removeProperty('--ga-cell');
    else { fit(el); watch(el); }

    var result = {
      total: total,
      max: max,
      weeks: weeks.length,
      busiest: ranked.length ? ranked[0].label : null,
    };
    sessions.push({ el: el, data: data, result: result });
    return result;
  }

  function attach(el) {
    if (!el || el.getAttribute('data-ga-ready')) return null;
    var entries = parseAttr(el);
    if (!entries.length) return null;
    el.setAttribute('data-ga-ready', '1');
    return render(el, entries, {
      label: el.getAttribute('data-ga-label'),
      days: parseInt(el.getAttribute('data-ga-days'), 10) || 365,
      end: el.getAttribute('data-ga-end') || undefined,
      fit: el.getAttribute('data-ga-fit') !== 'false',
    });
  }

  function scan(root) {
    for (var i = sessions.length - 1; i >= 0; i--) {
      if (doc.contains(sessions[i].el)) continue;
      sessions.splice(i, 1);
    }
    var list = root.matches && root.matches('[data-github-activity]') ? [root] : [];
    if (root.querySelectorAll) {
      list = list.concat(Array.prototype.slice.call(root.querySelectorAll('[data-github-activity]')));
    }
    list.forEach(attach);
  }

  function boot() {
    scan(doc.body);
    if (!global.MutationObserver) return;
    var pending = 0;
    var queued = [];
    new global.MutationObserver(function (records) {
      Array.prototype.forEach.call(records, function (r) {
        Array.prototype.forEach.call(r.addedNodes, function (n) {
          if (n.nodeType === 1) queued.push(n);
        });
      });
      if (!queued.length || pending) return;
      pending = global.requestAnimationFrame(function () {
        pending = 0;
        var batch = queued;
        queued = [];
        batch.forEach(scan);
      });
    }).observe(doc.body, { childList: true, subtree: true });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.ActivityHeatmap = {
    render: render,
    attach: attach,
    refresh: function () { scan(doc.body); },
    tally: tally,
  };
})(window);
