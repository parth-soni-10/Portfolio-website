(function () {
  'use strict';

  /* ── OPENING SPLASH ───────────────────────────────── */
  /* The curtain is decorative and hides itself from CSS alone; this only skips
     it on a repeat visit, holds the page still while it plays, and removes the
     node once it has dissolved. A backstop timer means even a stalled
     animation can't leave the visitor behind it. */
  (function () {
    const splash = document.getElementById('splash');
    if (!splash) return;

    let seen = false;
    try { seen = sessionStorage.getItem('ps-splash-seen') === '1'; } catch (e) {}
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (seen || reduce) { splash.remove(); return; }
    try { sessionStorage.setItem('ps-splash-seen', '1'); } catch (e) {}

    // Hold the page still while the curtain plays, and pay the scrollbar back:
    // locking the viewport takes the scrollbar away, which would widen the
    // layout by its width and pop every centred element sideways the moment
    // the curtain lifted. Measured before the lock, released with it.
    // Clamped: a scrollbar is ~15-40 CSS px, so anything larger means the
    // measurement is meaningless (an unrendered document) and must be ignored
    // rather than turned into a page-wrecking padding.
    const bar = window.innerWidth - document.documentElement.clientWidth;
    if (bar > 0 && bar <= 64) document.documentElement.style.paddingRight = bar + 'px';
    document.body.classList.add('is-splashing');

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      splash.remove();
      document.body.classList.remove('is-splashing');
      document.documentElement.style.paddingRight = '';
    };

    // Only the curtain's own animation ends the sequence — the child
    // animations bubble their animationend up to #splash too.
    splash.addEventListener('animationend', (e) => {
      if (e.animationName === 'splash-out') finish();
    });
    setTimeout(finish, 1700);
  })();

  /* ── MOBILE MENU ─────────────────────────────────── */
  const menuToggle = document.getElementById('menuToggle');
  const mobileNav  = document.getElementById('mobileNav');

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.innerHTML = isOpen ? '&#10005;' : '&#9776;';
    });

    mobileNav.querySelectorAll('.mobile-link').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        menuToggle.innerHTML = '&#9776;';
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', (e) => {
      if (!mobileNav.contains(e.target) && !menuToggle.contains(e.target)) {
        mobileNav.classList.remove('open');
        menuToggle.innerHTML = '&#9776;';
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── SCROLL FADE-IN (Relay-style blur + rise) ────── */
  const fadeTargets = document.querySelectorAll(
    '.connect-card, ' +
    '.dash-filters, .dash-card, ' +
    '.exp-block, .spot-wrap, .cert-grid, .edu-entry, ' +
    '.about-body, .open-to-block, .medium-callout, ' +
    '.skills-two-col, .footer-grey'
  );

  fadeTargets.forEach(el => el.classList.add('fade-up'));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -30px 0px' }
  );

  fadeTargets.forEach(el => observer.observe(el));


  /* ── STAGGERED DASHBOARD CARD REVEAL ─────────────── */
  document.querySelectorAll('.dash-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 70}ms`;
  });

  /* ── ACTIVE NAV (IntersectionObserver, not a scroll listener) ── */
  const navLinks = document.querySelectorAll('nav a');
  const navByHref = new Map(Array.from(navLinks).map(l => [l.getAttribute('href'), l]));

  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(l => { l.style.color = ''; });
      const link = navByHref.get('#' + entry.target.id);
      if (link) link.style.color = '#e85d04';
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  document.querySelectorAll('section[id], div[id], footer[id]').forEach(sec => navObserver.observe(sec));

  /* ── HEADER SHADOW + EDGE BLUR ON SCROLL ─────────── */
  const header   = document.getElementById('site-header');
  const edgeBlur = document.querySelector('.edge-blur');

  /* Runs for scroll, resize and focus changes — the three things that can
     change whether the edge blur belongs on screen. */
  function syncScrollState() {
    if (header) {
      header.style.boxShadow = window.scrollY > 60
        ? '0 1px 2px rgba(22,19,14,.05), 0 10px 28px -14px rgba(22,19,14,.18)'
        : 'none';
    }
    if (edgeBlur) {
      // Only while there is report left below the fold — the blur is a
      // "more to come" cue, not a permanent frame over the footer. It also
      // steps aside for a focused field, so typing at a form's bottom edge is
      // never hazy.
      const active  = document.activeElement;
      const typing  = active && active.matches && active.matches('input, textarea, select');
      const remaining = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      edgeBlur.style.opacity = !typing && window.scrollY > 40 && remaining > 48 ? '1' : '0';
    }
  }

  window.addEventListener('scroll', syncScrollState, { passive: true });
  window.addEventListener('resize', syncScrollState, { passive: true });
  document.addEventListener('focusin', syncScrollState);
  document.addEventListener('focusout', syncScrollState);
  syncScrollState();

})();

/* ── CONNECT CARD (Svelte-style profile switcher) ─────── */
/* Replicates the colinlienard.com Contacts card: content swaps with a
   300ms directional fly (±200px, cubic-out) + fade, an indicator pill
   that slides between tabs (300ms tween), and auto-rotation. */
