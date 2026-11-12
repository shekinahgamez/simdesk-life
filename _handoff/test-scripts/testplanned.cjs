// Planned Sims: filter in the Sims list, Mark as planned/created from the profile menu, Quick add toggle.
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const SID = '66666666-6666-4666-8666-666666666666';
const until = async (p, f) => { for (let i = 0; i < 40; i++) { try { if (f()) return true; } catch {} await p.waitForTimeout(150); } return false; };
(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['wide', 1440, 900], ['phone', 390, 844]]) {
    const phone = n === 'phone';
    const st = newState(); const now = new Date().toISOString();
    st.saves[SID] = { id: SID, data: { name: 'Planned Save', color: '#B83C76', packs: [], secretLots: [], today: 14, calendar: { seasonLength: 14, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: {} }, edited_at: now, deleted_at: null, created_at: now };
    const rec = (id, d) => ({ id, save_id: SID, kind: 'sim', data: { first: id, last: 'Test', bornDay: -9000, householdId: null, traits: [], ...d }, edited_at: now, deleted_at: null, created_at: now });
    st.records[SID] = { Made: rec('Made', {}), Plan: rec('Plan', { planned: true }), Plan2: rec('Plan2', { planned: true }) };
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
    await p.goto(`http://localhost:4173/#/s/${SID}/sims`); await p.waitForTimeout(900);
    ok(await p.getByText('Planned').count() >= 2, `${n} Planned shows quietly on the Sim rows`);
    await p.getByRole('button', { name: /^Filter/ }).click(); await p.waitForTimeout(400);
    await p.getByRole('button', { name: 'Planned', exact: true }).click(); await p.waitForTimeout(300);
    await p.getByRole('button', { name: /^Show \d+ Sims?$/ }).click(); await p.waitForTimeout(400);
    ok(await p.getByText('Plan Test').count() >= 1 && await p.getByText('Made Test').count() === 0, `${n} Planned filter shows only planned Sims`);
    await p.getByRole('button', { name: /^Filter/ }).click(); await p.waitForTimeout(300);
    await p.getByRole('button', { name: 'Created', exact: true }).click(); await p.waitForTimeout(300);
    await p.getByRole('button', { name: /^Show \d+ Sims?$/ }).click(); await p.waitForTimeout(400);
    ok(await p.getByText('Made Test').count() >= 1 && await p.getByText('Plan Test').count() === 0, `${n} Created filter hides planned Sims`);
    await p.goto(`http://localhost:4173/#/s/${SID}/sims/Plan`); await p.waitForTimeout(900);
    await p.getByRole('button', { name: 'More' }).first().click(); await p.waitForTimeout(300);
    await p.getByText('Mark as created').first().click(); await p.waitForTimeout(300);
    ok(await until(p, () => !st.records[SID].Plan.data.planned), `${n} Mark as created clears the flag`);
    await p.getByRole('button', { name: 'More' }).first().click(); await p.waitForTimeout(300);
    await p.getByText('Mark as planned').first().click();
    ok(await until(p, () => st.records[SID].Plan.data.planned === true), `${n} Mark as planned sets the flag`);
    ok(errs.length === 0, `${n} no page errors ${errs.join('|')}`);
    await ctx.close();
  }
  await b.close();
  console.log(`planned: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
