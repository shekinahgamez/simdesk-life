// Phase 3: Sims, against the stand-in Supabase (real account path, photos included).
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL', m); } };
const seedSave = (st) => { const sid = '11111111-1111-4111-8111-111111111111'; const now = new Date().toISOString();
  st.saves[sid] = { id: sid, data: { name: 'Okafor Legacy', color: '#B83C76', packs: ['vampires'], secretLots: [], today: 7, calendar: { seasonLength: 28, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: { rotation: true } }, edited_at: now, deleted_at: null, created_at: now }; return sid; };
const sims = (st, sid) => Object.values(st.records[sid] ?? {}).filter((r) => r.kind === 'sim' && !r.deleted_at);
const wait = (p, ms) => p.waitForTimeout(ms);
const shots = process.env.SHOTS;

(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['wide', 1280, 860], ['phone', 393, 852]]) {
    const phone = n === 'phone';
    const st = newState(); const sid = seedSave(st);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: phone });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await wait(p, 1500);

    // deck: Sims is built now
    if (!phone) {
      ok(await p.locator('.deck-card.soon').count() === 0 && await p.locator('.deck-card').count() === 4, `${n} four cards, all lit; no Clubs card without Get Together`);
      await p.locator('.deck-card').first().click();
    } else {
      ok(await p.locator('.ms-dcard.soon').count() === 0, `${n} every phone deck card lit (Clubs only with Get Together)`);
      await p.locator('.ms-dcard[aria-hidden="false"]').click();
    }
    await p.waitForURL(/\/sims$/, { timeout: 5000 }); await wait(p, 900);
    ok(await p.getByText('No Sims yet. Time to make some!').isVisible(), `${n} empty state`);

    // new Sim with a new household, custom trait, Add & add another
    await p.getByRole('button', { name: 'Add your first Sim' }).click(); await wait(p, 400);
    const dlg = p.getByRole('dialog', { name: 'New Sim' });
    await dlg.getByLabel('First name').fill('Marisol'); await dlg.getByLabel('Last name').fill('Okafor');
    await dlg.getByRole('button', { name: 'New household' }).click();
    await dlg.getByLabel('Household').fill('Okafor');
    await dlg.getByRole('button', { name: 'Female' }).click();
    await dlg.getByLabel('Traits').fill('creat'); await dlg.getByRole('option', { name: 'Creative', exact: true }).click();
    await dlg.getByLabel('Traits').fill('Loves Plants'); await dlg.getByRole('option', { name: /Add “Loves Plants”/ }).click(); await p.keyboard.press('Escape');
    const box = await dlg.getByRole('button', { name: 'Add Sim' }).boundingBox();
    ok(box && box.y + box.height <= h, `${n} Add Sim button visible without scrolling (${box && Math.round(box.y)})`);
    await dlg.getByRole('button', { name: 'Add & add another' }).click(); await wait(p, 500);
    ok(await dlg.getByLabel('First name').inputValue() === '', `${n} add another clears the form`);
    ok(await dlg.getByLabel('Household').locator('option:checked').textContent() === 'Okafor', `${n} add another keeps the household`);
    await dlg.getByLabel('First name').fill('Desmond'); await dlg.getByLabel('Last name').fill('Okafor');
    await dlg.getByRole('button', { name: 'Male', exact: true }).click();
    await dlg.getByLabel('Life stage').selectOption('adult');
    await dlg.getByRole('button', { name: 'No, already playing them' }).click();
    await dlg.getByRole('textbox', { name: 'Birthday in' }).fill('3'); await dlg.getByRole('textbox', { name: 'Birthday in' }).blur();
    await dlg.getByRole('button', { name: 'Add Sim' }).click();
    await p.waitForURL(/\/sims\/[^/]+$/, { timeout: 4000 }); await wait(p, 1500);
    ok(await p.getByRole('heading', { name: 'Desmond Okafor' }).first().isVisible(), `${n} lands on new Sim's profile`);
    const all = sims(st, sid);
    ok(all.length === 2, `${n} two Sims synced (${all.length})`);
    const hh = Object.values(st.records[sid]).filter((r) => r.kind === 'household');
    ok(hh.length === 1 && hh[0].data.name === 'Okafor', `${n} household made once`);
    ok(st.account?.data?.customTraits?.[0]?.name === 'Loves Plants', `${n} custom trait saved to account`);
    const mar = all.find((r) => r.data.first === 'Marisol');
    ok(mar.data.traits.length === 2 && mar.data.addedDay === 7 && mar.data.householdId === hh[0].id, `${n} Marisol saved right`);

    // list: birthdays, switch, filter, sort, quick add
    await p.goto(`http://localhost:4173/#/s/${sid}/sims`); await wait(p, 900);
    if (!phone) {
      ok(await p.locator('.soon-birthday', { hasText: 'in 3 days' }).isVisible(), `${n} soon birthday in blue`);
      ok(await p.getByRole('cell', { name: 'Okafor' }).first().isVisible(), `${n} household shows just the name`);
      await p.getByRole('button', { name: 'Date', exact: true }).click(); await wait(p, 1200);
      ok(await p.locator('.soon-birthday', { hasText: /Spring \d+/ }).isVisible(), `${n} birthday date view`);
      ok(st.account?.data?.prefs?.birthdayView === 'date', `${n} birthday view saved to account`);
      await p.getByRole('button', { name: 'Sort by Birthday' }).click(); await wait(p, 200);
      ok((await p.locator('tbody tr').first().textContent()).includes('Desmond'), `${n} sort by birthday`);
    } else {
      ok(await p.locator('.sim-card-bday', { hasText: 'Birthday in 3 days' }).isVisible(), `${n} phone card birthday this week`);
    }
    await p.getByRole('button', { name: /^Filter/ }).click(); await wait(p, 400);
    await p.getByRole('button', { name: 'Male', exact: true }).click(); await wait(p, 200);
    await p.getByRole('button', { name: /^Show 1 Sim$/ }).click(); await wait(p, 400);
    ok(await p.locator(phone ? '.sim-card' : 'tbody tr').count() === 1, `${n} gender filter`);
    await p.getByRole('button', { name: 'Clear', exact: true }).click(); await wait(p, 200);
    await p.getByRole('button', { name: 'Quick add' }).first().click(); await wait(p, 300);
    await p.getByLabel('Names').fill('Rafael Banks\nAdaeze Okafor');
    await p.getByRole('button', { name: 'Add 2 Sims' }).click(); await wait(p, 1500);
    ok(sims(st, sid).length === 4, `${n} quick add`);
    ok(await p.locator(phone ? '.sim-card' : 'tbody tr').count() === 4, `${n} four in the list`);

    // profile: relationships, photo, deceased
    const marId = mar.id;
    await p.goto(`http://localhost:4173/#/s/${sid}/sims/${marId}`); await wait(p, 1000);
    if (phone) await p.getByRole('tab', { name: 'Family' }).click();
    await p.getByRole('button', { name: phone ? 'Add a relationship' : 'Add', exact: true }).first().click(); await wait(p, 300);
    const rd = p.getByRole('dialog');
    await rd.getByLabel('Who').fill('Desm'); await rd.getByRole('option', { name: 'Desmond Okafor' }).click();
    await rd.getByLabel('Relationship').selectOption('parent');
    await rd.getByLabel(/On Marisol’s profile/).fill('Father');
    await rd.getByRole('button', { name: 'Secret' }).click();
    await rd.getByRole('button', { name: 'Save', exact: true }).click(); await wait(p, 1200);
    ok(await p.getByText('Father', { exact: true }).isVisible() && await p.locator('.secret-tag').isVisible(), `${n} relationship with label and secret`);
    const rel = Object.values(st.records[sid]).find((r) => r.kind === 'rel');
    ok(rel && rel.data.a !== marId && rel.data.b === marId && rel.data.labelB === 'Father', `${n} parent is a, label on child's side`);
    await p.getByRole('button', { name: /Edit relationship with Desmond/ }).click(); await wait(p, 300);
    await p.getByRole('dialog').getByRole('button', { name: 'Remove' }).click(); await wait(p, 300);
    ok(await p.locator('.toast', { hasText: 'Relationship moved to Trash' }).isVisible(), `${n} remove relationship toast`);
    await p.locator('.toast-btn').click(); await wait(p, 500);
    ok(await p.getByText('Father', { exact: true }).isVisible(), `${n} undo brings relationship back`);
    if (phone) await p.getByRole('tab', { name: 'About' }).click();

    const chooser = p.waitForEvent('filechooser');
    await p.getByRole('button', { name: /Add a portrait/ }).first().click();
    await (await chooser).setFiles('portrait.png');
    await p.getByRole('dialog', { name: 'Position your photo' }).waitFor({ timeout: 8000 });
    await p.getByRole('button', { name: 'Use photo' }).click(); await wait(p, 2000);
    ok(Object.keys(st.photos).length === 1 && Object.keys(st.files).length === 2, `${n} photo uploaded (full + small)`);
    ok(await p.locator(phone ? '.pp-photo img' : '.sim-hero-photo img').first().evaluate((i) => i.complete && i.naturalWidth > 0), `${n} photo shows`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-profile.png` });
    if (phone) {
      await p.evaluate(() => window.scrollTo(0, 600)); await wait(p, 300);
      const wpx = await p.locator('.pp-photo').evaluate((e) => e.getBoundingClientRect().width);
      ok(wpx < 80, `${n} photo shrinks into the circle when scrolled (${Math.round(wpx)})`);
      await p.evaluate(() => window.scrollTo(0, 0)); await wait(p, 200);
    }
    await p.getByRole('button', { name: 'Edit', exact: !phone ? false : true }).first().click(); await wait(p, 500);
    await p.screenshot({ path: 'dbg-edit.png' }); const ed = p.getByRole('dialog', { name: 'Edit Marisol' });
    await ed.getByRole('button', { name: 'Remove', exact: true }).click();
    await ed.getByRole('button', { name: 'Save changes' }).click(); await wait(p, 1500);
    ok(Object.keys(st.photos).length === 0 && Object.keys(st.files).length === 0, `${n} removed photo deleted from storage`);

    if (phone) await p.getByRole('button', { name: 'Mark as deceased' }).click();
    else { await p.getByRole('button', { name: 'More', exact: true }).click(); await p.getByRole('menuitem', { name: 'Mark as deceased' }).click(); }
    await wait(p, 300);
    await p.getByLabel('Cause (optional)').fill('Pufferfish');
    await p.getByRole('dialog').getByRole('button', { name: 'Mark as deceased' }).click(); await wait(p, 800);
    ok(await p.getByText(/Passed/).first().isVisible(), `${n} deceased shows passed`);
    await p.goto(`http://localhost:4173/#/s/${sid}/sims`); await wait(p, 800);
    ok(await p.locator(phone ? '.sim-card' : 'tbody tr').count() === 3, `${n} deceased leave the living list`);
    if (!phone) ok(await p.getByText('3 living · 1 deceased').isVisible(), `${n} counts`);

    // delete Desmond (with his relationship), then restore from Trash
    const desId = sims(st, sid).find((r) => r.data.first === 'Desmond').id;
    await p.goto(`http://localhost:4173/#/s/${sid}/sims/${desId}`); await wait(p, 800);
    if (phone) await p.getByRole('button', { name: 'Delete Sim' }).click();
    else { await p.getByRole('button', { name: 'More', exact: true }).click(); await p.getByRole('menuitem', { name: 'Delete Sim' }).click(); }
    await p.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await p.waitForURL(/\/sims$/); await wait(p, 1200);
    ok(Object.values(st.records[sid]).filter((r) => r.deleted_at).length === 2, `${n} Sim and relationship in Trash`);
    await p.goto(`http://localhost:4173/#/s/${sid}/settings`); await wait(p, 800);
    if (phone) await p.getByRole('button', { name: /Trash/ }).click();
    await wait(p, 300);
    ok(await p.locator('.trash-row').count() === 1, `${n} Trash lists the Sim only`);
    await p.locator('.trash-row').getByRole('button', { name: 'Restore' }).click(); await wait(p, 1500);
    ok(Object.values(st.records[sid]).filter((r) => r.deleted_at).length === 0, `${n} restoring brings the relationship back too`);
    if (phone) await p.keyboard.press('Escape');

    // draft
    await p.goto(`http://localhost:4173/#/s/${sid}/sims`); await wait(p, 800);
    await (phone ? p.getByRole('button', { name: 'New Sim' }) : p.getByRole('button', { name: 'New Sim' })).first().click(); await wait(p, 300);
    await p.getByRole('dialog', { name: 'New Sim' }).getByLabel('First name').fill('Tobi'); await wait(p, 1700);
    await p.keyboard.press('Escape'); await wait(p, 200);
    await p.getByRole('alertdialog').getByRole('button', { name: 'Save draft' }).click(); await wait(p, 300);
    await p.getByRole('button', { name: 'New Sim' }).first().click(); await wait(p, 400);
    ok(await p.getByRole('dialog', { name: 'New Sim' }).getByLabel('First name').inputValue() === 'Tobi' && await p.getByText(/Picked up your draft/).isVisible(), `${n} draft comes back`);
    await p.getByRole('button', { name: 'Start over' }).click(); await p.keyboard.press('Escape'); await wait(p, 300);

    // cover photo -> desktop home
    if (!phone) {
      await p.goto(`http://localhost:4173/#/s/${sid}/settings`); await wait(p, 800);
      const c2 = p.waitForEvent('filechooser');
      await p.getByRole('button', { name: 'Add a cover photo' }).click();
      await (await c2).setFiles('portrait.png');
      await p.getByRole('dialog', { name: 'Position your photo' }).waitFor({ timeout: 8000 });
      await p.getByRole('button', { name: 'Use photo' }).click(); await wait(p, 1800);
      ok(st.saves[sid].data.cover && Object.keys(st.photos).length === 1, `${n} cover saved`);
      await p.goto(`http://localhost:4173/#/s/${sid}`); await wait(p, 1500);
      if (shots) await p.screenshot({ path: `${shots}/${n}-home.png` });
      ok(await p.locator('.home-cover img').evaluate((i) => i.complete && i.naturalWidth > 0), `${n} cover on home`);
      ok((await p.locator('.deck-card').first().textContent()).includes('3 Sims'), `${n} live count on Sims card`);
    }
    ok(errs.length === 0, `${n} no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  console.log(`pass ${pass} fail ${fail}`);
  await b.close();
})();
