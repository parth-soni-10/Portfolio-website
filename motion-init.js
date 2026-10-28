/* ---------------------------------------------------------------------------
 * The motion preference, decided before first paint.
 *
 * The site honours the operating system's reduce-motion setting in CSS and in
 * script.js. The footer's switch lets a visitor ask for the same calm page on a
 * device whose OS has no opinion, so the choice has to survive a reload - and a
 * choice that arrives after the hero has already risen is not the calm page.
 * Kept as its own same-origin file (not an inline <script>) so the strict CSP
 * keeps holding, and loaded in the head so no animation starts first.
 *
 * One attribute is the whole state: <html data-motion="reduce">. style.css
 * reads it, script.js reads it live, and squish-switch.js only paints the
 * control. A stored choice wins over the OS; with no stored choice the OS is
 * the default.
 * ------------------------------------------------------------------------ */
(function () {
  var KEY = 'ps-motion';
  var stored = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch (e) {
    /* private mode: fall through to the OS */
  }
  var decided = stored === 'reduce' || stored === 'auto';
  var system = false;
  try {
    system = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    /* no matchMedia: the page simply starts with motion on */
  }
  var reduce = decided ? stored === 'reduce' : system;
  document.documentElement.dataset.motion = reduce ? 'reduce' : 'auto';
})();
