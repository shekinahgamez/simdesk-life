// Turns the game-data workbook into the JSON files built into the app (src/data/game/).
// Usage: npm run import-workbook                     (uses game-data/simdesk-game-data.xlsx)
//        npm run import-workbook -- main.xlsx new-pack.xlsx ...
// The main workbook always goes first. Extra files (made from game-data/new-pack-template.xlsx) are
// added on top: rows from tabs with the same name are combined, "Example Pack" rows are skipped.
// game-data/fixes.json is applied last (owner-approved corrections).
//
// Safety rules (v1 could wipe data):
//  - A tab with no real rows never replaces a list; the old file is kept and you get a warning.
//  - A world or neighborhood name that doesn't match the Worlds / Neighborhoods tabs is listed as a
//    warning instead of quietly making a new one.
//  - Nothing is written if the Packs tab is missing or empty.

import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const args = process.argv.slice(2);
const files = args.length ? args : ['game-data/simdesk-game-data.xlsx'];
const outDir = path.resolve('src/data/game');
const fixes = JSON.parse(fs.readFileSync(path.resolve('game-data/fixes.json'), 'utf8'));
const books = files.map((f) => XLSX.readFile(f));
const allSheetNames = [...new Set(books.flatMap((b) => b.SheetNames))];
const warnings = [];

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = (s) => String(s ?? '').toLowerCase().replace(/&/g, 'and').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const isExample = (row) => Object.entries(row).some(([k, v]) => norm(k).includes('pack') && norm(v) === 'examplepack');

/** Rows of a tab across every file (example rows removed). null when no file has the tab. */
function sheet(...names) {
  const wanted = names.map(norm);
  let rows = null;
  for (const b of books) {
    const hit = b.SheetNames.find((n) => wanted.includes(norm(n)));
    if (!hit) continue;
    rows = (rows ?? []).concat(XLSX.utils.sheet_to_json(b.Sheets[hit], { defval: '' }).filter((r) => !isExample(r)));
  }
  return rows;
}
function pick(row, ...keys) {
  const map = Object.fromEntries(Object.entries(row).map(([k, v]) => [norm(k), v]));
  for (const k of keys) {
    const v = map[norm(k)];
    if (v !== undefined && v !== '') return typeof v === 'string' ? v.trim() : v;
  }
  return '';
}
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? undefined : Number(v));
const bool = (v) => /^(y|yes|true|1|x)$/i.test(String(v).trim());
const cleanSize = (v) => {
  const s = String(v ?? '').trim().replace(/\s*[x×]\s*/i, 'x');
  return /^\d+x\d+$/.test(s) || /floor apartment$/i.test(s) ? s : '';
};

const written = {};
const kept = [];
function write(name, rows, tab) {
  if (!rows || rows.length === 0) {
    if (tab) kept.push(tab);
    return false;
  }
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(rows, null, 1) + '\n');
  written[name] = rows.length;
  return true;
}

// ---- Packs ----
const packRows = sheet('Packs') ?? [];
const typeOf = (t) => {
  const s = norm(t);
  if (s.includes('expansion') || s === 'ep') return 'expansion';
  if (s.includes('game') || s === 'gp') return 'game';
  if (s.includes('stuff') || s === 'sp') return 'stuff';
  if (s.includes('kit')) return 'kit';
  if (s.includes('base')) return 'base';
  if (s.includes('free') || s.includes('event')) return 'free';
  return s || 'other';
};
const packs = packRows.map((r) => {
  const name = pick(r, 'pack name', 'name', 'pack');
  const type = typeOf(pick(r, 'type', 'pack type'));
  return name && {
    id: type === 'base' ? 'base-game' : slug(name),
    name: type === 'base' ? 'Base Game' : name,
    type,
    year: num(pick(r, 'release year', 'year', 'released')),
    world: pick(r, 'world added', 'world', 'worlds'),
  };
}).filter(Boolean);
if (packs.length === 0) {
  console.error('Stopped: the Packs tab is missing or empty, so nothing was changed. Put the main workbook first.');
  process.exit(1);
}
if (!packs.some((p) => p.type === 'base')) packs.unshift({ id: 'base-game', name: 'Base Game', type: 'base' });
const packByKey = new Map();
for (const r of packRows) {
  const name = pick(r, 'pack name', 'name', 'pack');
  const p = packs.find((x) => x.name === name || (x.type === 'base' && typeOf(pick(r, 'type')) === 'base'));
  const code = pick(r, 'code', 'pack code', 'ea code', 'internal code');
  if (p && code) packByKey.set(norm(code), p.id); // codes only help matching; never shown
}
for (const p of packs) packByKey.set(norm(p.name), p.id);
packByKey.set('base', 'base-game');
packByKey.set('basegame', 'base-game');
const unknownPacks = new Set();
const packId = (raw) => {
  const v = String(raw ?? '').split('/')[0].trim(); // "Base Game / Life & Death" starts in the first pack
  if (!v) return 'base-game';
  const id = packByKey.get(norm(v));
  if (!id) unknownPacks.add(v);
  return id ?? slug(v);
};
write('packs', packs, 'Packs');

