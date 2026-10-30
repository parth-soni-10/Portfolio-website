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
    // motion-init.js has already answered this for the page - a stored choice
    // or the OS setting, on <html> before first paint.
    const reduce = document.documentElement.dataset.motion === 'reduce';
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

    // Only the curtain's own animation ends the sequence - the child
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
    '.about-body, .medium-callout, ' +
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
  /* The inline transition-delay staggers the reveal - but it would also lag
     every later transition (the hover lift) behind the pointer, so drop it
     as soon as the reveal's own transform transition ends. One delegated
     listener covers all cards; transitionend bubbles up to the document. */
  document.querySelectorAll('.dash-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 70}ms`;
  });
  document.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'transform' && e.target.classList?.contains('dash-card')) {
      e.target.style.transitionDelay = '';
    }
  });

  /* ── ACTIVE NAV (IntersectionObserver, not a scroll listener) ── */
  const navLinks = document.querySelectorAll('nav a');
  const navByHref = new Map(Array.from(navLinks).map(l => [l.getAttribute('href'), l]));

  /* The class is the same active state the colour below has always expressed -
     gooey-nav.js reads it to know which link the pill belongs under, so the
     highlight can slide between sections instead of jumping. */
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      /* Nested divs are observed too, so a child without a nav link would
         clear the highlight and never restore it - the last entry to report
         decided the colour, and most of them had no link to give it to. Only
         a target that names a nav link may move it. */
      const href = '#' + entry.target.id;
      if (!navByHref.has(href)) return;
      navLinks.forEach(l => { l.style.color = ''; l.classList.remove('active'); });
      const link = navByHref.get(href);
      link.style.color = '#e85d04';
      link.classList.add('active');
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  document.querySelectorAll('section[id], div[id], footer[id]').forEach(sec => navObserver.observe(sec));

  /* ── HEADER SHADOW + EDGE BLUR ON SCROLL ─────────── */
  const header   = document.getElementById('site-header');
  const edgeBlur = document.querySelector('.edge-blur');

  /* Both states are edge-triggered: the shadow and the fade only belong on one
     side of their threshold, so nothing is written on a scroll event that does
     not cross it. The old version reassigned two inline styles on every event -
     at trackpad rates that re-parsed a 1005px box-shadow a few hundred times a
     second on the element that carries the blur stack, and repainted the stack
     with it. The shadow is now a class (style.css), and the opacity write is
     guarded by the last value. */
  let shadowOn = null;
  let edgeOn   = null;
  let queued   = false;

  /* Runs for scroll, resize and focus changes - the three things that can
     change whether the edge blur belongs on screen. Every read happens before
     the first write, so the scrollHeight lookup never forces a style or layout
     pass over a document we just dirtied. */
  function syncScrollState() {
    const y = window.scrollY;

    let wantShadow = false;
    let wantEdge   = false;

    if (header) wantShadow = y > 60;

    if (edgeBlur) {
      // Only while there is report left below the fold - the blur is a
      // "more to come" cue, not a permanent frame over the footer. It also
      // steps aside for a focused field, so typing at a form's bottom edge is
      // never hazy.
      const active = document.activeElement;
      const typing = active && active.matches && active.matches('input, textarea, select');
      const remaining = document.documentElement.scrollHeight - (y + window.innerHeight);
      wantEdge = !typing && y > 40 && remaining > 48;
    }

    if (header && wantShadow !== shadowOn) {
      shadowOn = wantShadow;
      header.classList.toggle('is-scrolled', wantShadow);
    }
    if (edgeBlur && wantEdge !== edgeOn) {
      edgeOn = wantEdge;
      edgeBlur.style.opacity = wantEdge ? '1' : '0';
    }
  }

  /* One pass per frame, however many scroll events arrive in it. */
  function queueScrollState() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(() => {
      queued = false;
      syncScrollState();
    });
  }

  window.addEventListener('scroll', queueScrollState, { passive: true });
  window.addEventListener('resize', queueScrollState, { passive: true });
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

  // Read live, not once: the footer's switch can be flipped while this page is
  // open, and the next tab change should already honour it.
  const reduceMotion = () => document.documentElement.dataset.motion === 'reduce';
  const FLY_PX       = 200;   // matches Svelte fly x:200
  const DURATION_MS  = 300;   // matches Svelte fly duration:300
  const ROTATE_MS    = 4200;  // auto-rotate interval

  let activeIndex = 0;
  let switching   = false;
  let timer       = null;
  let visible     = false; // corrected by IntersectionObserver's first callback

  /* Slide the indicator pill to the active tab (300ms tween).
     Transform-only: translateX positions it, scaleX sizes it
     (compositor-friendly - never animates left/width). */
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

    if (reduceMotion()) {
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
    if (reduceMotion()) return;
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

  /* Live GitHub contribution heatmap, read from this site's own /api/contributions:
     a Pages Function that asks github-contributions-api server-side and caches the
     answer for 12 hours, so the third-party host is not in every visitor's path and
     not in connect-src. See functions/api/contributions.js for what that does and
     does not fix.

     The drawing is the design system's ActivityHeatmap, not markup written here:
     the grid, the shading and the ranked footer are one implementation shared
     with the other sites, and a second hand-rolled "year of squares" is how the
     two drift. The kit measures whatever card it is given and follows it on
     resize, so this file no longer fits 53 columns by hand either. What stays is
     what is the portfolio's: the read and the failure line. */
  const ghGraph = document.getElementById('ghGraph');

  function renderContributionGraph() {
    if (!ghGraph) return;

    fetch('/api/contributions')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('ghc'))))
      .then(data => {
        /* The endpoint answers the calendar as {date, count, level}; the kit
           takes dates with weights and shades them by its own quartiles, so the
           upstream level is dropped rather than mixed with a second scale. */
        const days = (data.contributions || []).map(d => ({ date: d.date, value: d.count || 0 }));
        ActivityHeatmap.render(ghGraph, days, { label: 'contributions' });
      })
      .catch(() => {
        ghGraph.textContent = '';
        ghGraph.classList.remove('ga');
        const fail = document.createElement('div');
        fail.className = 'gh-loading';
        fail.textContent = 'Contribution graph unavailable right now. Check your connection and reload.';
        ghGraph.appendChild(fail);
      });
  }

  renderContributionGraph();

  /* Init */
  positionIndicator(true);
  window.addEventListener('resize', () => positionIndicator(false));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => positionIndicator(false));
  }
  startTimer();
})();

