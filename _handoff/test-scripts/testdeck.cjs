const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
const SP = __dirname;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
const seed = (st) => { const sid = 'save-1'; st.saves[sid] = { id: sid, data: { name: 'Okafor Legacy', color: '#6FCFB9', packs: ['seasons'], secretLots: [], today: 0, calendar: { seasonLength: 28, anchorDay: 0, anchorDate: { year: 2, season: 1, day: 9 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: {} }, edited_at: new Date().toISOString(), deleted_at: null, created_at: new Date().toISOString() }; return sid; };
const topLabel = (p) => p.locator('.ms-dcard[aria-hidden="false"]').getAttribute('aria-label');
async function drag(p, dx, dy = 0, steps = 8) {
  const b = await p.locator('.ms-stack').boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await p.mouse.move(x, y); await p.mouse.down();
  for (let i = 1; i <= steps; i++) { await p.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps); await p.waitForTimeout(16); }
  await p.mouse.up();
}
(async () => {
  const b = await chromium.launch();
  // phone
  {
    const st = newState(); const sid = seed(st);
    const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block', hasTouch: false });
    await ctx.addInitScript(() => { window.__SD_BUILT__ = ['sims', 'worlds']; });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//);
    await p.goto(`http://localhost:4173/#/s/${sid}/today`); await p.waitForTimeout(1200);
    ok((await topLabel(p)).startsWith('Sims.'), 'phone starts on Sims');
    ok(await p.locator('.ms-dcard.soon').count() === 2, 'phone 2 gray (households, calendar)');
    await p.screenshot({ path: `${SP}/deck-phone-0.png` });
    const peekStart = await p.locator('.ms-peek').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    // swipe left: top card goes out, then tucks behind
    const bb = await p.locator('.ms-stack').boundingBox();
    await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down();
    for (let i = 1; i <= 6; i++) { await p.mouse.move(bb.x + bb.width / 2 - i * 20, bb.y + bb.height / 2); await p.waitForTimeout(16); }
    await p.screenshot({ path: `${SP}/deck-phone-drag.png` });
    const tr = await p.locator('.ms-dcard').first().evaluate((el) => el.style.transform);
    ok(/translateX\(-1[12]\dpx\)/.test(tr), `phone top card follows finger (${tr})`);
    await p.mouse.move(bb.x + bb.width / 2 - 160, bb.y + bb.height / 2); await p.mouse.up();
    await p.waitForTimeout(120); await p.screenshot({ path: `${SP}/deck-phone-out.png` });
    await p.waitForTimeout(250); await p.screenshot({ path: `${SP}/deck-phone-tuck.png` });
    await p.waitForTimeout(400);
    ok((await topLabel(p)).startsWith('Households.'), 'phone swipe left shows next card');
    const sims = await p.locator('.ms-dcard').first().evaluate((el) => ({ z: +getComputedStyle(el).zIndex, o: getComputedStyle(el).opacity }));
    const zs = await p.locator('.ms-dcard').evaluateAll((els) => els.map((el) => +getComputedStyle(el).zIndex));
    ok(sims.o === '0' && sims.z === Math.min(...zs), `phone Sims slipped to the bottom out of sight (${JSON.stringify(sims)})`);
    const peeks = await p.locator('.ms-peek').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    ok(JSON.stringify(peeks) === JSON.stringify(peekStart), `phone stack edges never move (${peeks} vs ${peekStart})`);
    ok(await p.locator('.m-dots span').nth(1).getAttribute('class') === 'on', 'phone dots follow');
    // tap a gray card does nothing
    await p.locator('.ms-dcard[aria-hidden="false"]').click({ force: true }); await p.waitForTimeout(800);
    ok(/\/today$/.test(p.url()) && await p.locator('.deck-wipe').count() === 0, 'phone gray top card does nothing');
    // swipe right brings Sims back
    // drag right: the thrown-away card (Sims) follows the finger in from the left; the top card stays put
    {
      const sb = await p.locator('.ms-stack').boundingBox();
      await p.mouse.move(sb.x + 40, sb.y + sb.height / 2); await p.mouse.down();
      for (let i = 1; i <= 6; i++) { await p.mouse.move(sb.x + 40 + i * 20, sb.y + sb.height / 2); await p.waitForTimeout(16); }
      const simsBox = await p.locator('.ms-dcard').first().boundingBox();
      const hhTf = await p.locator('.ms-dcard').nth(1).evaluate((el) => el.style.transform);
      await p.screenshot({ path: `${SP}/deck-phone-pull.png` });
      ok(simsBox.x + simsBox.width / 2 < sb.x + sb.width / 2 - 40, `phone dragging right pulls the last card in from the left (${Math.round(simsBox.x)})`);
      ok(hhTf === 'none', `phone top card stays put while pulling back (${hhTf})`);
      await p.mouse.move(sb.x + 40 + 160, sb.y + sb.height / 2); await p.mouse.up();
    }
    await p.waitForTimeout(120); await p.screenshot({ path: `${SP}/deck-phone-in.png` }); await p.waitForTimeout(450);
    ok((await topLabel(p)).startsWith('Sims.'), 'phone swipe right brings the back card forward');
    // short drags spring back (both ways)
    await drag(p, -40); await p.waitForTimeout(500);
    ok((await topLabel(p)).startsWith('Sims.'), 'phone short left drag springs back');
    await drag(p, 40); await p.waitForTimeout(500);
    const clubs = await p.locator('.ms-dcard').last().evaluate((el) => getComputedStyle(el).opacity);
    ok((await topLabel(p)).startsWith('Sims.') && clubs === '0', 'phone short right drag sends the card back off');
    // vertical drag doesn't flip
    await drag(p, -10, 120); await p.waitForTimeout(500);
    ok((await topLabel(p)).startsWith('Sims.'), 'phone vertical drag does not flip');
    // loops: 4 nexts back to Sims (Clubs isn't in the deck without Get Together)
    for (let i = 0; i < 4; i++) { await p.getByRole('button', { name: 'Next card' }).click(); await p.waitForTimeout(620); }
    ok((await topLabel(p)).startsWith('Sims.'), 'phone deck loops');
    await p.getByRole('button', { name: 'Previous card' }).click(); await p.waitForTimeout(500);
    ok((await topLabel(p)).startsWith('Calendar.'), 'phone previous from first goes to last');
    // open a built card (Worlds: Sims, Households, Worlds)
    for (let i = 0; i < 3; i++) { await p.getByRole('button', { name: 'Next card' }).click(); await p.waitForTimeout(620); }
    ok((await topLabel(p)).startsWith('Worlds'), 'phone: the third card is Worlds');
    await p.locator('.ms-dcard[aria-hidden="false"]').click();
    await p.waitForURL(/\/worlds$/, { timeout: 4000 }); await p.waitForTimeout(700);
    ok(await p.locator('.deck-wipe').count() === 0, 'phone built card opens with the color fill');
    // pack tiles
    await p.goto('http://localhost:4173/#/s/save-1/settings'); await p.waitForTimeout(800);
    ok(errs.length === 0, 'phone no errors ' + errs.join('|'));
    await ctx.close();
  }
  // desktop
  {
    const st = newState(); const sid = seed(st);
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { window.__SD_BUILT__ = ['sims']; });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1400);
    ok(await p.locator('.deck-card.soon').count() === 3, 'desktop 3 gray cards');
    await p.screenshot({ path: `${SP}/deck-desk-home.png` });
    await p.locator('.deck-card').nth(1).click({ force: true }); await p.waitForTimeout(700);
    ok(await p.locator('.deck-wipe').count() === 0 && !/households/.test(p.url()), 'desktop gray card does nothing');
    await p.locator('.deck-card').first().click(); await p.waitForTimeout(1000);
    const r = await p.locator('.deck-card').first().boundingBox();
    ok(Math.abs(r.x + r.width / 2 - 640) < 12 && Math.abs(r.y + r.height / 2 - 400) < 12, `desktop built card glides to center (${Math.round(r.x + r.width / 2)},${Math.round(r.y + r.height / 2)})`);
    await p.waitForURL(/\/sims$/, { timeout: 4000 });
    ok(errs.length === 0, 'desktop no errors ' + errs.join('|'));
    await ctx.close();
  }
  console.log(`pass ${pass} fail ${fail}`);
  await b.close();
})();
