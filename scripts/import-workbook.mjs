// Turns the simdesk-game-data workbook into the JSON files the app loads from public/game-data.
// Usage: npm run import-workbook -- path/to/simdesk-game-data.xlsx
// Updating game data (new packs, traits, lots) is a data change: re-run this, no code changes.
//
// It reads tabs by name (Packs, Life stages, Traits, Aspirations, Occult types, Holiday traditions,
// Worlds, Neighborhoods, Secret areas, Lots, Lot types) and is forgiving about column headers.

import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run import-workbook -- path/to/simdesk-game-data.xlsx');
  process.exit(1);
}
const outDir = path.resolve('public/game-data');
const wb = XLSX.readFile(file);

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function sheet(...names) {
  const wanted = names.map(norm);
  const hit = wb.SheetNames.find((n) => wanted.includes(norm(n)));
  if (!hit) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[hit], { defval: '' });
}

/** Pick a value from a row by any of several header spellings. */
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

const written = {};
function write(name, rows) {
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(rows, null, 1));
  written[name] = rows.length;
}

// ---- Packs (everything else is tagged with a pack name; we map names → ids) ----
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
const packs = packRows
  .map((r) => {
    const name = pick(r, 'pack name', 'name', 'pack');
    const type = typeOf(pick(r, 'type', 'pack type'));
    return name && {
      id: type === 'base' ? 'base-game' : slug(name),
      name: type === 'base' ? 'Base Game' : name,
      type,
      code: String(pick(r, 'code', 'ea code', 'internal code', 'pack code')), // matching only, never shown
      year: num(pick(r, 'release year', 'year', 'released')),
      world: pick(r, 'world added', 'world', 'worlds'),
    };
  })
  .filter(Boolean);
if (!packs.some((p) => p.type === 'base')) packs.unshift({ id: 'base-game', name: 'Base Game', type: 'base', code: 'BG' });
const packByKey = new Map();
for (const p of packs) {
  packByKey.set(norm(p.name), p.id);
  if (p.code) packByKey.set(norm(p.code), p.id);
}
packByKey.set('base', 'base-game');
packByKey.set('basegame', packs.find((p) => p.type === 'base').id);
const unknownPacks = new Set();
const packId = (raw) => {
  // "Base Game / Life & Death" means it starts in the first pack
  const v = String(raw ?? '').split('/')[0].trim();
  if (!v) return packs.find((p) => p.type === 'base').id;
  const id = packByKey.get(norm(v));
  if (!id) unknownPacks.add(v);
  return id ?? slug(v);
};
if (packRows.length) write('packs', packs);

// ---- Life stages ----
const stageIds = {
  newborn: 'newborn', baby: 'newborn', infant: 'infant', toddler: 'toddler', child: 'child', teen: 'teen',
  youngadult: 'youngAdult', ya: 'youngAdult', adult: 'adult', elder: 'elder',
};
const stages = (sheet('Life stages', 'Lifestages', 'Life stage') ?? [])
  .map((r) => {
    const name = pick(r, 'life stage', 'stage', 'name');
    const id = stageIds[norm(name)];
    return id && {
      id, name,
      short: num(pick(r, 'short (days)', 'short', 'short days')),
      normal: num(pick(r, 'normal (days)', 'normal', 'normal days')),
      long: num(pick(r, 'long (days)', 'long', 'long days')),
      notes: pick(r, 'notes'),
    };
  })
  .filter(Boolean);
if (stages.length) write('life-stages', stages);

// ---- Simple tagged lists ----
function list(name, tabs, extra) {
  const rows = sheet(...tabs);
  if (!rows) return;
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const n = pick(r, 'name', 'trait name', 'trait', 'aspiration name', 'aspiration', 'occult type', 'occult', 'tradition', 'world', 'area', 'secret area', 'lot type');
    if (!n) continue;
    let id = slug(n);
    while (seen.has(id)) id += '-2';
    seen.add(id);
    out.push({ id, name: n, pack: packId(pick(r, 'pack')), ...extra(r) });
  }
  write(name, out);
}

