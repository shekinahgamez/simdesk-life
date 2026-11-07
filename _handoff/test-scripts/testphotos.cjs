// Photos area, against the stand-in Supabase.
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const wait = (p, ms) => p.waitForTimeout(ms);
const shots = process.env.SHOTS;
const SID = '11111111-1111-4111-8111-111111111111';
const sim = (first, last) => ({ first, last, gender: 'female', householdId: null, bornDay: -100, addedDay: 0, stage: null, traits: [], aspiration: null, occult: null, pronouns: '', orientation: '', career: '', careerLevel: null, genderSettings: {}, notes: '', portrait: null, stagePhotos: [], deceased: null });
const photos = (st) => Object.values(st.records[SID] ?? {}).filter((r) => r.kind === 'photo');

(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['wide', 1280, 860], ['phone', 393, 852]]) {
    const phone = n === 'phone';
    const st = newState(); const now = new Date().toISOString();
    st.saves[SID] = { id: SID, data: { name: 'Okafor Legacy', color: '#B83C76', packs: [], secretLots: [], today: 7, calendar: { seasonLength: 28, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: {} }, edited_at: now, deleted_at: null, created_at: now };
    const put = (id, kind, data) => { (st.records[SID] ||= {})[id] = { id, kind, data, edited_at: now, deleted_at: null }; };
    put('aaaaaaaa-0000-4000-8000-000000000001', 'sim', sim('Adaeze', 'Okafor'));
    put('aaaaaaaa-0000-4000-8000-000000000002', 'sim', sim('Tobi', 'Okafor'));
    put('eeeeeeee-0000-4000-8000-000000000001', 'event', { name: 'Adaeze’s graduation party', day: 13, host: null, going: [], notes: '', banner: 'graduation' });
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: phone, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await wait(p, 1500);

    // no deck card for Photos; it has its own link
    ok(await p.locator('.deck-card', { hasText: 'Photos' }).count() === 0, `${n} no Photos deck card`);
    if (phone) { await p.goto(`http://localhost:4173/#/s/${SID}/more`); await wait(p, 600); await p.getByRole('link', { name: /Photos/ }).click(); }
    else await p.getByRole('link', { name: 'Photos' }).first().click();
    await wait(p, 700);
    ok(/\/photos$/.test(p.url()), `${n} opens Photos`);
    ok(await p.getByText('No photos yet').first().isVisible(), `${n} empty state`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-empty.png` });

    // add a photo
    const addPhoto = async (btnScope) => {
      const chooser = p.waitForEvent('filechooser');
      await btnScope.getByRole('button', { name: /Add photo/ }).first().click();
      await (await chooser).setFiles('portrait.png');
      await p.getByRole('dialog', { name: 'Add a photo' }).waitFor({ timeout: 8000 });
    };
    await addPhoto(p);
    let dlg = p.getByRole('dialog', { name: 'Add a photo' });
    await dlg.getByLabel('Caption').fill('Adaeze blowing out her candles');
    await dlg.getByRole('button', { name: /^Sims in this photo:/ }).click(); await wait(p, 300);
    await p.getByRole('dialog').getByRole('checkbox', { name: 'Adaeze Okafor' }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Done · 1 selected' }).click(); await wait(p, 300);
    ok(await dlg.getByRole('button', { name: /^Sims in this photo: Adaeze/ }).isVisible(), `${n} Sims row shows who is tagged`);
    ok(await dlg.getByText('Club (optional)').count() === 0, `${n} no Club row when the save has no clubs`);
    ok(await dlg.getByText('Game date', { exact: true }).isVisible(), `${n} game date field for a dated save`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-add.png` });
    await dlg.getByRole('button', { name: 'Add photo' }).click(); await wait(p, 2000);
    const ph = photos(st);
    ok(ph.length === 1 && Object.keys(st.photos).length === 1 && Object.keys(st.files).length === 2, `${n} photo uploaded and saved`);
    ok(ph[0]?.data.caption === 'Adaeze blowing out her candles' && ph[0].data.simIds.length === 1, `${n} caption and Sim saved`);
    ok(ph[0]?.data.gameDay === 7, `${n} game date defaults to today`);
    ok(!!ph[0]?.data.added, `${n} added day saved`);
    ok(await p.getByRole('link', { name: 'Adaeze blowing out her candles' }).isVisible(), `${n} tile in the grid`);
    ok(await p.getByRole('heading', { name: /Spring · Year 1/ }).isVisible(), `${n} section by game season`);
    ok(await p.locator('.ph-tile img').first().evaluate((i) => i.complete && i.naturalWidth > 0), `${n} thumbnail shows`);
    if (!phone) ok(await p.locator('.ph-tile .photo-box').first().evaluate((e) => Math.abs(e.getBoundingClientRect().width - e.getBoundingClientRect().height) < 2), `${n} tiles are square`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-grid.png`, fullPage: true });

    // photo page
    await p.locator('.ph-tile').first().click(); await wait(p, 800);
    ok(/\/photos\/[0-9a-f-]+$/.test(p.url()), `${n} photo page address`);
    ok(await p.getByRole('heading', { name: 'Adaeze blowing out her candles' }).isVisible(), `${n} photo page title`);
    ok(await p.getByRole('link', { name: /Adaeze Okafor/ }).isVisible(), `${n} tagged Sim links`);
    ok(await p.locator('.ph-when b', { hasText: 'Year 1 · Spring · Day 8' }).isVisible() && await p.locator('.ph-when span', { hasText: /^Added / }).isVisible(), `${n} game date leads, added day is quiet`);
    ok(await p.getByText('1 of 1').isVisible(), `${n} position shows`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-photo.png`, fullPage: true });

    // remove the game date: the added day leads alone
    await p.getByRole('button', { name: 'Edit' }).click(); await wait(p, 400);
    dlg = p.getByRole('dialog', { name: 'Edit photo' });
    await dlg.getByRole('button', { name: 'Remove', exact: true }).click();
    await dlg.getByRole('button', { name: 'Save' }).click(); await wait(p, 700);
    ok(photos(st)[0].data.gameDay === null, `${n} game date removed`);
    ok(await p.locator('.ph-when b', { hasText: /^Added / }).isVisible() && await p.locator('.ph-when span').count() === 0, `${n} added day leads alone`);

    // on the Sim's profile
    await p.goto(`http://localhost:4173/#/s/${SID}/sims/aaaaaaaa-0000-4000-8000-000000000001`); await wait(p, 900);
    
    ok(await p.locator('.ph-mini').first().isVisible(), `${n} photo on the Sim's profile`);
    await p.goto(`http://localhost:4173/#/s/${SID}/sims/aaaaaaaa-0000-4000-8000-000000000002`); await wait(p, 900);
    
    ok(await p.locator('.ph-mini').count() === 0 && await p.getByText('No photos of them yet.').isVisible(), `${n} no photos for an untagged Sim`);

    // on a calendar event
    await p.goto(`http://localhost:4173/#/s/${SID}/calendar/event/eeeeeeee-0000-4000-8000-000000000001`); await wait(p, 900);
    await addPhoto(p.locator('section.card', { hasText: 'Photos' }));
    dlg = p.getByRole('dialog', { name: 'Add a photo' });
    await dlg.getByLabel('Caption').fill('Cap and gown');
    await dlg.getByRole('button', { name: 'Add photo' }).click(); await wait(p, 2000);
    const ev = photos(st).find((r) => r.data.caption === 'Cap and gown');
    ok(ev?.data.item?.kind === 'event' && ev.data.gameDay === 13, `${n} attached to the event, dated to its day`);
    ok(await p.locator('.ph-mini').count() === 1, `${n} event page shows its photo`);
    if (!phone) ok(await p.locator('.cal-item-grid > .card').count() >= 3, `${n} cards laid out in columns`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-event.png`, fullPage: true });

    // grid order: dated first, then the undated one; filter by Sim
    await p.goto(`http://localhost:4173/#/s/${SID}/photos`); await wait(p, 800);
    const caps = await p.locator('.ph-tile').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    ok(caps[0] === 'Cap and gown', `${n} game-dated photo first (${caps.join(' | ')})`);
    // sections: the game-date one, then "No game date" last
    const heads = await p.locator('.ph-group h2').allInnerTexts();
    ok(/Spring · Year 1/.test(heads[0]) && /No game date/.test(heads[heads.length - 1]), `${n} sections: ${heads.join(' | ')}`);
    ok(await p.getByRole('button', { name: /^Adaeze$/ }).count() === 0, `${n} no name pills`);
    if (phone) { const one = await p.locator('.ph-tiles.n1 .ph-tile').count(); ok(one === 2, `${n} single-photo sections fill the row (${one})`); }
    // search: suggestions by kind
    const box = p.getByRole('searchbox', { name: 'Search photos' });
    await box.fill('ada'); await wait(p, 300);
    const sg = p.getByRole('listbox', { name: 'Suggestions' });
    ok(await sg.getByText('Sims', { exact: true }).isVisible() && await sg.getByText('Occasions', { exact: true }).isVisible() && await sg.getByText('Captions', { exact: true }).isVisible(), `${n} suggestions grouped`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-search.png` });
    await sg.getByRole('button', { name: /Adaeze Okafor/ }).click(); await wait(p, 400);
    ok(await p.locator('.ph-tile').count() === 1 && await p.locator('.ph-sum').innerText().then((t) => /Adaeze · 1 photo/.test(t)), `${n} picking a Sim filters, summary line shows`);
    ok(await box.inputValue() === '', `${n} search box empties after picking`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-filtered.png` });
    await p.locator('.ph-sum').getByRole('button', { name: 'Clear' }).click(); await wait(p, 300);
    ok(await p.locator('.ph-tile').count() === 2, `${n} Clear brings them back`);
    await box.fill('graduation'); await box.press('Enter'); await wait(p, 400);
    ok(await p.locator('.ph-tile').count() === 1 && await p.getByRole('link', { name: 'Cap and gown' }).isVisible(), `${n} Enter shows everything that matches (occasion name)`);
    await box.fill('candles'); await box.press('Enter'); await wait(p, 300);
    ok(await p.locator('.ph-tile').count() === 1 && await p.getByRole('link', { name: /candles/ }).isVisible(), `${n} caption words match`);
    await box.fill('zzzz'); await box.press('Enter'); await wait(p, 300);
    ok(await p.getByText('No photos match that').isVisible(), `${n} nothing matches`);
    await p.getByRole('button', { name: 'Clear', exact: true }).last().click(); await wait(p, 300);
    // filter sheet
    await p.getByRole('button', { name: /^Filter/ }).click(); await wait(p, 500);
    const fd = p.getByRole('dialog', { name: 'Filter' });
    if (shots) await p.screenshot({ path: `${shots}/${n}-dbg.png` });
    ok(await fd.getByText('Sort by').isVisible() && await fd.getByRole('button', { name: 'Game date' }).isVisible(), `${n} sort lives in the filter`);
    ok(await fd.getByText('Sims', { exact: true }).isVisible() && await fd.getByText('When', { exact: true }).isVisible() && await fd.getByText('Occasion', { exact: true }).isVisible(), `${n} filter rows: Sims, When, Occasion`);
    ok(await fd.getByRole('button', { name: /^Sims: Any/ }).innerText().then((t) => /Change/.test(t)), `${n} Sims row says Change`);
    ok(await fd.getByRole('button', { name: 'Game date' }).getAttribute('aria-pressed') === 'true', `${n} Game date is the selected sort`);
    ok(await fd.getByText('Only photos they’re all in.').count() === 0, `${n} no hint line under Sims`);
    await fd.getByRole('button', { name: /^Occasion:/ }).click(); await wait(p, 300);
    ok(await p.getByRole('searchbox', { name: 'Search occasions' }).isVisible() && await p.getByText('Spring · Year 1 · Day 14').isVisible(), `${n} occasion list has a search and the date under the name`);
    await p.getByRole('option', { name: /graduation/ }).click(); await wait(p, 300);
    ok(await p.getByRole('dialog', { name: 'Filter' }).getByRole('button', { name: /^Occasion: Adaeze’s graduation party/ }).isVisible(), `${n} picking an occasion goes back to Filter`);
    ok(await fd.getByRole('button', { name: /Show 1 photo/ }).isVisible(), `${n} Show N photos counts live`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-sheet.png` });
    await fd.getByRole('button', { name: /Show 1 photo/ }).click(); await wait(p, 400);
    ok(await p.locator('.ph-tile').count() === 1 && await p.locator('.filter-btn .count').innerText() === '1', `${n} occasion filter on, button shows 1`);
    // the viewer stays inside the filtered grid, and Back keeps the filter
    await p.locator('.ph-tile').first().click(); await wait(p, 600);
    ok(await p.getByText('1 of 1').isVisible() && await p.getByRole('button', { name: 'Next photo' }).count() === 0, `${n} viewer follows the filter (1 of 1)`);
    await p.locator('.ph-back').click(); await wait(p, 600);
    ok(await p.locator('.ph-tile').count() === 1 && await p.locator('.filter-btn .count').innerText() === '1', `${n} Back keeps the filter on`);
    await p.getByRole('button', { name: /^Filter/ }).click(); await wait(p, 400);
    await p.getByRole('dialog', { name: 'Filter' }).getByRole('button', { name: 'Clear all' }).click(); await wait(p, 200);
    {
      const fdlg = () => p.getByRole('dialog', { name: 'Filter' });
      const showN = (t) => fdlg().getByRole('button', { name: t }).isVisible();
      ok(await fdlg().getByRole('button', { name: /^Occasion: Any/ }).isVisible() && await showN('Show 2 photos'), `${n} Clear all empties every row`);
      // Sims: a searchable checklist
      await fdlg().getByRole('button', { name: /^Sims:/ }).click(); await wait(p, 300);
      ok(await p.getByRole('searchbox', { name: 'Search Sims' }).isVisible() && await p.getByRole('checkbox').count() === 1, `${n} Sims list: search and a checkbox per Sim tagged in photos`);
      ok(await p.getByText('Selected', { exact: true }).count() === 0, `${n} no Selected heading before anyone is picked`);
      await p.getByRole('searchbox', { name: 'Search Sims' }).fill('zzz'); await wait(p, 200);
      ok(await p.getByText(/No Sim called/).isVisible(), `${n} Sims search with no match`);
      await p.getByRole('searchbox', { name: 'Search Sims' }).fill(''); await wait(p, 200);
      await p.getByRole('checkbox', { name: 'Adaeze Okafor' }).click(); await wait(p, 200);
      ok(await p.getByRole('checkbox', { name: 'Adaeze Okafor' }).getAttribute('aria-checked') === 'true' && await p.getByText('Selected', { exact: true }).isVisible(), `${n} picked Sim moves under Selected`);
      await p.getByRole('button', { name: 'Back to Filter' }).click(); await wait(p, 300);
      ok(await fdlg().getByRole('button', { name: /^Sims: Adaeze Okafor/ }).isVisible() && await showN('Show 1 photo'), `${n} Sims row shows the names, count updates`);
      await fdlg().getByRole('button', { name: 'Clear all' }).click(); await wait(p, 200);
      // When: the calendar picker, as a range
      await fdlg().getByRole('button', { name: /^When:/ }).click(); await wait(p, 400);
      ok(await p.locator('.dp').isVisible() && await p.locator('.dp h2', { hasText: /^Spring$/ }).isVisible(), `${n} When opens the calendar picker`);
      await p.getByRole('button', { name: 'Spring 20', exact: true }).click(); await p.getByRole('button', { name: 'Spring 10', exact: true }).click(); await wait(p, 200);
      ok(await p.getByText(/before the first day/).isVisible() && await p.locator('.dp').isVisible(), `${n} a last day before the first is refused`);
      await p.getByRole('button', { name: 'Spring 25', exact: true }).click(); await wait(p, 300);
      ok(await fdlg().getByRole('button', { name: /^When: Spring 20 → Spring 25 · Year 1/ }).isVisible() && await showN('Show 0 photos'), `${n} range picked: text and count (no photo dated in it)`);
      await fdlg().getByRole('button', { name: /^When:/ }).click(); await wait(p, 300);
      ok(await p.locator('.dp-day.sel').count() === 2 && await p.locator('.dp-day.mid').count() === 4, `${n} the picked range is drawn`);
      await p.getByRole('button', { name: 'Spring 14', exact: true }).click(); await p.getByRole('button', { name: 'Spring 14', exact: true }).click(); await wait(p, 300);
      ok(await fdlg().getByRole('button', { name: /^When: Spring 14 · Year 1/ }).isVisible() && await showN('Show 1 photo'), `${n} same day twice is a single day`);
      await fdlg().getByRole('button', { name: /^When:/ }).click(); await wait(p, 300);
      await p.getByRole('button', { name: 'Spring 1', exact: true }).click(); await p.getByRole('button', { name: 'Spring 28', exact: true }).click(); await wait(p, 300);
      ok(await fdlg().getByRole('button', { name: /^When: Spring · Year 1/ }).isVisible() && await showN('Show 1 photo'), `${n} a whole season reads as the season`);
      await fdlg().getByRole('button', { name: /^When:/ }).click(); await wait(p, 300);
      await p.getByRole('button', { name: 'Clear dates' }).click(); await p.getByRole('button', { name: 'Back to Filter' }).click(); await wait(p, 300);
      ok(await fdlg().getByRole('button', { name: /^When: Any/ }).isVisible() && await showN('Show 2 photos'), `${n} Clear dates puts When back to Any`);
      // a range filters the grid and the button badge, and survives opening a photo
      await fdlg().getByRole('button', { name: /^When:/ }).click(); await wait(p, 300);
      await p.getByRole('button', { name: 'Spring 10', exact: true }).click(); await p.getByRole('button', { name: 'Spring 20', exact: true }).click(); await wait(p, 300);
      await fdlg().getByRole('button', { name: 'Show 1 photo' }).click(); await wait(p, 400);
      ok(await p.locator('.ph-tile').count() === 1 && await p.locator('.filter-btn .count').innerText() === '1' && /Spring 10 → Spring 20 · Year 1 · 1 photo/.test(await p.locator('.ph-sum').innerText()), `${n} range filters the grid, badge and summary line`);
      await p.getByRole('button', { name: /^Filter/ }).click(); await wait(p, 400);
      await fdlg().getByRole('button', { name: 'Clear all' }).click(); await wait(p, 200);
    }
    await p.getByRole('dialog', { name: 'Filter' }).getByRole('button', { name: 'Date added' }).click(); await wait(p, 200);
    await p.getByRole('dialog', { name: 'Filter' }).getByRole('button', { name: /Show 2 photos/ }).click(); await wait(p, 400);
    const heads2 = await p.locator('.ph-group h2').allInnerTexts();
    ok(heads2.length === 1 && !/Year 1|No game date/.test(heads2[0]), `${n} date added groups by month: ${heads2.join(' | ')}`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-added.png` });
    const gridOrder = await p.locator('.ph-tile').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    await p.locator('.ph-tile').first().click(); await wait(p, 600);
    await p.keyboard.press('ArrowRight'); await wait(p, 500);
    ok(await p.getByText('2 of 2').isVisible() && await p.getByRole('heading', { level: 1 }).first().innerText().then((t) => gridOrder[1].includes(t) || t.includes(gridOrder[1])), `${n} viewer follows Date added order (${gridOrder.join(' | ')})`);
    await p.locator('.ph-back').click(); await wait(p, 600);
    await p.getByRole('button', { name: /^Filter/ }).click(); await wait(p, 400);
    await p.getByRole('dialog', { name: 'Filter' }).getByRole('button', { name: 'Game date' }).click();
    await p.getByRole('dialog', { name: 'Filter' }).getByRole('button', { name: /Show 2 photos/ }).click(); await wait(p, 400);
    // next / previous
    await p.locator('.ph-tile').first().click(); await wait(p, 600);
    ok(await p.getByText('1 of 2').isVisible(), `${n} 1 of 2`);
    if (phone) { const st = p.locator('.ph-stage'); const bb = await st.boundingBox(); await p.touchscreen.tap(bb.x + 5, bb.y + 5); }
    else { await p.keyboard.press('ArrowRight'); }
    if (!phone) { await wait(p, 500); ok(await p.getByText('2 of 2').isVisible(), `${n} arrow key goes to the next photo`); await p.getByRole('button', { name: 'Previous photo' }).click(); await wait(p, 500); ok(await p.getByText('1 of 2').isVisible(), `${n} previous button`); }

    // delete goes to Trash
    await p.getByRole('button', { name: 'Edit' }).click(); await wait(p, 300);
    await p.getByRole('dialog', { name: 'Edit photo' }).getByRole('button', { name: 'Cancel' }).click(); await wait(p, 300);
    await p.goto(`http://localhost:4173/#/s/${SID}/photos`); await wait(p, 700);
    await p.getByRole('link', { name: 'Cap and gown' }).click(); await wait(p, 600);
    await p.getByRole('button', { name: 'Edit' }).click(); await wait(p, 300);
    await p.getByRole('dialog', { name: 'Edit photo' }).getByRole('button', { name: /Delete/ }).click();
    await p.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click(); await wait(p, 700);
    ok(photos(st).find((r) => r.data.caption === 'Cap and gown')?.deleted_at, `${n} delete moves it to Trash`);
    ok(/\/photos$/.test(p.url()), `${n} back to the grid after deleting`);

    ok(errs.length === 0, `${n} no errors: ${errs.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