(function () {
  'use strict';

  const card = document.getElementById('connectCard');
  if (!card) return;

  const tabs      = Array.from(card.querySelectorAll('.connect-tab'));
  const panes     = Array.from(card.querySelectorAll('.connect-pane'));
  const body      = document.getElementById('connectBody');
  const indicator = card.querySelector('.connect-indicator');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FLY_PX       = 200;   // matches Svelte fly x:200
  const DURATION_MS  = 300;   // matches Svelte fly duration:300
  const ROTATE_MS    = 4200;  // auto-rotate interval

  let activeIndex = 0;
  let switching   = false;
  let timer       = null;
  let visible     = false; // corrected by IntersectionObserver's first callback

  /* Slide the indicator pill to the active tab (300ms tween).
     Transform-only: translateX positions it, scaleX sizes it
     (compositor-friendly — never animates left/width). */
  function positionIndicator(immediate) {
    const tab = tabs[activeIndex];
    if (!tab) return;
    const tf = 'translateX(' + tab.offsetLeft + 'px) scaleX(' +
               (tab.offsetWidth / indicator.parentElement.clientWidth) + ')';
    if (immediate) {
      indicator.style.transition = 'none';
      indicator.style.transform = tf;
      void indicator.offsetWidth; // flush
      indicator.style.transition = '';
    } else {
      indicator.style.transform = tf;
    }
  }

  /* Swap the visible pane with a directional fly + fade */
  function switchTo(next) {
    const n = tabs.length;
    if (next < 0) next = n - 1;
    if (next >= n) next = 0;
    if (switching || next === activeIndex) return;

    const forward  = next > activeIndex || (activeIndex === n - 1 && next === 0);
    const dir      = forward ? 1 : -1;
    const oldPane  = panes[activeIndex];
    const newPane  = panes[next];

    /* Tabs + a11y state (roving tabindex: only the active tab is focusable) */
    tabs[activeIndex].classList.remove('active');
    tabs[activeIndex].setAttribute('aria-selected', 'false');
    tabs[activeIndex].setAttribute('tabindex', '-1');
    oldPane.classList.remove('active');
    oldPane.setAttribute('aria-hidden', 'true');
    tabs[next].classList.add('active');
    tabs[next].setAttribute('aria-selected', 'true');
    tabs[next].setAttribute('tabindex', '0');
    newPane.classList.add('active');
    newPane.setAttribute('aria-hidden', 'false');

    activeIndex = next;

    if (reduceMotion) {
      positionIndicator(false);
      return;
    }

    switching = true;

    /* Lock body height to the taller pane so nothing clips mid-flight;
       the panes themselves animate transform/opacity only, never height */
    const oldH = body.offsetHeight;
    body.style.height = Math.max(oldH, newPane.offsetHeight) + 'px';
    body.classList.add('switching');

    /* Start states: old stays put, new sits off-screen in travel direction */
    oldPane.style.transform = 'translateX(0)';
    oldPane.style.opacity   = '1';
    newPane.style.transform = `translateX(${FLY_PX * dir}px)`;
    newPane.style.opacity   = '0';
    void body.offsetHeight; // flush initial state

    /* Animate: old flies out opposite, new flies in, body height eases */
    oldPane.style.transform = `translateX(${-FLY_PX * dir}px)`;
    oldPane.style.opacity   = '0';
    newPane.style.transform = 'translateX(0)';
    newPane.style.opacity   = '1';

    positionIndicator(false);

    window.setTimeout(() => {
      oldPane.style.transform = '';
      oldPane.style.opacity   = '';
      newPane.style.transform = '';
      newPane.style.opacity   = '';
      body.classList.remove('switching');
      body.style.height = '';
      switching = false;
    }, DURATION_MS + 60);
  }

  /* Auto-rotate */
  function startTimer() {
    stopTimer();
    if (reduceMotion) return;
    timer = window.setInterval(() => {
      if (visible && !switching && !card.matches(':hover') && !card.matches(':focus-within')) {
        switchTo(activeIndex + 1);
      }
    }, ROTATE_MS);
  }
  function stopTimer() {
    if (timer) { window.clearInterval(timer); timer = null; }
  }

  /* Pause while hovered / focused */
  card.addEventListener('mouseenter', stopTimer);
  card.addEventListener('mouseleave', startTimer);
  card.addEventListener('focusin', stopTimer);
  card.addEventListener('focusout', startTimer);

  /* Pause while off-screen (IO's first callback sets the true visibility) */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) startTimer(); else stopTimer();
    }, { threshold: 0.3 });
    io.observe(card);
  } else {
    visible = true; // no IO support: assume always visible
  }

  /* Tab clicks */
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      switchTo(i);
      startTimer();
    });
  });

  /* Arrow-key navigation (ARIA tabs pattern) */
  const tablist = card.querySelector('.connect-tabs');
  if (tablist) {
    tablist.addEventListener('keydown', (e) => {
      let next = null;
      if (e.key === 'ArrowRight') next = (activeIndex + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (activeIndex - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next !== null) {
        e.preventDefault();
        switchTo(next);
        tabs[next].focus();
        startTimer();
      }
    });
  }

  /* Copy email button */
  const copyBtn = document.getElementById('copyEmail');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const email = 'soni.soni.parth@gmail.com';
      try {
        await navigator.clipboard.writeText(email);
      } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = email;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      const original = copyBtn.textContent;
      copyBtn.textContent = 'Copied \u2713';
      window.setTimeout(() => { copyBtn.textContent = original; }, 2000);
      const status = document.getElementById('copyStatus');
      if (status) {
        status.textContent = 'Email address copied to clipboard';
        window.setTimeout(() => { status.textContent = ''; }, 2000);
      }
    });
  }

  /* Live GitHub stats (graceful fallback keeps the dash placeholders) */
  fetch('https://api.github.com/users/parth-soni-10')
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('gh'))))
    .then(d => {
      const repos = document.getElementById('ghRepos');
      const followers = document.getElementById('ghFollowers');
      if (repos)     repos.textContent = String(d.public_repos ?? '-');
      if (followers) followers.textContent = String(d.followers ?? '-');
    })
    .catch(() => {});

  /* Live GitHub contribution heatmap (github-contributions-api, CORS-enabled) */
  const ghGraph = document.getElementById('ghGraph');
  const ghWrap  = document.getElementById('ghGraphWrap');
  const ghTotal = document.getElementById('ghTotal');
  const WEEKS = 53;
  const GAP   = 2;

  function fitGraph() {
    if (!ghGraph || !ghWrap || !ghGraph.querySelector('.gh-cells')) return;
    const avail = ghWrap.clientWidth;
    let cell = Math.floor((avail - GAP * (WEEKS - 1)) / WEEKS);
    if (cell < 5) cell = 5; // min size; the wrapper scrolls horizontally below this
    ghGraph.style.setProperty('--gh-cell', cell + 'px');
    ghGraph.style.setProperty('--gh-gap', GAP + 'px');
    const pitch = cell + GAP;
    ghGraph.querySelectorAll('.gh-month-label').forEach(el => {
      el.style.left = (Number(el.dataset.col) * pitch) + 'px';
    });
  }

  function renderContributionGraph() {
    if (!ghGraph || !ghWrap) return;
    const pad = n => String(n).padStart(2, '0');

    fetch('https://github-contributions-api.jogruber.de/v4/parth-soni-10')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('ghc'))))
      .then(data => {
        const dayMap = {};
        (data.contributions || []).forEach(d => { dayMap[d.date] = d; });

        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 364);
        const gridStart = new Date(start);
        gridStart.setDate(gridStart.getDate() - gridStart.getDay()); // align to Sunday

        /* Build 53 Sunday-starting week columns */
        const weeks = [];
        const cursor = new Date(gridStart);
        for (let w = 0; w < WEEKS; w++) {
          const col = [];
          for (let r = 0; r < 7; r++) {
            col.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
          }
          weeks.push(col);
        }

        /* Month labels: one per column containing the 1st of a month in range.
           Day-based math (DST-safe): whole days first, then divide by 7. */
        const monthStarts = [];
        const m = new Date(start.getFullYear(), start.getMonth(), 1);
        while (m <= today) {
          const dayDelta = Math.round((m.getTime() - gridStart.getTime()) / 86400000);
          const colIdx = Math.floor(dayDelta / 7);
          if (colIdx >= 0 && colIdx < WEEKS) {
            monthStarts.push({ col: colIdx, label: m.toLocaleString('en-US', { month: 'short' }) });
          }
          m.setMonth(m.getMonth() + 1);
        }

        /* Cells + contribution total over the window */
        let total = 0;
        const cellsFrag = document.createDocumentFragment();
        weeks.forEach(col => {
          col.forEach(d => {
            const cell = document.createElement('span');
            cell.className = 'gh-cell';
            if (d >= start && d <= today) {
              const key = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
              const rec = dayMap[key];
              const count = rec ? (rec.count || 0) : 0;
              const level = rec ? (rec.level || 0) : 0;
              cell.classList.add('lvl-' + level);
              const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              cell.title = count > 0
                ? dateLabel + ' - ' + count + (count === 1 ? ' contribution' : ' contributions')
                : dateLabel + ' - No contributions';
              total += count;
            } else {
              cell.style.visibility = 'hidden'; // filler days outside the window
            }
            cellsFrag.appendChild(cell);
          });
        });

        /* Assemble: month label row + cell grid */
        ghGraph.textContent = '';
        const monthsRow = document.createElement('div');
        monthsRow.className = 'gh-months';
        monthStarts.forEach(ms => {
          const el = document.createElement('span');
          el.className = 'gh-month-label';
          el.dataset.col = String(ms.col);
          el.textContent = ms.label;
          monthsRow.appendChild(el);
        });
        const cellsGrid = document.createElement('div');
        cellsGrid.className = 'gh-cells';
        cellsGrid.appendChild(cellsFrag);
        ghGraph.appendChild(monthsRow);
        ghGraph.appendChild(cellsGrid);
        ghGraph.setAttribute('aria-label', total.toLocaleString() + ' contributions in the last year');
        if (ghTotal) ghTotal.textContent = total.toLocaleString();

        fitGraph();
      })
      .catch(() => {
        ghGraph.textContent = '';
        const fail = document.createElement('div');
        fail.className = 'gh-loading';
        fail.textContent = 'Contribution graph unavailable right now. Check your connection and reload.';
        ghGraph.appendChild(fail);
      });
  }

  renderContributionGraph();

  /* Throttle refits on resize (mobile URL-bar resizes fire storms) */
  let resizeRaf = null;
  window.addEventListener('resize', () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null;
      fitGraph();
    });
  });

  /* Init */
  positionIndicator(true);
  window.addEventListener('resize', () => positionIndicator(false));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => positionIndicator(false));
  }
  startTimer();
})();