// ---- Life stages ----
const stageIds = { newborn: 'newborn', baby: 'newborn', infant: 'infant', toddler: 'toddler', child: 'child', teen: 'teen', youngadult: 'youngAdult', ya: 'youngAdult', adult: 'adult', elder: 'elder' };
const stages = (sheet('Life stages', 'Lifestages', 'Life stage') ?? []).map((r) => {
  const name = pick(r, 'life stage', 'stage', 'name');
  const id = stageIds[norm(name)];
  return id && { id, name, short: num(pick(r, 'short (days)', 'short')), normal: num(pick(r, 'normal (days)', 'normal')), long: num(pick(r, 'long (days)', 'long')), notes: pick(r, 'notes') };
}).filter(Boolean);
if (stages.length && stages.length !== 8) warnings.push(`Life stages tab has ${stages.length} stages, expected 8. Kept the old file.`);
else write('life-stages', stages, 'Life stages');

// ---- Simple lists ----
function list(name, tabs, extra, change) {
  const rows = sheet(...tabs);
  if (!rows) return kept.push(tabs[0]);
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const n = pick(r, 'name', 'trait name', 'trait', 'aspiration name', 'aspiration', 'occult type', 'occult', 'tradition', 'world', 'area', 'secret area', 'lot type');
    if (!n) continue;
    let id = slug(n);
    while (seen.has(id)) id += '-2';
    seen.add(id);
    const row = { id, name: n, pack: packId(pick(r, 'pack')), ...extra(r) };
    out.push(change ? change(row) : row);
  }
  write(name, out, tabs[0]);
}
const aspChanges = new Map(fixes.aspirationChanges.map((c) => [norm(c.name), c]));
list('traits', ['Traits'], (r) => ({ category: pick(r, 'category', 'type'), ages: pick(r, 'ages', 'age', 'life stages'), notes: pick(r, 'notes') }));
list('aspirations', ['Aspirations'], (r) => ({ category: pick(r, 'category'), ages: pick(r, 'ages', 'age'), rewardTrait: pick(r, 'reward trait', 'reward'), notes: pick(r, 'notes') }),
  (row) => { const c = aspChanges.get(norm(row.name)); if (!c) return row; const { name, ...rest } = c; return { ...row, ...rest }; });
list('occults', ['Occult types', 'Occults'], (r) => ({ playableInCAS: bool(pick(r, 'playable in cas', 'cas')), otherWays: pick(r, 'other ways to become one', 'other ways'), inherited: bool(pick(r, 'inherited by children', 'inherited')), powers: pick(r, 'ranks or powers', 'powers'), notes: pick(r, 'notes') }));
list('traditions', ['Holiday traditions', 'Traditions'], (r) => ({ howTo: pick(r, 'how to take part', 'how', 'notes') }));
list('worlds', ['Worlds'], (r) => ({ type: pick(r, 'world type', 'type'), notes: pick(r, 'notes') }));
list('secret-areas', ['Secret areas'], (r) => ({ notes: pick(r, 'notes') }));
list('lot-types', ['Lot types'], (r) => {
  const g = norm(pick(r, 'group', 'kind', 'category'));
  return { kind: g.startsWith('resid') ? 'residential' : g.startsWith('special') ? 'special' : 'community' };
});

// ---- Neighborhoods and lots (need world ids) ----
const worlds = JSON.parse(fs.readFileSync(path.join(outDir, 'worlds.json'), 'utf8'));
const badWorlds = new Set();
const worldId = (v) => {
  const w = worlds.find((x) => norm(x.name) === norm(v));
  if (!w) badWorlds.add(String(v));
  return w?.id ?? slug(v);
};

const hoodRows = sheet('Neighborhoods');
let hoods = null;
if (hoodRows) {
  hoods = hoodRows.map((r) => {
    const name = pick(r, 'neighborhood', 'name');
    const world = worldId(pick(r, 'world'));
    return name && { id: `${world}--${slug(name)}`, world, name, pack: packId(pick(r, 'pack')) };
  }).filter(Boolean);
  if (!write('neighborhoods', hoods, 'Neighborhoods')) hoods = null;
}
hoods ??= JSON.parse(fs.readFileSync(path.join(outDir, 'neighborhoods.json'), 'utf8'));

