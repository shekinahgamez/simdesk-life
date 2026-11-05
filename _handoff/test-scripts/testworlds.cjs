// Worlds & lots, against the stand-in Supabase.
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL', m); } };
const seedSave = (st) => { const sid = '11111111-1111-4111-8111-111111111111'; const now = new Date().toISOString();
  st.saves[sid] = { id: sid, data: { name: 'Okafor Legacy', color: '#B83C76', packs: ['city-living'], secretLots: [], today: 7, calendar: { seasonLength: 28, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: {} }, edited_at: now, deleted_at: null, created_at: now }; return sid; };
const lots = (st, sid) => Object.values(st.records[sid] ?? {}).filter((r) => r.kind === 'lot' && !r.deleted_at);
const lotNamed = (st, sid, n) => lots(st, sid).find((r) => r.data.name === n);
const wait = (p, ms) => p.waitForTimeout(ms);
const shots = process.env.SHOTS;

(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['wide', 1280, 860], ['phone', 393, 852]]) {
    const phone = n === 'phone';
    const st = newState(); const sid = seedSave(st);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: phone });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/WebSocket/.test(m.text()) && errs.push(m.text()));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await wait(p, 1500);
    if (!phone) ok(await p.locator('.deck-card.soon').count() === 0, `${n} worlds card lit`);

    // worlds tab
    await p.goto(`http://localhost:4173/#/s/${sid}/worlds`); await wait(p, 900);
    ok(await p.locator('.world-tile', { hasText: 'Willow Creek' }).isVisible(), `${n} Willow Creek tile`);
    ok(await p.locator('.world-tile', { hasText: 'San Myshuno' }).isVisible(), `${n} City Living world tile`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-worlds.png`, fullPage: true });

    // lots tab: apartments preloaded
    await p.getByRole('tab', { name: 'Lots' }).click(); await wait(p, 500);
    ok(/\/worlds\/lots$/.test(p.url()), `${n} lots tab has its own address`);
    ok(await p.getByText('910 Medina Studios').count() === 0, `${n} unused game apartments folded away`);
    await p.getByRole('button', { name: /Apartments not in use/ }).click(); await wait(p, 300);
    ok(await p.getByText('910 Medina Studios').first().isVisible(), `${n} Show opens the game apartments`);
    await p.getByRole('button', { name: /Apartments not in use/ }).click(); await wait(p, 300);

    // add a lot: type required
    const addBtn = phone ? p.getByRole('button', { name: 'Add a lot' }) : p.getByRole('button', { name: 'Add lot' });
    await addBtn.first().click(); await wait(p, 400);
    let dlg = p.getByRole('dialog', { name: 'Add a lot' });
    await dlg.getByLabel('Lot name').fill('Magnolia Manor');
    await dlg.getByLabel('Size').selectOption('40x30');
    await dlg.getByLabel('Price (optional)').fill('85000');
    await dlg.getByRole('button', { name: 'Add lot' }).click(); await wait(p, 300);
    ok(await dlg.getByText('Pick a lot type.').isVisible(), `${n} lot type required`);
    await dlg.getByLabel('Lot type').fill('resid'); await dlg.getByRole('option', { name: 'Residential', exact: true }).click();
    await dlg.getByRole('button', { name: 'Add lot' }).click(); await wait(p, 500);
    ok(await p.getByRole('alertdialog', { name: 'Place Magnolia Manor now?' }).isVisible(), `${n} asks to place`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-ask.png` });
    await p.getByRole('button', { name: 'Place it' }).click(); await wait(p, 400);
    const pd = p.getByRole('dialog', { name: /Place Magnolia Manor/ });
    ok(await pd.getByText('5 empty lots fit').first().isVisible(), `${n} world shows how many fit`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-place-world.png` });
    await pd.locator('.place-world', { hasText: 'Willow Creek' }).click(); await wait(p, 300);
    if (shots) await p.screenshot({ path: `${shots}/${n}-place-spot.png` });
    ok(await pd.locator('.spot-row', { hasText: 'Crick Cabana' }).locator('.spot-state.small').isVisible(), `${n} too-small lot marked`);
    await pd.locator('.spot-row', { hasText: 'Garden Essence' }).click();
    await pd.getByRole('button', { name: 'Place here' }).click(); await wait(p, 1200);
    ok(lotNamed(st, sid, 'Magnolia Manor')?.data.spot === 'willow-creek--garden-essence' && lotNamed(st, sid, 'Magnolia Manor')?.data.price === 85000, `${n} placed and synced`);

    // three Not nows in a row: Stop asking shows on the third
    for (const [i, name] of ['Tiny Teal Cottage', 'Sunny Side Cafe', 'Velvet Room'].entries()) {
      await addBtn.first().click(); await wait(p, 300);
      dlg = p.getByRole('dialog', { name: 'Add a lot' });
      await dlg.getByLabel('Lot name').fill(name);
      await dlg.getByLabel('Lot type').fill(i === 1 ? 'cafe' : i === 2 ? 'nightc' : 'resid');
      await dlg.getByRole('option', { name: i === 1 ? 'Cafe' : i === 2 ? 'Nightclub' : 'Residential', exact: true }).click();
      await dlg.getByLabel('Size').selectOption(i === 0 ? '20x15' : '30x20');
      await dlg.getByRole('button', { name: 'Add lot' }).click(); await wait(p, 400);
      const stop = p.locator('.stop-asking');
      ok((await stop.count() > 0) === (i === 2), `${n} stop asking only on the 3rd (${i})`);
      if (i === 2) { if (shots) await p.screenshot({ path: `${shots}/${n}-stop.png` }); await stop.getByRole('button', { name: 'For now' }).click(); }
      else await p.getByRole('button', { name: 'Not now' }).click();
      await wait(p, 300);
    }
    await addBtn.first().click(); await wait(p, 300);
    dlg = p.getByRole('dialog', { name: 'Add a lot' });
    await dlg.getByLabel('Lot name').fill('Pendula Flats');
    await dlg.getByLabel('Lot type').fill('residential r'); await dlg.getByRole('option', { name: 'Residential Rental', exact: true }).click();
    await dlg.getByLabel('Size').selectOption('50x50');
    await dlg.getByRole('button', { name: 'Add lot' }).click(); await wait(p, 500);
    ok(await p.getByRole('alertdialog').count() === 0, `${n} "for now" stops asking`);
    await wait(p, 800);
    ok(lots(st, sid).length === 5, `${n} five lots synced (${lots(st, sid).length})`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-lots.png`, fullPage: true });

    // filter
    await p.locator('.filter-btn').click(); await wait(p, 300);
    await p.getByRole('button', { name: 'Not placed', exact: true }).click(); await wait(p, 200);
    if (shots) await p.screenshot({ path: `${shots}/${n}-filter.png` });
    await p.getByRole('button', { name: /^Show \d+ lots?$/ }).click(); await wait(p, 300);
    ok(await p.getByText('Magnolia Manor').count() === 0 && await p.getByText('Velvet Room').first().isVisible(), `${n} not placed filter`);
    await p.getByRole('button', { name: 'Clear', exact: true }).click(); await wait(p, 200);

    // swap: Tiny Teal onto Garden Essence
    if (phone) await p.locator('.m-row', { hasText: 'Tiny Teal Cottage' }).getByRole('button', { name: 'Place' }).click();
    else { await p.getByRole('row', { name: /Tiny Teal Cottage/ }).click(); await wait(p, 600); await p.getByRole('button', { name: 'Place it' }).click(); }
    await wait(p, 400);
    await p.locator('.place-world', { hasText: 'Willow Creek' }).click(); await wait(p, 200);
    ok(await p.locator('.spot-row', { hasText: 'Garden Essence' }).getByText('Has Magnolia Manor').isVisible(), `${n} taken lot says what's there`);
    await p.locator('.spot-row', { hasText: 'Garden Essence' }).click(); await p.getByRole('button', { name: 'Place here' }).click(); await wait(p, 300);
    ok(await p.getByRole('alertdialog', { name: 'Garden Essence already has a lot' }).isVisible(), `${n} swap asks`);
    await p.getByRole('button', { name: 'Swap', exact: true }).click(); await wait(p, 1200);
    ok(lotNamed(st, sid, 'Tiny Teal Cottage')?.data.spot === 'willow-creek--garden-essence' && lotNamed(st, sid, 'Magnolia Manor')?.data.spot === null, `${n} swap sends the old lot back`);

    // too big: Pendula Flats (50x50) on Brook Bungalow (40x30)
    await p.goto(`http://localhost:4173/#/s/${sid}/worlds/lot/${lotNamed(st, sid, 'Pendula Flats').id}`); await wait(p, 800);
    await p.getByRole('button', { name: 'Place it' }).click(); await wait(p, 300);
    await p.locator('.place-world', { hasText: 'Willow Creek' }).click(); await wait(p, 200);
    await p.locator('.spot-row', { hasText: 'Brook Bungalow' }).click(); await p.getByRole('button', { name: 'Place here' }).click(); await wait(p, 300);
    ok(await p.getByRole('alertdialog', { name: 'Too big for Brook Bungalow' }).isVisible(), `${n} too big asks`);
    await p.getByRole('button', { name: 'Place anyway' }).click(); await wait(p, 800);
    ok(await p.getByText('40x30 · Original size 50x50').isVisible(), `${n} placed size and original size`);
    // units
    await p.getByRole('button', { name: 'Add unit' }).click(); await p.getByRole('button', { name: 'Add unit' }).click(); await wait(p, 800);
    ok(lotNamed(st, sid, 'Pendula Flats').data.units.length === 2, `${n} units saved`);
    await p.getByLabel('Notes').fill('Adaeze wants Unit B.'); await wait(p, 1400);
    ok(lotNamed(st, sid, 'Pendula Flats').data.notes === 'Adaeze wants Unit B.', `${n} notes autosave`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-lot.png`, fullPage: true });

    // world page: table and an empty lot's menu
    await p.goto(`http://localhost:4173/#/s/${sid}/worlds/willow-creek`); await wait(p, 900);
    ok(await p.getByText('21 lots · 2 in use').isVisible(), `${n} world counts`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-world.png`, fullPage: true });
    const emptyRow = p.locator('.hood-row', { hasText: 'Oakenstead' });
    await emptyRow.click(); await wait(p, 300);
    ok(await p.getByRole('alertdialog', { name: 'Oakenstead' }).isVisible(), `${n} empty lot menu`);
    await p.getByRole('button', { name: 'Put a lot here' }).click(); await wait(p, 300);
    await p.locator('.spot-row', { hasText: 'Magnolia Manor' }).click(); await wait(p, 1000);
    ok(lotNamed(st, sid, 'Magnolia Manor').data.spot === 'willow-creek--oakenstead', `${n} put a lot here`);

    // apartment: a downloaded one, used in a game apartment
    await p.goto(`http://localhost:4173/#/s/${sid}/worlds/lots`); await wait(p, 600);
    await addBtn.first().click(); await wait(p, 300);
    dlg = p.getByRole('dialog', { name: 'Add a lot' });
    await dlg.getByLabel('Lot name').fill('Spice Loft');
    await dlg.getByLabel('Lot type').fill('apart'); await dlg.getByRole('option', { name: 'Apartment', exact: true }).click();
    ok(await dlg.getByLabel('Size').count() === 0, `${n} apartments ask "meant for" instead of size`);
    await dlg.getByLabel('Meant for (optional)').selectOption({ label: '910 Medina Studios · San Myshuno' });
    await dlg.getByRole('button', { name: 'Add lot' }).click(); await wait(p, 500);
    await p.goto(`http://localhost:4173/#/s/${sid}/worlds/apt/san-myshuno--910-medina-studios`); await wait(p, 800);
    ok(await p.getByText('The game’s original').isVisible(), `${n} apartment uses the original`);
    await p.getByRole('button', { name: 'Use this' }).click(); await wait(p, 1000);
    ok(lotNamed(st, sid, 'Spice Loft').data.spot === 'san-myshuno--910-medina-studios', `${n} use a saved apartment`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-apt.png`, fullPage: true });

    // delete a lot
    await p.goto(`http://localhost:4173/#/s/${sid}/worlds/lot/${lotNamed(st, sid, 'Velvet Room').id}`); await wait(p, 700);
    await p.getByRole('button', { name: 'Delete lot' }).click(); await p.getByRole('button', { name: 'Delete', exact: true }).click(); await wait(p, 1000);
    ok(!lotNamed(st, sid, 'Velvet Room') && /\/worlds\/lots$/.test(p.url()), `${n} delete goes to Trash`);

    // App settings: ask to place, for good
    await p.goto('http://localhost:4173/#app-settings'); await wait(p, 900);
    const sw = p.getByRole('button', { name: 'Ask to place newly created lots' });
    ok(await sw.isVisible(), `${n} app settings has the switch`);
    await sw.click(); await wait(p, 900);
    ok(st.account?.data?.prefs?.askToPlace === false, `${n} for good saved to account`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-settings.png`, fullPage: true });

    ok(errs.length === 0, `${n} no errors: ${errs.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
