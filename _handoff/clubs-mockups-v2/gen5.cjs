const { chromium } = require('playwright');
const fs = require('fs');
const src = fs.readFileSync('/home/user/simdesk-life/_handoff/approved-mockups/gen.cjs', 'utf8');
const baseCss = src.match(/const css = `([\s\S]*?)`;\n/)[1];
const css = baseCss + `
.fl{font-size:13px;font-weight:600;margin:14px 0 6px}
.phone .input,.mdl .input{width:100%;box-sizing:border-box}
.phone textarea,.mdl textarea{width:100%;box-sizing:border-box}
.rule{display:flex;gap:8px;align-items:center;margin-bottom:8px}
.rule .x{width:34px;height:34px;border-radius:50%;background:var(--sidebar);display:flex;align-items:center;justify-content:center;color:var(--muted);flex:none}
.addrule{color:var(--accent);font-weight:700;font-size:14px;margin-top:2px}
.mdl{position:absolute;left:50%;top:30px;transform:translateX(-50%);width:540px;background:var(--surface);border-radius:24px;padding:26px 32px 28px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.mdl h3{margin:0 0 6px;font-size:22px}
.row-sub{font-size:13px;color:var(--muted);font-weight:500}
.back{color:var(--accent);font-weight:700;font-size:14px;display:inline-flex;align-items:center;gap:2px;margin-bottom:6px}
.sec2{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin:12px 0 2px}
.mrow{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid var(--line);font-weight:600;font-size:16px}
.mrow .grow{flex:1;min-width:0}
.mrow small{display:block;font-size:13px;color:var(--muted);font-weight:500}
.ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
`;
const ICON = fs.readFileSync('clubs-icon.svg', 'utf8');
const obj = (lg) => `<span class="obj clubs ${lg ? 'lg' : ''}">${ICON}</span>`;
const page = (body) => `<!doctype html><html><head><meta charset=utf-8><link rel=stylesheet href="app.css"><link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Gabarito:wght@600;700;800&family=Rethink+Sans:wght@400;500;600;700&display=swap"><style>${css}</style></head><body>${body}</body></html>`;
const srch = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="opacity:.55"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const back = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>';
const tick = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--clubs-ink)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const people = [['Adaeze Okafor', 'AO'], ['Tobi Okafor', 'TO'], ['Ngozi Banks', 'NB'], ['Marcus Hale', 'MH'], ['Priya Raman', 'PR'], ['Lena Voss', 'LV']];
const av = (i, s = 44) => `<span class="sim-avatar initials" style="width:${s}px;height:${s}px;font-size:${Math.round(s * .36)}px">${people[i][1]}</span>`;
const faces = (idx, more = 0, s = 44) => `<span class="hh-faces" style="--f:${s}px">${idx.map((i) => `<span class="hh-face">${av(i, s)}</span>`).join('')}${more ? `<span class="hh-face more">+${more}</span>` : ''}</span>`;
const card = (idx, more, name, ln, tag) => `<div class="hh-card">${faces(idx, more)}<h3>${name}</h3><div class="ln">${ln}</div><div class="row" style="gap:6px"><span class="tag clubs">${tag}</span></div></div>`;
const CARDS = [
  card([0, 1, 2, 3], 1, 'Saturday Chess Club', 'Chess · Plaza Park', 'Leader: Adaeze'),
  card([4, 5], 0, 'Garden Gossips', 'Gardening · Willow Creek Greenhouse', 'Leader: Priya'),
  card([1, 3, 5], 0, 'Night Owls', 'Karaoke · Any Karaoke Bar', 'Leader: Tobi')];
