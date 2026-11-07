/* World banners zoom out from the 400x300 tile picture to a wide view (x -150..550), so tall things like the
   Brindleton lighthouse or the Windenburg castle fit in a short banner. Scenes were drawn for 0..400, so the
   wide view stretches their edge shapes (sky, hills, water) out to the new edges. */

const EXTRA = 150;
const LEFT = -EXTRA;
const WIDE = 400 + EXTRA * 2;

/** Where the wide view starts from the top (scene units). Worlds not listed keep the tile's own crop. */
export const BANNER_TOP: Record<string, number> = {
  'willow-creek': 30, newcrest: 45, windenburg: 30, 'brindleton-bay': 25, 'forgotten-hollow': 30, sulani: 40,
  'del-sol-valley': 40, strangerville: 30, glimmerbrook: 35, britechester: 18, 'evergreen-harbor': 25,
  'mt-komorebi': 20, 'henford-on-bagley': 30, copperdale: 30, 'san-sequoia': 25, tomarang: 40,
  // oasis-springs and san-myshuno keep their original crop (she liked those better).
};

/** Scenes already drawn on the wide canvas, so their edges don't need stretching. */
const DRAWN_WIDE = new Set(['willow-creek', 'newcrest', 'britechester']);

const out = (x: string) => { const v = Number(x); return v === 0 ? String(LEFT) : v === 400 ? String(400 + EXTRA) : x; };

/** Moves a path's points on the left/right edge (x = 0 or 400) out to the wide edges. Absolute commands only. */
function widenPath(d: string): string {
  const toks = d.match(/[MLCSQTAHVZmlcsqtahvz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const res: string[] = [];
  let cmd = '';
  let i = 0;
  for (const t of toks) {
    if (/[A-Za-z]/.test(t)) { cmd = t; i = 0; res.push(t); continue; }
    let v = t;
    if (cmd === 'H') v = out(t);
    else if ('MLCSQT'.includes(cmd) && i % 2 === 0) v = out(t);
    else if (cmd === 'A' && i % 7 === 5) v = out(t);
    i++;
    res.push(v);
  }
  return res.join(' ');
}

const cache = new Map<string, string>();
function widen(id: string, svg: string): string {
  if (DRAWN_WIDE.has(id)) return svg;
  const hit = cache.get(id);
  if (hit) return hit;
  const w = svg
    .replace(/ d="([^"]*)"/g, (_m, d: string) => ` d="${widenPath(d)}"`)
    .replace(/<rect( x="0")? width="400"/g, `<rect x="${LEFT}" width="${WIDE}"`)
    .replace(/<rect x="0" y="([\d.]+)" width="400"/g, `<rect x="${LEFT}" y="$1" width="${WIDE}"`);
  cache.set(id, w);
  return w;
}

/** The banner version of a scene: its markup and the svg view to show it with. */
export function bannerScene(id: string, svg: string): { html: string; viewBox: string; fit: string } {
  const top = BANNER_TOP[id];
  if (top === undefined) return { html: svg, viewBox: '0 0 400 300', fit: 'xMidYMid slice' };
  return { html: widen(id, svg), viewBox: `${LEFT} ${top} ${WIDE} ${300 - top}`, fit: 'xMidYMin slice' };
}
