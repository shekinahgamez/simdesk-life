// Legacy (Nov 2026): list, new legacy with pasted generations, legacy page, generation page, story peek, goals, heir, households, photos tagging, storylines card.
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
const fs = require('fs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const SID = '55555555-5555-4555-8555-555555555555';
const OUT = process.env.SHOTS || '/tmp/legacyshots';
fs.mkdirSync(OUT, { recursive: true });
const until = async (p, f) => { for (let i = 0; i < 40; i++) { try { if (f()) return true; } catch {} await p.waitForTimeout(150); } return false; };
const seed = (st, off) => {
  const now = new Date().toISOString();
  const data = { name: 'Legacy Save', color: '#B83C76', packs: [], secretLots: [], today: 14, calendar: { seasonLength: 14, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: off ? {} : { legacy: true, storylines: true } };
  st.saves[SID] = { id: SID, data, edited_at: now, deleted_at: null, created_at: now };
  const rec = (id, kind, d) => ({ id, save_id: SID, kind, data: d, edited_at: now, deleted_at: null, created_at: now });
  const sim = (id, first, h) => rec(id, 'sim', { first, last: 'Reed', bornDay: -9000, householdId: h, traits: [] });
  st.records[SID] = {
    h1: rec('h1', 'household', { name: 'Reed house', home: null, notes: '' }), h2: rec('h2', 'household', { name: 'Cole apartment', home: null, notes: '' }),
    h3: rec('h3', 'household', { name: 'Brightwater flat', home: null, notes: '' }),
    mina: sim('mina', 'Mina', 'h1'), dev: sim('dev', 'Devon', 'h2'), tessa: sim('tessa', 'Tessa', null),
    big: rec('big', 'legacy', { name: 'Big Legacy', story: '', households: [], rules: [], current: '' }),
    ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => [`bg${i}`, rec(`bg${i}`, 'generation', { legacy: 'big', n: i, title: `Title ${i}`, goals: [{ text: 'x', done: i <= 8, optional: false }], heir: null, spares: [] })])),
    s1: rec('s1', 'storyline', { name: 'Mina and the lab', status: 'hot', cast: ['mina'], pinned: false, tags: [], notes: '', questions: [] }),
    k1: rec('k1', 'secret', { title: 'Devon is leaving', storyline: 's1', out: false, cast: ['dev'], knows: { dev: 'knows' } }),
  };
};
(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['wide', 1440, 900], ['phone', 390, 844]]) {
    const phone = n === 'phone';
    const st = newState(); seed(st);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', deviceScaleFactor: 1 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
    const url = (x) => `http://localhost:4173/#/s/${SID}/${x}`;
    const shot = async (name) => { await p.waitForTimeout(250); return p.screenshot({ path: `${OUT}/${n}-${name}.png`, fullPage: false }); };
    const recs = (k) => Object.values(st.records[SID]).filter((r) => r.kind === k && !r.deleted_at && r.data.legacy !== 'big' && r.id !== 'big');
    if (!phone) ok(await p.locator('nav.sidebar').getByRole('link', { name: 'Legacy' }).isVisible(), `${n} Legacy in sidebar`);
    await p.goto(url('legacy')); await p.waitForTimeout(900);
    ok(await p.getByText('Big Legacy').isVisible(), `${n} list shows the seeded legacy`);
    // new legacy
    await p.getByRole('button', { name: /New legacy/ }).first().click();
    const dlg = p.getByRole('dialog', { name: 'New legacy' });
    await dlg.getByLabel('Name').fill('Reed Legacy');
    await dlg.locator('textarea').fill('Pearl · White\n2. Ruby · Red\nJade · Green');
    ok(await dlg.getByText('3 generations').isVisible(), `${n} counts pasted generations`);
    await dlg.getByRole('button', { name: /Pick households/ }).click();
    await p.getByRole('checkbox', { name: 'Reed house' }).click(); await p.getByRole('checkbox', { name: 'Cole apartment' }).click();
    await p.getByRole('button', { name: /Done · 2 selected/ }).click();
    await shot('1-new-legacy');
    await dlg.getByRole('button', { name: 'Add legacy' }).click(); await p.waitForTimeout(800);
    ok(await until(p, () => recs('legacy').length === 1 && recs('generation').length === 3), `${n} legacy + 3 generations saved`);
    ok(/legacy\/[^/]+$/.test(p.url()), `${n} opens the new legacy`);
    ok((await p.locator('.lg-gen.cur').innerText()).includes('Pearl'), `${n} current generation is first with goals left (Gen 1)`);
    ok(await p.getByText('2 households').isVisible(), `${n} households row`);
    const lid = recs('legacy')[0].id;
    // story peek
    await p.getByRole('button', { name: /^Story/ }).click(); await p.waitForTimeout(300);
    await p.getByLabel('Story', { exact: true }).fill('The Reeds start with Harlow.'); await p.waitForTimeout(900);
    ok(await until(p, () => recs('legacy')[0].data.story === 'The Reeds start with Harlow.'), `${n} story saves`);
    await shot('2-story-peek');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok(await p.getByRole('dialog', { name: /story/ }).count() === 0, `${n} story closes`);
    // households row list
    await p.getByRole('button', { name: /2 households/ }).click(); await p.waitForTimeout(300);
    await p.getByRole('checkbox', { name: 'Brightwater flat' }).click(); await p.waitForTimeout(300);
    ok(await until(p, () => recs('legacy')[0].data.households.length === 3), `${n} add a household from the sheet`);
    await shot('3-households');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    // rules
    await p.getByLabel('Add a rule').fill('No money cheats'); await p.getByRole('button', { name: 'Add', exact: true }).click(); await p.waitForTimeout(300);
    ok(await until(p, () => recs('legacy')[0].data.rules.length === 1), `${n} rule added`);
    // add generation
    await p.getByRole('button', { name: /Add generation/ }).first().click();
    await p.getByRole('dialog', { name: 'Add generations' }).locator('textarea').fill('Onyx · Black');
    await p.getByRole('button', { name: 'Add generation', exact: true }).last().click(); await p.waitForTimeout(500);
    ok(await until(p, () => recs('generation').length === 4 && recs('generation').some((r) => r.data.n === 4)), `${n} generation 4 added`);
    await shot('4-legacy');
    // open gen 1
    await p.locator('.lg-gen.cur').click(); await p.waitForTimeout(700);
    ok(/Pearl/.test(await p.locator('h1').innerText()), `${n} generation page`);
    const gid = recs('generation').find((r) => r.data.n === 1).id;
    // goals
    await p.getByRole('button', { name: 'Add goal' }).click();
    await p.getByLabel('New goal').fill('Reach Level 10 Cooking'); await p.getByRole('button', { name: 'Add', exact: true }).click(); await p.waitForTimeout(300);
    await p.getByLabel('New goal').fill('Throw a dinner party'); await p.getByRole('button', { name: 'Optional' }).click(); await p.getByRole('button', { name: 'Add', exact: true }).click(); await p.waitForTimeout(300);
    ok(await until(p, () => st.records[SID][gid].data.goals.length === 2 && st.records[SID][gid].data.goals[1].optional), `${n} two goals, one optional`);
    await p.getByRole('checkbox', { name: 'Reach Level 10 Cooking' }).click(); await p.waitForTimeout(300);
    ok(await until(p, () => st.records[SID][gid].data.goals[0].done), `${n} goal ticks in one tap`);
    // heir and spares
    await p.getByRole('button', { name: 'Add Sim' }).click();
    await p.getByRole('checkbox', { name: /^Mina Reed/ }).click(); await p.getByRole('checkbox', { name: /^Devon Reed/ }).click();
    await p.getByRole('button', { name: 'Done', exact: true }).click(); await p.waitForTimeout(300);
    ok(await until(p, () => st.records[SID][gid].data.heir === 'mina' && st.records[SID][gid].data.spares.join() === 'dev'), `${n} first Sim is heir, next is spare`);
    ok(await p.getByText('Cole apartment').first().isVisible(), `${n} spare shows current household`);
    await p.getByRole('button', { name: /Make heir/ }).click(); await p.waitForTimeout(300);
    ok(await until(p, () => st.records[SID][gid].data.heir === 'dev' && st.records[SID][gid].data.spares.join() === 'mina'), `${n} make heir swaps`);
    // storylines card
    ok(await p.getByRole('link', { name: /Mina and the lab/ }).isVisible(), `${n} storyline shows for cast`);
    await p.getByRole('button', { name: /Devon is leaving/ }).click(); await p.waitForTimeout(300);
    ok(await p.getByRole('dialog', { name: 'Secret' }).getByText('Devon is leaving').isVisible(), `${n} secret opens in a popover, not the Secrets tab`);
    ok(/legacy\//.test(p.url()), `${n} still on the generation page`);
    await shot('5a-secret');
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    // edit details
    await p.getByRole('button', { name: 'Edit', exact: true }).click();
    const ed = p.getByRole('dialog', { name: 'Edit generation' });
    await ed.getByLabel('Traits').fill('Ambitious, Geek'); await ed.getByLabel('Aspiration').fill('Master Chef'); await ed.getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(300);
    ok(await until(p, () => st.records[SID][gid].data.traits.length === 2), `${n} traits saved`);
    // photo tagged from page
    const chooser = p.waitForEvent('filechooser');
    await p.getByRole('button', { name: 'Add photo' }).click();
    await (await chooser).setFiles('portrait.png');
    const pd = p.getByRole('dialog', { name: 'Add a photo' }); await pd.waitFor({ timeout: 8000 });
    ok(await pd.getByText('Reed Legacy · Gen 1').isVisible(), `${n} photo is auto-tagged with the page`);
    await shot('5-add-photo');
    await pd.getByRole('button', { name: 'Add photo' }).click(); await p.waitForTimeout(1200);
    const ph = recs('photo');
    ok(ph.length === 1 && ph[0].data.legacyId === lid && ph[0].data.genId === gid, `${n} photo saved with legacy and generation`);
    ok(await p.locator('.lg-strip .lg-ph').count() === 2, `${n} strip: 1 photo + Add tile`);
    await shot('6-generation');
    // not current: make current
    await p.getByRole('link', { name: /Reed Legacy/ }).first().click(); await p.waitForTimeout(500);
    await p.locator('.lg-gen').nth(2).click(); await p.waitForTimeout(500);
    await p.getByRole('button', { name: /Make current/ }).click(); await p.waitForTimeout(400);
    ok(await until(p, () => recs('legacy')[0].data.current !== ''), `${n} make current saves`);
    // 8 finished generations fold into one row (seeded legacy)
    await p.goto(url('legacy/big')); await p.waitForTimeout(1200);
    ok(await p.getByText('Gen 1 to 8 · done').isVisible(), `${n} finished generations fold into one row`);
    ok(await p.locator('.lg-gen').count() === 3, `${n} fold row + current + next (not 10 rows)`);
    await p.getByText('Gen 1 to 8 · done').click(); await p.waitForTimeout(200);
    ok(await p.locator('.lg-gen').count() === 11, `${n} fold opens`);
    await shot('7-folded');
    // photos page link
    await p.goto(url('photos')); await p.waitForTimeout(900);
    await p.locator('a[href*="photos/"]').first().click(); await p.waitForTimeout(700);
    ok(await p.getByText(/Legacy: Reed Legacy · Gen 1/).isVisible(), `${n} photo page links back to the legacy`);
    // off module
    const st2 = newState(); seed(st2, true);
    ok(errs.length === 0, `${n} no page errors ${errs.join('|')}`);
    await ctx.close();
  }
  await b.close();
  console.log(`legacy: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
