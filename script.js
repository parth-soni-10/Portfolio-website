(function () {
  'use strict';

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
    '.issue-tag, .hero-h1, .hero-sub, .hero-cta-row, ' +
    '.profile-kicker, .hero-stat-block, .profile-pill-row, .pull-quote, ' +
    '.connect-card, ' +
    '.dash-filters, .dash-card, ' +
    '.exp-block, .proj-row, .cert-card, .edu-entry, ' +
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

  /* ── STAGGERED HERO ENTRANCE ─────────────────────── */
  document.querySelectorAll('#hero .fade-up').forEach((el, i) => {
    el.style.transitionDelay = `${i * 90}ms`;
  });

  /* ── STAGGERED CERT REVEAL ───────────────────────── */
  document.querySelectorAll('.cert-card').forEach((card, i) => {
    card.style.transitionDelay = `${i * 55}ms`;
  });

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

  /* ── HEADER SHADOW ON SCROLL ─────────────────────── */
  const header = document.getElementById('site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.style.boxShadow = window.scrollY > 60
        ? '0 2px 24px rgba(0,0,0,0.45)'
        : 'none';
    }, { passive: true });
  }

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
      if (repos)     repos.textContent = String(d.public_repos ?? '\u2014');
      if (followers) followers.textContent = String(d.followers ?? '\u2014');
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
                ? dateLabel + ' \u2014 ' + count + (count === 1 ? ' contribution' : ' contributions')
                : dateLabel + ' \u2014 No contributions';
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
   #519DFA line chart, #0077E6 bar chart, #333333 / #777777 text. */
