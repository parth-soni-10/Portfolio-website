// ── TYPEWRITER ────────────────────────────────────────────
const roles = ['Data Analyst','SQL Wizard','BI Developer','F1 Enthusiast','Storyteller','Dashboard Builder','Insights Analyst'];
let ri = 0, ci = 0, del = false;
const tw = document.getElementById('tw');
const cur = document.getElementById('cur');

setInterval(() => cur.style.opacity = cur.style.opacity === '0' ? '1' : '0', 520);

function tick() {
  const w = roles[ri];
  if (!del) {
    tw.textContent = w.slice(0, ++ci);
    if (ci === w.length) { del = true; setTimeout(tick, 1900); return; }
  } else {
    tw.textContent = w.slice(0, --ci);
    if (ci === 0) { del = false; ri = (ri + 1) % roles.length; }
  }
  setTimeout(tick, del ? 42 : 75);
}
tick();

// ── THEME TOGGLE ──────────────────────────────────────────
const root = document.documentElement;
const btn  = document.getElementById('themeBtn');
const moon = document.getElementById('iconMoon');
const sun  = document.getElementById('iconSun');

const saved = localStorage.getItem('theme') || 'dark';
setTheme(saved);

btn.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  setTheme(next);
  localStorage.setItem('theme', next);
});

function setTheme(t) {
  root.setAttribute('data-theme', t);
  moon.style.display = t === 'dark' ? 'block' : 'none';
  sun.style.display  = t === 'light' ? 'block' : 'none';
}
