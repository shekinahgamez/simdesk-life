// Account page, password, and backups (Nov 7): rows, Download choices (backup .json, spreadsheet .xlsx, photos .zip),
// Last backup date, Restore as a new save, wrong file, phone shows a note only. Run from inside _handoff/test-scripts/.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { mock, newState, logIn } = require('./mockdb.cjs');
const { seed, SID } = require('./seed.cjs');
const XLSX = require('../../node_modules/xlsx');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'acct-'));
const PORTRAIT = 'c1111111-0000-4000-8000-000000000001';
const png = fs.existsSync('portrait.png') ? fs.readFileSync('portrait.png') : Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const withPhoto = (st) => {
  const sim = Object.values(st.records[SID]).find((r) => r.kind === 'sim');
  sim.data.portrait = { id: PORTRAIT, w: 1, h: 1, crop: { cx: 0.5, cy: 0.5, zoom: 1 } };
  st.files[`u1/${PORTRAIT}.png`] = { data: png, type: 'image/png' };
};
(async () => {
  const b = await chromium.launch();
  for (const [n, w, h] of [['wide', 1440, 900], ['phone', 390, 844]]) {
    const phone = n === 'phone';
    const st = newState(); seed(st); withPhoto(st);
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', acceptDownloads: true });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await mock(p, st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
    await p.goto('http://localhost:4173/#/account'); await p.waitForTimeout(1000);
    const body = await p.locator('main, .main, body').first().innerText();
    ok(/NiaPlays/.test(body), `${n} shows the username`);
    ok(/nia@example\.com/.test(body), `${n} shows the email`);
    ok(await p.getByRole('button', { name: /Password/ }).isVisible(), `${n} Password row`);
    ok(!/Style check/.test(body) && !/Signed in/.test(body), `${n} no Style check link or Signed in line`);
    ok(await p.getByRole('button', { name: /Log out/ }).isVisible(), `${n} Log out is there`);

    // Password validation
    await p.getByRole('button', { name: /Password/ }).first().click(); await p.waitForTimeout(400);
    ok(await p.getByText('Change password').first().isVisible(), `${n} password window opens`);
    await p.getByLabel('New password', { exact: true }).fill('abc'); await p.getByLabel('Confirm new password').fill('abc');
    await p.getByRole('button', { name: 'Save new password' }).click(); await p.waitForTimeout(300);
    ok(await p.getByRole('alert').isVisible() && /at least/.test(await p.getByRole('alert').innerText()), `${n} short password is refused`);
    await p.getByLabel('New password', { exact: true }).fill('longenough1'); await p.getByLabel('Confirm new password').fill('different1');
    await p.getByRole('button', { name: 'Save new password' }).click(); await p.waitForTimeout(300);
    ok(/match/.test(await p.getByRole('alert').innerText()), `${n} mismatched passwords are refused`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    if (!await p.getByText('Change password').count()) { /* closed */ } else { await p.getByRole('button', { name: 'Cancel' }).click().catch(() => {}); await p.waitForTimeout(300); }

    if (phone) {
      ok(await p.getByRole('button', { name: /Download/ }).count() === 0 && await p.getByRole('button', { name: /Restore/ }).count() === 0, `${n} no Download or Restore buttons`);
      ok(/computer version/.test(await p.locator('body').innerText()), `${n} says backups are on the computer version`);
      ok(errs.length === 0, `${n} no page errors ${errs.join(' | ')}`);
      await ctx.close(); continue;
    }

    // Download choices
    ok(/Never backed up/.test(await p.locator('body').innerText()), `${n} says Never backed up at first`);
    await p.getByRole('button', { name: /Download/ }).first().click(); await p.waitForTimeout(400);
    ok(await p.getByRole('button', { name: /Backup file/ }).isVisible() && await p.getByRole('button', { name: /Spreadsheet/ }).isVisible() && await p.getByRole('button', { name: /^Photos/ }).isVisible(), `${n} three choices`);
    const dlg = await p.locator('.modal').innerText();
    ok(/Can be restored/.test(dlg) && (dlg.match(/Can’t be restored/g) || []).length === 2, `${n} says which ones can be restored`);

    // Spreadsheet
    let dl = p.waitForEvent('download'); await p.getByRole('button', { name: /Spreadsheet/ }).click();
    let d = await dl; const xl = path.join(tmp, 'sheet.xlsx'); await d.saveAs(xl);
    ok(/\.xlsx$/.test(d.suggestedFilename()), `${n} spreadsheet is named .xlsx`);
    const wb = XLSX.readFile(xl);
    ok(['Sims', 'Households', 'Lots', 'Relationships'].every((t) => wb.SheetNames.includes(t)), `${n} tabs ${wb.SheetNames.join(',')}`);
    const sims = XLSX.utils.sheet_to_json(wb.Sheets.Sims);
    ok(sims.length === 2 && sims.some((r) => r.Name === 'Cori Fletcher') && !('id' in sims[0]), `${n} Sims tab has names, no ids`);
    ok(sims.find((r) => r.Name === 'Cori Fletcher').Traits.includes('Anxious Attachment'), `${n} custom trait names come through`);
    const rels = XLSX.utils.sheet_to_json(wb.Sheets.Relationships);
    ok(rels.length === 1 && rels[0].Sim && rels[0]['Other Sim'], `${n} Relationships tab reads in words`);
    await p.waitForTimeout(600);
    ok(await p.locator('.modal').count() === 0, `${n} window closes after the download`);

    // Photos zip
    await p.getByRole('button', { name: /Download/ }).first().click(); await p.waitForTimeout(400);
    dl = p.waitForEvent('download'); await p.getByRole('button', { name: /^Photos/ }).click();
    d = await dl; const zp = path.join(tmp, 'photos.zip'); await d.saveAs(zp);
    ok(/\.zip$/.test(d.suggestedFilename()), `${n} photos file is a .zip`);
    const zbuf = fs.readFileSync(zp);
    ok(zbuf.readUInt32LE(0) === 0x04034b50 && zbuf.includes(Buffer.from('Cori Fletcher - portrait.jpg')), `${n} zip holds "Cori Fletcher - portrait.jpg"`);
    ok(zbuf.includes(Buffer.from([0xff, 0xd8, 0xff])), `${n} zip holds a real JPEG`);

    // Backup file
    await p.getByRole('button', { name: /Download/ }).first().click(); await p.waitForTimeout(400);
    dl = p.waitForEvent('download'); await p.getByRole('button', { name: /Backup file/ }).click();
    d = await dl; const js = path.join(tmp, 'backup.json'); await d.saveAs(js);
    const bk = JSON.parse(fs.readFileSync(js, 'utf8'));
    ok(bk.format === 2 && Object.keys(bk.photos || {}).length === 1 && bk.records.length === 6, `${n} backup file has records and the photo`);
    await p.waitForTimeout(500);
    ok(/Last backup/.test(await p.locator('body').innerText()) && !!st.saves[SID].data.backedUpAt, `${n} save shows Last backup and remembers it`);

    // Backup without photos
    await p.getByRole('button', { name: /Download/ }).first().click(); await p.waitForTimeout(400);
    await p.getByLabel('Include photos').uncheck();
    dl = p.waitForEvent('download'); await p.getByRole('button', { name: /Backup file/ }).click();
    d = await dl; await d.saveAs(path.join(tmp, 'nophotos.json'));
    ok(!JSON.parse(fs.readFileSync(path.join(tmp, 'nophotos.json'), 'utf8')).photos, `${n} Include photos off leaves them out`);
    await p.waitForTimeout(400);

    // Restore
    const before = Object.keys(st.saves).length;
    await p.getByRole('button', { name: /Restore from a backup/ }).click(); await p.waitForTimeout(400);
    ok(await p.getByRole('button', { name: 'Restore as a new save' }).isDisabled(), `${n} Restore is off until a file is picked`);
    await p.locator('.modal input[type=file]').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"x":1}') }); await p.waitForTimeout(400);
    ok(await p.getByRole('alert').isVisible() && /isn’t a SimDesk backup/.test(await p.getByRole('alert').innerText()), `${n} wrong file gets an error`);
    await p.locator('.modal input[type=file]').setInputFiles(js); await p.waitForTimeout(500);
    const dlg2 = await p.locator('.modal').innerText();
    ok(/Grown Folks Save/.test(dlg2) && /2 Sims/.test(dlg2) && /1 photo/.test(dlg2), `${n} preview shows name and counts`);
    ok(await p.locator('.modal input.input').inputValue() === 'Grown Folks Save (restored)', `${n} name starts as "(restored)"`);
    await p.getByRole('button', { name: 'Restore as a new save' }).click(); await p.waitForTimeout(1500);
    const ids = Object.keys(st.saves);
    ok(ids.length === before + 1 && st.saves[SID].data.name === 'Grown Folks Save', `${n} restore makes a NEW save and leaves the old one`);
    const nid = ids.find((i) => i !== SID);
    ok(st.saves[nid].data.name === 'Grown Folks Save (restored)', `${n} new save is named`);
    const rs = Object.values(st.records[nid] || {});
    ok(rs.length === 6 && rs.every((r) => !(r.id in st.records[SID])), `${n} restored records get new ids`);
    const rp = rs.find((r) => r.kind === 'sim' && r.data.portrait);
    ok(rp && rp.data.portrait.id !== PORTRAIT && Object.keys(st.files).some((k) => k.includes(rp.data.portrait.id)), `${n} photo is re-uploaded under a new id`);
    ok(await p.getByText('Open it').isVisible(), `${n} toast offers Open it`);
    ok(errs.length === 0, `${n} no page errors ${errs.join(' | ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(`testaccount: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