const phoneTop = (t, btn) => `<div class="top"><h1 style="font-size:26px">${t}</h1>${btn ? `<button class="btn primary" style="height:38px">${btn}</button>` : ''}</div>`;
const phone = (cap, inner, extra = '') => `<div class="phone m-stack"><div class="cap">${cap}</div><div class="wrap" style="padding-top:42px">${inner}</div>${extra}</div>`;
const sheetOver = (inner, foot) => `<div class="scrim"></div><div class="sheet" style="padding-bottom:16px;max-height:92%;overflow:hidden"><div class="grab"></div>${inner}${foot || ''}</div>`;
const bigbtn = (t) => `<div class="bigbtn">${t}</div>`;
const tilesImg = (n) => Array.from({ length: n }, (_, k) => `<div class="ph-mini"><img src="${['ph-land', 'ph-square', 'ph-tall'][k % 3]}.png" style="display:block;width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;filter:hue-rotate(${k * 50}deg)"><span class="ph-mini-date">Spring 1${k} · Year 1</span></div>`).join('');


// ================= v2 =================
const search = (ph) => `<div style="height:44px;border:1px solid var(--line);border-radius:10px;padding:0 14px;display:flex;align-items:center;gap:10px;background:var(--bg);color:var(--muted);font-size:15px;margin-bottom:4px">${srch}${ph}</div>`;
const cb = (on) => `<span style="width:18px;height:18px;border-radius:5px;border:1.5px solid ${on ? 'var(--clubs-ink)' : 'var(--line)'};background:${on ? 'var(--clubs-ink)' : 'transparent'};flex:none;position:relative">${on ? '<span style="position:absolute;left:5px;top:1.5px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)"></span>' : ''}</span>`;
const css2 = `.subt{display:flex;align-items:center;gap:6px;margin:0 0 12px -6px;font-family:var(--font-head);font-weight:800;font-size:19px}
.subt svg{width:22px;height:22px}.subt .clr{margin-left:auto;font-family:var(--font-body);font-size:14px;font-weight:700;color:var(--accent)}
.phone .ph-seg,.mdl .ph-seg{margin:0 0 10px}
.card h2{font-size:17px}`;
const chev = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--muted)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>';
const backD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>';
const subt = (t, clr) => `<div class="subt">${backD}<span>${t}</span>${clr ? `<span class="clr">${clr}</span>` : ''}</div>`;
const hh = ['Okafor', 'Okafor', 'Banks', 'Hale', 'Raman', 'Voss'];
const card2 = (idx, more, name, ln, led) => `<div class="hh-card" style="gap:4px"><h3 style="margin:0">${name}</h3><div class="ln" style="margin:0">${ln}</div><div class="ln" style="margin:0">${led}</div><div style="margin-top:8px">${faces(idx, more, 34)}</div></div>`;
const CARDS2 = [
  card2([0, 1, 2, 3], 1, 'Saturday Chess Club', 'Chess · Plaza Park', 'Led by Adaeze · 5 members'),
  card2([4, 5], 0, 'Garden Gossips', 'Gardening · Willow Creek Greenhouse', 'Led by Priya · 2 members'),
  card2([1, 3, 5], 0, 'Night Owls', 'Karaoke · Any Karaoke Bar', 'Led by Tobi · 3 members')];
const ch2 = (t) => `<div class="card-head"><h2>${t}</h2></div>`;
const memberRows2 = [0, 1, 2, 3, 4].map((i) => `<div class="mrow">${av(i, 36)}<span class="grow">${people[i][0]}</span>${i === 0 ? '<span class="tag clubs">Leader</span>' : ''}${chev}</div>`).join('');
const membersCard2 = `<section class="card">${ch2('Members · 5')}${memberRows2}</section>`;
const meetsCard2 = `<section class="card">${ch2('Meets at')}<div class="mrow" style="border:0;padding:2px 0"><span class="grow">Plaza Park<small>Windenburg</small></span>${chev}</div></section>`;
const rulesCard2 = `<section class="card">${ch2('Rules')}<ul class="ul"><li>No phones at the table</li><li>Winner picks the snacks</li><li>Everyone plays at least one round</li></ul></section>`;
const notesCard2 = `<section class="card">${ch2('Notes')}<p style="margin:0">Started in Year 1 Spring. Adaeze keeps the trophy on her mantel.</p></section>`;
const photosCard2 = `<section class="card">${ch2('Photos · 3')}<div class="ph-strip">${tilesImg(3)}</div><button class="btn sm" style="margin-top:2px">+ Add photo</button></section>`;
const clubHead2 = (ph) => `<div class="back">${back} Clubs</div><div class="page-head" style="margin-bottom:14px"><div class="row" style="gap:14px;align-items:flex-start">${obj(true)}<div><h1 style="${ph ? 'font-size:24px' : ''}">Saturday Chess Club</h1><div class="sub">Chess · 5 members</div></div></div><button class="btn">Edit</button></div>`;