/* ── ANALYTICS DASHBOARD DEMO ───────────────────────── */
/* Design spec: Inter 18/24 SemiBold metrics (-0.1px tracking), 12/16 Medium
   labels, 28px/13px/6px filter pills, 14px-radius / 16px-padding cards,
   #519DFA line chart, #0077E6 bar chart,   orange line/bar charts · #333333 / #777777 text. */
(function () {
  'use strict';

  const sec = document.getElementById('dashboard');
  if (!sec) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Locale-aware month labels (Intl, not a hardcoded array) */
  const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleString('en-US', { month: 'short' }));

  /* Parser for the sheet's `Month` column. Google writes full names
     (e.g. "August"); short names are accepted too as a safety net. */
  const MONTH_IDX = {};
  ['January','February','March','April','May','June','July',
   'August','September','October','November','December']
    .forEach((m, i) => { MONTH_IDX[m] = i; });
  MONTH_NAMES.forEach((m, i) => { MONTH_IDX[m] = i; });

  /* Live source: the public Content Tracking sheet, exported as CSV. Google
     serves `/export?format=csv` with Access-Control-Allow-Origin:*, so a plain
     fetch works from the browser — no backend and no Apps Script. */
  const SHEET_ID  = '1rWMX8Ew3rWxZr1Se18kE_Q1N6JoodQ0RciqwdX31BUE';
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID
                  + '/export?format=csv';

  /* Live data (populated from the sheet once fetched) */
  let PERIODS     = null;
  let GENRES      = [];
  let GENRE_YEARS = {};
  let START_YEAR  = 2024;
  let YEAR_ORDER  = []; /* years present in the data, newest first (drives the tabs) */
  let current     = 'all';
  let inited      = false;

  /* ── Element refs ── */
  const els = {
    lineSvg:    document.getElementById('lineSvg'),
    lineTip:    document.getElementById('lineTip'),
    barFigure:  document.getElementById('barFigure'),
    lineSub:    document.getElementById('lineSub'),
    barSub:     document.getElementById('barSub'),
    filters:    [], /* populated by buildFilters() once the years are known */
    metrics: {
      titles: document.getElementById('mTitles'),
      hours:  document.getElementById('mHours'),
      shows:  document.getElementById('mShows'),
      movies: document.getElementById('mMovies')
    },
    subs: [
      document.getElementById('sTitles'),
      document.getElementById('sHours'),
      document.getElementById('sShows'),
      document.getElementById('sMovies')
    ]
  };

  /* ── Sheet fetch + aggregation ── */
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += c;
      } else if (c === '"') {
        inQ = true;
      } else if (c === ',') {
        row.push(field); field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else {
        field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  /* Turns the sheet rows into the PERIODS/GENRES/GENRE_YEARS the renderers use. */
  function buildLive(rows) {
    const headerIdx = rows.findIndex(r => r && String(r[0]).trim().toLowerCase() === 'name');
    if (headerIdx < 0) throw new Error('Sheet layout not recognized');
    const hdr = rows[headerIdx].map(h => String(h || '').trim().toLowerCase());
    const col = (r, name) => {
      const j = hdr.indexOf(name.toLowerCase());
      return j >= 0 ? String(r[j] == null ? '' : r[j]).trim() : '';
    };

    const records = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !Array.isArray(r)) continue;
      const name = col(r, 'Name');
      if (!name) continue;
      /* Same row rule as the full Content Tracking Dashboard (its mapRows
         keeps only `name && year > 0`): a title without a year can't be
         bucketed into any period, and counting it in All Time only is what
         made this section disagree with the live dashboard — and with the
         sum of its own year tabs. */
      const yv = parseInt(col(r, 'Year'), 10);
      if (!(yv > 0)) continue;
      const st = parseFloat(col(r, 'Screentime'));
      const type = col(r, 'Type').toLowerCase();
      records.push({
        genre: col(r, 'Details/Genre') || col(r, 'Genre'),
        month: MONTH_IDX[col(r, 'Month')] >= 0 ? MONTH_IDX[col(r, 'Month')] : -1,
        year:  String(yv),
        min:   isFinite(st) && st > 0 ? st : 0,
        movie: type === 'movie',                                   /* exact match, as the live KPIs do */
        show:  type.includes('series') || type.includes('show')
      });
    }
    if (!records.length) throw new Error('No rows parsed');

    const years = [...new Set(records.filter(r => r.year).map(r => r.year))].sort();
    const minYear = Number(years[0]);
    const maxYear = years[years.length - 1];
    START_YEAR = minYear;
    YEAR_ORDER  = years.slice().reverse();

    const sumMin = list => list.reduce((s, r) => s + r.min, 0);
    const H = m => Math.round(m / 60);

    /* top genres (all-time hours) drive the bar chart order */
    const gHours = {};
    records.forEach(r => { if (r.genre) gHours[r.genre] = (gHours[r.genre] || 0) + r.min; });
    const GENRES6 = Object.keys(gHours)
      .sort((a, b) => gHours[b] - gHours[a])
      .slice(0, 6);

    /* hours by genre per period, aligned to the top-6 order */
    const genreYears = {};
    ['all'].concat(years).forEach(p => {
      const list = p === 'all' ? records : records.filter(r => r.year === p);
      genreYears[p] = GENRES6.map(g => H(list.reduce((s, r) => (r.genre === g ? s + r.min : s), 0)));
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

    return { periods, genres: GENRES6, genreYears, startYear: minYear };
  }

  /* Snapshot used only if the sheet can't be reached (keeps the demo intact).
     Mirrors the live dashboard's KPIs at the time of the last sync — if the
     network copy is unreachable, the numbers still agree with the full
     Content Tracking Dashboard instead of showing months-old figures. */
  function loadFallback() {
    PERIODS = {
      all: {
        name: 'All Time',
        months: [84,41,82,31,106,95,62,138,74,165,59,73, 138,121,74,110,140,115,85,248,112,64,78,48, 165,156,15,64,46,65,10,31,46,4],
        titles: 369, hours: 2943, shows: 278, movies: 91,
        sub: ['series + movies', 'since Jan 2024', '75.3% of titles', '24.7% of titles'],
        monthsLabel: 'Jan 2024-Oct 2026'
      },
      '2024': {
        name: '2024', months: [84,41,82,31,106,95,62,138,74,165,59,73],
        titles: 121, hours: 1011, shows: 97, movies: 24,
        sub: ['active in period', 'Jan-Dec 2024', '80% of titles', '20% of titles'],
        monthsLabel: 'Jan-Dec 2024'
      },
      '2025': {
        name: '2025', months: [138,121,74,110,140,115,85,248,112,64,78,48],
        titles: 158, hours: 1331, shows: 122, movies: 36,
        sub: ['active in period', 'Jan-Dec 2025', '77% of titles', '23% of titles'],
        monthsLabel: 'Jan-Dec 2025'
      },
      '2026': {
        name: '2026', months: [165,156,15,64,46,65,10,31,46,4],
        titles: 90, hours: 600, shows: 59, movies: 31,
        sub: ['active in period', 'Jan-Oct 2026', '66% of titles', '34% of titles'],
        monthsLabel: 'Jan-Oct 2026'
      }
    };
    GENRES = ['Drama','Thriller','Crime','Comedy','Action','Sci-Fi'];
    GENRE_YEARS = {
      '2024': [428, 88, 138, 123, 55, 90],
      '2025': [349, 234, 204, 251, 111, 49],
      '2026': [129, 169, 99, 47, 83, 3],
      /* rounded from all-time minutes directly (not the sum of the year
         values above), matching how buildLive derives the live series */
      all:   [905, 491, 441, 421, 250, 141]
    };
    START_YEAR = 2024;
    YEAR_ORDER  = ['2026','2025','2024'];
    const count = document.getElementById('dashTotalTitles');
    if (count) count.textContent = PERIODS.all.titles.toLocaleString('en-US') + '+';
    setSourceStatus('snapshot');
  }

  let dataPromise = null;
  function ensureData() {
    if (PERIODS) return Promise.resolve();
    if (dataPromise) return dataPromise;
    /* Cache-busting timestamp + no-store: every page load reads the sheet
       fresh, so the KPIs can never lag behind the live dashboard. */
    dataPromise = fetch(SHEET_URL + '&_ts=' + Date.now(), { cache: 'no-store' })
      .then(res => { if (!res.ok) throw new Error('Sheet HTTP ' + res.status); return res.text(); })
      .then(parseCSV)
      .then(rows => {
        const built = buildLive(rows);
        PERIODS     = built.periods;
        GENRES      = built.genres;
        GENRE_YEARS = built.genreYears;
        START_YEAR  = built.startYear;
        const count = document.getElementById('dashTotalTitles');
        if (count) count.textContent = PERIODS.all.titles.toLocaleString('en-US') + '+';
        setSourceStatus('live');
      })
      .catch(err => {
        console.warn('Dashboard: live sheet unavailable, showing snapshot', err);
        loadFallback();
      });
    return dataPromise;
  }

  /* Source-indicator feedback: 'pending' (loading) → 'live' (sheet reached)
     or 'snapshot' (fetch failed, we're showing the embedded fallback). */
  function setSourceStatus(state) {
    const el = document.getElementById('dashSource');
    if (!el) return;
    const label = state === 'live'
      ? 'live · Google Sheets'
      : state === 'snapshot'
        ? 'snapshot · sheet unreachable'
        : 'syncing · Google Sheets';
    el.innerHTML = '<span class="dash-source-dot" data-state="' + state +
      '" aria-hidden="true"></span><span id="dashSourceText">' + label + '</span>';
  }

  /* Build the filter tabs from the data's years ('all' first, then each year
     newest-first), so there are never dead buttons for a year with no rows. */
  function buildFilters(active) {
    const host = document.getElementById('dashFilters');
    if (!host) return;
    host.textContent = '';
    const list = [];
    ['all'].concat(YEAR_ORDER).forEach(p => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dash-filter';
      b.dataset.period = p;
      b.setAttribute('aria-pressed', String(p === active));
      if (p === active) b.classList.add('active');
      b.textContent = p === 'all' ? 'All Time' : p;
      b.addEventListener('click', () => setFilter(b.dataset.period));
      list.push(b);
    });
    els.filters = list;
    list.forEach(b => host.appendChild(b));
  }

  /* ── KPI count-up animation ── */
  const values = { titles: 0, hours: 0, shows: 0, movies: 0 };
  const FMTS = {
    titles: { key: 'titles', render: v => Math.round(v).toLocaleString('en-US') },
    hours:  { key: 'hours',  render: v => Math.round(v).toLocaleString('en-US') },
    shows:  { key: 'shows',  render: v => Math.round(v).toLocaleString('en-US') },
    movies: { key: 'movies', render: v => Math.round(v).toLocaleString('en-US') }
  };

  /* Cancel any in-flight count-up before starting a new one (rapid filter clicks) */
  const animIds = {};
  function setMetric(el, fmt, target, animate) {
    if (!el) return;
    const from = values[fmt.key];
    values[fmt.key] = target;
    if (animIds[fmt.key]) { cancelAnimationFrame(animIds[fmt.key]); animIds[fmt.key] = 0; }
    if (!animate || reduceMotion || from === target) { el.textContent = fmt.render(target); return; }
    const dur = 550;
    const t0  = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    function frame(now) {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = fmt.render(from + (target - from) * ease(p));
      animIds[fmt.key] = p < 1 ? requestAnimationFrame(frame) : 0;
    }
    animIds[fmt.key] = requestAnimationFrame(frame);
  }

  function updateMetrics(period, animate) {
    const d = PERIODS[period];
    setMetric(els.metrics.titles, FMTS.titles, d.titles, animate);
    setMetric(els.metrics.hours,  FMTS.hours,  d.hours,  animate);
    setMetric(els.metrics.shows,  FMTS.shows,  d.shows,  animate);
    setMetric(els.metrics.movies, FMTS.movies, d.movies, animate);
    els.subs.forEach((el, i) => { if (el) el.textContent = d.sub[i]; });
  }

  /* ── Line chart (orange accent) ── */
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  /* Round axis step: the smallest of 1 / 2 / 2.5 / 5 × 10ⁿ ≥ target, so
     gridlines land on 0h/50h/100h… instead of 0h/83h/167h… */
  function niceStep(target) {
    if (!isFinite(target) || target <= 0) return 1;
    const pow  = Math.pow(10, Math.floor(Math.log10(target)));
    const f    = target / pow;
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * pow;
  }

  /* Monotone cubic interpolation (Fritsch–Carlson): a smooth curve through
     every point that never overshoots the data — a plain Catmull-Rom spline
     would draw peaks above the real hours and dips below zero. */
  function monoPath(pts) {
    const n = pts.length;
    if (n < 2) return n ? 'M' + pts[0].x + ',' + pts[0].y : '';
    const dx = [], dy = [], m = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1].x - pts[i].x;
      dy[i] = pts[i + 1].y - pts[i].y;
      m[i]  = dy[i] / dx[i];
    }
    const t = [m[0]];
    for (let i = 1; i < n - 1; i++) {
      if (m[i - 1] * m[i] <= 0) {
        t[i] = 0;
      } else {
        const w1 = 2 * dx[i] + dx[i - 1];
        const w2 = dx[i] + 2 * dx[i - 1];
        t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]);
      }
    }
    t[n - 1] = m[n - 2];
    let d = 'M' + pts[0].x + ',' + pts[0].y;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += 'C' + (pts[i].x + h) + ',' + (pts[i].y + t[i] * h) +
           ' ' + (pts[i + 1].x - h) + ',' + (pts[i + 1].y - t[i + 1] * h) +
           ' ' + pts[i + 1].x + ',' + pts[i + 1].y;
    }
    return d;
  }

  let lastLineW = 0; /* width the line chart last rendered at (resize sync) */

  function renderLine(period, animate) {
    const svg = els.lineSvg;
    if (!svg) return;
    svg.textContent = '';

    const months = PERIODS[period].months;
    /* Render in real pixels: the viewBox tracks the figure's width (540px
       floor = the mobile scroll canvas), so 1 unit = 1px — axis text never
       scales and the trend gets the card's full width instead of a squeezed
       600-unit box that shrank every label into its neighbour. */
    const figBox = svg.parentElement;
    const W = Math.max(540, (figBox && figBox.clientWidth) || 0) || 600;
    const H = W >= 700 ? 300 : 250;
    const PL = 40, PR = 16, PT = 14, PB = 30;
    const iw = W - PL - PR;
    const ih = H - PT - PB;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    lastLineW = W;
    const max = Math.max.apply(null, months);
    const step = niceStep(max / 3.5);
    const niceMax = Math.max(step, Math.ceil((max || 1) / step) * step);
    const x = i => PL + (months.length === 1 ? iw / 2 : (iw * i) / (months.length - 1));
    const y = v => PT + ih - (ih * v) / niceMax;
    const baseYear = period === 'all' ? START_YEAR : Number(period);
    const yearOf = i => baseYear + Math.floor(i / 12);

    /* gradient fill under the line */
    const grad = svgEl('linearGradient', { id: 'dashLineGrad', x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(svgEl('stop', { offset: '0%',   'stop-color': '#e85d04', 'stop-opacity': '0.28' }));
    grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#e85d04', 'stop-opacity': '0' }));
    svg.appendChild(grad);

    /* gridlines + y-axis labels at the round step */
    for (let k = 0; k * step <= niceMax + 1e-9; k++) {
      const v  = k * step;
      const yy = y(v);
      svg.appendChild(svgEl('line', { x1: PL, x2: W - PR, y1: yy, y2: yy, class: 'dash-grid-line' }));
      const t = svgEl('text', { x: PL - 7, y: yy + 3.5, 'text-anchor': 'end', class: 'dash-y-label' });
      t.textContent = (Math.round(v * 10) / 10) + 'h';
      svg.appendChild(t);
    }

    /* x-axis labels. Cadence adapts to real pixel width: pick the densest
       schedule (monthly → every-2 → quarterly → bi-monthly → yearly) whose
       spacing still clears the widest label (~49px at 11px + 14px air), then
       keep first + last and drop any label whose estimated boxes would touch.
       The old fixed 46px center-to-center gap matched the labels' own width,
       so "Jul 2026" and "Oct 2026" landed 1px apart at the right edge. */
    const CADENCE   = [1, 2, 3, 6, 12];
    const spacing   = months.length > 1 ? iw / (months.length - 1) : iw;
    const every     = CADENCE.find(c => spacing * c >= 64) || 12;
    const labText   = i => MONTH_NAMES[i % 12] + ' ' + yearOf(i);
    const labW      = i => labText(i).length * 6.1;
    const cand = [];
    months.forEach((_, i) => { if (i % every === 0) cand.push(i); });
    if (cand[cand.length - 1] !== months.length - 1) cand.push(months.length - 1);
    const keep = [];
    cand.forEach(i => {
      if (keep.length === 0) { keep.push(i); return; }
      const prev = keep[keep.length - 1];
      const gap  = x(i) - x(prev);
      const need = (labW(i) + labW(prev)) / 2 + 14;
      if (i === months.length - 1) {
        /* prefer the final month over its crowded neighbour: shed the
           predecessor if needed, but always keep the end of the data */
        if (gap < need) keep.pop();
        keep.push(i);
      } else if (gap >= need) {
        keep.push(i);
      }
    });
    keep.forEach(i => {
      const t = svgEl('text', { x: x(i), y: H - 9, 'text-anchor': 'middle', class: 'dash-x-label' });
      t.textContent = labText(i);
      svg.appendChild(t);
    });

    /* line + area paths — one monotone curve shared by both */
    const curve = months.map((v, i) => ({ x: x(i), y: y(v) }));
    const d = monoPath(curve);
    const area = svgEl('path', {
      d: d + ' L' + x(months.length - 1) + ',' + y(0) + ' L' + PL + ',' + y(0) + ' Z',
      class: 'dash-area-path'
    });
    const line = svgEl('path', { d: d, class: 'dash-line-path' });
    svg.appendChild(area);
    svg.appendChild(line);

    /* haloed data points so individual months stay readable where the line
       is dense (smaller dots when all-time's 34 points share the width) */
    const dotR = months.length > 18 ? 2 : 3;
    const dots = svgEl('g', { class: 'dash-dots' });
    curve.forEach(p => dots.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: dotR, class: 'dash-dot' })));
    svg.appendChild(dots);

    /* draw-on animation */
    const total = line.getTotalLength();
    line.style.strokeDasharray  = String(total);
    line.style.strokeDashoffset = String(total);
    area.style.opacity = '0';
    dots.style.opacity = '0';
    if (animate && !reduceMotion) {
      const t0 = performance.now();
      const dur = 800;
      const ease = t => 1 - Math.pow(1 - t, 3);
      function frame(now) {
        const p = Math.min(1, (now - t0) / dur);
        line.style.strokeDashoffset = String(total * (1 - ease(p)));
        area.style.opacity = String(0.06 + 0.94 * ease(p));
        dots.style.opacity = String(0.06 + 0.94 * ease(p));
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    } else {
      line.style.strokeDashoffset = '0';
      area.style.opacity = '1';
      dots.style.opacity = '1';
    }

    /* hover: crosshair + tooltip */
    const overlay = svgEl('rect', { x: PL, y: PT, width: iw, height: ih, fill: 'transparent' });
    const hLine   = svgEl('line', { class: 'dash-hover-line' });
    const hDot    = svgEl('circle', { r: '4.5', class: 'dash-hover-dot' });
    svg.appendChild(overlay);
    svg.appendChild(hLine);
    svg.appendChild(hDot);

    function showTip(idx) {
      const i = Math.max(0, Math.min(months.length - 1, Math.round(idx)));
      const vx = x(i), vy = y(months[i]);
      hLine.setAttribute('x1', vx); hLine.setAttribute('x2', vx);
      hLine.setAttribute('y1', PT); hLine.setAttribute('y2', PT + ih);
      hLine.setAttribute('opacity', '1');
      hDot.setAttribute('cx', vx); hDot.setAttribute('cy', vy);
      hDot.setAttribute('opacity', '1');
      els.lineTip.textContent = MONTH_NAMES[i % 12] + ' ' + yearOf(i) + ' · ' + months[i] + ' hrs';
      els.lineTip.hidden = false;
      /* Keep the tooltip on the hovered point and fully inside the visible
         figure. The chart scrolls horizontally on small screens (the svg
         keeps a 540px min-width), and an absolutely positioned child of a
         scroll container rides along with the content — so the element's
         `left` must be (visible offset + scrollLeft), with the edge clamp
         computed in visible-space coordinates. The percentage-based math
         it replaces only worked when the svg filled the figure's width. */
      const figEl   = els.lineTip.parentElement;
      const figW    = figEl.clientWidth;
      const figH    = figEl.clientHeight;
      const svgW    = svg.getBoundingClientRect().width || W;
      const tipW    = els.lineTip.offsetWidth;
      const tipH    = els.lineTip.offsetHeight;
      const scrollL = figEl.scrollLeft || 0;
      let visCx     = (vx / W) * svgW - scrollL;
      visCx = Math.min(figW - tipW / 2 - 8, Math.max(tipW / 2 + 8, visCx));
      els.lineTip.style.left = (visCx + scrollL) + 'px';
      els.lineTip.style.top  = ((vy / H) * 100) + '%';
      els.lineTip.style.transform = (vy / H) * figH < tipH + 12
        ? 'translate(-50%, 12px)'
        : 'translate(-50%, calc(-100% - 10px))';
    }

    overlay.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const vx = (e.clientX - r.left) * (W / r.width);
      showTip(((vx - PL) / iw) * (months.length - 1));
    });
    overlay.addEventListener('pointerleave', () => {
      hLine.setAttribute('opacity', '0');
      hDot.setAttribute('opacity', '0');
      els.lineTip.hidden = true;
    });

    svg.setAttribute('aria-label',
      'Line chart: hours watched per month, ' + months.length + ' points, ' + PERIODS[period].monthsLabel);
  }

  /* ── Bar chart (orange accent) ── */
  function renderBars(period, animate) {
    const fig = els.barFigure;
    if (!fig) return;
    fig.textContent = '';

    const hours = GENRE_YEARS[period] || GENRE_YEARS.all;
    const entries = GENRES.map((g, i) => ({ name: g, v: hours[i] })).sort((a, b) => b.v - a.v);
    const maxV = entries[0].v;

    entries.forEach(entry => {
      const col = document.createElement('div');
      col.className = 'dash-bar-col';
      col.title = entry.name + ': ' + entry.v + ' hrs';

      const area = document.createElement('div');
      area.className = 'dash-bar-area';

      const bar = document.createElement('div');
      bar.className = 'dash-bar';
      bar.dataset.v = String(entry.v);

      const val = document.createElement('span');
      val.className = 'dash-bar-val';
      val.textContent = String(entry.v);

      const genre = document.createElement('p');
      genre.className = 'dash-bar-genre';
      genre.textContent = entry.name;

      area.appendChild(val); // sibling of the bar so scaleY never squashes the label
      area.appendChild(bar);
      col.appendChild(area);
      col.appendChild(genre);
      fig.appendChild(col);
    });

    const grow = () => {
      fig.querySelectorAll('.dash-bar').forEach(b => {
        const s = Number(b.dataset.v) / maxV;
        b.style.transform = 'scaleY(' + s + ')';
        const val = b.parentElement.querySelector('.dash-bar-val');
        if (val) val.style.bottom = 'calc(' + (s * 100).toFixed(2) + '% + 6px)';
      });
    };
    if (animate && !reduceMotion) requestAnimationFrame(() => requestAnimationFrame(grow));
    else grow();

    fig.setAttribute('aria-label', 'Bar chart: hours watched by genre, ' + PERIODS[period].name);
  }

  /* ── Filters ── */
  function setFilter(period) {
    /* Ignore clicks until the sheet has loaded (and period buttons that
       aren't present in the data, e.g. a future year with no titles yet). */
    if (!PERIODS || !PERIODS[period] || period === current) return;
    current = period;
    els.filters.forEach(f => {
      const on = f.dataset.period === period;
      f.classList.toggle('active', on);
      f.setAttribute('aria-pressed', String(on));
    });
    history.replaceState(null, '', '?period=' + period + location.hash);
    updateMetrics(period, true);
    renderLine(period, true);
    renderBars(period, true);
    if (els.lineSub) els.lineSub.textContent = 'per month · ' + PERIODS[period].monthsLabel;
    if (els.barSub)  els.barSub.textContent  = 'top ' + GENRES.length + ' · ' + PERIODS[period].name;
  }

  /* ── Init (render once data is ready, on first scroll into view) ── */
  async function init(animate) {
    if (inited) return;
    inited = true;
    await ensureData();
    if (!PERIODS) return;

    const urlPeriod = new URLSearchParams(location.search).get('period');
    if (urlPeriod && PERIODS[urlPeriod]) current = urlPeriod;
    buildFilters(current);

    updateMetrics(current, animate);
    renderLine(current, animate);
    renderBars(current, animate);
    if (els.lineSub) els.lineSub.textContent = 'per month · ' + PERIODS[current].monthsLabel;
    if (els.barSub)  els.barSub.textContent  = 'top ' + GENRES.length + ' · ' + PERIODS[current].name;
  }

  ensureData(); /* start the sheet fetch immediately, not on first scroll */

  /* The line chart renders in real pixels, so re-render it when the
     container's width actually changes (window resize, phone rotate). */
  let rzTimer = 0;
  window.addEventListener('resize', () => {
    if (!inited || !PERIODS) return;
    clearTimeout(rzTimer);
    rzTimer = setTimeout(() => {
      const fig = els.lineSvg && els.lineSvg.parentElement;
      const w = fig ? Math.max(540, fig.clientWidth) : 0;
      if (Math.abs(w - lastLineW) < 8) return;
      renderLine(current, false);
    }, 160);
  });

  if (reduceMotion) {
    init(false);
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      if (entries[0].isIntersecting) { init(true); obs.disconnect(); }
    }, { threshold: 0.18 });
    io.observe(sec);
  } else {
    init(true);
  }
})();