const LOCKED = new Set(fixes.lockedLotTypes.map(norm));
const NAME_FIX = new Map(Object.entries(fixes.lotNameFixes).map(([k, v]) => [norm(k), v]));
const SECRET_TYPES = new Set(['secretlot', 'secretlab', 'themagicrealm']);
const CAREER_TYPES = new Set(['hospital', 'policestation', 'futuresimlabs', 'actingstudio']);
const badHoods = new Set();

function makeLot({ name, world, hood, size, type, pack, secret, locked, note }) {
  const career = CAREER_TYPES.has(norm(type));
  const isSecret = secret || SECRET_TYPES.has(norm(type)) || norm(name) === 'sixam' || (norm(hood) === 'hiddenlot' && !career);
  const w = worlds.find((x) => x.id === world);
  let neighborhood = norm(hood) === 'secretarea' ? (w?.name ?? hood) : hood;
  if (isSecret && (norm(hood) === 'hiddenlot' || !hood)) neighborhood = 'Secret lots';
  else if (career) neighborhood = 'Career buildings';
  else if (neighborhood && !hoods.some((h) => h.world === world && norm(h.name) === norm(neighborhood)) && norm(neighborhood) !== norm(w?.name)) {
    badHoods.add(`${neighborhood} (${w?.name ?? world})`);
  }
  // Only lots the game won't let you change keep their lot type. Everything else is a blank slate.
  const isLocked = locked || isSecret || LOCKED.has(norm(type));
  return {
    name, world, neighborhood, size: cleanSize(size), pack,
    ...(isLocked ? { locked: true } : {}),
    ...(isLocked && type ? { lotType: type } : {}),
    ...(isSecret ? { secret: true } : {}),
    ...(note ? { note } : {}),
  };
}

const lotRows = sheet('Lots');
if (lotRows) {
  const lots = lotRows.map((r) => {
    const raw = pick(r, 'lot', 'lot name', 'name');
    if (!raw) return null;
    return makeLot({
      name: NAME_FIX.get(norm(raw)) ?? raw,
      world: worldId(pick(r, 'world')), hood: pick(r, 'neighborhood'), size: pick(r, 'size', 'lot size'),
      type: pick(r, 'default lot type', 'lot type', 'type'), pack: packId(pick(r, 'pack')),
    });
  }).filter(Boolean);
  for (const x of fixes.extraLots) {
    const world = worldId(x.world);
    if (lots.some((l) => l.world === world && norm(l.name) === norm(x.name))) continue;
    lots.push(makeLot({ name: x.name, world, hood: x.neighborhood, size: x.size, type: x.lotType, pack: packId(x.pack), secret: x.secret, locked: x.locked, note: x.note }));
  }
  for (const c of fixes.lotChanges) {
    const l = lots.find((y) => y.world === worldId(c.world) && norm(y.name) === norm(c.name));
    if (!l) { warnings.push(`fixes.json: lot "${c.name}" in ${c.world} wasn't found.`); continue; }
    if (c.neighborhood) l.neighborhood = c.neighborhood;
    if (c.size) l.size = cleanSize(c.size);
  }
  const seen = new Set();
  for (const l of lots) {
    let id = `${l.world}--${slug(l.name)}`;
    while (seen.has(id)) id += '-2';
    seen.add(id);
    l.id = id;
  }
  write('lots', lots.map(({ id, ...rest }) => ({ id, ...rest })), 'Lots');
}

fs.writeFileSync(path.join(outDir, '_about.json'), JSON.stringify({ source: files.map((f) => path.basename(f)).join(' + ') + ' + fixes.json', importedAt: new Date().toISOString() }, null, 1) + '\n');

console.log('Updated:', written);
if (kept.length) console.warn('These tabs were missing or had no rows, so the old lists were kept:', kept);
if (unknownPacks.size) console.warn('Pack names not found on the Packs tab (check spelling):', [...unknownPacks]);
if (badWorlds.size) console.warn('World names not found on the Worlds tab (check spelling):', [...badWorlds]);
if (badHoods.size) console.warn('Neighborhoods not found on the Neighborhoods tab (check spelling):', [...badHoods]);
for (const w of warnings) console.warn(w);
const missing = ['Packs', 'Life stages', 'Traits', 'Aspirations', 'Occult types', 'Holiday traditions', 'Worlds', 'Neighborhoods', 'Secret areas', 'Lots', 'Lot types']
  .filter((t) => !allSheetNames.some((n) => norm(n) === norm(t)));
if (missing.length && files.length > 0) console.warn('Tabs not in any file:', missing);