/* ── ANALYTICS DASHBOARD DEMO ───────────────────────── */
/* Live slice of the Content Tracking Dashboard: the dashboard's own store in,
   KPIs, filter pills and two charts out. Orange accent, Inter data type,
   #333/#6f6f6f text. The row→figure shaping lives in dash-aggregate.js, because
   the embedded snapshot is generated with that same function (see the
   SNAPSHOT:START block below). */
(function () {
  'use strict';

  const sec = document.getElementById('dashboard');
  if (!sec) return;

  // Live, so the footer's switch takes effect on the next filter click rather
  // than on the next reload.
  const reduceMotion = () => document.documentElement.dataset.motion === 'reduce';

  const AGG = window.DashAggregate;
  const MONTH_NAMES = AGG.MONTH_NAMES;

  /* Live source: the Content Tracking Dashboard's own read endpoint - the rows
     its SPA renders, straight off its D1 store (lib/db.js). Deliberately NOT the
     Google Sheet this used to read: the dashboard was migrated off the Sheet and
     no longer touches it, so a copy read from there can drift away from the
     numbers the dashboard shows. Reading the store is what makes the two agree
     by construction. The endpoint carries the one CORS allowance this page needs
     - see netlify/functions/watchlist.js in that project. */
  const STORE_URL = 'https://contenttrackerdashboard.pages.dev/.netlify/functions/watchlist';

  /* Live data (populated from the store once fetched) */
  let PERIODS     = null;
  let GENRES      = [];
  let GENRE_YEARS = {};
  let START_YEAR  = 2024;
  let START_C     = 0; /* continuous month index (from minYear) of the first
                          month with data - the all-time axis labels count
                          from here, not from January */
  let YEAR_ORDER  = []; /* years present in the data, newest first (drives the tabs) */
  let current     = 'all';
  let resetView  = null;
  let inited      = false;

  /* ── Element refs ── */
  const els = {
    lineChart:  document.getElementById('lineChart'),
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

  /* ── Store fetch ── */
  /* ── Snapshot ───────────────────────────────────────── */
  /* The section is reading its embedded snapshot, not the store - say so where
     the numbers are. A snapshot that reads as live is exactly the disagreement
     this section was changed to remove, so it is never shown silently. */
  function noteSnapshot(on) {
    const el = document.getElementById('dashSnapshotNote');
    if (!el) return;
    el.hidden = !on;
    el.textContent = on && FALLBACK
      ? 'Snapshot - the dashboard store could not be reached from this page, so these are the figures captured on ' + FALLBACK.taken + '.'
      : '';
  }

  /* Apply one built data set - live rows or the snapshot - to module state. */
  function applyBuilt(built, isSnapshot) {
    if (!built) return;
    PERIODS     = built.periods;
    GENRES      = built.genres;
    GENRE_YEARS = built.genreYears;
    START_YEAR  = built.startYear;
    START_C     = built.startC;
    YEAR_ORDER  = built.yearOrder;
    const count = document.getElementById('dashTotalTitles');
    if (count) count.textContent = PERIODS.all.titles.toLocaleString('en-US') + '+';
    noteSnapshot(isSnapshot);
  }

  /* ── EMBEDDED SNAPSHOT ────────────────────────────────
     Generated by tools/snapshot-dashboard-fallback.mjs from the store's own rows,
     through the same buildLive() the live path runs - so the fallback agrees with
     the dashboard by construction rather than by someone remembering to retype
     it. Do not hand-edit: re-run the tool after the store changes; it rewrites
     the SNAPSHOT:START/END block below. */
  /* SNAPSHOT:START */
  const FALLBACK = {
    "taken": "2026-10-16",
    "periods": {
      "2024": {
        "name": "2024",
        "months": [143,45,82,31,106,95,63,139,74,165,59,73],
        "titles": 130,
        "hours": 1073,
        "shows": 106,
        "movies": 24,
        "sub": ["active in period","Jan-Dec 2024","82% of titles","18% of titles"],
        "monthsLabel": "Jan-Dec 2024"
      },
      "2025": {
        "name": "2025",
        "months": [138,121,74,110,140,115,85,248,112,64,78,48],
        "titles": 158,
        "hours": 1331,
        "shows": 122,
        "movies": 36,
        "sub": ["active in period","Jan-Dec 2025","77% of titles","23% of titles"],
        "monthsLabel": "Jan-Dec 2025"
      },
      "2026": {
        "name": "2026",
        "months": [165,156,15,64,46,65,10,39,46,38],
        "titles": 98,
        "hours": 643,
        "shows": 63,
        "movies": 35,
        "sub": ["active in period","Jan-Oct 2026","64% of titles","36% of titles"],
        "monthsLabel": "Jan-Oct 2026"
      },
      "all": {
        "name": "All Time",
        "months": [
          143,
          45,
          82,
          31,
          106,
          95,
          63,
          139,
          74,
          165,
          59,
          73,
          138,
          121,
          74,
          110,
          140,
          115,
          85,
          248,
          112,
          64,
          78,
          48,
          165,
          156,
          15,
          64,
          46,
          65,
          10,
          39,
          46,
          38
        ],
        "titles": 386,
        "hours": 3048,
        "shows": 291,
        "movies": 95,
        "sub": ["series + movies","since Jan 2024","75.4% of titles","24.6% of titles"],
        "monthsLabel": "Jan 2024-Oct 2026"
      }
    },
    "genres": [
      "Drama",
      "Thriller",
      "Comedy",
      "Crime",
      "Action",
      "Sci-Fi",
      "Romance",
      "Documentary",
      "Superhero",
      "Sitcom",
      "Mystery",
      "Animation",
      "Sci-Fi & Fantasy",
      "Action/Horror",
      "Tragic",
      "Science Fiction",
      "Horror"
    ],
    "genreYears": {
      "2024": [428,88,179,144,55,90,47,35,0,0,0,7,0,0,0,0,0],
      "2025": [349,234,251,204,111,49,38,34,31,23,0,3,0,2,0,0,2],
      "2026": [129,179,54,120,85,3,22,19,6,0,14,0,9,0,2,2,0],
      "all": [905,501,484,468,252,141,108,88,37,23,14,10,9,2,2,2,2]
    },
    "startYear": 2024,
    "startC": 0,
    "yearOrder": ["2026","2025","2024"]
  };
  /* SNAPSHOT:END */

  let dataPromise = null;
  function ensureData() {
    if (PERIODS) return Promise.resolve();
    if (dataPromise) return dataPromise;
    /* Cache-busting timestamp + no-store: every page load reads the store
       fresh, so the KPIs can never lag behind the live dashboard. */
    dataPromise = fetch(STORE_URL + '?_ts=' + Date.now(), { cache: 'no-store' })
      .then(res => { if (!res.ok) throw new Error('Store HTTP ' + res.status); return res.json(); })
      .then(rows => applyBuilt(AGG.buildLive(rows), false))
      .catch(err => {
        console.warn('Dashboard: store unavailable, showing the embedded snapshot', err);
        applyBuilt(FALLBACK, true);
      });
    return dataPromise;
  }

  /* Build the period picker from the data's years ('all' first, then each year
     newest-first), so there are never dead options for a year with no rows.
     It is a <select> enhanced by GlideSelect: one chip opening a gliding list,
     which keeps the same filter and the same ?period= URL contract. */
  function buildFilters(active) {
    const host = document.getElementById('dashFilters');
    if (!host) return;
    host.textContent = '';
    const select = document.createElement('select');
    select.id = 'dashPeriod';
    select.setAttribute('aria-label', 'Time period');
    select.setAttribute('data-glide', '');
    select.setAttribute('data-glide-menu-width', '170');
    ['all'].concat(YEAR_ORDER).forEach(p => {
      const o = document.createElement('option');
      o.value = p;
      o.textContent = p === 'all' ? 'All Time' : p;
      select.appendChild(o);
    });
    select.value = active;
    select.addEventListener('change', () => setFilter(select.value));
    host.appendChild(select);
    els.filters = [select];

    /* Reset view is the one destructive control in this section: it throws the
       chosen period away and puts the dashboard back on All Time. The chart and
       every figure re-compute on click; the button itself keeps the six-second
       window in which the old period can be restored. */
    resetView = document.createElement('button');
    resetView.type = 'button';
    resetView.className = 'dash-reset tu-btn';
    resetView.textContent = 'Reset view';
    host.appendChild(resetView);
  }

  /* ── KPI count-up animation ── */
  const values = { titles: 0, hours: 0, shows: 0, movies: 0 };
  const fmtCount = v => Math.round(v).toLocaleString('en-US');

  /* Cancel any in-flight count-up before starting a new one (rapid filter clicks) */
  const animIds = {};
  function setMetric(el, key, target, animate) {
    if (!el) return;
    const from = values[key];
    values[key] = target;
    if (animIds[key]) { cancelAnimationFrame(animIds[key]); animIds[key] = 0; }
    if (!animate || reduceMotion() || from === target) { el.textContent = fmtCount(target); return; }
    const dur = 550;
    const t0  = performance.now();
    const ease = t => 1 - Math.pow(1 - t, 3);
    function frame(now) {
      const p = Math.min(1, (now - t0) / dur);
      el.textContent = fmtCount(from + (target - from) * ease(p));
      animIds[key] = p < 1 ? requestAnimationFrame(frame) : 0;
    }
    animIds[key] = requestAnimationFrame(frame);
  }

  function updateMetrics(period, animate) {
    const d = PERIODS[period];
    setMetric(els.metrics.titles, 'titles', d.titles, animate);
    setMetric(els.metrics.hours,  'hours',  d.hours,  animate);
    setMetric(els.metrics.shows,  'shows',  d.shows,  animate);
    setMetric(els.metrics.movies, 'movies', d.movies, animate);
    els.subs.forEach((el, i) => { if (el) el.textContent = d.sub[i]; });
  }

  /* ── Line chart (orange accent) ── */
  /* The line is the design system's analytics-chart: one series, one tooltip.
     The months come from the store; the kit draws the path, sizes itself to the
     card and moves the cursor, so there is no second plot to drift from the one
     the other sites use. */
  /* How many months the trend shows. 36 is every month this dashboard holds,
     so the default is the whole period it always drew, and the reader can trim
     it to 3 without changing the filter above. */
  function storedLineMonths() {
    try {
      const n = parseInt(localStorage.getItem('portfolio-line-months'), 10);
      return isFinite(n) ? Math.max(3, Math.min(36, n)) : 36;
    } catch (e) { return 36; }
  }

  function mountLineLen() {
    const host = document.getElementById('lineLen');
    if (!host || !window.Stepper || Stepper.get(host) !== null) return;
    Stepper.mount(host, {
      value: storedLineMonths(), min: 3, max: 36, step: 1,
      label: 'Months shown', unit: 'month', size: 'sm',
      onChange(n) {
        try { localStorage.setItem('portfolio-line-months', String(n)); } catch (e) { /* private mode */ }
        renderLine(current, false);
        updateSubs(current);
      }
    });
  }

  function renderLine(period) {
    const host = els.lineChart;
    if (!host || !window.AnalyticsChart) return;
    const all = PERIODS[period].months;
    const offset = Math.max(0, all.length - storedLineMonths());
    const months = all.slice(offset);
    const absIdx = i => (period === 'all' ? START_C : (Number(period) - START_YEAR) * 12) + offset + i;
    const points = months.map((hours, i) => ({
      label: MONTH_NAMES[absIdx(i) % 12] + ' ' + (START_YEAR + Math.floor(absIdx(i) / 12)),
      value: hours,
    }));
    AnalyticsChart.render(host, points, {
      label: 'hours watched',
      format: v => v.toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' hrs',
    });
  }

  /* ── Bar chart (orange accent) ── */
  function renderBars(period, animate) {
    const fig = els.barFigure;
    if (!fig) return;
    fig.textContent = '';

    const hours = GENRE_YEARS[period] || GENRE_YEARS.all;
    /* Year tabs skip genres with no hours in that period, so the card stays
       dense instead of holding empty columns for absent genres. */
    const entries = GENRES.map((g, i) => ({ name: g, v: hours[i] }))
      .filter(e => e.v > 0)
      .sort((a, b) => b.v - a.v);
    if (!entries.length) {
      fig.setAttribute('aria-label', 'Bar chart: no hours in ' + PERIODS[period].name);
      return;
    }
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
    if (animate && !reduceMotion()) requestAnimationFrame(() => requestAnimationFrame(grow));
    else grow();

    fig.setAttribute('aria-label', 'Bar chart: hours watched by genre, ' + PERIODS[period].name);
  }

  /* ── Filters ── */
  function setFilter(period) {
    /* Ignore clicks until the store has loaded (and period buttons that
       aren't present in the data, e.g. a future year with no titles yet). */
    if (!PERIODS || !PERIODS[period] || period === current) return;
    current = period;
    els.filters.forEach(f => {
      if (f.tagName === 'SELECT') { if (f.value !== period) f.value = period; return; }
      const on = f.dataset.period === period;
      f.classList.toggle('active', on);
      f.setAttribute('aria-pressed', String(on));
    });
    history.replaceState(null, '', '?period=' + period + location.hash);
    updateMetrics(period, true);
    renderLine(period, true);
    renderBars(period, true);
    updateSubs(period);
  }

  function updateSubs(period) {
    const trimmed = PERIODS[period].months.length > storedLineMonths();
    if (els.lineSub) {
      els.lineSub.textContent = 'per month · ' + PERIODS[period].monthsLabel +
        (trimmed ? ' · last ' + storedLineMonths() + ' months' : '');
    }
    if (els.barSub)  els.barSub.textContent  = GENRES.length + ' genres · ' + PERIODS[period].name;
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
    mountLineLen();
    if (resetView && window.TimeUndo) {
      let beforePeriod = null;
      TimeUndo.mount(resetView, {
        seconds: 6,
        onStart: () => {
          if (current === 'all') return false;
          beforePeriod = current;
          setFilter('all');
          return true;
        },
        onCancel: () => {
          if (!beforePeriod) return;
          const restore = beforePeriod;
          beforePeriod = null;
          setFilter(restore);
        },
        onCommit: () => { beforePeriod = null; }
      });
    }

    updateMetrics(current, animate);
    renderLine(current, animate);
    renderBars(current, animate);
    updateSubs(current);
  }

  ensureData(); /* start the store fetch immediately, not on first scroll */

  if (reduceMotion()) {
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

/* ── WRITING ON MEDIUM: THE 3 LATEST POSTS ────────────────── */
/* The callout in the Education section shows the three newest articles, refreshed
   on every page load. The feed is read from this site's own endpoint,
   /api/medium - a Pages Function (functions/api/medium.js) that asks Medium for
   the feed server-side and caches it. It used to read a third-party JSON proxy
   (api.rss2json.com), which is what broke the section on 15 Oct 2026: the proxy
   answered 500 while the feed itself was fine, and the list went empty for every
   visitor. Nothing third-party is in this path now.

   The rules that pick the three live in medium-feed.js: the same parseFeed() and
   latestPosts() run in the Function, in this file, and under Node in
   tools/snapshot-medium-fallback.mjs - which regenerates the snapshot this list is
   served with - so the three on screen and the three baked into the page are chosen
   one way rather than two.

   That snapshot is what the note below is for. It used to be two hand-typed articles
   from September, and any failure left them on screen looking current: the section
   disagreed with Medium for weeks and said nothing. The list still stays (the card is
   never empty, and the tool keeps the snapshot honest), but a failed read now says it
   is a snapshot instead of passing three old titles off as the latest. */
(function () {
  'use strict';

  const list = document.querySelector('.medium-recent');
  if (!list || !window.MediumFeed) return;
  const { FEED_URL, latestPosts } = window.MediumFeed;
  const note = document.getElementById('mediumSnapshotNote');

  /* Hidden in the markup, shown only when the live read fails. During a load the
     list briefly shows the committed snapshot, which is current as of the last deploy,
     and calling that a failure would be wrong. */
  function noteSnapshot(on) {
    if (!note) return;
    note.hidden = !on;
    note.textContent = on
      ? 'Snapshot - the Medium feed could not be read from this page, so these are '
        + 'the newest articles as of ' + (note.dataset.taken || 'the last update') + '.'
      : '';
  }

  fetch(FEED_URL, { cache: 'no-store' })
    .then(res => { if (!res.ok) throw new Error('feed HTTP ' + res.status); return res.json(); })
    .then(data => {
      if (!data || !Array.isArray(data.items)) throw new Error('bad feed payload');
      const latest = latestPosts(data.items);
      if (!latest.length) { noteSnapshot(true); return; } /* keep it, and say so */

      list.textContent = '';
      latest.forEach(it => {
        const li   = document.createElement('li');
        const a    = document.createElement('a');
        const span = document.createElement('span');
        a.href = it.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = it.title;
        span.textContent = it.label;
        li.appendChild(a);
        li.appendChild(span);
        list.appendChild(li);
      });
      noteSnapshot(false);
    })
    .catch(() => noteSnapshot(true));    /* the list stays, and the note says why */
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
  const reduceMotion = () => document.documentElement.dataset.motion === 'reduce';
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
    if (reduceMotion() || interacted || rotTimer || !projectsSec) return;
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

  /* Rotation is the one loop that would keep moving after the footer switch is
     turned on, so the switch's event stops it - and turning motion back on
     resumes it without a reload. */
  document.addEventListener('motionchange', (e) => {
    if (e.detail && e.detail.reduce) stopRotation();
    else startRotation();
  });
})();

/* ── MICRO-INTERACTIONS (tilt + glare) ──────────────── */
/* Cursor-tracked tilt on certificate cards and a soft glare sweep on the
   dashboard cards - the threeui.com / 21st.dev touch. rAF-throttled,
   pointer-devices only, skipped entirely under prefers-reduced-motion.
   Only CSS custom properties are written here; every visual state lives
   in style.css, so this stays CSP-clean (no inline styles). */
(function () {
  'use strict';

  const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!finePointer) return;

  function trackVars(el, onMove, resetOnLeave) {
    let raf = null;
    el.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        // Checked per frame rather than once at load: the footer switch can turn
        // the tilt off (and back on) while this page is open.
        if (document.documentElement.dataset.motion === 'reduce') return;
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

  /* Dashboard cards: sheen only - the charts stay flat and readable */
  document.querySelectorAll('.dash-card').forEach((card) => {
    trackVars(card, (el, px, py) => {
      el.style.setProperty('--glare-x', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--glare-y', (py * 100).toFixed(1) + '%');
    }, false);
  });
})();

/* ── MOTION SWITCH ─────────────────────────────────── */
/* The footer's control, and the only preference on the page. The OS setting is
   the default (motion-init.js copies it before first paint); this switch lets a
   visitor ask for the calm page on a device whose OS has no opinion, and the
   answer survives a reload.

   The page owns the state, as the component expects: this writes
   <html data-motion> and aria-checked, style.css and every motion block above
   read the attribute, and squish-switch.js only paints the track. The custom
   event is what stops a loop that is already running. */
(function () {
  'use strict';

  const btn = document.getElementById('motionSwitch');
  if (!btn) return;
  const KEY = 'ps-motion';
  const reduce = () => document.documentElement.dataset.motion === 'reduce';

  function apply(on, persist) {
    document.documentElement.dataset.motion = on ? 'reduce' : 'auto';
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    // The component's thumb is script-driven, so the global CSS above cannot
    // stop its spring; data-ss-motion is its documented opt-out, read on every
    // interaction. Set here so the switch itself is calm under its own answer.
    if (on) btn.setAttribute('data-ss-motion', 'off');
    else btn.removeAttribute('data-ss-motion');
    if (!persist) return;
    try { localStorage.setItem(KEY, on ? 'reduce' : 'auto'); } catch (e) { /* private mode */ }
    document.dispatchEvent(new CustomEvent('motionchange', { detail: { reduce: on } }));
  }

  // The markup ships off so a script-less visitor still gets the page; the
  // stored or OS answer is written here, before the component reads it.
  apply(reduce(), false);
  btn.addEventListener('click', () => apply(!reduce(), true));
})();

/* ── SCROLL ISLAND ─────────────────────────────────── */
/* The index of this one long page: seven sections, no URL and no history entry.
   Each section carries data-si-label, because the headings here are set in
   display type with <br> and <em> in them - "Professional<br><em>Experience</em>"
   reads as one word to textContent, and an index of one-word labels is useless.
   The 76px offset is the sticky header, so a chosen section lands below it. */
(function () {
  'use strict';
  if (!window.ScrollIsland) return;
  ScrollIsland.mount(document.body, {
    label: 'Portfolio sections',
    head: 'On this page',
    sections: '#main > section[data-si-label]',
    offset: 76
  });
})();