/* ── WRITING ON MEDIUM: 2 LATEST POSTS ────────────────── */
/* The cell in the Education section shows the two newest articles, refreshed
   on every page load. Medium answers browser requests to its own feeds with
   a Cloudflare challenge (HTTP 403), so the feed is read through rss2json's
   CORS API instead — its edge cache can lag the feed by up to 30 minutes.
   Any failure (offline, rate limit, response shape change) leaves the two
   articles hard-coded in index.html untouched, so the cell is never empty. */
(function () {
  'use strict';

  const list = document.querySelector('.medium-recent');
  if (!list) return;

  const FEED = 'https://api.rss2json.com/v1/api.json?rss_url=' +
               encodeURIComponent('https://medium.com/feed/@soni.soni.parth');
  const MON  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  fetch(FEED, { cache: 'no-store' })
    .then(res => { if (!res.ok) throw new Error('feed HTTP ' + res.status); return res.json(); })
    .then(data => {
      if (!data || data.status !== 'ok' || !Array.isArray(data.items)) throw new Error('bad feed payload');
      const latest = data.items
        .filter(it => it && typeof it.title === 'string' && it.title.trim() && typeof it.link === 'string')
        .map(it => ({ title: it.title.trim(), url: it.link.split('?')[0], pub: String(it.pubDate || '') }))
        .filter(it => { /* only plain https Medium links survive */
          try {
            const u = new URL(it.url);
            return u.protocol === 'https:' && /(^|\.)medium\.com$/.test(u.hostname);
          } catch (e) { return false; }
        })
        .sort((a, b) => (a.pub < b.pub ? 1 : a.pub > b.pub ? -1 : 0))
        .slice(0, 2);
      if (!latest.length) return; /* keep the hard-coded pair */

      list.textContent = '';
      latest.forEach(it => {
        const li   = document.createElement('li');
        const a    = document.createElement('a');
        const span = document.createElement('span');
        const m    = /^(\d{4})-(\d{2})/.exec(it.pub); /* pubDate is 'YYYY-MM-DD HH:MM:SS' */
        a.href = it.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = it.title;
        span.textContent = m ? MON[Number(m[2]) - 1] + ' ' + m[1] : '';
        li.appendChild(a);
        li.appendChild(span);
        list.appendChild(li);
      });
    })
    .catch(() => { /* silent fallback: the hard-coded articles stay */ });
})();

