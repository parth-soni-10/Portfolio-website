/* Accordion Gallery - a row of images where one opens and the rest step back.
 *
 *   <div class="cert-grid" data-accordion-gallery>
 *     <a class="cert-card" href="…">
 *       <div class="cert-img-wrap"><picture>…</picture></div>
 *       <div class="cert-info"><p>Microsoft • Coursera</p><p>Power BI Data Analyst</p></div>
 *     </a>
 *     …
 *   </div>
 *
 * The gallery adopts what the host already has. Every panel stays the same link
 * with the same picture and the same caption, so following one is unchanged and
 * nothing here needs to know what the panels are about. The kit adds a number
 * badge, the vertical spine title and the class that keeps one panel open; the
 * opening itself is CSS (flex-grow, with :hover and :focus-within as fallbacks),
 * so the row still opens if this file never runs.
 *
 * What the kit does own is the decision of *which* panel is open: hover sets it,
 * focus sets it, and it is remembered as an index rather than a node, so a host
 * that repaints its cards does not leave the row pointing at a detached one.
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var galleries = [];

  function reduced() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function titleOf(panel) {
    var explicit = panel.getAttribute('data-ag-title');
    if (explicit) return explicit.trim();
    var name = panel.querySelector('[class*="cert-name"], .ag-title, h2, h3');
    return name ? name.textContent.trim() : '';
  }

  function open(state, index) {
    if (state.open === index) return;
    state.open = index;
    state.panels.forEach(function (panel, i) {
      panel.classList.toggle('is-open', i === index);
    });
    state.root.setAttribute('data-ag-open', String(index));
  }

  function attach(root) {
    if (!root || root.dataset.agReady) return null;
    var panels = Array.prototype.filter.call(root.children, function (el) {
      return el.nodeType === 1 && !/^(SCRIPT|STYLE|TEMPLATE)$/.test(el.tagName);
    });
    if (panels.length < 2) return null;
    root.dataset.agReady = '1';
    root.classList.add('ag-gallery');

    var state = { root: root, panels: panels, open: -1 };

    panels.forEach(function (panel, i) {
      panel.classList.add('ag-panel');

      var num = doc.createElement('span');
      num.className = 'ag-num';
      num.textContent = ('0' + (i + 1)).slice(-2);
      num.setAttribute('aria-hidden', 'true');
      panel.appendChild(num);

      // The title is already in the caption, so the spine and the badge are
      // decoration for a sighted glance and stay out of the accessible name.
      var spine = doc.createElement('span');
      spine.className = 'ag-spine';
      spine.setAttribute('aria-hidden', 'true');
      spine.textContent = titleOf(panel);
      panel.appendChild(spine);

      panel.addEventListener('pointerenter', function () { open(state, i); });
      panel.addEventListener('focusin', function () { open(state, i); });
      // Touch has no pointerenter before the tap, and a click on a link is a
      // navigation: opening first would only be seen after the page changed.
      panel.addEventListener('click', function () { open(state, i); });
    });

    root.addEventListener('keydown', function (ev) {
      var key = ev.key;
      if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') return;
      var from = state.panels.indexOf(doc.activeElement);
      if (from < 0) return;
      var to;
      if (key === 'Home') to = 0;
      else if (key === 'End') to = state.panels.length - 1;
      else to = from + (key === 'ArrowRight' ? 1 : -1);
      if (to < 0) to = state.panels.length - 1;
      if (to >= state.panels.length) to = 0;
      ev.preventDefault();
      state.panels[to].focus();
    });

    // One panel is always open: a row of equal slices is a texture, not a
    // gallery, and the host's first card is the one it already leads with.
    var start = parseInt(root.getAttribute('data-ag-open'), 10);
    if (!isFinite(start) || start < 0 || start >= panels.length) start = 0;
    open(state, start);

    galleries.push(state);
    return state;
  }

  function scan(root) {
    for (var i = galleries.length - 1; i >= 0; i--) {
      if (doc.contains(galleries[i].root)) continue;
      galleries.splice(i, 1);
    }
    var list = root.matches && root.matches('[data-accordion-gallery]') ? [root] : [];
    if (root.querySelectorAll) list = list.concat(Array.prototype.slice.call(root.querySelectorAll('[data-accordion-gallery]')));
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

  global.AccordionGallery = {
    attach: attach,
    refresh: function () { scan(doc.body); },
    openIndex: function (root) {
      var state = galleries.filter(function (g) { return g.root === root; })[0];
      return state ? state.open : -1;
    },
    reduced: reduced,
  };
})(window);
