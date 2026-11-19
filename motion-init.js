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
 *
 * Second job: flip the below-fold component stylesheets from print media to
 * all once the document is parsed. They download in parallel without blocking
 * first paint (the hero needs only style.css + gooey-nav.css), and an inline
 * onload handler would break the strict CSP - so the flip lives here, in a
 * same-origin file, on DOMContentLoaded. A scriptless visit never runs this
 * file and keeps the noscript copies instead.
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

  var flipAsyncCss = function () {
    var sheets = document.querySelectorAll('link[data-async-css]');
    for (var i = 0; i < sheets.length; i++) sheets[i].media = 'all';
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', flipAsyncCss);
  } else {
    flipAsyncCss();
  }
})();
