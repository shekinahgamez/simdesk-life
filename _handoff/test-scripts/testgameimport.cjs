// Import from game (Nov 2026): button on desktop Today only, pick a Logger file, review sheet, apply, Undo.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { mock, newState, logIn } = require('./mockdb.cjs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const SID = '44444444-4444-4444-8444-444444444444';
const TABLE = { teen_start: null };
const seed = (st, { money = true, link = null } = {}) => {
  const now = new Date().toISOString();
  const data = { name: 'Import Save', color: '#B83C76', packs: [], secretLots: [], today: 100, calendar: { seasonLength: 21, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: { rotation: true, funds: money }, money: { snb: true, simfin: false } };
  data.rotation = { order: ['hh', 'hp'], lengths: {}, current: 'hp', startDay: 98, round: 1, roundStart: 'hp' };
  if (link) data.gameLink = link;
  st.saves[SID] = { id: SID, data, edited_at: now, deleted_at: null, created_at: now };
  const rec = (id, kind, d) => ({ id, save_id: SID, kind, data: d, edited_at: now, deleted_at: null, created_at: now });
  st.records[SID] = {
    hh: rec('hh', 'household', { name: 'Harlow', home: null, notes: 'keep me' }),
    hp: rec('hp', 'household', { name: 'Priestley', home: null, notes: '' }),
    s1: rec('s1', 'sim', { first: 'Darnell', last: 'Harlow', gender: 'male', bornDay: -9000, householdId: 'hh', traits: ['cheerful'], career: 'Head of Surgery', careerLevel: null, notes: 'my notes', likes: ['Jazz'] }),
    s2: rec('s2', 'sim', { first: 'Nia', last: 'Harlow', gender: 'female', bornDay: 100 - 120, householdId: 'hh', traits: [], notes: '' }),
  };
};
const file = JSON.stringify({
  format: 'simdesk-log', version: 1, loggedAt: '2026-11-07T10:00:00', game: { absoluteDay: 33 },
  household: { id: 7, name: 'Harlow', sims: [
    { id: 1, first: 'Darnell', last: 'Harlow', gender: 'male', age: { stage: 'ADULT' }, traits: [{ name: 'Ambitious' }], aspiration: null, career: { name: 'Doctor', level: 7 }, deceased: false },
    { id: 2, first: 'Nia', last: 'Harlow', gender: 'female', age: { stage: 'TEEN' }, traits: [], aspiration: null, career: null, deceased: false },
    { id: 3, first: 'Baby', last: 'Harlow', gender: 'female', age: { stage: 'INFANT' }, traits: [], aspiration: null, career: null, deceased: false },
  ] },
  money: { funds: 12450, snbAccounts: [{ id: 'a1', name: 'Main', type: 'CHECKING', owners: [1], balance: 3200 }] }, skipped: [],
});
const tmp = path.join(os.tmpdir(), 'Harlow-day33.json'); fs.writeFileSync(tmp, file);
(async () => {
  const b = await chromium.launch();
  const open = async (w, h, opts) => {
    const st = newState(); seed(st, opts);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
    await p.goto(`http://localhost:4173/#/s/${SID}/`); await p.waitForTimeout(900);
    return { p, st, errs };
  };
  // phone: no import at all
  { const { p, errs } = await open(393, 852, {});
    ok(!(await p.getByRole('button', { name: /Import from game/ }).count()), 'phone has no Import from game');
    ok(!errs.length, 'phone no errors ' + errs); }
  // desktop, first import (no date link yet)
  { const { p, st, errs } = await open(1280, 860, {});
    const btn = p.getByRole('button', { name: /Import from game/ });
    ok(await btn.isVisible(), 'desktop Today has Import from game');
    await btn.click(); await p.waitForTimeout(300);
    ok(await p.getByText('Pick the file SimLogger saved').isVisible(), 'asks for the file');
    await p.locator('input[accept=".json,application/json"]').setInputFiles({ name: 'nope.json', mimeType: 'application/json', buffer: Buffer.from('hello') });
    await p.waitForTimeout(300);
    ok(await p.getByRole('alert').innerText().then((t) => t.includes('doesn’t look like a SimDesk Logger file')), 'wrong file gets a plain message');
    await p.locator('input[accept=".json,application/json"]').setInputFiles(tmp); await p.waitForTimeout(500);
    const sheet = p.locator('.gi-modal');
    ok(await sheet.isVisible(), 'review sheet opens');
    const text = await sheet.innerText();
    ok(text.includes('Harlow') && text.includes('3 Sims'), 'file card');
    ok(text.includes('Household funds') && text.includes('§12,450'), 'funds row');
    ok(text.includes('Checking') && text.includes('§3,200') && text.includes('SNB'), 'SNB row');
    ok(text.includes('Start Harlow’s turn'), 'turn row');
    ok(text.includes('First import'), 'first import links the date');
    ok(text.includes('Matched by name'), 'name match note');
    ok(text.includes('SimFinancial and loans'), 'says what was not read');
    ok(!/\bNew\b/.test(await sheet.locator('.gi-tag').allInnerTexts().then((x) => x.join(' '))), 'no New tags');
    ok(await sheet.locator('.gi-sim').count() === 3, `one row per Sim with changes (${await sheet.locator('.gi-sim').count()})`);
    ok(await sheet.locator('.gi-det').count() === 1, 'only the first Sim is open');
    ok(text.includes('SimDesk has your own title'), 'typed career is protected');
    const footer = p.locator('.modal-foot');
    const fb = await footer.boundingBox(); const mb = await sheet.boundingBox();
    ok(fb && mb && fb.y + fb.height <= 860 + 1 && fb.y > mb.y + mb.height - 100, 'footer pinned inside the window');
    const n0 = await footer.innerText();
    ok(/(\d+) changes? picked/.test(n0), 'footer counts: ' + n0.replace(/\n/g, ' '));
    // one checkbox per Sim. Darnell is half ticked (his typed career is off), so one tap ticks everything, two untick it.
    const box = sheet.getByRole('checkbox', { name: 'Include everything for Darnell' });
    ok(await box.getAttribute('aria-checked') === 'mixed', 'half-ticked Sim shows mixed');
    await box.click();
    const n1 = await footer.innerText();
    ok(+n1.match(/(\d+) change/)[1] === +n0.match(/(\d+) change/)[1] + 1, 'one tap ticks all of a Sim: ' + n1.replace(/\n/g, ' '));
    await box.click();
    const n2 = await footer.innerText();
    ok(+n2.match(/(\d+) change/)[1] < +n0.match(/(\d+) change/)[1], 'two taps untick them all: ' + n2.replace(/\n/g, ' '));
    await sheet.getByRole('button', { name: 'Open all' }).click();
    ok(await sheet.locator('.gi-det').count() >= 2, 'Open all opens every Sim');
    await box.click(); // all on: the player chose to replace the typed career too
    await sheet.getByRole('button', { name: /^Add \d+ changes?$/ }).click(); await p.waitForTimeout(600);
    const rec = (id) => st.records[SID][id]?.data;
    ok(rec('s1').gameId === '1' && rec('s1').traits.includes('ambitious') && rec('s1').traits.includes('cheerful'), 'Darnell: id linked, trait added, old trait kept');
    ok(rec('s1').career === 'Doctor' && rec('s1').careerLevel === 7, 'ticking the typed career replaces it');
    ok(rec('s1').notes === 'my notes' && rec('s1').likes[0] === 'Jazz', 'notes and likes untouched');
    ok(rec('s2').gameId === '2' && rec('s2').bornDay !== 100 - 120, 'Nia aged up to teen');
    const baby = Object.values(st.records[SID]).find((r) => r.kind === 'sim' && r.data.first === 'Baby');
    ok(baby && baby.data.householdId === 'hh' && baby.data.gameId === '3', 'new Sim made in the household');
    ok(rec('hh').gameId === '7' && rec('hh').notes === 'keep me', 'household linked, notes kept');
    const money = rec('money:hh');
    ok(money && money.funds === 12450 && money.items.some((i) => i.id === 'snb:a1' && i.amount === 3200 && i.owners.includes('s1')), 'money saved with the right owner');
    ok(st.saves[SID].data.gameLink && st.saves[SID].data.gameLink.game === 33 && st.saves[SID].data.gameLink.desk === 100, 'date linked, not moved');
    ok(st.saves[SID].data.rotation.current === 'hh', 'Harlow’s turn started');
    // Undo puts it all back
    await p.getByRole('button', { name: 'Undo' }).click(); await p.waitForTimeout(600);
    ok(!rec('s1').gameId && !rec('s1').traits.includes('ambitious'), 'Undo restores Darnell');
    ok(!Object.values(st.records[SID]).some((r) => r.kind === 'sim' && r.data.first === 'Baby' && !r.deleted_at), 'Undo trashes the new Sim');
    ok(!st.records[SID]['money:hh'] || st.records[SID]['money:hh'].deleted_at, 'Undo trashes the money');
    ok(st.saves[SID].data.rotation.current === 'hp' && !st.saves[SID].data.gameLink, 'Undo restores rotation and link');
    ok(!errs.length, 'no page errors ' + errs);
  }
  // second import: the date moves by what the game moved
  { const { p, st, errs } = await open(1280, 860, { link: { game: 30, desk: 98 } });
    await p.getByRole('button', { name: /Import from game/ }).click();
    await p.locator('input[accept=".json,application/json"]').setInputFiles(tmp); await p.waitForTimeout(500);
    ok((await p.locator('.gi-modal').innerText()).includes('Move SimDesk to'), 'later import offers the date move');
    await p.locator('.gi-modal').getByRole('button', { name: /^Add \d+ changes?$/ }).click(); await p.waitForTimeout(500);
    ok(st.saves[SID].data.today === 101 && st.saves[SID].data.gameLink.desk === 101, 'date moved one day: ' + st.saves[SID].data.today);
    ok(st.records[SID].s1.data.career === 'Head of Surgery', 'default import keeps the typed career');
    ok(!errs.length, 'no page errors ' + errs); }
  // funds module off: nothing about money
  { const { p } = await open(1280, 860, { money: false });
    await p.getByRole('button', { name: /Import from game/ }).click();
    await p.locator('input[accept=".json,application/json"]').setInputFiles(tmp); await p.waitForTimeout(500);
    ok(!(await p.locator('.gi-modal').innerText()).includes('Household funds'), 'no money rows when Household funds is off'); }
  await b.close();
  console.log(`gameimport: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
