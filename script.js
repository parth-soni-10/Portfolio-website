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
      });
    });

    document.addEventListener('click', (e) => {
      if (!mobileNav.contains(e.target) && !menuToggle.contains(e.target)) {
        mobileNav.classList.remove('open');
        menuToggle.innerHTML = '&#9776;';
      }
    });
  }

  /* ── SCROLL FADE-IN (Relay-style blur + rise) ────── */
  const fadeTargets = document.querySelectorAll(
    '.issue-tag, .hero-h1, .hero-sub, .hero-cta-row, ' +
    '.profile-kicker, .hero-stat-block, .profile-pill-row, .pull-quote, ' +
    '.connect-card, ' +
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

  /* ── ACTIVE NAV ON SCROLL ────────────────────────── */
  const sections = document.querySelectorAll('section[id], div[id], footer[id]');
  const navLinks  = document.querySelectorAll('nav a');
  const headerH   = 70;

  function setActiveNav() {
    let current = '';
    sections.forEach(sec => {
      if (window.scrollY >= sec.offsetTop - headerH - 20) {
        current = sec.getAttribute('id');
      }
    });
    navLinks.forEach(link => {
      link.style.color = '';
      if (link.getAttribute('href') === '#' + current) {
        link.style.color = '#e85d04';
      }
    });
  }

  window.addEventListener('scroll', setActiveNav, { passive: true });
  setActiveNav();

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

  /* Slide the indicator pill to the active tab (300ms tween) */
  function positionIndicator(immediate) {
    const tab = tabs[activeIndex];
    if (!tab) return;
    if (immediate) {
      indicator.style.transition = 'none';
      indicator.style.left = tab.offsetLeft + 'px';
      indicator.style.width = tab.offsetWidth + 'px';
      void indicator.offsetWidth; // flush
      indicator.style.transition = '';
    } else {
      indicator.style.left = tab.offsetLeft + 'px';
      indicator.style.width = tab.offsetWidth + 'px';
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

    /* Lock body height, stack both panes absolutely */
    const oldH = body.offsetHeight;
    body.style.height = oldH + 'px';
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
    body.style.height       = newPane.offsetHeight + 'px';

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
        fail.textContent = 'Contribution graph unavailable right now.';
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
