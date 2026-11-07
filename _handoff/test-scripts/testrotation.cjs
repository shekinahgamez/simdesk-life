// Rotation (Nov 2026): Playing now card on Today, Rotation page, End turn with Undo, Add, ⋯ menu, turn length, drag, household page line, Sim tag.
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const SID = '33333333-3333-4333-8333-333333333333';
const seed = (st, rot) => {
  const now = new Date().toISOString();
  const data = { name: 'Rotation Save', color: '#B83C76', packs: [], secretLots: [], today: 11, calendar: { seasonLength: 14, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: { rotation: true } };
  if (rot) data.rotation = { order: ['hp', 'ha', 'hc'], lengths: { hc: 5 }, current: 'hp', startDay: 10, round: 1, roundStart: 'hp' };
  st.saves[SID] = { id: SID, data, edited_at: now, deleted_at: null, created_at: now };
  const rec = (id, kind, d) => ({ id, save_id: SID, kind, data: d, edited_at: now, deleted_at: null, created_at: now });
  st.records[SID] = {
    hp: rec('hp', 'household', { name: 'Priestley', home: null, notes: '' }),
    ha: rec('ha', 'household', { name: 'Adebayo', home: null, notes: '' }),
    hc: rec('hc', 'household', { name: 'Coriana', home: null, notes: '' }),
    hx: rec('hx', 'household', { name: 'Vaughn', home: null, notes: '' }),
    s1: rec('s1', 'sim', { first: 'Jamar', last: 'Priestley', bornDay: -9000, householdId: 'hp', traits: [] }),
    s2: rec('s2', 'sim', { first: 'Femi', last: 'Adebayo', bornDay: -9000, householdId: 'ha', traits: [] }),
  };
};
const rot = (st) => st.saves[SID].data.rotation || {};
(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['wide', 1280, 860], ['phone', 393, 852]]) {
    const phone = n === 'phone';
    const open = async (withRot) => {
      const st = newState(); seed(st, withRot);
      const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
      const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
      await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
      return { p, st, errs };
    };
    const url = (x) => `http://localhost:4173/#/s/${SID}/${x}`;
    let { p, st, errs } = await open(true);
    await p.goto(url(phone ? 'today' : '')); await p.waitForTimeout(900);
    const card = p.locator('.rot-now');
    ok(await card.isVisible(), `${n} Playing now card on Today`);
    ok((await card.innerText()).includes('Priestley household') && (await card.innerText()).includes('Day 2 of 3'), `${n} card says who and Day 2 of 3`);
    ok((await card.innerText()).includes('Adebayo household'), `${n} card says up next`);
    await card.getByRole('button', { name: /End turn/ }).click(); await p.waitForTimeout(400);
    ok(await p.getByText('End the Priestley household’s turn?').isVisible(), `${n} End turn asks first`);
    ok(await p.locator('.rot-span').innerText().then((t) => t.includes('Spring 11') && t.includes('Spring 12') && t.includes('2 days')), `${n} turn span dates`);
    await p.getByRole('button', { name: /Start the Adebayo household’s turn/ }).click(); await p.waitForTimeout(400);
    ok((await card.innerText()).includes('Adebayo household') && (await card.innerText()).includes('Day 1 of 3'), `${n} next household playing`);
    ok(st.saves[SID].data.today === 11, `${n} ending a turn doesn't move the date`);
    await p.getByRole('button', { name: 'Undo' }).click(); await p.waitForTimeout(400);
    ok((await card.innerText()).includes('Priestley household'), `${n} Undo puts it back`);
    // Rotation page
    if (phone) { await p.goto(url('more')); await p.waitForTimeout(600); await p.getByRole('link', { name: 'Rotation', exact: true }).click(); }
    else await p.locator('.nav-link', { hasText: 'Rotation' }).click();
    await p.waitForURL(/\/rotation$/); await p.waitForTimeout(700);
    ok(await p.getByText('Round 1 · 3 households').isVisible(), `${n} round and count`);
    const rows = () => p.locator('.rot-row .rot-rowname b').allInnerTexts();
    ok((await rows()).join() === 'Adebayo household,Coriana household', `${n} up next order ${await rows()}`);
    ok(await p.getByText(/Round 2 starts with the Priestley household/).isVisible(), `${n} next round line`);
    // length
    await p.getByRole('button', { name: /Turn length for Coriana household: 5 days/ }).click(); await p.waitForTimeout(300);
    await p.getByRole('radio', { name: '7 days' }).click(); await p.getByRole('button', { name: 'Save', exact: true }).click(); await p.waitForTimeout(300);
    ok(rot(st).lengths?.hc === 7 || (await p.getByRole('button', { name: /Coriana household: 7 days/ }).isVisible()), `${n} turn length changed`);
    // play next via menu
    await p.getByRole('button', { name: 'More for Coriana household' }).click(); await p.waitForTimeout(200);
    await p.getByRole('menuitem', { name: 'Play next' }).click(); await p.waitForTimeout(300);
    ok((await rows()).join() === 'Coriana household,Adebayo household', `${n} Play next`);
    // drag Adebayo back up
    const grip = p.getByRole('button', { name: 'Drag to move Adebayo household' });
    const first = await p.locator('.rot-row').first().boundingBox(); const gb = await grip.boundingBox();
    await p.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2); await p.mouse.down();
    await p.mouse.move(gb.x + gb.width / 2, first.y + 4, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(400);
    ok((await rows()).join() === 'Adebayo household,Coriana household', `${n} drag to reorder (${await rows()})`);
    // play now
    await p.getByRole('button', { name: 'More for Coriana household' }).click(); await p.waitForTimeout(200);
    await p.getByRole('menuitem', { name: 'Play now' }).click(); await p.waitForTimeout(400);
    ok((await p.locator('.rot-now .rot-name').innerText()) === 'Coriana household', `${n} Play now`);
    // add
    await p.getByRole('button', { name: /^Add/ }).first().click(); await p.waitForTimeout(300);
    ok(await p.locator('.rot-pick').count() === 1, `${n} Add lists only households not in it`);
    await p.locator('.rot-pick').first().click(); await p.getByRole('button', { name: 'Add 1 household' }).click(); await p.waitForTimeout(400);
    ok(await p.getByText(/· 4 households/).isVisible(), `${n} added`);
    // take out
    await p.getByRole('button', { name: 'More for Vaughn household' }).click(); await p.waitForTimeout(200);
    await p.getByRole('menuitem', { name: 'Take out of rotation' }).evaluate((el) => el.click()); await p.waitForTimeout(400);
    ok(await p.getByText(/· 3 households/).isVisible(), `${n} taken out`);
    // household page + sim tag
    await p.goto(url('households/ha')); await p.waitForTimeout(700);
    ok((await p.locator('.rot-hh').innerText()).includes('in line') || (await p.locator('.rot-hh').innerText()).includes('Up next'), `${n} household page shows place in line`);
    await p.locator('.rot-hh').getByRole('button', { name: /Play now/ }).click(); await p.waitForTimeout(400);
    ok((await p.locator('.rot-hh').innerText()).includes('Playing now'), `${n} Play now from the household page`);
    if (!phone) {
      await p.goto(url('sims/s2')); await p.waitForTimeout(800);
      ok(await p.locator('.rot-tag').isVisible(), `${n} Playing now tag on the Sim`);
    }
    await p.waitForTimeout(2500);
    ok(rot(st).current === 'ha', `${n} saved to the server`);
    ok(errs.length === 0, `${n} no page errors ${errs.join(' | ')}`);
    // empty start
    ({ p, st, errs } = await open(false));
    await p.goto(url(phone ? 'today' : '')); await p.waitForTimeout(800);
    await p.locator('.rot-start').getByRole('button', { name: /Add households/ }).click(); await p.waitForTimeout(300);
    await p.locator('.rot-pick', { hasText: 'Priestley' }).click(); await p.locator('.rot-pick', { hasText: 'Adebayo' }).click();
    await p.getByRole('button', { name: 'Add 2 households' }).click(); await p.waitForTimeout(400);
    ok((await p.locator('.rot-now').innerText()).includes('Priestley household') && (await p.locator('.rot-now').innerText()).includes('Day 1 of 3'), `${n} first one added starts playing`);
    ok(errs.length === 0, `${n} no page errors (empty) ${errs.join(' | ')}`);
  }
  // module off: nothing shows
  {
    const st = newState(); seed(st, true); st.saves[SID].data.modules = {};
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
    const p = await ctx.newPage(); await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
    ok(await p.locator('.rot-now').count() === 0 && await p.locator('.nav-link', { hasText: 'Rotation' }).count() === 0, 'rotation off hides it');
  }
  await b.close();
  console.log(`testrotation: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
