// Bulk delete from the Sims list: Select, pick two, Delete, confirm.
// Bulk delete from the Sims list & Storylines (Nov 2026): list/cards/board, filters, storyline page, secrets, feelings, Content tab, Sim card.
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
const fs = require('fs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const SID = '44444444-4444-4444-8444-444444444444';
const OUT = process.env.SHOTS || '/tmp/loreshots';
fs.mkdirSync(OUT, { recursive: true });
const seed = (st) => {
  const now = new Date().toISOString();
  const data = { name: 'Lore Save', color: '#B83C76', packs: [], secretLots: [], today: 14, calendar: { seasonLength: 14, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: { storylines: true, rotation: true } };
  st.saves[SID] = { id: SID, data, edited_at: now, deleted_at: null, created_at: now };
  const rec = (id, kind, d) => ({ id, save_id: SID, kind, data: d, edited_at: now, deleted_at: null, created_at: now });
  const sim = (id, first, h) => rec(id, 'sim', { first, last: 'Test', bornDay: -9000, householdId: h, traits: [] });
  st.records[SID] = {
    h1: rec('h1', 'household', { name: 'Priestley', home: null, notes: '' }),
    h2: rec('h2', 'household', { name: 'Adebayo', home: null, notes: '' }),
    kai: sim('kai', 'Kai', 'h1'), qu: sim('qu', 'Quentin', 'h1'), sh: sim('sh', 'Shanae', 'h2'), co: sim('co', 'Corey', null), ki: sim('ki', 'Kiana', null),
    s1: rec('s1', 'storyline', { name: 'Hookah bar night', status: 'hot', cast: ['kai', 'qu', 'sh'], pinned: true, tags: ['Drama'], notes: '', questions: [{ text: 'Who does Kiana want?', done: false }] }),
    s2: rec('s2', 'storyline', { name: 'Who does Quentin like?', status: 'brewing', cast: ['qu', 'sh'], pinned: false, tags: [], notes: '', questions: [] }),
    s3: rec('s3', 'storyline', { name: 'Move-in weekend', status: 'resolved', cast: ['kai', 'qu'], pinned: false, tags: ['Home'], notes: '', questions: [] }),
    b1: rec('b1', 'beat', { storyline: 's1', text: 'Corey and Kiana showed up at the door.', sims: ['co', 'ki', 'kai'], day: 14, video: true, secret: false, addedAt: '2026-11-07T12:00:00Z' }),
    b2: rec('b2', 'beat', { storyline: 's1', text: 'Hookah bar with Shanae.', sims: ['kai', 'qu', 'sh'], day: 13, video: true, secret: true, addedAt: '2026-11-07T11:00:00Z' }),
    b3: rec('b3', 'beat', { storyline: 's2', text: 'Quentin kept staring.', sims: ['qu'], day: 13, video: false, secret: false, addedAt: '2026-11-07T11:30:00Z' }),
    k1: rec('k1', 'secret', { title: 'Quentin likes Shanae', storyline: 's1', out: false, cast: ['kai', 'qu', 'sh'], knows: { qu: 'knows', sh: 'guess' } }),
    f1: rec('f1', 'feeling', { from: 'ki', to: 'kai', word: 'Into him', why: 'Since the door', kind: 'crush' }),
    f2: rec('f2', 'feeling', { from: 'kai', to: 'qu', word: 'Best friends', why: '', kind: 'close' }),
  };
};
(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['wide', 1440, 900], ['phone', 390, 844]]) {
    const st = newState(); seed(st);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', deviceScaleFactor: 1.5 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
    const url = (x) => `http://localhost:4173/#/s/${SID}/${x}`;
    await p.goto(url('sims')); await p.waitForTimeout(900);
    await p.getByRole('button', { name: /Select/ }).first().click(); await p.waitForTimeout(300);
    for (const nm of ['Corey', 'Kiana']) await (n === 'phone' ? p.locator('.sim-mrow', { hasText: nm }) : p.locator('tbody tr', { hasText: nm }).locator('input[type=checkbox]')).first().click();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/${n}-select-bar.png` });
    await p.getByRole('button', { name: /^Delete$/ }).click(); await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/${n}-delete-confirm.png` });
    await p.locator('.confirm-actions').getByRole('button', { name: 'Delete' }).click(); await p.waitForTimeout(600);
    const live = Object.values(st.records[SID]).filter((r) => r.kind === 'sim' && !r.deleted_at).length;
    const trashed = Object.values(st.records[SID]).filter((r) => r.kind === 'sim' && r.deleted_at).length;
    ok(live === 3 && trashed === 2, `${n} bulk delete moves the 2 picked Sims to Trash (live ${live}, trashed ${trashed})`);
    ok(errs.length === 0, `${n} no page errors`);
    await ctx.close();
  }
  await b.close();
  console.log(`testbulk: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