// form
const fld2 = (label, val, action, muted, dis) => `<div class="fl">${label}</div><div class="fld" style="${dis ? 'opacity:.6' : ''}"><span style="${muted ? 'color:var(--muted);font-weight:500' : ''}">${val}</span>${action ? `<small>${action}</small>` : ''}</div>`;
const rules2 = `<div class="fl">Rules</div><div class="rule"><input class="input" value="No phones at the table"><span class="x" style="width:40px;height:40px">✕</span></div><div class="rule"><input class="input" value="Winner picks the snacks"><span class="x" style="width:40px;height:40px">✕</span></div><div class="btn sm" style="margin-top:2px">+ Add a rule</div>`;
const notes2 = `<div class="fl">Notes</div><textarea class="textarea" rows="2" placeholder="Anything worth remembering…"></textarea>`;
const formFull = (title) => `<h3 style="margin:0 0 4px;font-size:19px">${title}</h3>
<div class="fl">Club name</div><input class="input" value="Saturday Chess Club">
<div class="fl">Activity</div><input class="input" placeholder="Like Chess" value="Chess">
${fld2('Members', 'Adaeze, Tobi, Ngozi +2', 'Change')}
${fld2('Leader', 'Adaeze Okafor', 'Change')}
${fld2('Meets at', 'Plaza Park · Windenburg', 'Change')}
${rules2}${notes2}`;
const formEmpty = `<h3 style="margin:0 0 4px;font-size:19px">New club</h3>
<div class="fl">Club name</div><input class="input" placeholder="Like Saturday Chess Club">
<div class="fl">Activity</div><input class="input" placeholder="Like Chess">
${fld2('Members', 'None yet', 'Add', true)}
${fld2('Leader', 'Add members first', '', true, true)}
${fld2('Meets at', 'Not set', 'Choose', true)}
<div class="fl">Rules</div><div class="btn sm">+ Add a rule</div>
${notes2}`;

// pickers
const memRow = (i, on) => `<div class="mrow" style="border:0">${cb(on)}${av(i, 30)}<span class="grow">${people[i][0]}</span><span style="font-size:13px;color:var(--muted);font-weight:500">${hh[i]}</span></div>`;
const membersList2 = `${subt('Members')}${search('Search Sims')}<div class="sec2">Selected</div>${[0, 1, 2, 3, 4].map((i) => memRow(i, true)).join('')}<div class="sec2">Everyone</div>${memRow(5, false)}`;
const leaderList2 = `${subt('Leader')}<div class="sec2" style="margin-top:2px">From the members</div>${[0, 1, 2, 3, 4].map((i) => `<div class="mrow">${av(i, 30)}<span class="grow">${people[i][0]}</span><span style="font-size:13px;color:var(--muted);font-weight:500;margin-right:6px">${hh[i]}</span><span style="width:22px">${i === 0 ? tick : ''}</span></div>`).join('')}`;
const seg2 = (a) => `<div class="ph-seg" role="group"><button aria-pressed="${a === 0}">A lot</button><button aria-pressed="${a === 1}">Lot type</button></div>`;
const row1 = (t, on) => `<div class="mrow"><span class="grow">${t}</span><span style="width:22px">${on ? tick : ''}</span></div>`;
const lotRow2 = (t, s, on) => `<div class="mrow"><span class="grow">${t}${s ? `<small>${s}</small>` : ''}</span><span style="width:22px">${on ? tick : ''}</span></div>`;
const spotLots = `${subt('Meets at', 'Clear')}${seg2(0)}${search('Search your lots')}${lotRow2('Plaza Park', 'Windenburg', true)}${lotRow2('The Brew Café', 'Windenburg', false)}${lotRow2('Willow Creek Greenhouse', 'Willow Creek', false)}${lotRow2('Moonlit Lounge', 'Windenburg', false)}`;
const spotTypes = `${subt('Meets at', 'Clear')}${seg2(1)}${search('Search lot types')}${['Bar', 'Cafe', 'Gym', 'Karaoke Bar', 'Library', 'Lounge', 'Museum', 'Nightclub'].map((t) => row1(t, t === 'Karaoke Bar')).join('')}`;

