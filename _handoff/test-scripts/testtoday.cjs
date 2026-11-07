// Today page (Nov 2026; replaced the home deck): date, Next day / Jump ahead / Go back with Undo, To sort, Jump back in, phone date pill.
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const SID = '22222222-2222-4222-8222-222222222222';
const seed = (st) => {
  const now = new Date().toISOString();
  st.saves[SID] = { id: SID, data: { name: 'Okafor Legacy', color: '#B83C76', packs: [], secretLots: [], today: 10, calendar: { seasonLength: 14, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: {} }, edited_at: now, deleted_at: null, created_at: now };
  const rec = (id, kind, data) => ({ id, save_id: SID, kind, data, edited_at: now, deleted_at: null, created_at: now });
  st.records[SID] = {
    s1: rec('s1', 'sim', { first: 'Marisol', last: 'Okafor', bornDay: -9000, householdId: 'h1', traits: [] }),
    s2: rec('s2', 'sim', { first: 'Desmond', last: 'Okafor', bornDay: -9500, householdId: null, traits: [] }),
    s3: rec('s3', 'sim', { first: 'Rafael', last: 'Banks', bornDay: -8000, householdId: null, traits: [] }),
    h1: rec('h1', 'household', { name: 'Okafor', home: null, notes: '' }),
  };
};
(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['wide', 1280, 860], ['phone', 393, 852]]) {
    const phone = n === 'phone';
    const st = newState(); seed(st);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
    await p.goto(`http://localhost:4173/#/s/${SID}/sims/s1`); await p.waitForTimeout(800);
    await p.goto(`http://localhost:4173/#/s/${SID}/${phone ? 'today' : ''}`); await p.waitForTimeout(1000);
    const h1 = () => p.locator('.today-head h1').innerText();
    ok((await h1()).includes('Spring 11'), `${n} today's date as the title`);
    ok(await p.getByText('2 Sims', { exact: true }).isVisible() && await p.getByText(/1 household/).isVisible(), `${n} To sort counts`);
    ok(await p.locator('.today-row', { hasText: 'Marisol Okafor' }).isVisible(), `${n} Jump back in remembers the Sim`);
    await p.locator('.today-head').getByRole('button', { name: /Next day/ }).click(); await p.waitForTimeout(300);
    ok((await h1()).includes('Spring 12'), `${n} Next day`);
    await p.getByRole('button', { name: 'Undo' }).click(); await p.waitForTimeout(300);
    ok((await h1()).includes('Spring 11'), `${n} Undo`);
    await p.getByRole('button', { name: /Jump ahead/ }).first().click(); await p.waitForTimeout(400);
    ok(await p.locator('.dp-day.off').count() === 11, `${n} Jump ahead greys today and earlier`);
    await p.getByRole('button', { name: 'Spring 14' }).click();
    ok(await p.locator('.jump-note', { hasText: '3 days ahead' }).isVisible(), `${n} says how far`);
    await p.getByRole('button', { name: 'Jump ahead 3 days' }).click(); await p.waitForTimeout(300);
    ok((await h1()).includes('Spring 14'), `${n} jumped 3 days`);
    await p.getByRole('button', { name: /Go back/ }).first().click(); await p.waitForTimeout(400);
    await p.getByRole('button', { name: 'Spring 9' }).click();
    ok(await p.locator('.jump-note.back', { hasText: 'younger' }).isVisible(), `${n} Go back warns Sims get younger`);
    ok(!(await p.locator('.jump-note.back').innerText()).includes('crash'), `${n} no "why" sentence`);
    await p.getByRole('button', { name: 'Go back 5 days' }).click(); await p.waitForTimeout(300);
    ok((await h1()).includes('Spring 9'), `${n} went back 5 days`);
    await p.locator('.today-row', { hasText: 'with no household' }).click(); await p.waitForURL(/\/sims$/); await p.waitForTimeout(600);
    ok(await p.locator(phone ? '.sim-card' : 'tbody tr').count() === 2, `${n} To sort opens the Sims list filtered`);
    if (phone) {
      await p.goto(`http://localhost:4173/#/s/${SID}/today`); await p.waitForTimeout(800);
      await p.locator('.m-datepill').click(); await p.waitForTimeout(400);
      await p.getByRole('button', { name: 'Next week' }).click(); await p.waitForTimeout(300);
      const hp = await h1(); ok(hp.includes('Summer 2'), `${n} date pill: Next week (${hp})`);
    } else {
      await p.locator('.side-nextday').click(); await p.waitForTimeout(300);
      ok((await p.locator('.save-switch-date').innerText()).includes('Day 10'), `${n} sidebar Next day`);
      await p.waitForTimeout(2500); ok(st.saves[SID].data.today === 9, `${n} saved to the server`);
    }
    ok(errs.length === 0, `${n} no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
