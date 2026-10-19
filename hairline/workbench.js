/* Workbench — the projects as artifacts on a desk.
 *
 * The tiles are read from the project tabs and their own panel tags, so the
 * figure cannot name a project the page does not list. Pointing at a tile raises
 * it and reads the project and its stack; the project tab list and the generated
 * project pages remain the accessible path.
 *
 * Wrapped in an IIFE: the engine's figures are written at top level, and two of
 * them on one page would collide on their destructured names.
 */
(function () {
const {
  Cam, facing, fit, hull, open, poly, proj, rrect, ringAt, run,
  spring, stepS, register, disposer, mk, pointer,
} = HL;

const TILE_Z0 = 1.8, TILE_Z1 = 4.8, LIFT = 4;
const HW = 11, HD = 8;
const POS = [
  [-36, -12], [-12, -16], [12, -10], [36, -14],
  [-36, 12], [-12, 8], [12, 14], [36, 10],
];

/** A rounded box, drawn from its foot and top rings. */
function boxAt(parent, P, front, cx, cy, hw, hd, z0, z1, r) {
  const foot = rrect(cx - hw, cy - hd, cx + hw, cy + hd, r, 6);
  const top = rrect(cx - hw + 0.8, cy - hd + 0.8, cx + hw - 0.8, cy + hd - 0.8, Math.max(0.6, r - 0.8), 6);
  const g = mk('g', {}, parent);
  const sil = mk('path', { d: poly(hull(ringAt(P, foot, z0).concat(ringAt(P, top, z1)))), class: 'sil' }, g);
  const cr = mk('path', { d: open(ringAt(P, run(top, front), z1)), class: 'nf lo' }, g);
  return { g, sil, cr, foot, top };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();

  const C = Cam(45, 0.5, 2.55);
  fit(C, [[-54, -34, 0], [54, 34, 0], [-54, -34, 12], [54, 34, 12]], 200, 164);
  const P = proj(C), front = facing(C);
  const root = mk('g', {}, svg);

  let items = [];
  let tiles = [];
  let selected = -1;
  let signature = null;
  let board = null;

  function readDefault() {
    const n = items.length;
    read.textContent = n ? `${n} projects on the desk` : 'No projects on the desk';
    stage.setAttribute(
      'aria-label',
      n
        ? `${n} project artifacts on a workbench. Point at a tile to read the project and its stack.`
        : 'No projects are listed.',
    );
  }

  function drawTile(tile, z) {
    tile.sil.setAttribute('d', poly(hull(ringAt(P, tile.foot, TILE_Z0).concat(ringAt(P, tile.top, z)))));
    tile.cr.setAttribute('d', open(ringAt(P, run(tile.top, front), z)));
  }

  function build() {
    if (board) {
      bag.add(board.unregister);
      board = null;
    }
    root.replaceChildren();
    selected = -1;

    const desk = boxAt(root, P, front, 0, 0, 50, 38, 0, TILE_Z0, 6);
    tiles = items.slice(0, POS.length).map((item, i) => {
      const [cx, cy] = POS[i];
      const box = boxAt(root, P, front, cx, cy, HW, HD, TILE_Z0, TILE_Z1, 2);
      const sp = spring(0, { k: 150, c: 20 });
      const tile = { item, i, cx, cy, sil: box.sil, cr: box.cr, foot: box.foot, top: box.top, sp, lastZ: -1 };
      drawTile(tile, TILE_Z1);
      tile.lastZ = TILE_Z1;
      return tile;
    });

    const order = [{ key: -100, g: desk.g }, ...tiles.map((t) => ({ key: t.cx + t.cy, g: t.sil.parentNode }))];
    order.sort((a, b) => a.key - b.key).forEach((o) => root.appendChild(o.g));

    board = register(stage, (dt) => {
      let moving = false;
      for (const tile of tiles) {
        if (stepS(tile.sp, dt)) moving = true;
        const z = TILE_Z1 + tile.sp.x * LIFT;
        if (Math.abs(z - tile.lastZ) > 0.02) {
          tile.lastZ = z;
          drawTile(tile, z);
        }
      }
      return moving;
    });
    bag.add(board.unregister);
    bag.add(() => { board = null; });

    readDefault();
  }

  function highlight(i) {
    if (i === selected) return;
    selected = i;
    tiles.forEach((tile, k) => {
      tile.sp.t = k === i ? 1 : 0;
      tile.sil.setAttribute('class', k === i ? 'sil hi' : 'sil');
    });
    if (board) board.wake();
    if (i < 0) {
      readDefault();
      return;
    }
    const item = tiles[i].item;
    read.textContent = item.tags ? `${item.title} · ${item.tags}` : item.title;
  }

  function pick(pt) {
    const [u, v] = HL.unproj(C, pt[0], pt[1], TILE_Z1 + LIFT);
    let best = -1, distance = Infinity;
    tiles.forEach((tile, i) => {
      const d = Math.hypot(u - tile.cx, (v - tile.cy) * 1.2);
      if (d < distance && Math.abs(u - tile.cx) <= HW + 2 && Math.abs(v - tile.cy) <= HD + 2) {
        distance = d;
        best = i;
      }
    });
    return best;
  }

  function set(next) {
    const list = (Array.isArray(next) ? next : []).map((x) => ({
      title: String(x && x.title ? x.title : ''),
      tags: String(x && x.tags ? x.tags : ''),
    }));
    const sig = list.map((x) => `${x.title}:${x.tags}`).join('|');
    if (sig === signature) return;
    signature = sig;
    items = list;
    build();
  }

  bag.add(pointer(stage, {
    move: (p) => highlight(pick(p)),
    down: (p) => highlight(pick(p)),
    leave: () => highlight(-1),
  }));
  bag.add(() => svg.replaceChildren());

  set(value);
  return { set, destroy: bag.dispose };
}

hairline({
  name: 'workbench',
  means: 'Project artifacts on a workbench; point at a tile to read the project and its stack.',
  rules: [1, 4, 6, 8],
  range: [0, 8, 1],
  tour: [[150, 140], [200, 120], [260, 170], [310, 200], null],
  mount,
});

/** Read the tabs and their own panel tags; no second project manifest. */
function projectItems() {
  return Array.from(document.querySelectorAll('#spotIndex .spot-item')).slice(0, 8).map((tab) => {
    const title = (tab.querySelector('.si-title') || {}).textContent || '';
    const panel = document.getElementById(tab.getAttribute('aria-controls') || '');
    const tags = panel
      ? Array.from(panel.querySelectorAll('.ptag')).slice(0, 2).map((t) => t.textContent.trim()).join(' · ')
      : '';
    return { title: title.trim(), tags };
  }).filter((x) => x.title);
}

let handle = null;
function mountFromPage() {
  const host = document.getElementById('project-workbench');
  if (!host || !window.mountHairline) return;
  const items = projectItems();
  if (!handle) handle = window.mountHairline('project-workbench', items);
  else if (handle.set) handle.set(items);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountFromPage);
else mountFromPage();
})();
