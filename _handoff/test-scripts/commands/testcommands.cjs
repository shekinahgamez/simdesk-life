// Command bar (desktop) and Quick actions (phone): real-app checks + screenshots.
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
const { seed, SID, PORTRAIT_IDS } = require('./seed.cjs');
const photos = require('./photos.json');
const out = process.argv[2] || '.';
const OS='2d60f4a8-fefa-e5d3-2799-4f1713e472e4',PR='5056d802-6c5e-a304-9c79-671c6a49385d',AD='2ba8ae06-801b-34f8-1c6c-2bd8d57f92dd',FE='f9b9b9c1-35c2-a19a-b78c-8253484322a9',CO='4782e179-bd45-4205-a681-5306199d4c7d';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
async function start(b, w, h) {
  const st = newState(); seed(st);
  st.saves[SID].data = { ...st.saves[SID].data, rotation: { order: [OS, PR, AD, FE], lengths: {}, current: OS, startDay: -1, round: 1, roundStart: OS } };
  PORTRAIT_IDS.forEach((id, i) => { const ph = photos[i % photos.length]; st.files[`u1/${id}.webp`] = { data: Buffer.from(ph.full, 'base64'), type: 'image/webp' }; st.files[`u1/${id}_t.webp`] = { data: Buffer.from(ph.thumb, 'base64'), type: 'image/webp' }; st.photos[id] = { id, save_id: SID, bytes: 1 }; });
  const phone = w < 500;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', deviceScaleFactor: 2, isMobile: phone, hasTouch: phone });
  const p = await ctx.newPage(); p.on('pageerror', (e) => { fail++; console.log('PAGEERR', e.message); });
  await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
  await p.goto(`http://localhost:4173/#/s/${SID}/today`); await p.waitForTimeout(4000);
  return { p, st };
}
const shot = (p, f) => p.screenshot({ path: `${out}/${f}.png` });
(async () => {
  const b = await chromium.launch();
  // ---------- desktop ----------
  let { p } = await start(b, 1440, 900);
  const bar = p.getByRole('dialog', { name: 'Command bar' });
  const input = bar.getByRole('combobox');
  const open = async (q = '') => { await p.keyboard.press('Control+k'); await bar.waitFor(); if (q) await input.fill(q); await p.waitForTimeout(150); };
  const rows = () => bar.locator('.cb-r');
  ok(await p.getByRole('button', { name: /Search/ }).isVisible(), 'sidebar Search button');
  await shot(p, 'd0-closed');
  await p.getByRole('button', { name: /Search/ }).click(); ok(await bar.isVisible(), 'Search button opens bar');
  ok((await bar.locator('.cb-h').allTextContents()).includes('Quick'), 'Quick group when empty');
  ok(/Osborne/.test(await rows().first().innerText()), 'first quick row says Playing now: Osborne');
  await shot(p, 'd1-open');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); ok(!(await bar.isVisible()), 'Esc closes');
  await p.locator('body').click({ position: { x: 1300, y: 800 } });
  await p.keyboard.press('/'); await bar.waitFor(); ok((await input.inputValue()) === '/', '"/" opens with slash');
  ok((await rows().count()) === 17, `17 commands listed (got ${await rows().count()})`);
  await shot(p, 'd2-slash');
  await input.fill('/hou'); await p.waitForTimeout(100);
  ok((await rows().count()) === 1 && /New household/.test(await rows().first().innerText()), '/hou finds /household');
  await input.fill('cor'); await p.waitForTimeout(150);
  ok(/Play Coriana/.test(await rows().first().innerText()), '"cor" offers Play Coriana first');
  ok((await bar.locator('.cb-h').allTextContents()).join('|').includes('Households'), 'search shows Households group');
  ok((await bar.innerText()).includes('Cori Fletcher'), 'search finds the Sim Cori Fletcher');
  await shot(p, 'd3-search-cor');
  await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  ok(!(await bar.isVisible()), 'bar closes after running');
  ok(/Now playing Coriana/.test(await p.locator('.toast').innerText()), 'toast Now playing Coriana');
  ok(/Coriana household/.test(await p.locator('.rot-now .rot-name').innerText()), 'Playing now card shows Coriana');
  await shot(p, 'd4-after');
  await p.locator('.toast-btn').click(); await p.waitForTimeout(300);
  ok(/Osborne household/.test(await p.locator('.rot-now .rot-name').innerText()), 'Undo puts Osborne back');
  // chip + picker
  await open('/play ');
  ok(await bar.locator('.cb-tok').isVisible(), 'chip shows after "/play "');
  ok((await bar.locator('.cb-h').allTextContents()).join('|') === 'In the rotation|Not in the rotation', 'picker groups');
  ok(/Osborne/.test(await rows().first().innerText()) && /Playing now/.test(await rows().first().innerText()), 'Osborne first, tagged Playing now');
  ok((await bar.locator('.cb-r.on').innerText()).includes('Priestley'), 'selection starts on Priestley (Up next), not Playing now');
  await shot(p, 'd5-play-picker');
  await input.press('Backspace'); await p.waitForTimeout(100);
  ok((await input.inputValue()) === '/play' && !(await bar.locator('.cb-tok').count()), 'Backspace on empty chip goes back to /play');
  await input.fill('/play pri'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(/Priestley household/.test(await p.locator('.rot-now .rot-name').innerText()), '/play pri plays Priestley');
  // add
  await open('/add bap'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(/Baptiste household added/.test(await p.locator('.toast').innerText()), '/add adds Baptiste');
  // dates
  const h1 = () => p.locator('.today-head h1').innerText();
  const d0 = await h1();
  await open('/next'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(/Spring 13/.test(await h1()) && /Spring 12/.test(d0), `/next moves a day (${d0} -> ${await h1()})`);
  await open('/jump 3'); ok(/Jump ahead 3 days/.test(await rows().first().innerText()), '/jump 3 row'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(/Spring 16/.test(await h1()), '/jump 3 moves to Spring 16');
  await open('/back 2'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(/Spring 14/.test(await h1()), '/back 2 to Spring 14');
  await open('/jump'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  ok(await p.getByText('Jump ahead to').isVisible(), '/jump alone opens the calendar'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // end turn
  await open('/end'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  ok(await p.getByRole('dialog').filter({ hasText: /End/ }).first().isVisible(), '/end opens End turn'); await shot(p, 'd6-endturn'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // make
  await open('/sim Maya Brooks'); ok(/New Sim “Maya Brooks”/.test(await rows().first().innerText()), '/sim row shows name'); await p.keyboard.press('Enter'); await p.waitForTimeout(600);
  const vals = await p.locator('.modal input').evaluateAll((els) => els.map((e) => e.value));
  ok(vals.includes('Maya') && vals.includes('Brooks'), `Sim form filled (${vals.slice(0, 3)})`);
  await shot(p, 'd7-new-sim');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); if (await p.getByRole('button', { name: 'Discard' }).count()) { await p.getByRole('button', { name: 'Discard' }).click(); await p.waitForTimeout(300); }
  await open('/household Fletcher'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  ok((await p.locator('.modal input').first().inputValue()) === 'Fletcher', 'household form filled');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await open('/club Night Owls'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  ok((await p.locator('.modal input').evaluateAll((els) => els.map((e) => e.value))).includes('Night Owls'), 'club form filled');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); if (await p.getByRole('button', { name: 'Discard' }).count()) { await p.getByRole('button', { name: 'Discard' }).click(); await p.waitForTimeout(300); }
  await open('/event Cori’s wedding'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  ok((await p.locator('.modal input').evaluateAll((els) => els.map((e) => e.value))).includes('Cori’s wedding'), 'event form filled');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); if (await p.getByRole('button', { name: 'Discard' }).count()) { await p.getByRole('button', { name: 'Discard' }).click(); await p.waitForTimeout(300); }
  await open('/lot 21 Chic Street'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  ok((await p.locator('.modal input').evaluateAll((els) => els.map((e) => e.value))).includes('21 Chic Street'), 'lot form filled');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300); if (await p.getByRole('button', { name: 'Discard' }).count()) { await p.getByRole('button', { name: 'Discard' }).click(); await p.waitForTimeout(300); }
  // move
  await open('/move kai'); ok(/Kai Osborne/.test(await rows().first().innerText()), '/move kai finds Kai'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
  ok((await input.inputValue()) === 'Kai Osborne to ', `Enter fills "to" (${await input.inputValue()})`);
  await input.fill('Kai Osborne to cor'); await p.waitForTimeout(100); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok(/Moved Kai to Coriana household/.test(await p.locator('.toast').innerText()), `/move toast (${await p.locator('.toast').innerText()})`);
  // help + theme + settings
  await open('/help '); ok((await bar.locator('.cb-help').count()) === 17, 'help lists 17'); await shot(p, 'd8-help');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await open('/theme dark'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  ok((await p.evaluate(() => document.documentElement.dataset.sdTheme)) === 'dark', '/theme dark');
  await open('/theme light'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await open('/settings'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  ok(/\/settings$/.test(p.url()), '/settings goes to Save settings');
  await open('sims'); await p.waitForTimeout(100);
  ok((await bar.locator('.cb-h').allTextContents()).includes('Pages'), 'pages are searchable');
  await p.keyboard.press('Escape');
  // "/" inside a box types a slash, doesn't open
  await p.goto(`http://localhost:4173/#/s/${SID}/sims`); await p.waitForTimeout(1200);
  const sb = p.locator('input[type=search]').first(); await sb.click(); await p.keyboard.press('/'); await p.waitForTimeout(200);
  ok(!(await bar.isVisible()), '"/" in a search box does not open the bar');
  await p.keyboard.press('Control+k'); await p.waitForTimeout(200); ok(await bar.isVisible(), 'Ctrl K works from inside a box');
  await p.keyboard.press('Control+k'); await p.waitForTimeout(200); ok(!(await bar.isVisible()), 'Ctrl K again closes');
  await p.context().close();

  // ---------- phone ----------
  ({ p } = await start(b, 390, 844));
  ok(await p.getByRole('button', { name: 'Quick actions' }).isVisible(), 'lightning button on Today');
  await p.keyboard.press('Control+k'); await p.waitForTimeout(200); ok(!(await p.getByRole('dialog', { name: 'Command bar' }).count()), 'no command bar on phone');
  await shot(p, 'p0-today');
  await p.getByRole('button', { name: 'Quick actions' }).click(); await p.waitForTimeout(500);
  const sheet = p.getByRole('dialog', { name: 'Quick actions' });
  ok(await sheet.isVisible(), 'Quick actions sheet opens');
  ok((await sheet.locator('.qa-tile').count()) === 16, `16 tiles (got ${await sheet.locator('.qa-tile').count()})`);
  await shot(p, 'p1-quick-actions');
  await sheet.getByRole('button', { name: 'Play someone else' }).click(); await p.waitForTimeout(600);
  const pick = p.getByRole('dialog', { name: 'Play someone else' });
  ok(await pick.isVisible(), 'Play someone else sheet');
  await shot(p, 'p2-play-pick');
  await pick.locator('.cb-r', { hasText: 'Coriana' }).click(); await p.waitForTimeout(600);
  ok(/Now playing Coriana/.test(await p.locator('.toast').innerText()), 'phone: tap Coriana plays them');
  await shot(p, 'p3-after');
  await p.getByRole('button', { name: 'Quick actions' }).click(); await p.waitForTimeout(500);
  await p.getByRole('dialog', { name: 'Quick actions' }).getByRole('button', { name: 'New Sim' }).click(); await p.waitForTimeout(600);
  ok(await p.getByRole('dialog').filter({ hasText: 'New Sim' }).first().isVisible(), 'phone: New Sim opens the form');
  await p.goto(`http://localhost:4173/#/s/${SID}/more`); await p.waitForTimeout(1200);
  ok(await p.getByRole('button', { name: 'Quick actions' }).isVisible(), 'lightning button on More');
  await p.context().close();
  await b.close();
  console.log(`testcommands: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
