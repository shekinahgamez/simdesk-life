// Lore & Storylines (Nov 2026): list/cards/board, filters, storyline page, secrets, feelings, Content tab, Sim card.
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
const fs = require('fs');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const SID = '44444444-4444-4444-8444-444444444444';
const OUT = process.env.SHOTS || '/tmp/loreshots';
fs.mkdirSync(OUT, { recursive: true });
const seed = (st) => {
  const now = new Date().toISOString();
  const data = { name: 'Lore Save', color: '#B83C76', packs: [], secretLots: [], today: 14, calendar: { seasonLength: 14, anchorDay: 0, anchorDate: { year: 1, season: 0, day: 1 } }, lifespan: { preset: 'normal' }, trackDate: true, modules: { storylines: true, rotation: true } };
  st.saves[SID] = { id: SID, data, edited_at: now, deleted_at: null, created_at: now };
  const rec = (id, kind, d) => ({ id, save_id: SID, kind, data: d, edited_at: now, deleted_at: null, created_at: now });
  const sim = (id, first, h) => rec(id, 'sim', { first, last: 'Test', bornDay: -9000, householdId: h, traits: [] });
  st.records[SID] = {
    h1: rec('h1', 'household', { name: 'Priestley', home: null, notes: '' }),
    h2: rec('h2', 'household', { name: 'Adebayo', home: null, notes: '' }),
    kai: sim('kai', 'Kai', 'h1'), qu: sim('qu', 'Quentin', 'h1'), sh: sim('sh', 'Shanae', 'h2'), co: sim('co', 'Corey', null), ki: sim('ki', 'Kiana', null),
    s1: rec('s1', 'storyline', { name: 'Hookah bar night', status: 'hot', cast: ['kai', 'qu', 'sh'], pinned: true, tags: ['Drama'], notes: '', questions: [{ text: 'Who does Kiana want?', done: false }] }),
    s2: rec('s2', 'storyline', { name: 'Who does Quentin like?', status: 'brewing', cast: ['qu', 'sh'], pinned: false, tags: [], notes: '', questions: [] }),
    s3: rec('s3', 'storyline', { name: 'Move-in weekend', status: 'resolved', cast: ['kai', 'qu'], pinned: false, tags: ['Home'], notes: '', questions: [] }),
    b1: rec('b1', 'beat', { storyline: 's1', text: 'Corey and Kiana showed up at the door.', sims: ['co', 'ki', 'kai'], day: 14, video: true, secret: false, addedAt: '2026-11-07T12:00:00Z' }),
    b2: rec('b2', 'beat', { storyline: 's1', text: 'Hookah bar with Shanae.', sims: ['kai', 'qu', 'sh'], day: 13, video: true, secret: true, addedAt: '2026-11-07T11:00:00Z' }),
    b3: rec('b3', 'beat', { storyline: 's2', text: 'Quentin kept staring.', sims: ['qu'], day: 13, video: false, secret: false, addedAt: '2026-11-07T11:30:00Z' }),
    k1: rec('k1', 'secret', { title: 'Quentin likes Shanae', storyline: 's1', out: false, cast: ['kai', 'qu', 'sh'], knows: { qu: 'knows', sh: 'guess' } }),
    f1: rec('f1', 'feeling', { from: 'ki', to: 'kai', word: 'Into him', why: 'Since the door', kind: 'crush' }),
    f2: rec('f2', 'feeling', { from: 'kai', to: 'qu', word: 'Best friends', why: '', kind: 'close' }),
  };
};
(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['wide', 1440, 900], ['phone', 390, 844]]) {
    const phone = n === 'phone';
    const st = newState(); seed(st);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', acceptDownloads: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
    const url = (x) => `http://localhost:4173/#/s/${SID}/${x}`;
    const shot = async (name) => { await p.locator('h1').first().scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(200); return p.screenshot({ path: `${OUT}/${n}-${name}.png` }); };
    const rec = (id) => st.records[SID][id];
    // sidebar / more
    if (!phone) {
      const side = p.locator('nav.sidebar');
      ok(await side.getByRole('link', { name: 'Storylines' }).isVisible(), `${n} Storylines in sidebar`);
      ok(await side.locator('.obj.rotation').count() === 1, `${n} Rotation has its own color class`);
      ok(await side.locator('.obj.worlds').count() === 1, `${n} Worlds keeps its own color`);
    }
    // list
    await p.goto(url('storylines')); await p.waitForTimeout(900);
    ok(await p.getByText('Pinned').first().isVisible(), `${n} Pinned header`);
    ok(await p.locator('.sl-row').count() === 2, `${n} list shows 2 open rows (resolved folded)`);
    ok(await p.getByRole('button', { name: /Resolved · 1/ }).isVisible(), `${n} Resolved fold`);
    await p.getByRole('button', { name: /Resolved · 1/ }).click();
    ok(await p.locator('.sl-row').count() === 3, `${n} Resolved opens`);
    await shot('1-list');
    // filters: Sims (all chosen), Household, Status
    await p.getByRole('button', { name: /^Sims/ }).click(); await p.waitForTimeout(300);
    await p.getByRole('checkbox', { name: /^Kai Test/ }).click();
    await p.getByRole('checkbox', { name: /^Quentin Test/ }).click();
    if (!phone) await shot('2-sims-filter');
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(await p.getByText('2 storylines match').isVisible(), `${n} two Sims = storylines with both (2)`);
    ok(await p.getByRole('button', { name: /^Sims · 2/ }).isVisible(), `${n} Sims button shows count`);
    await p.getByRole('button', { name: 'Clear', exact: true }).click(); await p.waitForTimeout(200);
    await p.getByRole('button', { name: /^Household/ }).click(); await p.waitForTimeout(300);
    await p.getByRole('checkbox', { name: /Adebayo/ }).click(); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(await p.locator('.sl-row').count() === 2, `${n} household filter (Adebayo has Shanae in 2 storylines)`);
    await p.getByRole('button', { name: 'Clear', exact: true }).click();
    await p.getByRole('button', { name: /^Status/ }).click(); await p.waitForTimeout(300);
    await p.getByRole('checkbox', { name: 'Resolved' }).click(); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    ok(await p.locator('.sl-row').count() === 1, `${n} status filter`);
    await p.getByRole('button', { name: 'Clear', exact: true }).click();
    await p.locator('.sl-search input').fill('staring'); await p.waitForTimeout(200);
    ok(await p.locator('.sl-row').count() === 1, `${n} search finds a beat`);
    await p.locator('.sl-search input').fill('');
    // views
    await p.getByRole('button', { name: 'Cards' }).click(); await p.waitForTimeout(300);
    ok(await p.locator('.sl-card-tile').count() >= 2, `${n} cards view`);
    if (!phone) {
      await p.getByRole('button', { name: 'Board' }).click(); await p.waitForTimeout(300);
      ok(await p.locator('.sl-col').count() === 3, `board has 3 columns`);
      await shot('3-board');
      await p.locator('.sl-kcard', { hasText: 'Who does Quentin like?' }).dragTo(p.locator('.sl-col').nth(1)); await p.waitForTimeout(400);
      await p.waitForTimeout(1500);
      ok(rec('s2').data.status === 'hot', 'dragging a card changes its status');
    } else {
      ok(await p.getByRole('button', { name: 'Board' }).count() === 0, 'phone has no Board button');
    }
    await p.getByRole('button', { name: 'List' }).click();
    // storyline page
    await p.goto(url('storylines/s1')); await p.waitForTimeout(900);
    ok(await p.getByRole('heading', { name: 'Hookah bar night' }).isVisible(), `${n} storyline page`);
    ok(await p.locator('.sl-beat').count() === 2, `${n} two beats`);
    ok(await p.getByText('Spring 14').first().isVisible(), `${n} game date leads`);
    await p.getByRole('button', { name: 'Kai Test: Knows' }).click(); await p.waitForTimeout(300);
    await p.waitForTimeout(1500);
    ok(rec('k1').data.knows.kai === 'knows', `${n} tapping a circle saves who knows`);
    ok(await p.locator('.sl-dot.knows svg').count() >= 1 && await p.locator('.sl-dot svg').count() >= 1, `${n} circle shows a check`);
    await p.getByRole('button', { name: 'Shanae Test: No' }).click(); await p.waitForTimeout(300);
    await p.waitForTimeout(1500);
    ok(rec('k1').data.knows.sh === 'no', `${n} guess to no`);
    await p.getByRole('button', { name: 'Heating up' }).first().click();
    await p.getByRole('button', { name: /Resolved/ }).first().click(); await p.waitForTimeout(300);
    await p.waitForTimeout(1500);
    ok(rec('s1').data.status === 'resolved', `${n} status changes in place`);
    await p.getByRole('button', { name: 'Brewing' }).first().click(); await p.waitForTimeout(300);
    await p.waitForTimeout(1500);
    ok(rec('s1').data.status === 'brewing', `${n} status back`);
    await p.getByLabel('Add a question').fill('Does Kai find out?'); await p.locator('.sl-qadd button').click(); await p.waitForTimeout(300);
    await p.waitForTimeout(1500);
    ok(rec('s1').data.questions.length === 2, `${n} adds an open question`);
    await p.getByRole('button', { name: /Who does Kiana want\?: open/ }).click(); await p.waitForTimeout(300);
    await p.waitForTimeout(1500);
    ok(rec('s1').data.questions[0].done === true, `${n} answers a question`);
    ok(await p.getByLabel('Episode notes').count() === 0, `${n} no Episode notes box (moved to Content)`);
    ok(await p.getByText('Pictures').first().isVisible(), `${n} Pictures card`);
    await shot('4-storyline');
    // add beat
    await p.getByRole('button', { name: /Add beat/ }).first().click(); await p.waitForTimeout(400);
    await p.getByLabel('What happened').fill('Everyone went home.');
    await p.getByRole('button', { name: /^Content material/ }).click();
    await p.getByRole('button', { name: /^Save beat/ }).click(); await p.waitForTimeout(500);
    await p.waitForTimeout(1500);
    const nb = Object.values(st.records[SID]).filter((r) => r.kind === 'beat' && r.data.text === 'Everyone went home.');
    ok(nb.length === 1 && nb[0].data.storyline === 's1' && nb[0].data.video === true && nb[0].data.day === 14, `${n} new beat saved (storyline, video, today)`);
    // edit + delete beat
    await p.locator('.sl-beat', { hasText: 'Everyone went home.' }).click(); await p.waitForTimeout(300);
    await p.getByRole('button', { name: 'Delete', exact: true }).click(); await p.waitForTimeout(400);
    ok(await p.locator('.sl-beat', { hasText: 'Everyone went home.' }).count() === 0, `${n} beat deleted (Trash with Undo)`);
    // secrets tab
    await p.goto(url('storylines/secrets')); await p.waitForTimeout(800);
    ok(await p.getByText('Quentin likes Shanae').first().isVisible(), `${n} secrets list`);
    if (phone) await p.locator('.sl-sec').first().click();
    await p.waitForTimeout(300);
    ok(await p.locator('.sl-matrix').isVisible(), `${n} who-knows table`);
    await shot('5-secrets');
    // new secret
    await p.getByRole('button', { name: /New secret/ }).first().click(); await p.waitForTimeout(300);
    await p.getByLabel('The secret').fill('Corey and Kiana like Kai'); await p.getByRole('dialog').getByRole('button', { name: 'Add secret' }).click(); await p.waitForTimeout(400);
    await p.waitForTimeout(1500);
    ok(Object.values(st.records[SID]).some((r) => r.kind === 'secret' && r.data.title === 'Corey and Kiana like Kai'), `${n} new secret saved`);
    // feelings
    await p.goto(url('storylines/feelings')); await p.waitForTimeout(800);
    ok(await p.locator('.sl-feel').count() === 2, `${n} feelings list`);
    await shot('6-feelings');
    await p.getByRole('button', { name: /Add feeling/ }).first().click(); await p.waitForTimeout(300);
    await p.getByRole('button', { name: /^Who feels it/ }).click(); await p.getByRole('option', { name: /^Corey/ }).click();
    await p.getByRole('button', { name: /^About/ }).click(); await p.getByRole('option', { name: /^Kai Test/ }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Mad' }).click();
    await p.getByRole('dialog').getByRole('button', { name: 'Add feeling' }).click(); await p.waitForTimeout(400);
    await p.waitForTimeout(1500);
    ok(Object.values(st.records[SID]).some((r) => r.kind === 'feeling' && r.data.from === 'co' && r.data.to === 'kai' && r.data.kind === 'mad'), `${n} new feeling saved`);
    // video tab + export
    await p.goto(url('storylines/video')); await p.waitForTimeout(800);
    ok(await p.locator('.sl-beat').count() === 2, `${n} Content tab shows the 2 content beats`);
    await shot('7-video');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /Export to vault/ }).click()]);
    const txt = fs.readFileSync(await dl.path(), 'utf8');
    ok(txt.includes('# Hookah bar night') && txt.includes('[[Kai Test]]'), `${n} export writes a markdown note`);
    // new storyline
    await p.goto(url('storylines')); await p.waitForTimeout(600);
    await p.getByRole('button', { name: /New storyline/ }).first().click(); await p.waitForTimeout(300);
    await p.getByLabel('Name').fill('Stadium redo'); await p.getByLabel('Add a tag').fill('Club'); await p.getByRole('dialog').getByRole('button', { name: 'Add storyline' }).click(); await p.waitForTimeout(600);
    await p.waitForTimeout(1500);
    const ns = Object.values(st.records[SID]).find((r) => r.kind === 'storyline' && r.data.name === 'Stadium redo');
    ok(ns && ns.data.tags[0] === 'Club', `${n} new storyline with tag`);
    ok(p.url().includes('/storylines/' + ns.id), `${n} lands on the new storyline`);
    // Sim profile card
    await p.goto(url('sims/kai')); await p.waitForTimeout(900);
    ok(await p.getByText('Hookah bar night').first().isVisible(), `${n} Sim profile lists their storylines`);
    await shot('8-sim');
    // delete storyline
    await p.goto(url('storylines/' + ns.id)); await p.waitForTimeout(500);
    await p.getByRole('button', { name: 'Delete storyline' }).click(); await p.getByRole('button', { name: 'Delete', exact: true }).click(); await p.waitForTimeout(500);
    await p.waitForTimeout(1500);
    ok(!!st.records[SID][ns.id].deleted_at, `${n} storyline deleted to Trash`);
    ok(errs.length === 0, `${n} no page errors ${errs.join('|')}`);
    await ctx.close();
  }
  await b.close();
  console.log(`testlore: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