// photo filter with a Club row
const pfld = (l, v, a, m) => `<div class="lbl" style="margin:10px 0 6px">${l}</div><div class="fld"><span style="${m ? 'color:var(--muted);font-weight:500' : ''}">${v}</span>${a ? `<small>${a}</small>` : ''}</div>`;
const filterClub = `<h3>Filter</h3>${pfld('Sims', 'Adaeze Okafor, Tobi Okafor', 'Change')}${pfld('When', 'Any', '', true)}${pfld('Occasion', 'Any', '', true)}${pfld('Club', 'Saturday Chess Club', '')}<div class="lbl" style="margin:10px 0 6px">Sort by</div><div class="ph-seg"><button aria-pressed="true">Game date</button><button aria-pressed="false">Date added</button></div>`;
const pbar = (n) => `<div style="display:flex;gap:8px;margin-bottom:14px"><div style="flex:1;height:44px;border-radius:12px;background:var(--sidebar);display:flex;align-items:center;gap:10px;padding:0 14px;color:var(--muted);font-size:15px">${srch}Search photos</div><div style="position:relative;width:44px;height:44px;border-radius:12px;background:var(--photos-tint);color:var(--photos-ink);display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M7 12h10M10 17h4"/></svg><span style="position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;border-radius:9px;background:var(--photos-ink);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center">${n}</span></div></div>`;

// sim card
const simClubs2 = `<section class="card">${ch2('Clubs · 2')}<div class="mrow"><span class="grow">Saturday Chess Club<small>Chess · Leader</small></span>${chev}</div><div class="mrow" style="border:0"><span class="grow">Garden Gossips<small>Gardening · Member</small></span>${chev}</div></section>`;

const empty2 = `<div class="empty" style="margin-top:24px">${obj(true)}<h2 style="font-size:18px;margin:0">No clubs yet</h2><p>Who’s in it, who leads it, where it meets.</p><button class="btn primary">+ New club</button></div>`;