(function () {
  'use strict';

  const sec = document.getElementById('dashboard');
  if (!sec) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Locale-aware month labels (Intl, not a hardcoded array) */
  const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleString('en-US', { month: 'short' }));
  const GENRES      = ['Sci-Fi','Drama','Documentary','Comedy','Crime','Animation'];

  /* Monthly hours watched + per-period KPIs (mirrors the live Content
     Tracking Dashboard — Google Sheets backend, 342+ titles). */
  const PERIODS = {
    all: {
      name: 'All Time',
      months: [18,24,31,27,35,29,42,38,45,39,51,47, 44,52,48,61,55,63,58,72,66,70,62,75, 58,64,71,60,78,83,74],
      titles: 342, hours: 1640, shows: 205, movies: 137,
      sub: ['movies + series', 'since Jan 2024', '60% of titles', '40% of titles'],
      monthsLabel: 'Jan 2024-Jul 2026'
    },
    '2024': {
      name: '2024',
      months: [18,24,31,27,35,29,42,38,45,39,51,47],
      titles: 198, hours: 426, shows: 116, movies: 82,
      sub: ['active in period', 'Jan-Dec 2024', '59% of titles', '41% of titles'],
      monthsLabel: 'Jan-Dec 2024'
    },
    '2025': {
      name: '2025',
      months: [44,52,48,61,55,63,58,72,66,70,62,75],
      titles: 289, hours: 726, shows: 168, movies: 121,
      sub: ['active in period', 'Jan-Dec 2025', '58% of titles', '42% of titles'],
      monthsLabel: 'Jan-Dec 2025'
    },
    '2026': {
      name: '2026',
      months: [58,64,71,60,78,83,74],
      titles: 214, hours: 488, shows: 119, movies: 95,
      sub: ['active in period', 'Jan-Jul 2026', '56% of titles', '44% of titles'],
      monthsLabel: 'Jan-Jul 2026'
    }
  };

  /* Hours by genre per year (order matches GENRES). All Time = the sums. */
  const GENRE_YEARS = {
    '2024': [72, 89, 64, 60, 43, 38],
    '2025': [138, 131, 109, 87, 87, 73],
    '2026': [117, 78, 59, 54, 68, 49]
  };
  GENRE_YEARS.all = GENRES.map((_, i) => GENRE_YEARS['2024'][i] + GENRE_YEARS['2025'][i] + GENRE_YEARS['2026'][i]);

  /* ── Element refs ── */
  const els = {
    lineSvg:    document.getElementById('lineSvg'),
    lineTip:    document.getElementById('lineTip'),
    barFigure:  document.getElementById('barFigure'),
    lineSub:    document.getElementById('lineSub'),
    barSub:     document.getElementById('barSub'),
    filters:    Array.from(sec.querySelectorAll('.dash-filter')),
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

  let current = 'all';
  let inited  = false;

  /* URL state: deep-link the active filter via ?period= */
  const urlPeriod = new URLSearchParams(location.search).get('period');
  if (urlPeriod && PERIODS[urlPeriod]) {
    current = urlPeriod;
    els.filters.forEach(f => {
      const on = f.dataset.period === urlPeriod;
      f.classList.toggle('active', on);
      f.setAttribute('aria-pressed', String(on));
    });
  }

  /* ── KPI count-up animation ── */
  const values = { titles: 342, hours: 1640, shows: 205, movies: 137 };
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

  /* ── Line chart (#519DFA) ── */
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  function renderLine(period, animate) {
    const svg = els.lineSvg;
    if (!svg) return;
    svg.textContent = '';

    const months = PERIODS[period].months;
    const W = 600, H = 220, PL = 36, PR = 14, PT = 12, PB = 26;
    const iw = W - PL - PR;
    const ih = H - PT - PB;
    const max = Math.max.apply(null, months);
    const niceMax = Math.max(10, Math.ceil(max / 10) * 10);
    const x = i => PL + (months.length === 1 ? iw / 2 : (iw * i) / (months.length - 1));
    const y = v => PT + ih - (ih * v) / niceMax;
    const baseYear = period === 'all' ? 2024 : Number(period);
    const yearOf = i => baseYear + Math.floor(i / 12);

    /* gradient fill under the line */
    const grad = svgEl('linearGradient', { id: 'dashLineGrad', x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.appendChild(svgEl('stop', { offset: '0%',   'stop-color': '#519DFA', 'stop-opacity': '0.28' }));
    grad.appendChild(svgEl('stop', { offset: '100%', 'stop-color': '#519DFA', 'stop-opacity': '0' }));
    svg.appendChild(grad);

    /* gridlines + y-axis labels */
    const N_LINES = 4;
    for (let g = 0; g < N_LINES; g++) {
      const v  = (niceMax / (N_LINES - 1)) * g;
      const yy = y(v);
      svg.appendChild(svgEl('line', { x1: PL, x2: W - PR, y1: yy, y2: yy, class: 'dash-grid-line' }));
      const t = svgEl('text', { x: PL - 7, y: yy + 3.5, 'text-anchor': 'end', class: 'dash-y-label' });
      t.textContent = v + 'h';
      svg.appendChild(t);
    }

    /* x-axis labels (sparse, to stay readable) */
    const every = months.length > 24 ? 6 : 3;
    months.forEach((m, i) => {
      if (i % every !== 0 && i !== months.length - 1) return;
      const t = svgEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'dash-x-label' });
      t.textContent = MONTH_NAMES[i % 12] + ' ' + yearOf(i);
      svg.appendChild(t);
    });

    /* line + area paths */
    const pts = months.map((v, i) => x(i) + ',' + y(v));
    const area = svgEl('path', {
      d: 'M' + PL + ',' + y(0) + ' L' + pts.join(' L') + ' L' + x(months.length - 1) + ',' + (PT + ih) + ' Z',
      class: 'dash-area-path'
    });
    const line = svgEl('polyline', { points: pts.join(' '), class: 'dash-line-path' });
    svg.appendChild(area);
    svg.appendChild(line);

    /* draw-on animation */
    const total = line.getTotalLength();
    line.style.strokeDasharray  = String(total);
    line.style.strokeDashoffset = String(total);
    area.style.opacity = '0';
    if (animate && !reduceMotion) {
      const t0 = performance.now();
      const dur = 800;
      const ease = t => 1 - Math.pow(1 - t, 3);
      function frame(now) {
        const p = Math.min(1, (now - t0) / dur);
        line.style.strokeDashoffset = String(total * (1 - ease(p)));
        area.style.opacity = String(0.06 + 0.94 * ease(p));
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    } else {
      line.style.strokeDashoffset = '0';
      area.style.opacity = '1';
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
      /* Keep the tooltip fully inside the figure (clamp horizontally, flip below near the top) */
      const figW = els.lineTip.parentElement.clientWidth;
      const figH = els.lineTip.parentElement.clientHeight;
      const tipW = els.lineTip.offsetWidth;
      const tipH = els.lineTip.offsetHeight;
      const inset = ((tipW / 2 + 8) / figW) * 100;
      let pct = (vx / W) * 100;
      pct = Math.min(100 - inset, Math.max(inset, pct));
      els.lineTip.style.left = pct + '%';
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

  /* ── Bar chart (#0077E6) ── */
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
    if (period === current) return;
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
  els.filters.forEach(f => f.addEventListener('click', () => setFilter(f.dataset.period)));

  /* ── Init (render on first scroll into view) ── */
  function init(animate) {
    if (inited) return;
    inited = true;
    updateMetrics(current, animate);
    renderLine(current, animate);
    renderBars(current, animate);
    if (els.lineSub) els.lineSub.textContent = 'per month · ' + PERIODS[current].monthsLabel;
    if (els.barSub)  els.barSub.textContent  = 'top ' + GENRES.length + ' · ' + PERIODS[current].name;
  }

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