/* ── PROJECTS SPOTLIGHT INDEX ─────────────────────── */
/* Master-detail picker: a numbered index rail on the left, a large
   detail panel that swaps on the right. Click to select, arrow keys
   to roam (Home/End included). Panels stack in one grid cell so the
   container takes the tallest card with no JS height measuring. */
(function () {
  'use strict';

  const wrap = document.getElementById('spotWrap');
  if (!wrap) return;

  const tablist = document.getElementById('spotIndex');
  const tabs    = Array.from(wrap.querySelectorAll('.spot-item'));
  const panels  = Array.from(wrap.querySelectorAll('.spot-card'));
  if (!tablist || !tabs.length || !panels.length) return;

  let active = tabs.findIndex(t => t.classList.contains('active'));
  if (active < 0) active = 0;

  function setSpot(i) {
    if (i < 0 || i >= tabs.length) return;
    active = i;
    tabs.forEach((t, j) => {
      t.classList.toggle('active', j === i);
      t.setAttribute('aria-selected', String(j === i));
      t.tabIndex = j === i ? 0 : -1;
    });
    panels.forEach((p, j) => p.classList.toggle('active', j === i));
  }

  tabs.forEach((t, i) => {
    t.tabIndex = i === active ? 0 : -1;
    t.addEventListener('click', () => { markInteracted(); setSpot(i); });
  });

  tablist.addEventListener('keydown', (e) => {
    markInteracted();
    const n = tabs.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      setSpot((active + 1) % n);
      tabs[active].focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setSpot((active - 1 + n) % n);
      tabs[active].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSpot(0);
      tabs[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      setSpot(n - 1);
      tabs[n - 1].focus();
    }
  });

  /* ── Auto-rotation: a gentle showcase that never fights the user ──
     Starts when the section scrolls into view, cycles every 7s, pauses
     while the pointer is over the section, and stops permanently on the
     first click or key press. Never runs under prefers-reduced-motion. */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const projectsSec  = document.getElementById('projects');
  const autoNote     = wrap.querySelector('.spot-autoplay-note');
  let interacted = false;
  let rotTimer   = null;

  function stopRotation() {
    if (rotTimer) { window.clearInterval(rotTimer); rotTimer = null; }
    wrap.classList.remove('rotating');
    if (autoNote) autoNote.hidden = true;
  }

  function startRotation() {
    if (reduceMotion || interacted || rotTimer || !projectsSec) return;
    rotTimer = window.setInterval(() => setSpot((active + 1) % tabs.length), 7000);
    wrap.classList.add('rotating');
    if (autoNote) autoNote.hidden = false;
  }

  function markInteracted() {
    interacted = true;
    stopRotation();
  }

  if (projectsSec && 'IntersectionObserver' in window) {
    const rotIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) startRotation();
        else stopRotation();
      });
    }, { threshold: 0.35 });
    rotIO.observe(projectsSec);
  } else {
    startRotation();
  }

  wrap.addEventListener('pointerenter', stopRotation, { passive: true });
  wrap.addEventListener('pointerleave', () => { if (!interacted) startRotation(); }, { passive: true });
})();