const P2 = {
  list: phone('Clubs', `${phoneTop('Clubs', '+ New club')}<div class="stack" style="gap:12px">${CARDS2.join('')}</div>`),
  empty: phone('No clubs yet', `${phoneTop('Clubs')}${empty2}`),
  club: phone('A club', `${clubHead2(true)}<div class="stack" style="gap:12px">${membersCard2}${meetsCard2}${rulesCard2}</div>`),
  form: phone('New club, filled in', `${phoneTop('Clubs', '+ New club')}`, sheetOver(`<div style="max-height:600px;overflow:hidden">${formFull('New club')}</div>`, bigbtn('Add club'))),
  formEmpty: phone('New club, empty', `${phoneTop('Clubs', '+ New club')}`, sheetOver(`<div style="max-height:600px;overflow:hidden">${formEmpty}</div>`, bigbtn('Add club'))),
  filter: phone('Photos filter, with a Club row', `${phoneTop('Photos', '+ Add')}${pbar(2)}`, sheetOver(filterClub, `${bigbtn('Show 3 photos')}<div style="text-align:center;font-weight:700;padding:14px 0 2px">Clear all</div>`)),
  members: phone('Tap Members', `${phoneTop('Clubs', '+ New club')}`, sheetOver(membersList2, bigbtn('Done · 5 selected'))),
  leader: phone('Tap Leader', `${phoneTop('Clubs', '+ New club')}`, sheetOver(leaderList2, '')),
  lots: phone('Meets at: a lot', `${phoneTop('Clubs', '+ New club')}`, sheetOver(spotLots, '')),
  types: phone('Meets at: lot type', `${phoneTop('Clubs', '+ New club')}`, sheetOver(spotTypes, '')),
  sim: phone('On a Sim’s page', `<div class="back">${back} Sims</div><div class="page-head" style="margin-bottom:14px"><div class="row" style="gap:14px">${av(0, 56)}<div><h1 style="font-size:24px">Adaeze Okafor</h1><div class="sub">Young adult</div></div></div></div><div class="stack" style="gap:12px">${simClubs2}</div>`),
};
const D2 = {
  list: `<div class="wrap" style="width:1100px;padding:28px"><div class="page-head" style="margin-bottom:18px"><div class="row" style="gap:14px;align-items:flex-start">${obj(true)}<div><h1>Clubs</h1><div class="sub">3 clubs</div></div></div><button class="btn primary">+ New club</button></div><div class="hh-cards">${CARDS2.join('')}</div></div>`,
  club: `<div class="wrap" style="width:1100px;padding:28px">${clubHead2(false)}<div class="hh-grid"><div class="stack" style="gap:14px">${membersCard2}${photosCard2}</div><div class="stack" style="gap:14px">${meetsCard2}${rulesCard2}${notesCard2}</div></div></div>`,
  form: `<div class="wrap" style="width:1100px"><div class="page-head"><div class="row" style="gap:14px">${obj(true)}<div><h1>Clubs</h1><div class="sub">3 clubs</div></div></div></div></div><div style="position:absolute;inset:0;background:rgba(30,18,26,.38)"></div><div class="mdl"><div style="position:absolute;right:30px;top:28px;font-size:22px">✕</div>${formFull('Edit club').replace('<h3 style="margin:0 0 4px;font-size:19px">Edit club</h3>', '<h3>Edit club</h3>')}<div style="display:flex;gap:10px;margin-top:22px;align-items:center"><div class="btn ghost" style="color:var(--danger);margin-right:auto">Delete</div><div class="btn">Cancel</div><div class="btn primary">Save</div></div></div>`,
};
(async () => {
  const b = await chromium.launch();
  const shoot = async (html, w, h, out) => { fs.writeFileSync('t5.html', html.replace('</style>', css2 + '</style>')); const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 }); const p = await c.newPage(); await p.goto('file://' + process.cwd() + '/t5.html'); await p.waitForTimeout(1500); await p.screenshot({ path: out }); await c.close(); };
  const row = (...xs) => page(`<div class="sidebyside">${xs.join('')}</div>`);
  await shoot(row(P2.list, P2.empty, P2.club), 1260, 900, 'mock/v2-a.png');
  await shoot(row(P2.form, P2.formEmpty, P2.filter), 1260, 900, 'mock/v2-b.png');
  await shoot(row(P2.members, P2.leader, P2.lots, P2.types), 1680, 900, 'mock/v2-c.png');
  await shoot(row(P2.sim), 460, 900, 'mock/v2-d.png');
  await shoot(page(`<div style="position:relative;height:620px;overflow:hidden">${D2.list}</div>`), 1180, 560, 'mock/v2-desk-list.png');
  await shoot(page(`<div style="position:relative;height:900px;overflow:hidden">${D2.club}</div>`), 1180, 800, 'mock/v2-desk-page.png');
  await shoot(page(`<div style="position:relative;height:1000px;overflow:hidden">${D2.form}</div>`), 1180, 1000, 'mock/v2-desk-form.png');
  await b.close();
})();
