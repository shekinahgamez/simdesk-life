// Businesses (Nov 2026): list, new business, page edits (rating, price, staff, customer rules, activities), money log + starting-total note, kinds list, Townie, import from game.
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
const fs = require('fs'), os = require('os'), path = require('path');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const SID = '66666666-6666-4666-8666-666666666666';
const OUT = process.env.SHOTS || '/tmp/bizshots';
fs.mkdirSync(OUT, { recursive: true });
const until = async (p, f) => { for (let i = 0; i < 40; i++) { try { if (f()) return true; } catch {} await p.waitForTimeout(150); } return false; };
const seed = (st, off) => {
  const now = new Date().toISOString();
  const data = { name: 'Biz Save', color: '#B83C76', packs: [], secretLots: [], today: 14, calendar: { seasonLength: 14, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: off ? {} : { venues: true, funds: false } };
  st.saves[SID] = { id: SID, data, edited_at: now, deleted_at: null, created_at: now };
  const rec = (id, kind, d) => ({ id, save_id: SID, kind, data: d, edited_at: now, deleted_at: null, created_at: now });
  const sim = (id, first, h, x = {}) => rec(id, 'sim', { first, last: 'Pryor', bornDay: -9000, householdId: h, traits: [], ...x });
  st.records[SID] = {
    h1: rec('h1', 'household', { name: 'Pryor house', home: null, notes: '' }),
    nolan: sim('nolan', 'Nolan', 'h1', { gameId: '1' }), marcel: sim('marcel', 'Marcel', null, { townie: true }), lenora: sim('lenora', 'Lenora', null),
  };
};
const imp = JSON.stringify({
  format: 'simdesk-log', version: 1, loggedAt: '2026-11-08T10:00:00', game: { absoluteDay: 33 },
  household: { id: 7, name: 'Pryor', sims: [{ id: 1, first: 'Nolan', last: 'Pryor', gender: 'male', age: { stage: 'ADULT' }, traits: [], aspiration: null, career: null, deceased: false }] },
  money: { funds: null }, skipped: [],
  businesses: [
    { id: 'b-tea', name: 'Black Tea', type: 'SMALL_BUSINESS', lifetime: 5000, rating: 4, staff: [1] },
    { id: 'b-rack', name: 'Ransom Rack', type: 'RETAIL', dayProfit: 800, closeKey: 'd1', rating: 3, staff: [] },
  ],
});
const tmp = path.join(os.tmpdir(), 'biz-import.json'); fs.writeFileSync(tmp, imp);
(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['wide', 1440, 900], ['phone', 390, 844]]) {
    const phone = n === 'phone';
    const st = newState(); seed(st);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
    const url = (x) => `http://localhost:4173/#/s/${SID}/${x}`;
    const shot = async (name) => { await p.waitForTimeout(250); return p.screenshot({ path: `${OUT}/${n}-${name}.png` }); };
    const recs = (k) => Object.values(st.records[SID]).filter((r) => r.kind === k && !r.deleted_at);
    const biz = () => recs('business')[0]?.data;
    if (!phone) ok(await p.locator('nav.sidebar').getByRole('link', { name: 'Businesses' }).isVisible(), `${n} Businesses in sidebar`);
    await p.goto(url('businesses')); await p.waitForTimeout(900);
    ok(await p.getByText('No businesses yet').isVisible(), `${n} empty state`);
    await shot('1-empty');
    // new business
    await p.getByRole('button', { name: /New business/ }).first().click();
    const dlg = p.getByRole('dialog', { name: 'New business' });
    await dlg.getByLabel('Name').fill('Black Tea');
    await dlg.getByLabel('Kind').click(); await dlg.getByRole('option', { name: 'Cafe', exact: true }).click();
    await dlg.getByLabel('Owner household').click(); await dlg.getByRole('option').first().click();
    await shot('2-new');
    await dlg.getByRole('button', { name: 'Add business' }).click(); await p.waitForTimeout(800);
    ok(await until(p, () => recs('business').length === 1), `${n} business saved`);
    ok(biz().kind === 'Cafe' && biz().system === 'small' && biz().owner === 'h1', `${n} kind, system and owner (${JSON.stringify(biz())})`);
    ok(/businesses\/[^/]+$/.test(p.url()), `${n} opens the business`);
    // rating + price
    await p.getByRole('button', { name: '4 stars' }).click();
    ok(await until(p, () => biz().rating === 4), `${n} rating 4`);
    await p.getByRole('button', { name: '4 stars' }).click();
    ok(await until(p, () => biz().rating === 0), `${n} tapping the same star clears it`);
    await p.getByRole('button', { name: '3 stars' }).click();
    await p.getByLabel('Price level').click(); await p.getByRole('option', { name: '+50%', exact: true }).click();
    ok(await until(p, () => biz().price === 50), `${n} price level`);
    // staff (townie included)
    await p.getByRole('button', { name: /Add staff/ }).click();
    const sd = p.getByRole('dialog', { name: 'Staff' });
    ok(await sd.getByRole('checkbox', { name: /Marcel Pryor/ }).isVisible(), `${n} townie shows in the staff picker`);
    await sd.getByRole('checkbox', { name: /Nolan Pryor/ }).click(); await sd.getByRole('checkbox', { name: /Marcel Pryor/ }).click();
    await sd.getByRole('button', { name: /Done · 2 selected/ }).click();
    ok(await until(p, () => biz().staff.length === 2), `${n} two staff saved`);
    await p.getByLabel('Role for Nolan').fill('Owner'); await p.getByLabel('Role for Nolan').blur();
    ok(await until(p, () => biz().staff.find((s) => s.sim === 'nolan').role === 'Owner'), `${n} role saves`);
    await p.getByLabel('Pay for Marcel').click(); await p.getByRole('option', { name: 'High', exact: true }).click();
    ok(await until(p, () => biz().staff.find((s) => s.sim === 'marcel').pay === 'High'), `${n} pay saves`);
    // customers
    ok(await p.getByText('Anyone can come in.').isVisible(), `${n} no rules yet`);
    await p.locator('.sl-card', { hasText: 'Customers' }).getByRole('button', { name: /Add/ }).click();
    await p.getByRole('dialog', { name: 'Add a customer rule' }).getByRole('button', { name: /^Age/ }).click();
    const rd = p.getByRole('dialog', { name: 'Age' });
    await rd.getByRole('checkbox', { name: 'Teen' }).click(); await rd.getByRole('checkbox', { name: 'Young adult' }).click();
    await rd.getByRole('button', { name: 'Done' }).click();
    ok(await until(p, () => biz().customers.length === 1 && biz().customers[0].values.join() === 'Teen,Young adult' && biz().customers[0].level === 'required'), `${n} Age rule saved as required`);
    ok(!(await p.getByText(/Required or Preferred|means/).count()), `${n} no helper text under customer rules`);
    await p.getByRole('button', { name: /Age: required/ }).click();
    ok(await until(p, () => biz().customers[0].level === 'preferred'), `${n} switches to preferred`);
    // free-text criterion
    await p.locator('.sl-card', { hasText: 'Customers' }).getByRole('button', { name: /Add/ }).click();
    const pr = p.getByRole('dialog', { name: 'Add a customer rule' });
    ok(!(await pr.getByRole('button', { name: /^Age/ }).count()), `${n} Age is not offered twice`);
    await pr.getByRole('button', { name: /^Traits/ }).click();
    const td = p.getByRole('dialog', { name: 'Traits' });
    await td.getByLabel('Add traits').fill('Foodie'); await td.getByRole('button', { name: 'Add', exact: true }).click();
    await td.getByRole('button', { name: 'Done' }).click();
    ok(await until(p, () => biz().customers.length === 2 && biz().customers[1].values[0] === 'Foodie'), `${n} typed trait rule`);
    await p.getByRole('button', { name: 'Remove Traits' }).click();
    ok(await until(p, () => biz().customers.length === 1), `${n} rule removed`);
    // activities (small business, max 5)
    for (const a of ['Yoga', 'Pottery', 'Dance', 'Chess', 'Book club']) {
      await p.locator('.sl-card', { hasText: 'Activities' }).getByRole('button', { name: /Add/ }).click();
      await p.getByRole('textbox', { name: 'Activity' }).fill(a); await p.getByRole('button', { name: 'Add activity' }).click();
      await p.waitForTimeout(150);
    }
    ok(await until(p, () => biz().activities.length === 5), `${n} five activities`);
    ok(!(await p.locator('.sl-card', { hasText: 'Activities' }).getByRole('button', { name: /^Add$/ }).count()), `${n} no Add after five`);
    // money: small business has no starting note
    ok(!(await p.getByText('SimLogger only counts profit').count()), `${n} small business has no starting-totals note`);
    await p.getByRole('button', { name: /Add a reading/ }).click();
    await p.getByLabel('Lifetime total now').fill('5000'); await p.getByRole('button', { name: 'Add reading' }).click();
    await p.getByRole('button', { name: /Add a reading/ }).click();
    await p.getByLabel('Lifetime total now').fill('5400'); await p.getByRole('button', { name: 'Add reading' }).click();
    ok(await until(p, () => biz().log.length === 2 && biz().log[1].change === 400 && biz().log[0].change === null), `${n} money log keeps the difference (${JSON.stringify(biz().log)})`);
    ok((await p.getByRole('table', { name: 'Money log' }).innerText()).includes('+§400'), `${n} log shows +§400`);
    await shot('3-business');
    // kinds list
    await p.getByRole('button', { name: 'Edit kinds' }).first().click();
    const kd = p.getByRole('dialog', { name: 'Kinds of business' });
    await kd.getByLabel('New kind').fill('Salon'); await kd.getByRole('button', { name: 'Add', exact: true }).click();
    await kd.getByRole('button', { name: 'Remove Daycare' }).click();
    await kd.getByRole('button', { name: 'Save kinds' }).click();
    ok(await until(p, () => (st.saves[SID].data.bizKinds || []).includes('Salon') && !(st.saves[SID].data.bizKinds || []).includes('Daycare')), `${n} kinds list edits`);
    // retail business shows the starting-totals note until set
    await p.goto(url('businesses')); await p.waitForTimeout(700);
    await p.getByRole('button', { name: /New business/ }).first().click();
    const d2 = p.getByRole('dialog', { name: 'New business' });
    await d2.getByLabel('Name').fill('Ransom Rack'); await d2.getByLabel('Kind').click(); await d2.getByRole('option', { name: 'Retail', exact: true }).click();
    await d2.getByRole('button', { name: 'Add business' }).click(); await p.waitForTimeout(800);
    ok(await p.getByText(/SimLogger only counts profit/).isVisible(), `${n} retail shows the starting-totals note`);
    await p.getByRole('button', { name: 'Set starting total' }).click();
    await p.getByLabel('Lifetime profit before SimLogger').fill('10000'); await p.getByRole('button', { name: 'Save', exact: true }).click();
    ok(await until(p, () => recs('business').some((r) => r.data.name === 'Ransom Rack' && r.data.start === 10000)), `${n} starting total saved`);
    ok(!(await p.getByText(/SimLogger only counts profit/).count()), `${n} note goes away once a starting total is set`);
    // list
    await p.goto(url('businesses')); await p.waitForTimeout(700);
    ok((await p.locator('.bz-row').count()) === 2, `${n} list has two rows`);
    ok(await p.getByText('+§400').isVisible(), `${n} list shows the last change`);
    await shot('4-list');
    // Townie in the Sims list + profile menu
    await p.goto(url('sims')); await p.waitForTimeout(900);
    ok(await p.getByText('Townie').first().isVisible(), `${n} Townie shows on the Sims list`);
    ok(!errs.length, `${n} no errors ${errs}`);
    await ctx.close();
  }
  // import (desktop only) — a fresh state with both businesses unknown
  {
    const st = newState(); seed(st);
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
    await p.goto(`http://localhost:4173/#/s/${SID}/`); await p.waitForTimeout(900);
    const recs = (k) => Object.values(st.records[SID]).filter((r) => r.kind === k && !r.deleted_at);
    await p.getByRole('button', { name: /Import from game/ }).click(); await p.waitForTimeout(300);
    await p.locator('input[accept=".json,application/json"]').setInputFiles(tmp); await p.waitForTimeout(600);
    const sheet = p.locator('.gi-modal');
    const text = await sheet.innerText();
    ok(/businesses · 2/i.test(text) && text.includes('Black Tea') && text.includes('Ransom Rack'), 'import lists both businesses');
    ok(text.includes('Lifetime total') && text.includes('§5,000') && text.includes('Rating'), 'small business rows');
    ok(text.includes('SimLogger only counts profit'), 'starting-total note shows for a new retail business');
    await sheet.getByLabel('Starting total for Ransom Rack').fill('10000');
    await p.screenshot({ path: `${OUT}/import.png` });
    await sheet.getByRole('button', { name: /^Add \d+ changes?$/ }).click(); await p.waitForTimeout(800);
    ok(await until(p, () => recs('business').length === 2), 'both businesses created');
    const tea = recs('business').find((r) => r.data.name === 'Black Tea').data;
    const rack = recs('business').find((r) => r.data.name === 'Ransom Rack').data;
    ok(tea.gameId === 'b-tea' && tea.rating === 4 && tea.log.length === 1 && tea.log[0].total === 5000 && tea.staff.map((s) => s.sim).join() === 'nolan', `Black Tea imported (${JSON.stringify(tea)})`);
    ok(rack.start === 10000 && rack.log[0].total === 10800 && rack.log[0].change === 800 && rack.closeKey === 'd1', `Ransom Rack counts day 1 on top of the starting total (${JSON.stringify(rack)})`);
    // same file again: nothing double counted
    await p.getByRole('button', { name: /Import from game/ }).click(); await p.waitForTimeout(300);
    await p.locator('input[accept=".json,application/json"]').setInputFiles(tmp); await p.waitForTimeout(600);
    const again = await p.locator('.gi-modal').innerText();
    ok(!again.includes('Profit:'), 'the same business day is not counted twice');
    ok(!errs.length, 'import no errors ' + errs);
    await ctx.close();
  }
  await b.close();
  console.log(`businesses: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