/* ── MICRO-INTERACTIONS (tilt + glare) ──────────────── */
/* Cursor-tracked tilt on certificate cards and a soft glare sweep on the
   dashboard cards — the threeui.com / 21st.dev touch. rAF-throttled,
   pointer-devices only, skipped entirely under prefers-reduced-motion.
   Only CSS custom properties are written here; every visual state lives
   in style.css, so this stays CSP-clean (no inline styles). */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduceMotion || !finePointer) return;

  function trackVars(el, onMove, resetOnLeave) {
    let raf = null;
    el.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const r  = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        onMove(el, px, py);
      });
    });
    if (resetOnLeave) {
      el.addEventListener('pointerleave', () => {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        el.style.setProperty('--tilt-x', '0deg');
        el.style.setProperty('--tilt-y', '0deg');
      });
    }
  }

  /* Certificates: 3D tilt (max 5deg) + glare position */
  document.querySelectorAll('.cert-card').forEach((card) => {
    trackVars(card, (el, px, py) => {
      el.style.setProperty('--tilt-x', ((0.5 - py) * 5).toFixed(2) + 'deg');
      el.style.setProperty('--tilt-y', ((px - 0.5) * 5).toFixed(2) + 'deg');
      el.style.setProperty('--glare-x', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--glare-y', (py * 100).toFixed(1) + '%');
    }, true);
  });

  /* Dashboard cards: sheen only — the charts stay flat and readable */
  document.querySelectorAll('.dash-card').forEach((card) => {
    trackVars(card, (el, px, py) => {
      el.style.setProperty('--glare-x', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--glare-y', (py * 100).toFixed(1) + '%');
    }, false);
  });
})();
