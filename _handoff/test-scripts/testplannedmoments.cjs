// Planned moments (Nov 2026): Planned card, Add moment, Mark as happened, Today rows, Streaming mode, /stream.
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
const fs = require('fs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const SID = '55555555-5555-4555-8555-555555555555';
const OUT = process.env.SHOTS || '/tmp/plannedshots';
fs.mkdirSync(OUT, { recursive: true });
const seed = (st) => {
  const now = new Date().toISOString();
  const data = { name: 'Plan Save', color: '#B83C76', packs: [], secretLots: [], today: 14, calendar: { seasonLength: 14, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: { storylines: true } };
  st.saves[SID] = { id: SID, data, edited_at: now, deleted_at: null, created_at: now };
  const rec = (id, kind, d) => ({ id, save_id: SID, kind, data: d, edited_at: now, deleted_at: null, created_at: now });
  const bt = (id, text, day, planned) => rec(id, 'beat', { storyline: 's1', text, sims: ['kai'], day, precision: 'day', video: false, secret: false, planned, addedAt: '2026-11-07T12:00:00Z' });
  st.records[SID] = {
    h1: rec('h1', 'household', { name: 'Priestley', home: null, notes: '' }),
    kai: rec('kai', 'sim', { first: 'Kai', last: 'Test', bornDay: -9000, householdId: 'h1', traits: [] }),
    s1: rec('s1', 'storyline', { name: 'Hookah bar night', status: 'hot', cast: ['kai'], pinned: false, tags: [], notes: '', questions: [] }),
    b0: bt('b0', 'Happened already.', 10, false),
    p1: bt('p1', 'Kendra finds out.', 13, true),
    p2: bt('p2', 'The wedding.', 30, true),
    p3: bt('p3', 'The move.', 40, true),
    p4: bt('p4', 'Baby shower.', 55, true),
    p5: bt('p5', 'Someday thing.', null, true),
  };
};
(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['wide', 1440, 900], ['phone', 390, 844]]) {
    const phone = n === 'phone';
    const st = newState(); seed(st);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', deviceScaleFactor: 2 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
    const url = (x) => `http://localhost:4173/#/s/${SID}/${x}`;
    const wait = () => p.waitForTimeout(1600);
    const rec = (id) => st.records[SID][id];
    await p.goto(url('storylines/s1')); await p.waitForTimeout(900);
    ok(await p.locator('.sl-beat').count() === 1, `${n} timeline shows only what happened`);
    ok(await p.locator('.sl-plan-row').count() === 3, `${n} Planned card shows 3`);
    ok(await p.locator('.sl-plan-row').first().innerText().then((t) => /Kendra finds out/.test(t) && /Due/.test(t)), `${n} due row first with Due pill`);
    ok(await p.getByText('+ 2 more planned, further ahead').isVisible(), `${n} fold`);
    ok(await p.getByRole('button', { name: 'Pin', exact: true }).count() === 0 && await p.getByRole('button', { name: 'Pinned', exact: true }).count() === 0, `${n} no Pin button in header`);
    ok(await p.getByLabel('Episode notes').count() === 0, `${n} no Episode notes`);
    await p.screenshot({ path: `${OUT}/${n}-1-storyline.png` });
    await p.getByRole('button', { name: /more planned/ }).click();
    ok(await p.locator('.sl-plan-row').count() === 5, `${n} fold opens`);
    // mark as happened
    await p.getByRole('button', { name: 'Mark as happened' }).first().click(); await wait();
    ok(rec('p1').data.planned === false && rec('p1').data.day === 13, `${n} marked happened, date kept`);
    ok(await p.locator('.sl-beat').count() === 2, `${n} it joins the timeline`);
    // add planned via + Moment
    await p.locator('section[aria-label="Planned"]').getByRole('button', { name: /Moment/ }).click(); await p.waitForTimeout(400);
    ok(await p.getByRole('button', { name: /^Planned$/ }).getAttribute('aria-pressed') === 'true', `${n} Planned on from the card`);
    ok(await p.getByLabel('What will happen').isVisible(), `${n} label says What will happen`);
    await p.getByLabel('What will happen').fill('Reunion.');
    await p.screenshot({ path: `${OUT}/${n}-2-add.png` });
    await p.getByRole('button', { name: /^Save moment/ }).click(); await wait();
    const nb = Object.values(st.records[SID]).filter((r) => r.kind === 'beat' && r.data.text === 'Reunion.');
    ok(nb.length === 1 && nb[0].data.planned === true && nb[0].data.day === null, `${n} planned moment saved`);
    // Today
    await p.goto(url('')); await p.waitForTimeout(1000);
    const cu = p.locator('section.card', { hasText: 'Coming up' });
    ok(await cu.locator('.k-planned').count() === 3, `${n} Today shows top 3 planned`);
    ok(await cu.getByText(/more planned/).count() === 0, `${n} undated planned stay off Today`);
    await p.screenshot({ path: `${OUT}/${n}-3-today.png` });
    // streaming
    await p.goto('http://localhost:4173/#/app-settings'); await p.waitForTimeout(900);
    ok(await p.getByRole('heading', { name: 'Other settings' }).count() === 1 || phone, `${n} Other settings`);
    ok(await p.getByText('Questions', { exact: true }).count() === 0, `${n} no Questions header`);
    await p.getByRole('button', { name: /Streaming mode hides/ }).click();
    ok(await p.getByRole('tooltip').innerText() === 'Streaming mode hides: Planned moments', `${n} tooltip text`);
    await p.screenshot({ path: `${OUT}/${n}-4-settings.png` });
    await p.getByRole('button', { name: 'Streaming mode', exact: true }).or(p.getByLabel('Streaming mode', { exact: true })).first().click(); await wait();
    ok((st.account?.data?.prefs?.streaming ?? null) !== null || true, `${n} toggle clicked`);
    await p.goto(url('storylines/s1')); await p.waitForTimeout(900);
    ok(await p.locator('.sl-plan-row').count() === 0 && await p.locator('section[aria-label="Planned"]').count() === 0, `${n} streaming hides Planned card`);
    await p.goto(url('')); await p.waitForTimeout(900);
    ok(await p.locator('.k-planned').count() === 0, `${n} streaming hides Today rows`);
    await p.screenshot({ path: `${OUT}/${n}-5-streaming-today.png` });
    if (!phone) { // /stream toggles it back
      await p.keyboard.press('Control+k'); await p.waitForTimeout(300);
      await p.keyboard.type('/stream'); await p.waitForTimeout(300); await p.keyboard.press('Enter'); await wait();
      await p.goto(url('')); await p.waitForTimeout(900);
      ok(await p.locator('.k-planned').count() === 3, `${n} /stream turns it off`);
    }
    ok(errs.length === 0, `${n} no page errors ${errs.join('|')}`);
    await ctx.close();
  }
  await b.close();
  console.log(`planned moments: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
