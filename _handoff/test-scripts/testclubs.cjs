// Clubs, against the stand-in Supabase.
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const wait = (p, ms) => p.waitForTimeout(ms);
const shots = process.env.SHOTS;
const ON = '11111111-1111-4111-8111-111111111111';   // Get Together on, no clubs
const OFF = '22222222-2222-4222-8222-222222222222';  // Get Together off
const FULL = '33333333-3333-4333-8333-333333333333'; // Lena is in 3 clubs; a tagged photo
const U = (n) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sim = (first, last, extra = {}) => ({ first, last, gender: 'female', householdId: null, bornDay: -100, addedDay: 0, stage: null, traits: [], aspiration: null, occult: null, pronouns: '', orientation: '', career: '', careerLevel: null, genderSettings: {}, notes: '', portrait: null, stagePhotos: [], deceased: null, ...extra });
const people = [['Adaeze', 'Okafor'], ['Tobi', 'Okafor'], ['Ngozi', 'Banks'], ['Marcus', 'Hale'], ['Priya', 'Raman'], ['Lena', 'Voss']];
const clubs = (st, sid) => Object.values(st.records[sid] ?? {}).filter((r) => r.kind === 'club' && !r.deleted_at);

(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['wide', 1280, 860], ['phone', 393, 852]]) {
    const phone = n === 'phone';
    const st = newState(); const now = new Date().toISOString();
    const mkSave = (id, name, packs) => { st.saves[id] = { id, data: { name, color: '#B83C76', packs, secretLots: [], today: 7, calendar: { seasonLength: 28, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: {} }, edited_at: now, deleted_at: null, created_at: now }; };
    const put = (sid, id, kind, data) => { (st.records[sid] ||= {})[id] = { id, kind, data, edited_at: now, deleted_at: null }; };
    mkSave(ON, 'Okafor Legacy', ['get-together']); mkSave(OFF, 'No Pack', []); mkSave(FULL, 'Full Up', ['get-together']);
    for (const sid of [ON, OFF, FULL]) {
      people.forEach(([f, l], i) => put(sid, U(i + 1), 'sim', sim(f, l)));
      put(sid, U(7), 'sim', sim('Baby', 'Bean', { bornDay: null, stage: 'toddler' }));
      put(sid, U(8), 'sim', sim('Gone', 'Gus', { deceased: { day: 3, cause: '', notes: '' } }));
    }
    put(ON, '1f000000-0000-4000-8000-000000000001', 'lot', { name: 'Plaza Park', type: 'park' });
    // Lena is already in three clubs; one photo is tagged with the first
    const CL = (i) => `c0000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    ['Alpha Club', 'Beta Club', 'Gamma Club'].forEach((name, i) => put(FULL, CL(i + 1), 'club', { name, members: i === 0 ? [U(6), U(1)] : [U(6)], leader: U(6), encouraged: [{ text: 'Chat', club: null }] }));
    put(FULL, 'b0000000-0000-4000-8000-000000000001', 'photo', { photo: { id: 'p1', w: 600, h: 600 }, caption: 'Club night', simIds: [U(6)], gameDay: 3, added: now, item: null, clubId: CL(1) });
    put(FULL, 'b0000000-0000-4000-8000-000000000002', 'photo', { photo: { id: 'p2', w: 600, h: 600 }, caption: 'Just us', simIds: [], gameDay: 4, added: now, item: null, clubId: null });

    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', hasTouch: phone, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await wait(p, 1500);
    const open = async (sid, path) => { await p.goto(`http://localhost:4173/#/s/${sid}/${path}`); await wait(p, 900); };
    const dlg = () => p.getByRole('dialog');
    const btn = (name, scope = p) => scope.getByRole('button', { name });

    // ---- the pack gate
    await open(OFF, 'clubs');
    ok(await p.getByText('Clubs need Get Together').isVisible(), `${n} no pack: says so`);
    if (!phone) ok(await p.getByRole('link', { name: 'Clubs' }).count() === 0, `${n} no pack: no Clubs in the sidebar`);
    await open(OFF, 'more');
    if (phone) ok(await p.getByRole('link', { name: /Clubs/ }).count() === 0, `${n} no pack: no Clubs on the More page`);
    await open(ON, phone ? 'more' : 'sims');
    if (phone) ok(await p.getByRole('link', { name: /Clubs/ }).isVisible(), `${n} pack on: Clubs on the More page`);
    else ok(await p.getByRole('link', { name: 'Clubs' }).first().isVisible(), `${n} pack on: Clubs in the sidebar`);

    // (The home deck's Clubs card is gone: Today replaced the deck, Nov 2026. The sidebar check above covers it.)
    // ---- empty state, then a new club
    await open(ON, 'clubs');
    ok(await p.getByText('No clubs yet').isVisible(), `${n} empty state`);
    await btn('New club').click(); await wait(p, 500);
    ok(await dlg().getByRole('heading', { name: 'New club' }).isVisible(), `${n} New club window`);
    await btn('Add club', dlg()).click(); await wait(p, 200);
    ok(await dlg().getByText('Give it a name.').isVisible(), `${n} a name is required`);
    await dlg().getByLabel('Club name').fill('Page Turners');
    await dlg().getByLabel('Description').fill('A calm corner for people who love a good book.');
    await btn('Invite only', dlg()).click();
    ok(await btn('Invite only', dlg()).getAttribute('aria-pressed') === 'true', `${n} invite only picked`);
    ok(await btn(/^Leader:/, dlg()).isDisabled(), `${n} leader waits for members`);

    // members
    await btn(/^Members:/, dlg()).click(); await wait(p, 300);
    ok(await dlg().getByRole('checkbox').count() === 6, `${n} members list: living Child-and-older Sims only (${await dlg().getByRole('checkbox').count()})`);
    ok(await dlg().getByText('Baby Bean').count() === 0 && await dlg().getByText('Gone Gus').count() === 0, `${n} no toddler, no Sim who has passed`);
    await dlg().getByRole('checkbox', { name: 'Adaeze Okafor' }).click(); await dlg().getByRole('checkbox', { name: 'Tobi Okafor' }).click(); await dlg().getByRole('checkbox', { name: 'Ngozi Banks' }).click(); await wait(p, 200);
    ok(await dlg().getByText('Selected', { exact: true }).isVisible() && await btn('Done · 3 selected', dlg()).isVisible(), `${n} selected Sims counted`);
    await dlg().getByRole('searchbox', { name: 'Search Sims' }).fill('zzz'); ok(await dlg().getByText(/No Sim called/).isVisible(), `${n} members search, no match`);
    await dlg().getByRole('searchbox', { name: 'Search Sims' }).fill('');
    await btn('Done · 3 selected', dlg()).click(); await wait(p, 300);
    ok(await btn(/^Members: Adaeze, Tobi, Ngozi/, dlg()).isVisible(), `${n} members row shows first names`);
    ok(await btn(/^Leader: Adaeze Okafor/, dlg()).isVisible(), `${n} first member leads by default`);
    await btn(/^Leader:/, dlg()).click(); await wait(p, 300);
    await dlg().getByRole('option', { name: /Tobi Okafor/ }).click(); await wait(p, 300);
    ok(await btn(/^Leader: Tobi Okafor/, dlg()).isVisible(), `${n} leader changed`);

    // meets at: a lot, a lot type, no place
    await btn(/^Meets at:/, dlg()).click(); await wait(p, 300);
    await dlg().getByRole('option', { name: /Plaza Park/ }).click(); await wait(p, 300);
    ok(await btn(/^Meets at: Plaza Park/, dlg()).isVisible(), `${n} a lot picked`);
    await btn(/^Meets at:/, dlg()).click(); await wait(p, 300);
    await btn('Lot type', dlg()).click(); await wait(p, 200);
    ok(await dlg().getByRole('option', { name: 'Library' }).isVisible() && await dlg().getByRole('option', { name: 'Residential' }).count() === 0, `${n} lot types: community ones`);
    await dlg().getByRole('searchbox', { name: 'Search lot types' }).fill('lib');
    ok(await dlg().getByRole('option').count() === 1, `${n} lot type search`);
    await dlg().getByRole('option', { name: 'Library' }).click(); await wait(p, 300);
    ok(await btn(/^Meets at: Any Library · lot type/, dlg()).isVisible(), `${n} a lot type picked`);
    await btn(/^Meets at:/, dlg()).click(); await wait(p, 300);
    await btn('No place', dlg()).click(); await wait(p, 200);
    ok(await dlg().getByText(/wherever the leader is/).isVisible(), `${n} no place explains itself`);
    await btn('Back', dlg()).click(); await wait(p, 300);
    ok(await btn(/^Meets at: No specific place/, dlg()).isVisible(), `${n} no place chosen`);
    await btn(/^Meets at:/, dlg()).click(); await wait(p, 300);
    await btn('Lot type', dlg()).click(); await dlg().getByRole('option', { name: 'Library' }).click(); await wait(p, 300);

    // activities
    await btn('Add activity', dlg()).first().click();
    await dlg().getByLabel('Encouraged activities 1').fill('Read');
    await btn('Add activity', dlg()).first().click();
    await dlg().getByLabel('Encouraged activities 2').fill('Tell Jokes');
    await btn('Add activity', dlg()).last().click();
    await dlg().getByLabel('Banned activities 1').fill('Fight');
    ok(await dlg().getByText('2 of 5').first().isVisible() && await dlg().getByText('1 of 5').first().isVisible(), `${n} activity counts`);
    // requirements: a trait, then ages
    await btn('Add a requirement', dlg()).click(); await wait(p, 300);
    ok(await dlg().getByRole('button', { name: /Marital status/ }).isVisible() && await dlg().getByRole('button', { name: /Skill/ }).isVisible(), `${n} requirement categories`);
    await dlg().getByRole('button', { name: /^Trait/ }).click(); await wait(p, 300);
    await dlg().getByRole('searchbox', { name: 'Search traits' }).fill('bookw');
    await dlg().getByRole('option', { name: 'Bookworm' }).click();
    await btn('Add requirement', dlg()).click(); await wait(p, 300);
    ok(await dlg().getByRole('group', { name: 'Trait: Bookworm' }).isVisible(), `${n} trait requirement added`);
    await btn('Add a requirement', dlg()).click(); await wait(p, 300);
    await dlg().getByRole('button', { name: /^Age/ }).click(); await wait(p, 300);
    ok(await btn('Add requirement', dlg()).isDisabled(), `${n} nothing picked yet`);
    await dlg().getByRole('checkbox', { name: 'Teen', exact: true }).click(); await dlg().getByRole('checkbox', { name: 'Adult', exact: true }).click();
    await btn('Add requirement', dlg()).click(); await wait(p, 300);
    ok(await dlg().getByRole('group', { name: 'Age: Teen, Adult' }).isVisible() && await dlg().getByText('2 of 5').count() >= 1, `${n} age requirement added`);
    // a perk
    await btn('Add a perk', dlg()).click(); await wait(p, 300);
    ok(await btn('Add perk', dlg()).isDisabled(), `${n} a perk needs text`);
    await btn('Vibe', dlg()).click(); await dlg().getByLabel('Perk').fill('Focused'); await btn('Add perk', dlg()).click(); await wait(p, 300);
    ok(await dlg().getByRole('group', { name: 'Vibe: Focused' }).isVisible(), `${n} perk added`);
    await dlg().getByLabel('Notes').fill('Meets every Saturday.');
    if (shots) await p.screenshot({ path: `${shots}/${n}-form.png` });
    await btn('Add club', dlg()).click(); await wait(p, 900);

    // ---- the club page
    const saved = clubs(st, ON);
    ok(saved.length === 1, `${n} club saved`);
    const c = saved[0]?.data ?? {};
    ok(c.name === 'Page Turners' && c.admission === 'invite' && c.members.length === 3 && c.leader === U(2), `${n} name, admission, members, leader saved`);
    ok(c.place?.kind === 'type' && c.place.id === 'library', `${n} lot type saved (${JSON.stringify(c.place)})`);
    ok(JSON.stringify(c.encouraged.map((a) => a.text)) === '["Read","Tell Jokes"]' && c.banned[0]?.text === 'Fight', `${n} activities saved`);
    ok(c.requirements.length === 2 && c.requirements[1].value === 'Teen, Adult' && c.perks[0]?.kind === 'vibe', `${n} requirements and perks saved`);
    ok(/\/clubs\/[0-9a-f-]+$/.test(p.url()), `${n} lands on the club page`);
    ok(await p.getByRole('heading', { name: 'Page Turners' }).isVisible() && await p.getByText('Invite only').first().isVisible(), `${n} club page title and admission`);
    ok(await p.locator('.club-face[aria-label="Tobi Okafor, leader"] .club-lead').isVisible() && await p.locator('.club-lead').count() === 1, `${n} leader tagged`);
    ok(await p.locator('.club-face', { hasText: 'Tobi' }).count() === 1 && await p.locator('.club-face.add').isVisible(), `${n} members as faces with first names and Add`);
    ok(await p.getByText('Any Library').isVisible() && await p.getByText('Bookworm').isVisible() && await p.getByText('Secret'.slice(0, 0) + 'Focused').isVisible() && await p.getByText('Meets every Saturday.').isVisible(), `${n} place, requirement, perk, notes shown`);
    ok(await p.getByText('Read', { exact: true }).isVisible() && await p.getByText('Fight', { exact: true }).isVisible(), `${n} encouraged and banned shown`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-club.png`, fullPage: true });
    const firstClub = saved[0].id;

    // ---- a second club: suggestions, aiming at the first
    await open(ON, 'clubs');
    ok(await p.locator('.hh-card', { hasText: 'Page Turners' }).getByText(/Read · Tell Jokes/).isVisible() && await p.getByText(/Any Library · Invite only · 3 members/).isVisible(), `${n} list card summary`);
    await btn('New club', p).click(); await wait(p, 500);
    await dlg().getByLabel('Club name').fill('Night Owls');
    await btn(/^Members:/, dlg()).click(); await wait(p, 300);
    await dlg().getByRole('checkbox', { name: 'Adaeze Okafor' }).click(); await dlg().getByRole('checkbox', { name: 'Marcus Hale' }).click();
    await btn('Done · 2 selected', dlg()).click(); await wait(p, 300);
    await btn('Add activity', dlg()).first().click();
    await dlg().getByLabel('Encouraged activities 1').fill('Re');
    ok(await dlg().getByRole('option', { name: /Read.*used in Page Turners/ }).isVisible(), `${n} suggests an activity another club uses`);
    await dlg().getByRole('option', { name: /Read/ }).click();
    ok(await dlg().getByLabel('Encouraged activities 1').inputValue() === 'Read', `${n} suggestion fills the box`);
    await btn('Add activity', dlg()).first().click();
    await dlg().getByLabel('Encouraged activities 2').fill('Be Nice');
    await btn('Aim at a club', dlg()).click(); await wait(p, 300);
    ok(await dlg().getByRole('option').count() === 1 && await dlg().getByRole('option', { name: /Page Turners/ }).isVisible(), `${n} aim list: other clubs only`);
    await dlg().getByRole('option', { name: /Page Turners/ }).click(); await wait(p, 300);
    ok(await btn(/^Aimed at: Page Turners/, dlg()).isVisible(), `${n} aimed at a club`);
    await btn('Add club', dlg()).click(); await wait(p, 900);
    ok(clubs(st, ON).find((r) => r.data.name === 'Night Owls')?.data.encouraged[1]?.club === firstClub, `${n} aim saved`);
    const pill = p.locator('.club-pill', { hasText: 'Page Turners' });
    ok(await pill.isVisible() && await p.getByLabel('aimed at').isVisible(), `${n} the aimed-at club shows as a pill`);
    if (shots) await p.screenshot({ path: `${shots}/${n}-club-aimed.png`, fullPage: true });
    await pill.click(); await wait(p, 700);
    ok(await p.getByRole('heading', { name: 'Page Turners' }).isVisible(), `${n} the pill opens that club`);

    // ---- a Sim's profile
    await open(ON, `sims/${U(1)}`);
    
    await wait(p, 300);
    ok(await p.getByText(/^Clubs/).first().isVisible() && await p.getByText('Page Turners').first().isVisible() && await p.getByText('Night Owls').first().isVisible(), `${n} Sim profile lists both clubs`);
    await open(ON, `sims/${U(5)}`);  await wait(p, 300);
    ok(await p.getByText('Night Owls').count() === 0, `${n} a Sim in no club has no Clubs card`);

    // ---- edit just one part, from the pencil on its card
    await open(ON, `clubs/${firstClub}`);
    await btn('Edit rules').click(); await wait(p, 500);
    ok(await dlg().getByLabel('Encouraged activities 1').isVisible() && await dlg().getByLabel('Club name').count() === 0 && await dlg().getByText('Requirements').count() === 0, `${n} rules pencil shows only the rules`);
    await dlg().getByLabel('Encouraged activities 2').fill('Tell Stories');
    await btn('Done', dlg()).click(); await wait(p, 700);
    ok(clubs(st, ON).find((r) => r.id === firstClub)?.data.encouraged[1]?.text === 'Tell Stories' && await p.getByText('Tell Stories', { exact: true }).isVisible(), `${n} closing the part saves it`);
    await p.locator('.toast').getByRole('button', { name: 'Undo' }).click(); await wait(p, 700);
    ok(clubs(st, ON).find((r) => r.id === firstClub)?.data.encouraged[1]?.text === 'Tell Jokes', `${n} Undo puts the rules back`);
    await btn('Edit details').click(); await wait(p, 500);
    ok(await dlg().getByLabel('Notes').isVisible() && await btn(/^Meets at:/, dlg()).isVisible() && await dlg().getByLabel('Encouraged activities 1').count() === 0, `${n} details pencil: place, requirements, perks, notes`);
    await p.keyboard.press('Escape'); await wait(p, 400);
    ok(await dlg().count() === 0, `${n} closing with no change just closes`);
    await p.locator('.club-face.add').click(); await wait(p, 500);
    ok(await dlg().getByRole('checkbox', { name: 'Tobi Okafor' }).isVisible(), `${n} the Add face opens the member list`);
    await p.keyboard.press('Escape'); await wait(p, 400);

    // ---- edit and delete
    await btn('Edit', p).filter({ hasText: /^Edit$/ }).click(); await wait(p, 500);
    ok(await dlg().getByLabel('Club name').inputValue() === 'Page Turners' && await btn('Delete', dlg()).isVisible(), `${n} edit window has the details and Delete`);
    await dlg().getByLabel('Club name').fill('Page Turners Club');
    await btn('Save', dlg()).click(); await wait(p, 700);
    ok(await p.getByRole('heading', { name: 'Page Turners Club' }).isVisible(), `${n} edited`);
    await btn('Edit', p).filter({ hasText: /^Edit$/ }).click(); await wait(p, 400);
    await btn('Delete', dlg()).click(); await wait(p, 300);
    await p.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click(); await wait(p, 900);
    ok(/\/clubs$/.test(p.url()) && clubs(st, ON).length === 1, `${n} deleted, back to the list`);
    await p.locator('.hh-card', { hasText: 'Night Owls' }).click(); await wait(p, 700);
    ok(await p.getByText('Be Nice').isVisible() && await p.locator('.club-pill').count() === 0, `${n} a rule aimed at a deleted club keeps its words, loses the pill`);

    // ---- the 3-club limit
    await open(FULL, 'clubs');
    await p.getByRole('button', { name: 'New club' }).first().click(); await wait(p, 500);
    await btn(/^Members:/, dlg()).click(); await wait(p, 300);
    const lena = dlg().getByRole('checkbox', { name: 'Lena Voss' });
    ok(await lena.isDisabled() && await dlg().getByText('In 3 clubs').isVisible(), `${n} a Sim in 3 clubs can't join a 4th`);
    ok(await dlg().getByRole('checkbox', { name: 'Adaeze Okafor' }).isEnabled(), `${n} a Sim in 1 club can`);
    await btn('Back', dlg()).click(); await wait(p, 200);
    await btn('Cancel', dlg()).click(); await wait(p, 300);

    // ---- photos and clubs
    await open(FULL, 'photos');
    await btn(/^Filter/).click(); await wait(p, 500);
    ok(await dlg().getByRole('button', { name: /^Club:/ }).isVisible(), `${n} Photos filter has a Club row`);
    await dlg().getByRole('button', { name: /^Club:/ }).click(); await wait(p, 300);
    ok(await p.getByRole('option', { name: /Alpha Club/ }).isVisible() && await p.getByRole('option', { name: /Beta Club/ }).count() === 0, `${n} club list: clubs that have photos`);
    await p.getByRole('option', { name: /Alpha Club/ }).click(); await wait(p, 300);
    await p.getByRole('dialog', { name: 'Filter' }).getByRole('button', { name: /Show 1 photo/ }).click(); await wait(p, 400);
    ok(await p.locator('.ph-tile').count() === 1 && /Alpha Club · 1 photo/.test(await p.locator('.ph-sum').innerText()) && await p.locator('.filter-btn .count').innerText() === '1', `${n} club filter: grid, summary, badge`);
    await p.locator('.ph-sum').getByRole('button', { name: 'Clear' }).click(); await wait(p, 300);
    const box = p.getByRole('searchbox', { name: 'Search photos' });
    await box.fill('gamma'); await wait(p, 300);
    ok(await p.getByRole('listbox', { name: 'Suggestions' }).getByText('Clubs', { exact: true }).count() === 0, `${n} a club with no photos isn't suggested`);
    await box.fill('alpha'); await wait(p, 300);
    ok(await p.getByRole('listbox', { name: 'Suggestions' }).getByText('Clubs', { exact: true }).isVisible(), `${n} search suggests clubs`);
    await p.getByRole('listbox', { name: 'Suggestions' }).getByRole('button', { name: /Alpha Club/ }).click(); await wait(p, 400);
    ok(await p.locator('.ph-tile').count() === 1, `${n} picking a suggested club filters`);
    await p.locator('.ph-tile').first().click(); await wait(p, 700);
    ok(await p.getByRole('link', { name: 'Club: Alpha Club' }).isVisible(), `${n} photo page links to the club`);
    await btn('Edit').click(); await wait(p, 400);
    ok(await dlg().getByRole('button', { name: /^Club: Alpha Club/ }).isVisible() && await dlg().getByText('Sims in this photo (optional)').isVisible(), `${n} photo form: Club row and optional Sims`);
    await dlg().getByRole('button', { name: /^Club:/ }).click(); await wait(p, 300);
    await p.getByRole('option', { name: /Beta Club/ }).click(); await wait(p, 300);
    await btn('Save', dlg()).click(); await wait(p, 700);
    ok(clubs(st, FULL) && Object.values(st.records[FULL]).find((r) => r.kind === 'photo' && r.data.caption === 'Club night').data.clubId === CL(2), `${n} photo's club changed`);
    await open(FULL, `clubs/${CL(2)}`);
    ok(await p.locator('.club-card', { hasText: 'Photos' }).locator('.ph-mini').count() === 1, `${n} the club page lists its photo`);

    ok(errs.length === 0, `${n} no errors: ${errs.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
