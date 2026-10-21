/* =====================================================
   PORTFOLIO — COMPONENT LAYER

   The 26 design-system components, adopted onto the page
   that already exists. Loaded after script.js, so it
   enhances the site's own behaviour instead of replacing
   it.

   Strict CSP: no inline script, no style attribute. Any
   runtime geometry is set through CSS custom properties
   with style.setProperty (CSSOM), which the policy allows.

   Components with a natural home stay where they were:
   the header nav, the connect tabs, the dashboard figures
   and charts, the contribution graph, the experience
   timeline and the project rows. The rest are hosted on
   the settings surface at /?admin=1 — the sanctioned
   local-only Portfolio surface — where each one is wired
   to the same preference store the page reads, not to a
   demo value.
   ===================================================== */
(function () {
  'use strict';

  var KEY = 'portfolio-settings:v1';
  var DEFAULTS = {
    filter: 'All',
    limit: 10,
    gallerySpeed: 'Medium',
    reduceMotion: false,
    contrast: false,
    tooltipDelay: 100,
    links: [
      { name: 'LinkedIn', url: 'https://www.linkedin.com/in/parth-soni-1a6025191/' },
      { name: 'GitHub', url: 'https://github.com/parth-soni-10' }
    ]
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      var out = {};
      for (var k in DEFAULTS) out[k] = DEFAULTS[k];
      for (var j in raw) if (Object.prototype.hasOwnProperty.call(DEFAULTS, j)) out[j] = raw[j];
      return out;
    } catch (e) {
      var fallback = {};
      for (var d in DEFAULTS) fallback[d] = DEFAULTS[d];
      return fallback;
    }
  }

  var store = load();

  function save(patch) {
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) store[k] = patch[k];
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {}
    apply();
  }

  function mark(el, id) {
    if (!el) return el;
    el.setAttribute('data-component', id);
    return el;
  }

  function text(el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }

  function say(el, message) {
    if (!el) return;
    el.textContent = message;
    window.clearTimeout(el._pcTimer);
    el._pcTimer = window.setTimeout(function () { el.textContent = ''; }, 4000);
  }

  function copy(value, done) {
    var fallback = function () {
      try {
        var field = document.createElement('textarea');
        field.value = value;
        field.setAttribute('readonly', 'readonly');
        field.className = 'pc-copy-field';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        document.body.removeChild(field);
        if (done) done(true);
      } catch (e) { if (done) done(false); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () { if (done) done(true); }, fallback);
    } else fallback();
  }

  /* ── 1. Gooey nav ─────────────────────────────────────────────── */
  function installNav() {
    var nav = $('#site-header nav');
    if (!nav) return;
    nav.classList.add('pc-nav');
    mark(nav, 'gooey-nav');

    var blob = document.createElement('span');
    blob.className = 'pc-nav-blob';
    blob.setAttribute('aria-hidden', 'true');
    nav.appendChild(blob);

    function place() {
      var active = nav.querySelector('a[aria-current]') || nav.querySelector('a');
      if (!active) return;
      var navRect = nav.getBoundingClientRect();
      var rect = active.getBoundingClientRect();
      if (!rect.width) return;
      nav.style.setProperty('--pc-blob-x', Math.round(rect.left - navRect.left) + 'px');
      nav.style.setProperty('--pc-blob-w', Math.round(rect.width) + 'px');
    }

    var sections = $$('main section[id], footer[id]');
    var links = $$('a[href^="#"]', nav);
    function current() {
      var fromTop = window.scrollY + 140;
      var found = sections[0];
      sections.forEach(function (section) {
        if (section.offsetTop <= fromTop) found = section;
      });
      links.forEach(function (link) {
        if (found && link.getAttribute('href') === '#' + found.id) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
      place();
    }

    window.addEventListener('scroll', current, { passive: true });
    window.addEventListener('resize', place);
    current();
  }

  /* ── 2. Warm tooltips ─────────────────────────────────────────── */
  function installTooltips() {
    var triggers = $$('.footer-link').concat($$('#copyEmail'), $$('.connect-tab'));
    var open = null;
    var timer = null;

    function close() {
      window.clearTimeout(timer);
      if (!open) return;
      open.tooltip.classList.remove('is-open');
      open.tooltip.setAttribute('aria-hidden', 'true');
      open = null;
    }

    triggers.forEach(function (trigger, i) {
      var label = trigger.getAttribute('data-tip') || text(trigger) || trigger.getAttribute('aria-label');
      if (!label) return;
      var tip = document.createElement('span');
      tip.className = 'pc-tooltip';
      tip.id = 'pc-tip-' + i;
      tip.setAttribute('role', 'tooltip');
      tip.setAttribute('aria-hidden', 'true');
      tip.textContent = label;
      trigger.classList.add('pc-tooltip-trigger');
      trigger.setAttribute('aria-describedby', tip.id);
      trigger.appendChild(tip);
      mark(trigger, 'warm-tooltip');

      function show() {
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          close();
          tip.classList.add('is-open');
          tip.setAttribute('aria-hidden', 'false');
          open = { trigger: trigger, tooltip: tip };
        }, Number(store.tooltipDelay) || 0);
      }
      trigger.addEventListener('mouseenter', show);
      trigger.addEventListener('focus', show);
      trigger.addEventListener('mouseleave', close);
      trigger.addEventListener('blur', close);
      trigger.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') close();
      });
    });
  }

  /* ── 3. Fluid tabs (connect card) ─────────────────────────────── */
  function installTabs() {
    var list = $('.connect-tabs');
    if (!list) return;
    mark(list, 'fluid-tabs');
    var tabs = $$('.connect-tab', list);
    list.addEventListener('keydown', function (event) {
      var index = tabs.indexOf(document.activeElement);
      if (index < 0) return;
      var next = -1;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next < 0) return;
      event.preventDefault();
      tabs[next].focus();
      tabs[next].click();
    });
  }

  /* ── 4. Animated counters (dashboard figures) ────────────────── */
  function installCounters() {
    $$('.dash-metric-value').forEach(function (value) {
      value.classList.add('pc-counter');
      mark(value, 'animated-counter');
      var last = text(value);
      var observer = new MutationObserver(function () {
        if (text(value) === last) return;
        last = text(value);
        value.classList.remove('is-ticking');
        void value.offsetWidth;
        value.classList.add('is-ticking');
      });
      observer.observe(value, { childList: true, characterData: true, subtree: true });
    });
  }

  /* ── 5. GitHub activity + 6. Analytics chart ─────────────────── */
  function installFigures() {
    mark($('#ghGraph'), 'github-activity');
    mark($('#lineFigure'), 'analytics-chart');
  }

  /* ── 7. Skiper74 — sticky year, and the timeline drill ──────── */
  /* The year stamp doubles as the control: choosing a role's year narrows the
     timeline to that role — the other blocks keep their dates and role title
     and fold their detail — and the header offers the way back. One control,
     pointer and keyboard alike, so the figure is operable rather than only
     readable. */
  function installTimeline() {
    var section = $('#experience');
    if (!section) return;
    mark(section, 'skiper74');

    var entries = [];
    $$('.exp-block', section).forEach(function (block, index) {
      var date = $('.exp-date', block);
      var meta = $('.exp-meta', block);
      var content = $('.exp-content', block);
      if (!date || !meta || !content) return;
      var years = text(date).match(/\d{4}/g);
      if (!years) return;
      /* The parts a drill folds away: the evidence under the role title. */
      var parts = [$('.exp-bullets', block), $('.exp-tags', block)].filter(Boolean);
      if (!parts.length) return;
      parts.forEach(function (part, i) {
        if (!part.id) part.id = 'exp-detail-' + index + '-' + i;
      });

      var label = document.createElement('span');
      label.className = 'pc-year';
      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'pc-timeline-head pc-drill-year';
      head.textContent = years[years.length - 1];
      /* A pressed toggle, not a disclosure: every role's detail is open until
         the reader drills into one, which folds the others away. */
      head.setAttribute('aria-pressed', 'false');
      head.setAttribute('aria-controls', parts.map(function (part) { return part.id; }).join(' '));
      head.setAttribute('aria-label', 'Focus the ' + (text($('.exp-role', block)) || 'role')
        + ' (' + head.textContent + ')');
      label.appendChild(head);
      meta.appendChild(label);

      var entry = { block: block, button: head, parts: parts };
      entries.push(entry);
      head.addEventListener('click', function () { activate(entry); });
    });
    if (!entries.length) return;

    /* The count becomes the drill's status line, and its way out sits beside it. */
    var count = $('.exp-count', section);
    var countText = count ? text(count) : '';
    if (count) count.setAttribute('aria-live', 'polite');
    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'exp-show-all touch-target';
    reset.textContent = 'Show all roles';
    reset.hidden = true;
    if (count && count.parentNode) {
      var actions = document.createElement('div');
      actions.className = 'exp-header-actions';
      count.parentNode.insertBefore(actions, count);
      actions.appendChild(count);
      actions.appendChild(reset);
    }

    var focused = null;
    function apply(next) {
      focused = next;
      entries.forEach(function (entry) {
        var on = entry === next;
        entry.block.classList.toggle('is-focused', on);
        entry.block.classList.toggle('is-collapsed', !!next && !on);
        entry.parts.forEach(function (part) { part.hidden = !!next && !on; });
        entry.button.setAttribute('aria-pressed', String(on));
      });
      reset.hidden = !next;
      if (count) {
        count.textContent = next
          ? '01 of ' + String(entries.length).padStart(2, '0') + ' roles'
          : countText;
      }
    }
    function activate(entry) { apply(focused === entry ? null : entry); }
    reset.addEventListener('click', function () { apply(null); });
    section.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !focused) return;
      event.preventDefault();
      var back = focused.button;
      apply(null);
      back.focus();
    });
  }

  /* ── 8. Inline disclosure menus on every project row ─────────── */
  function installProjectMenus() {
    $$('#spotPanels .spot-card').forEach(function (card) {
      var top = $('.sc-top', card);
      if (!top) return;
      var title = text($('.sc-title', card)) || 'project';
      var pageLink = $('.spot-links a[href^="/projects/"]', card);
      var live = $$('.spot-links a[target="_blank"]', card)[0] || null;

      var wrap = document.createElement('div');
      wrap.className = 'pc-menu-wrap';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'pc-menu-button touch-target';
      button.setAttribute('aria-haspopup', 'menu');
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-label', 'Actions for ' + title);
      button.textContent = '\u22ee';

      var menu = document.createElement('div');
      menu.className = 'pc-menu';
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', 'Actions for ' + title);
      menu.hidden = true;

      function add(label, run, destructive) {
        var item = document.createElement('button');
        item.type = 'button';
        item.setAttribute('role', 'menuitem');
        if (destructive) item.setAttribute('data-destructive', '');
        item.textContent = label;
        item.addEventListener('click', function () { close(true); run(); });
        menu.appendChild(item);
        return item;
      }

      function openMenu() {
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        var first = menu.querySelector('button');
        if (first) first.focus();
      }
      function close(restore) {
        menu.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        if (restore) button.focus();
      }

      if (pageLink) {
        add('Open project page', function () { window.location.href = pageLink.getAttribute('href'); });
        add('Copy project link', function () {
          copy(new URL(pageLink.getAttribute('href'), window.location.origin).href);
        });
      }
      if (live) {
        add('Open live site', function () { window.open(live.getAttribute('href'), '_blank', 'noopener'); });
      }

      button.addEventListener('click', function () {
        if (menu.hidden) openMenu(); else close(false);
      });
      button.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowDown') { event.preventDefault(); openMenu(); }
      });
      menu.addEventListener('keydown', function (event) {
        var items = $$('button', menu);
        var index = items.indexOf(document.activeElement);
        if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1) % items.length].focus(); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length].focus(); }
        else if (event.key === 'Escape') { event.preventDefault(); close(true); }
      });
      document.addEventListener('click', function (event) {
        if (!wrap.contains(event.target)) close(false);
      });

      wrap.appendChild(button);
      wrap.appendChild(menu);
      top.appendChild(wrap);
      mark(wrap, 'inline-disclosure-menu');
    });
  }

  /* ── 9. Project filter (jelly radio) + limit (stepper) ───────── */
  var FILTERS = {
    All: function () { return true; },
    Live: function (card) {
      var badge = $('.proj-featured-badge', card);
      return !!badge && /live/i.test(text(badge));
    },
    Dashboards: function (card) {
      return $$('.ptag', card).some(function (tag) { return /dashboard|tableau|data viz/i.test(text(tag)); });
    },
    'AI/ML': function (card) {
      return $$('.ptag', card).some(function (tag) { return /cnn|llm|rag|machine learning/i.test(text(tag)); });
    },
    Apps: function (card) {
      return $$('.ptag', card).some(function (tag) { return /javascript|flask|es modules/i.test(text(tag)); });
    }
  };

  function projectRows() {
    return $$('#spotIndex .spot-item').map(function (item) {
      return { item: item, card: document.getElementById(item.getAttribute('aria-controls')) };
    });
  }

  function filterProjects() {
    var match = FILTERS[store.filter] || FILTERS.All;
    var rows = projectRows();
    var visible = 0;
    var activeHidden = false;
    rows.forEach(function (row) {
      var keep = !!row.card && match(row.card) && visible < Number(store.limit);
      row.item.hidden = !keep;
      if (row.card) row.card.classList.toggle('pc-filtered-out', !keep);
      if (keep) visible += 1;
      if (row.card && row.card.classList.contains('active') && !keep) activeHidden = true;
    });
    if (activeHidden) {
      var first = rows.filter(function (row) { return !row.item.hidden; })[0];
      if (first) first.item.click();
    }
  }

  /* ── 10. Scroll island ───────────────────────────────────────── */
  function installIsland() {
    var island = document.createElement('div');
    island.className = 'pc-island';
    island.hidden = true;
    var progress = document.createElement('progress');
    progress.max = 100;
    progress.value = 0;
    progress.setAttribute('aria-label', 'Page scroll progress');
    var list = document.createElement('nav');
    list.className = 'pc-island-list';
    list.setAttribute('aria-label', 'Section index');
    var sections = [
      ['connect', 'Connect'], ['experience', 'Experience'], ['projects', 'Projects'],
      ['dashboard', 'Dashboard'], ['certificates', 'Certificates'], ['contact', 'Contact']
    ];
    sections.forEach(function (pair) {
      var link = document.createElement('a');
      link.href = '#' + pair[0];
      link.textContent = pair[1];
      list.appendChild(link);
    });
    island.appendChild(progress);
    island.appendChild(list);
    document.body.appendChild(island);
    mark(island, 'scroll-island');

    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      progress.value = Math.round(ratio * 100);
      island.hidden = window.scrollY < 320;
      var links = $$('a', list);
      var current = null;
      sections.forEach(function (pair, i) {
        var section = document.getElementById(pair[0]);
        if (section && section.offsetTop <= window.scrollY + 180) current = links[i];
      });
      links.forEach(function (link) { link.removeAttribute('aria-current'); });
      if (current) current.setAttribute('aria-current', 'true');
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ── 11. Settings surface ────────────────────────────────────── */
  function panel(title, component) {
    var box = document.createElement('section');
    box.className = 'pc-panel';
    var heading = document.createElement('h3');
    heading.textContent = title;
    box.appendChild(heading);
    if (component) mark(box, component);
    return box;
  }

  function pills(choices, value, onPick, component, groupLabel, jelly) {
    var wrap = document.createElement('div');
    wrap.className = jelly ? 'pc-pills pc-jelly' : 'pc-pills';
    wrap.setAttribute('role', 'radiogroup');
    wrap.setAttribute('aria-label', groupLabel);
    choices.forEach(function (choice) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'pc-pill touch-target';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(choice === value));
      button.textContent = choice;
      button.addEventListener('click', function () {
        $$('button', wrap).forEach(function (other) { other.setAttribute('aria-checked', String(other === button)); });
        if (jelly) {
          button.removeAttribute('data-picked');
          void button.offsetWidth;
          button.setAttribute('data-picked', '');
        }
        onPick(choice);
      });
      wrap.appendChild(button);
    });
    if (component) mark(wrap, component);
    return wrap;
  }

  function toggle(label, checked, component, onChange) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'pc-switch touch-target';
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', String(checked));
    button.setAttribute('aria-label', label);
    var knob = document.createElement('span');
    button.appendChild(knob);
    button.addEventListener('click', function () {
      var next = button.getAttribute('aria-checked') !== 'true';
      button.setAttribute('aria-checked', String(next));
      onChange(next);
    });
    if (component) mark(button, component);
    return button;
  }

  function stepper(value, min, max, component, onChange) {
    var wrap = document.createElement('div');
    wrap.className = 'pc-step';
    var down = document.createElement('button');
    down.type = 'button';
    down.className = 'touch-target';
    down.setAttribute('aria-label', 'Fewer');
    down.textContent = '\u2212';
    var output = document.createElement('output');
    output.textContent = String(value);
    var up = document.createElement('button');
    up.type = 'button';
    up.className = 'touch-target';
    up.setAttribute('aria-label', 'More');
    up.textContent = '+';
    function set(next) {
      var bounded = Math.min(max, Math.max(min, next));
      output.textContent = String(bounded);
      down.disabled = bounded <= min;
      up.disabled = bounded >= max;
      onChange(bounded);
    }
    down.addEventListener('click', function () { set(Number(output.textContent) - 1); });
    up.addEventListener('click', function () { set(Number(output.textContent) + 1); });
    down.disabled = value <= min;
    up.disabled = value >= max;
    wrap.appendChild(down);
    wrap.appendChild(output);
    wrap.appendChild(up);
    if (component) mark(wrap, component);
    return wrap;
  }

  function glideSelect(options, value, component, onChange) {
    var wrap = document.createElement('div');
    wrap.className = 'pc-select';
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'pc-panel-select touch-target';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.textContent = value;
    var list = document.createElement('div');
    list.className = 'pc-menu';
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    options.forEach(function (option) {
      var item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option === value));
      item.textContent = option;
      item.addEventListener('click', function () {
        button.textContent = option;
        list.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        button.focus();
        $$('button', list).forEach(function (other) { other.setAttribute('aria-selected', String(other === item)); });
        onChange(option);
      });
      list.appendChild(item);
    });
    button.addEventListener('click', function () {
      list.hidden = !list.hidden;
      button.setAttribute('aria-expanded', String(!list.hidden));
      if (!list.hidden) list.querySelector('button').focus();
    });
    button.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' && list.hidden) { event.preventDefault(); button.click(); }
    });
    list.addEventListener('keydown', function (event) {
      var items = $$('button', list);
      var index = items.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') { event.preventDefault(); items[(index + 1) % items.length].focus(); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); items[(index - 1 + items.length) % items.length].focus(); }
      else if (event.key === 'Escape') { event.preventDefault(); list.hidden = true; button.setAttribute('aria-expanded', 'false'); button.focus(); }
    });
    wrap.appendChild(button);
    wrap.appendChild(list);
    if (component) mark(wrap, component);
    return wrap;
  }

  function numberField(value, component, onChange) {
    var input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('inputmode', 'decimal');
    input.className = 'touch-target';
    input.value = String(value);
    input.setAttribute('aria-label', 'Tooltip delay in milliseconds');
    input.addEventListener('change', function () {
      if (!/^\d{0,4}(\.\d{0,1})?$/.test(input.value)) {
        input.value = String(store.tooltipDelay);
        return;
      }
      var next = Math.min(500, Math.max(0, Number(input.value) || 0));
      input.value = String(next);
      onChange(next);
    });
    if (component) mark(input, component);
    return input;
  }

  function buildSettings() {
    var host = document.createElement('section');
    host.className = 'pc-settings';
    host.id = 'settings';
    host.setAttribute('aria-labelledby', 'settings-title');

    var title = document.createElement('h2');
    title.id = 'settings-title';
    title.textContent = 'Component settings';
    var intro = document.createElement('p');
    intro.className = 'pc-settings-intro';
    intro.textContent = 'The local surface for the components that have no home on the report itself. Everything here writes the same preference store the page reads — nothing is a demo value.';

    var grid = document.createElement('div');
    grid.className = 'pc-grid';

    // Jelly Radio — project filter
    var p1 = panel('Project filter', 'jelly-radio');
    var status1 = document.createElement('p');
    status1.className = 'pc-status';
    p1.appendChild(pills(Object.keys(FILTERS), store.filter, function (value) {
      save({ filter: value });
      status1.textContent = value === 'All' ? 'Showing every project.' : 'Showing ' + value + ' projects.';
    }, null, 'Project filter', true));
    p1.appendChild(status1);
    grid.appendChild(p1);

    // Stepper — how many projects render
    var p2 = panel('Projects shown', 'stepper');
    p2.appendChild(stepper(Number(store.limit), 3, 10, null, function (value) { save({ limit: value }); }));
    p2.appendChild(Object.assign(document.createElement('p'), { className: 'pc-note', textContent: 'Applies to the spotlight index on this page.' }));
    grid.appendChild(p2);

    // Rubber Segment — gallery speed
    var p3 = panel('Gallery speed', 'rubber-segment');
    var speeds = ['Slow', 'Medium', 'Fast'];
    p3.appendChild(pills(speeds, store.gallerySpeed, function (value) { save({ gallerySpeed: value }); startGallery(); }, null, 'Gallery speed'));
    grid.appendChild(p3);

    // Squish Switch — reduced motion
    var p4 = panel('Reduce motion', 'squish-switch');
    var row4 = document.createElement('div');
    row4.className = 'pc-row';
    row4.appendChild(toggle('Reduce component motion', store.reduceMotion, null, function (value) { save({ reduceMotion: value }); }));
    var note4 = document.createElement('span');
    note4.textContent = store.reduceMotion ? 'Component motion is off.' : 'Component motion follows the system setting.';
    row4.appendChild(note4);
    p4.appendChild(row4);
    grid.appendChild(p4);

    // Switch Mode — contrast
    var p5 = panel('High contrast', 'switch-mode');
    var row5 = document.createElement('div');
    row5.className = 'pc-row';
    row5.appendChild(toggle('High contrast text', store.contrast, null, function (value) { save({ contrast: value }); }));
    var note5 = document.createElement('span');
    note5.textContent = store.contrast ? 'Stronger ink and hairlines.' : 'Default palette.';
    row5.appendChild(note5);
    p5.appendChild(row5);
    grid.appendChild(p5);

    // Glide Select — tooltip delay preset
    var p6 = panel('Tooltip delay', 'glide-select');
    var presets = ['Instant', 'Normal', 'Patient'];
    var preset = store.tooltipDelay < 60 ? 'Instant' : store.tooltipDelay > 180 ? 'Patient' : 'Normal';
    p6.appendChild(glideSelect(presets, preset, null, function (value) {
      save({ tooltipDelay: value === 'Instant' ? 0 : value === 'Patient' ? 250 : 100 });
    }));
    grid.appendChild(p6);

    // Skiper68 — exact delay
    var p7 = panel('Custom delay (ms)', 'skiper68');
    p7.appendChild(numberField(store.tooltipDelay, null, function (value) { save({ tooltipDelay: value }); }));
    grid.appendChild(p7);

    // Filter Disclosure — section jumper
    var p8 = panel('Jump to section', 'filter-disclosure');
    var details = document.createElement('details');
    details.className = 'pc-disclosure';
    var summary = document.createElement('summary');
    summary.className = 'pc-pill touch-target';
    summary.textContent = 'Choose a section';
    details.appendChild(summary);
    var menu8 = document.createElement('div');
    menu8.className = 'pc-menu';
    [['hero', 'Intro', '\u25c9'], ['projects', 'Projects', '\u25a3'], ['dashboard', 'Dashboard', '\u25a4'], ['certificates', 'Certificates', '\u2713']].forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = item[2] + '  ' + item[1];
      button.addEventListener('click', function () {
        details.open = false;
        var target = document.getElementById(item[0]);
        if (target) target.scrollIntoView({ behavior: store.reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
      menu8.appendChild(button);
    });
    details.appendChild(menu8);
    p8.appendChild(details);
    grid.appendChild(p8);

    // Accordion Gallery — certificates
    var p9 = panel('Certificates', 'accordion-gallery');
    var gallery = document.createElement('div');
    gallery.className = 'pc-gallery';
    var cards = $$('.cert-card');
    cards.slice(0, 5).forEach(function (card, i) {
      var img = $('img', card);
      if (!img) return;
      var figure = document.createElement('figure');
      if (i === 0) figure.classList.add('is-open');
      var image = document.createElement('img');
      image.src = img.getAttribute('src');
      image.alt = img.getAttribute('alt') || '';
      image.loading = 'lazy';
      image.decoding = 'async';
      var caption = document.createElement('figcaption');
      caption.textContent = text($('.cert-name', card)) || 'Certificate';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'touch-target';
      button.setAttribute('aria-label', 'Expand ' + caption.textContent);
      button.addEventListener('click', function () {
        var open = figure.classList.contains('is-open');
        if (open) {
          var link = card.getAttribute('href');
          if (link) window.open(link, '_blank', 'noopener');
          return;
        }
        $$('figure', gallery).forEach(function (other) { other.classList.remove('is-open'); });
        figure.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
      });
      button.setAttribute('aria-expanded', String(i === 0));
      figure.appendChild(image);
      figure.appendChild(caption);
      figure.appendChild(button);
      gallery.appendChild(figure);
    });
    p9.appendChild(gallery);
    grid.appendChild(p9);

    // Expandable Profile Card + dialog
    var p10 = panel('Profile', 'expandable-profile-card');
    var profile = document.createElement('button');
    profile.type = 'button';
    profile.className = 'pc-profile-card';
    var portrait = document.createElement('img');
    portrait.src = 'og-card.png';
    portrait.alt = 'Parth Soni';
    portrait.loading = 'lazy';
    var pname = document.createElement('strong');
    pname.textContent = 'Parth Soni';
    var prole = document.createElement('span');
    prole.textContent = 'Data Analyst · Dublin · open to roles';
    profile.appendChild(portrait);
    profile.appendChild(pname);
    profile.appendChild(prole);
    profile.addEventListener('click', function () { openDialog(profile); });
    p10.appendChild(profile);
    grid.appendChild(p10);

    // Transaction List — recent activity read from the page
    var p11 = panel('Recent activity', 'transaction-list');
    var txns = document.createElement('div');
    txns.className = 'pc-txns';
    var rows = [
      ['Contributions', text($('#ghTotal')) || 'Loading', 'GitHub, last year'],
      ['Public repos', text($('#ghRepos')) || 'Loading', 'github.com/parth-soni-10'],
      ['Followers', text($('#ghFollowers')) || 'Loading', 'GitHub profile']
    ];
    rows.forEach(function (row) {
      var item = document.createElement('div');
      item.className = 'pc-txn';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'touch-target';
      button.innerHTML = '<span>' + row[0] + '</span><strong>' + row[1] + '</strong>';
      button.setAttribute('aria-expanded', 'false');
      var detail = document.createElement('div');
      detail.className = 'pc-txn-detail';
      detail.hidden = true;
      detail.textContent = row[2];
      button.addEventListener('click', function () {
        detail.hidden = !detail.hidden;
        button.setAttribute('aria-expanded', String(!detail.hidden));
      });
      item.appendChild(button);
      item.appendChild(detail);
      txns.appendChild(item);
    });
    p11.appendChild(txns);
    grid.appendChild(p11);

    // Fund Widget — dashboard KPI carousel
    var p12 = panel('Dashboard figures', 'fund-widget');
    var fund = buildFund(function () {
      return $$('.dash-metric').map(function (card) {
        return { label: text($('.dash-metric-label', card)), value: text($('.dash-metric-value', card)) };
      });
    });
    p12.appendChild(fund);
    grid.appendChild(p12);

    // Quick links — Inline Table Control + Swipe Row
    var p13 = panel('Quick links', 'inline-table-control');
    var table = document.createElement('table');
    table.className = 'pc-table';
    table.innerHTML = '<thead><tr><th scope="col">Name</th><th scope="col">URL</th></tr></thead>';
    var body = document.createElement('tbody');
    var draft = store.links.length ? store.links.slice() : [{ name: 'LinkedIn', url: 'https://www.linkedin.com/in/parth-soni-1a6025191/' }];
    draft.forEach(function (link, index) {
      var tr = document.createElement('tr');
      var nameCell = document.createElement('td');
      var nameInput = document.createElement('input');
      nameInput.value = link.name;
      nameInput.setAttribute('aria-label', 'Link name');
      nameCell.appendChild(nameInput);
      var urlCell = document.createElement('td');
      var urlInput = document.createElement('input');
      urlInput.type = 'url';
      urlInput.value = link.url;
      urlInput.setAttribute('aria-label', 'Link URL');
      urlCell.appendChild(urlInput);
      tr.appendChild(nameCell);
      tr.appendChild(urlCell);
      body.appendChild(tr);
      draft[index] = { name: link.name, url: link.url };
      nameInput.addEventListener('input', function () { draft[index].name = nameInput.value; });
      urlInput.addEventListener('input', function () { draft[index].url = urlInput.value; });
    });
    table.appendChild(body);
    p13.appendChild(table);
    var saveLinks = document.createElement('button');
    saveLinks.type = 'button';
    saveLinks.className = 'touch-target';
    saveLinks.textContent = 'Save links';
    var linkStatus = document.createElement('p');
    linkStatus.className = 'pc-status';
    saveLinks.addEventListener('click', function () {
      var clean = draft.filter(function (link) { return link.name && /^https?:\/\//i.test(link.url); });
      save({ links: clean });
      renderSwipeLinks(swipeHost, clean);
      say(linkStatus, clean.length + ' link' + (clean.length === 1 ? '' : 's') + ' saved.');
    });
    p13.appendChild(saveLinks);
    p13.appendChild(linkStatus);
    var swipeHost = document.createElement('div');
    swipeHost.className = 'pc-swipe-list';
    p13.appendChild(swipeHost);
    renderSwipeLinks(swipeHost, store.links);
    grid.appendChild(p13);

    // Time Undo — reset preferences
    var p14 = panel('Preferences', 'time-undo-action');
    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'touch-target';
    reset.textContent = 'Reset preferences';
    var undoNote = document.createElement('p');
    undoNote.className = 'pc-status';
    var undo = null;
    reset.addEventListener('click', function () {
      if (undo) return;
      var previous = JSON.parse(JSON.stringify(store));
      save(DEFAULTS);
      var left = 5;
      reset.disabled = true;
      undoNote.textContent = 'Preferences reset — Undo (' + left + ')';
      undo = {
        previous: previous,
        timer: window.setInterval(function () {
          left -= 1;
          if (left <= 0) {
            window.clearInterval(undo.timer);
            undo = null;
            reset.disabled = false;
            undoNote.textContent = 'Preferences reset.';
            return;
          }
          undoNote.textContent = 'Preferences reset — Undo (' + left + ')';
        }, 1000)
      };
      undoNote.setAttribute('role', 'button');
      undoNote.setAttribute('tabindex', '0');
    });
    function undoReset() {
      if (!undo) return;
      window.clearInterval(undo.timer);
      save(undo.previous);
      undo = null;
      reset.disabled = false;
      undoNote.textContent = 'Reset cancelled.';
    }
    undoNote.addEventListener('click', undoReset);
    undoNote.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); undoReset(); }
    });
    p14.appendChild(reset);
    p14.appendChild(undoNote);
    grid.appendChild(p14);

    // Feedback — mailto
    var p15 = panel('Report a broken link', 'feedback');
    var rating = document.createElement('div');
    rating.className = 'pc-thumbs';
    var picks = [['\ud83d\udc4d', 'Worked'], ['\ud83d\udc4e', 'Broken']];
    var chosen = '';
    picks.forEach(function (pick) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'touch-target';
      button.textContent = pick[0];
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', pick[1]);
      button.addEventListener('click', function () {
        chosen = pick[1];
        $$('button', rating).forEach(function (other) { other.setAttribute('aria-pressed', String(other === button)); });
      });
      rating.appendChild(button);
    });
    var message = document.createElement('textarea');
    message.setAttribute('aria-label', 'What went wrong?');
    message.maxLength = 2000;
    var send = document.createElement('button');
    send.type = 'button';
    send.className = 'touch-target';
    send.textContent = 'Open in mail';
    send.addEventListener('click', function () {
      var body = (chosen ? chosen + ': ' : '') + message.value;
      window.location.href = 'mailto:soni.soni.parth@gmail.com?subject=' + encodeURIComponent('Portfolio feedback') + '&body=' + encodeURIComponent(body);
    });
    p15.appendChild(rating);
    p15.appendChild(message);
    p15.appendChild(send);
    grid.appendChild(p15);

    // Dynamic Button — copy email, with real state
    var p16 = panel('Copy email', 'dynamic-button');
    var dynamic = document.createElement('button');
    dynamic.type = 'button';
    dynamic.className = 'pc-dynamic touch-target';
    dynamic.textContent = 'Copy email';
    dynamic.setAttribute('aria-live', 'polite');
    dynamic.addEventListener('click', function () {
      copy('soni.soni.parth@gmail.com', function (ok) {
        dynamic.textContent = ok ? 'Copied' : 'Copy failed';
        window.setTimeout(function () { dynamic.textContent = 'Copy email'; }, 1800);
      });
    });
    p16.appendChild(dynamic);
    grid.appendChild(p16);

    host.appendChild(title);
    host.appendChild(intro);
    host.appendChild(grid);
    var footer = document.querySelector('footer');
    if (footer && footer.parentNode) footer.parentNode.insertBefore(host, footer);
    host.hidden = false;

    // Gallery auto-advance honours the speed preference.
    function startGallery() {
      window.clearInterval(startGallery.timer);
      if (store.reduceMotion) return;
      var delay = store.gallerySpeed === 'Fast' ? 3200 : store.gallerySpeed === 'Slow' ? 9000 : 5600;
      startGallery.timer = window.setInterval(function () {
        var figures = $$('.pc-gallery figure');
        if (!figures.length) return;
        var index = figures.findIndex(function (figure) { return figure.classList.contains('is-open'); });
        figures.forEach(function (figure) { figure.classList.remove('is-open'); });
        figures[(index + 1) % figures.length].classList.add('is-open');
      }, delay);
    }
    startGallery();
    window.pcSettingsGallery = startGallery;
  }

  function renderSwipeLinks(host, links) {
    if (!host) return;
    host.textContent = '';
    if (!links.length) {
      var empty = document.createElement('p');
      empty.className = 'pc-note';
      empty.textContent = 'No custom links saved yet.';
      host.appendChild(empty);
      return;
    }
    links.forEach(function (link) {
      var row = document.createElement('div');
      row.className = 'pc-swipe';
      var inner = document.createElement('div');
      inner.className = 'pc-swipe-row';
      var label = document.createElement('a');
      label.href = link.url;
      label.target = '_blank';
      label.rel = 'noopener';
      label.textContent = link.name;
      inner.appendChild(label);
      var actions = document.createElement('div');
      actions.className = 'pc-swipe-actions';
      var copyButton = document.createElement('button');
      copyButton.type = 'button';
      copyButton.textContent = 'Copy';
      copyButton.setAttribute('aria-label', 'Copy ' + link.name + ' link');
      copyButton.addEventListener('click', function () { copy(link.url); });
      actions.appendChild(copyButton);
      row.appendChild(inner);
      row.appendChild(actions);
      var startX = null;
      inner.addEventListener('pointerdown', function (event) { startX = event.clientX; });
      inner.addEventListener('pointerup', function (event) {
        if (startX === null) return;
        var delta = Math.min(0, event.clientX - startX);
        inner.style.setProperty('--pc-swipe-x', Math.max(-80, delta) + 'px');
        startX = null;
        window.setTimeout(function () { inner.style.setProperty('--pc-swipe-x', '0px'); }, 1800);
      });
      inner.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowLeft') { event.preventDefault(); inner.style.setProperty('--pc-swipe-x', '-80px'); }
        if (event.key === 'Escape') inner.style.setProperty('--pc-swipe-x', '0px');
      });
      host.appendChild(row);
      mark(row, 'swipe-row');
    });
  }

  function buildFund(readFunds) {
    var wrap = document.createElement('div');
    wrap.className = 'pc-fund';
    var prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'touch-target';
    prev.setAttribute('aria-label', 'Previous figure');
    prev.textContent = '\u2190';
    var view = document.createElement('div');
    view.className = 'pc-fund-view';
    var label = document.createElement('p');
    label.className = 'pc-fund-label';
    var value = document.createElement('p');
    value.className = 'pc-fund-value';
    view.appendChild(label);
    view.appendChild(value);
    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'touch-target';
    next.setAttribute('aria-label', 'Next figure');
    next.textContent = '\u2192';
    var index = 0;
    function show(i) {
      var funds = readFunds();
      if (!funds.length) {
        label.textContent = 'Waiting for the dashboard';
        value.textContent = '\u2026';
        return;
      }
      index = (i + funds.length) % funds.length;
      label.textContent = funds[index].label || 'Figure';
      value.textContent = funds[index].value || '\u2026';
    }
    prev.addEventListener('click', function () { show(index - 1); });
    next.addEventListener('click', function () { show(index + 1); });
    view.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(index - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); show(index + 1); }
    });
    wrap.appendChild(prev);
    wrap.appendChild(view);
    wrap.appendChild(next);
    show(0);
    return wrap;
  }

  function openDialog(trigger) {
    var existing = $('.pc-dialog');
    if (existing) existing.parentNode.removeChild(existing);
    var dialog = document.createElement('div');
    dialog.className = 'pc-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'About Parth Soni');
    var card = document.createElement('div');
    card.className = 'pc-dialog-panel';
    card.innerHTML = '<button type="button" class="pc-dialog-close" aria-label="Close">\u00d7</button>'
      + '<h3>Parth Soni</h3>'
      + '<p>Data Analyst in Dublin. MSc Computer Science at UCD, two internships, and ten projects across analytics, dashboards and small tools.</p>'
      + '<p><a class="spot-link" href="#contact">Get in touch \u2192</a> <a class="spot-link" href="https://github.com/parth-soni-10" target="_blank" rel="noopener">GitHub \u2192</a></p>';
    dialog.appendChild(card);
    document.body.appendChild(dialog);
    var close = $('.pc-dialog-close', card);
    function dismiss() {
      dialog.parentNode.removeChild(dialog);
      document.removeEventListener('keydown', onKey);
      trigger.focus();
    }
    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
      if (event.key === 'Tab') {
        var focusable = $$('button, a[href]', card);
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    close.addEventListener('click', dismiss);
    dialog.addEventListener('click', function (event) { if (event.target === dialog) dismiss(); });
    document.addEventListener('keydown', onKey);
    close.focus();
  }

  /* ── 12. Service worker + update prompt ──────────────────────── */
  function installServiceWorker() {
    var bar = document.createElement('div');
    bar.className = 'pc-update';
    bar.hidden = true;
    var message = document.createElement('span');
    message.textContent = 'A new version is available.';
    var reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'pc-dynamic';
    reload.textContent = 'Reload';
    bar.appendChild(message);
    bar.appendChild(reload);
    document.body.appendChild(bar);

    if (!('serviceWorker' in navigator)) return;

    var waiting = null;
    function offer(worker) {
      waiting = worker;
      bar.hidden = false;
    }
    reload.addEventListener('click', function () {
      reload.textContent = 'Reloading';
      reload.disabled = true;
      if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
      else window.location.reload();
    });
    navigator.serviceWorker.addEventListener('controllerchange', function () { window.location.reload(); });

    navigator.serviceWorker.register('/sw.js').then(function (registration) {
      if (registration.waiting) offer(registration.waiting);
      registration.addEventListener('updatefound', function () {
        var installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', function () {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) offer(installing);
        });
      });
    }).catch(function () {});
  }

  /* ── 13. Focus on hash navigation ────────────────────────────── */
  function installHashFocus() {
    window.addEventListener('hashchange', function () {
      var target = document.getElementById(window.location.hash.slice(1));
      if (!target) return;
      var heading = target.querySelector('h1, h2, h3') || target;
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    });
  }

  /* ── 14. Touch targets ───────────────────────────────────────── */
  function installTouchTargets() {
    mark($('#copyEmail'), 'dynamic-button');
    $$('.connect-btn, #copyEmail, .menu-toggle, .spot-link, .footer-link, .btn-editorial, .btn-ghost-hero, .btn-medium, .btn-footer-contact, .mobile-link')
      .forEach(function (el) { el.classList.add('touch-target'); });
  }

  /* ── Apply persisted preferences ─────────────────────────────── */
  function apply() {
    var root = document.documentElement;
    root.classList.toggle('pc-reduce-motion', !!store.reduceMotion);
    root.classList.toggle('pc-contrast', !!store.contrast);
    filterProjects();
  }

  function init() {
    installNav();
    installTooltips();
    installTabs();
    installCounters();
    installFigures();
    installTimeline();
    installProjectMenus();
    installIsland();
    installHashFocus();
    installTouchTargets();
    installServiceWorker();
    if (new URLSearchParams(window.location.search).get('admin') === '1') buildSettings();
    apply();
    window.portfolioSettings = { get: function () { return JSON.parse(JSON.stringify(store)); }, set: save };
    document.documentElement.setAttribute('data-components-ready', 'true');
  }

  init();
})();
