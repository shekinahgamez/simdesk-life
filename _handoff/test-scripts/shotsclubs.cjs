const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
const SID = '11111111-1111-4111-8111-111111111111';
const U = (n) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const K = (n) => `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const LOT = (n) => `1f000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sim = (first, last, extra = {}) => ({ first, last, gender: 'female', householdId: extra.hh ?? null, bornDay: -100, addedDay: 0, stage: null, traits: [], aspiration: null, occult: null, pronouns: '', orientation: '', career: '', careerLevel: null, genderSettings: {}, notes: '', portrait: null, stagePhotos: [], deceased: null });
const people = [['Adaeze', 'Okafor'], ['Tobi', 'Okafor'], ['Ngozi', 'Banks'], ['Marcus', 'Hale'], ['Priya', 'Raman'], ['Lena', 'Voss']];
const wait = (p, ms) => p.waitForTimeout(ms);
(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['phone', 393, 852], ['wide', 1180, 900]]) {
    const phone = n === 'phone';
    const st = newState(); const now = new Date().toISOString();
    st.saves[SID] = { id: SID, data: { name: 'Okafor Legacy', color: '#B83C76', packs: ['get-together'], secretLots: [], today: 7, calendar: { seasonLength: 28, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: {} }, edited_at: now, deleted_at: null, created_at: now };
    const put = (id, kind, data) => { (st.records[SID] ||= {})[id] = { id, kind, data, edited_at: now, deleted_at: null }; };
    const HH = 'dddddddd-0000-4000-8000-000000000001', HH2 = 'dddddddd-0000-4000-8000-000000000002', HH3 = 'dddddddd-0000-4000-8000-000000000003', HH4 = 'dddddddd-0000-4000-8000-000000000004';
    put(HH, 'household', { name: 'Okafor', home: null, notes: '' }); put(HH2, 'household', { name: 'Banks', home: null, notes: '' }); put(HH3, 'household', { name: 'Hale', home: null, notes: '' }); put(HH4, 'household', { name: 'Raman', home: null, notes: '' });
    const hhOf = [HH, HH, HH2, HH3, HH4, null];
    people.forEach(([f, l], i) => put(U(i + 1), 'sim', { ...sim(f, l), householdId: hhOf[i] }));
    put(LOT(1), 'lot', { name: 'Plaza Park', type: 'park' }); put(LOT(2), 'lot', { name: 'Moonlit Lounge', type: 'lounge' });
    put(K(1), 'club', { name: 'Page Turners', description: 'A calm corner for people who love a good book.', admission: 'open', members: [U(1), U(2), U(3), U(4), U(5)], leader: U(1), place: { kind: 'type', id: 'library' },
      encouraged: [{ text: 'Read', club: null }, { text: 'Tell Jokes', club: null }, { text: 'Be Nice', club: K(3) }], banned: [{ text: 'Fight', club: null }, { text: 'Be Mean', club: K(2) }],
      requirements: [{ cat: 'trait', value: 'Bookworm' }, { cat: 'age', value: 'Teen, Young Adult, Adult' }], perks: [{ kind: 'vibe', text: 'Focused' }, { kind: 'status', text: 'Secret handshake' }], notes: 'Meets every Saturday after lunch. Adaeze brings the tea.' });
    put(K(2), 'club', { name: 'Clean Sweep', admission: 'invite', members: [U(5), U(6)], leader: U(5), place: { kind: 'lot', id: LOT(1) }, encouraged: [{ text: 'Clean', club: null }, { text: 'Repair', club: null }] });
    put(K(3), 'club', { name: 'Night Owls', admission: 'open', members: [U(2), U(4), U(6)], leader: U(2), place: { kind: 'lot', id: LOT(2) }, encouraged: [{ text: 'Sing', club: null }, { text: 'Dance', club: null }] });
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: phone, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await wait(p, 1500);
    const shot = (name, o = {}) => p.screenshot({ path: `realclubs/${n}-${name}.png`, ...o });
    const dlg = () => p.getByRole('dialog');
    const scrollForm = (y) => p.locator('.club-form').evaluate((el, y) => { el.scrollTop = y; }, y);
    const go = async (path) => { await p.goto(`http://localhost:4173/#/s/${SID}/${path}`); await wait(p, 900); };
    await go('clubs'); await shot('list');
    await go(`clubs/${K(1)}`); await shot('club-top');
    if (phone) { await p.setViewportSize({ width: 393, height: 1900 }); await wait(p, 500); await shot('club-full'); await p.setViewportSize({ width: 393, height: 852 }); await wait(p, 300); }
    else { await p.setViewportSize({ width: 1180, height: 1500 }); await wait(p, 500); await shot('club-full'); await p.setViewportSize({ width: 1180, height: 900 }); await wait(p, 300); }
    // edit form
    await p.getByRole('button', { name: 'Edit' }).click(); await wait(p, 600);
    await shot('form-1');
    const modalScroll = async (loc) => { await loc.evaluate((el) => { let n = el.parentElement; while (n && n !== document.body) { if (n.scrollHeight > n.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) { n.scrollTop = Math.max(0, el.getBoundingClientRect().top - n.getBoundingClientRect().top + n.scrollTop - 120); return; } n = n.parentElement; } }); await wait(p, 300); };
    await dlg().getByLabel('Encouraged activities 3').focus(); await modalScroll(dlg().getByLabel('Encouraged activities 3')); await shot('form-2');
    await modalScroll(dlg().getByRole('button', { name: /^Add a requirement/ })); await shot('form-3');
    await dlg().getByRole('button', { name: /^Members:/ }).scrollIntoViewIfNeeded(); await dlg().getByRole('button', { name: /^Members:/ }).click(); await wait(p, 400); await shot('members');
    await dlg().getByRole('button', { name: 'Back' }).click(); await wait(p, 300);
    await dlg().getByRole('button', { name: /^Meets at:/ }).scrollIntoViewIfNeeded(); await dlg().getByRole('button', { name: /^Meets at:/ }).click(); await wait(p, 300);
    await dlg().getByRole('button', { name: 'Lot type' }).click(); await wait(p, 300); await shot('place');
    await dlg().getByRole('button', { name: 'Back' }).click(); await wait(p, 300);
    await dlg().getByRole('button', { name: /^Aimed at: Night Owls/ }).scrollIntoViewIfNeeded(); await dlg().getByRole('button', { name: /^Aimed at: Night Owls/ }).click(); await wait(p, 300); await shot('aim');
    await dlg().getByRole('button', { name: 'Back' }).click(); await wait(p, 300);
    await dlg().getByRole('button', { name: 'Add a requirement' }).scrollIntoViewIfNeeded(); await dlg().getByRole('button', { name: 'Add a requirement' }).click(); await wait(p, 300); await shot('reqcat');
    await dlg().getByRole('button', { name: /^Trait/ }).click(); await wait(p, 300); await shot('trait');
    await dlg().getByRole('button', { name: 'Back' }).click(); await dlg().getByRole('button', { name: 'Back' }).click(); await wait(p, 300);
    await dlg().getByRole('button', { name: 'Add a perk' }).scrollIntoViewIfNeeded(); await dlg().getByRole('button', { name: 'Add a perk' }).click(); await wait(p, 300); await shot('perk');
    await go(`sims/${U(1)}`); if (phone) await p.getByRole('tab', { name: 'About' }).click(); await wait(p, 300);
    await p.getByText(/^Clubs/).first().scrollIntoViewIfNeeded(); await wait(p, 200); await shot('simcard');
    console.log(n, 'errors', errs.length, errs.slice(0, 2).join('|'));
    await ctx.close();
  }
  await b.close();
})();