list('traits', ['Traits'], (r) => ({
  category: pick(r, 'category', 'type'), ages: pick(r, 'ages', 'age', 'life stages'), notes: pick(r, 'notes'),
}));
list('aspirations', ['Aspirations'], (r) => ({
  category: pick(r, 'category'), ages: pick(r, 'ages', 'age'), rewardTrait: pick(r, 'reward trait', 'reward'), notes: pick(r, 'notes'),
}));
list('occults', ['Occult types', 'Occults'], (r) => ({
  playableInCAS: bool(pick(r, 'playable in cas', 'cas')), otherWays: pick(r, 'other ways to become one', 'other ways'),
  inherited: bool(pick(r, 'inherited by children', 'inherited')), powers: pick(r, 'ranks or powers', 'powers'), notes: pick(r, 'notes'),
}));
list('traditions', ['Holiday traditions', 'Traditions'], (r) => ({ howTo: pick(r, 'how to take part', 'how', 'notes') }));
list('worlds', ['Worlds'], (r) => ({ type: pick(r, 'world type', 'type'), notes: pick(r, 'notes') }));
list('secret-areas', ['Secret areas'], (r) => ({ notes: pick(r, 'notes') }));
list('lot-types', ['Lot types'], (r) => {
  const g = norm(pick(r, 'group', 'kind', 'category'));
  return { kind: g.startsWith('resid') ? 'residential' : g.startsWith('special') ? 'special' : 'community' };
});

// Neighborhoods and lots need their world's id.
const worlds = JSON.parse(fs.readFileSync(path.join(outDir, 'worlds.json'), 'utf8'));
const worldId = (v) => worlds.find((w) => norm(w.name) === norm(v))?.id ?? slug(v);

const hoods = sheet('Neighborhoods');
if (hoods) {
  write('neighborhoods', hoods
    .map((r) => {
      const name = pick(r, 'neighborhood', 'name');
      const world = worldId(pick(r, 'world'));
      return name && { id: `${world}--${slug(name)}`, world, name, pack: packId(pick(r, 'pack')), lotCount: num(pick(r, 'lots (rough count)', 'rough lot count', 'lot count', 'lots')) };
    })
    .filter(Boolean));
}

const lots = sheet('Lots');
if (lots) {
  const seen = new Set();
  write('lots', lots
    .map((r) => {
      const name = pick(r, 'lot', 'lot name', 'name');
      if (!name) return null;
      const world = worldId(pick(r, 'world'));
      let id = `${world}--${slug(name)}`;
      while (seen.has(id)) id += '-2';
      seen.add(id);
      return {
        id, name, world,
        neighborhood: pick(r, 'neighborhood'),
        size: String(pick(r, 'size', 'lot size')).replace(/\s*[x×]\s*/i, 'x'),
        lotType: pick(r, 'default lot type', 'lot type', 'type'),
        // keep the neighborhood name exactly as the Neighborhoods tab spells it
        pack: packId(pick(r, 'pack')),
      };
    })
    .filter(Boolean));
}

fs.writeFileSync(path.join(outDir, '_about.json'), JSON.stringify({ source: path.basename(file), importedAt: new Date().toISOString() }, null, 1));

console.log('Imported:', written);
if (unknownPacks.size) console.warn('Pack names not found in the Packs tab (check spelling):', [...unknownPacks]);
const missing = ['Packs', 'Life stages', 'Traits', 'Aspirations', 'Occult types', 'Holiday traditions', 'Worlds', 'Neighborhoods', 'Secret areas', 'Lots', 'Lot types']
  .filter((t) => !wb.SheetNames.some((n) => norm(n) === norm(t)));
if (missing.length) console.warn('Tabs not found (kept the existing JSON for these):', missing, '\nTabs in your file:', wb.SheetNames);
