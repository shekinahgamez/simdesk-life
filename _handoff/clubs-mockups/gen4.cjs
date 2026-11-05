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

// ---- club page pieces
const memberRows = [0, 1, 2, 3, 4].map((i) => `<div class="mrow">${av(i, 36)}<span class="grow">${people[i][0]}</span>${i === 0 ? '<span class="tag clubs">Leader</span>' : ''}</div>`).join('');
const cHead = (c) => `<div class="card-head"><h2><span class="obj clubs">${ICON}</span>${c}</h2></div>`;
const membersCard = `<section class="card">${cHead('Members · 5')}${memberRows}</section>`;
const meetsCard = `<section class="card">${cHead('Meets at')}<div style="font-weight:700;font-size:17px">Plaza Park</div><div class="row-sub" style="margin-top:2px">Windenburg · Community lot</div></section>`;
const rulesCard = `<section class="card">${cHead('Rules')}<ul class="ul"><li>No phones at the table</li><li>Winner picks the snacks</li><li>Everyone plays at least one round</li></ul></section>`;
const notesCard = `<section class="card">${cHead('Notes')}<p style="margin:0">Started in Year 1 Spring. Adaeze keeps the trophy on her mantel.</p></section>`;
const photosCard = `<section class="card">${cHead('Photos · 3')}<div class="ph-strip">${tilesImg(3)}</div><button class="btn sm" style="margin-top:2px">+ Add photo</button></section>`;
const clubHead = (phoneMode) => `<div class="back">${back} Clubs</div><div class="page-head" style="margin-bottom:14px"><div class="row" style="gap:14px;align-items:flex-start">${obj(true)}<div><h1 style="${phoneMode ? 'font-size:24px' : ''}">Saturday Chess Club</h1><div class="sub">Chess · Meets at Plaza Park</div></div></div><button class="btn">Edit</button></div>`;

// ---- form pieces
const fld = (label, val, action, muted) => `<div class="fl">${label}</div><div class="fld"><span style="${muted ? 'color:var(--muted);font-weight:500' : ''}">${val}</span>${action ? `<small>${action}</small>` : ''}</div>`;
const formBody = `<h3 style="margin:0 0 4px;font-size:19px">New club</h3>
<div class="fl">Club name</div><input class="input" value="Saturday Chess Club">
<div class="fl">Activity</div><input class="input" placeholder="Like Chess" value="Chess">
${fld('Leader', 'Adaeze Okafor', 'Change')}
${fld('Members', 'Adaeze Okafor, Tobi Okafor, Ngozi Banks +2', 'Change')}
${fld('Meets at', 'Plaza Park · Windenburg', 'Change')}
<div class="fl">Rules</div>
<div class="rule"><input class="input" value="No phones at the table"><span class="x">✕</span></div>
<div class="rule"><input class="input" value="Winner picks the snacks"><span class="x">✕</span></div>
<div class="addrule">+ Add a rule</div>
<div class="fl">Notes</div><textarea class="textarea" rows="2" placeholder="Anything worth remembering…"></textarea>`;
const formScroll = `<div style="max-height:560px;overflow:hidden">${formBody}</div>`;
const sub = (t) => `<div class="back" style="margin-bottom:8px">${back} ${t}</div>`;
const search = (ph) => `<div style="height:44px;border:1px solid var(--line);border-radius:10px;padding:0 14px;display:flex;align-items:center;gap:10px;background:var(--bg);color:var(--muted);font-size:15px;margin-bottom:4px">${srch}${ph}</div>`;
const cb = (on) => `<span style="width:18px;height:18px;border-radius:5px;border:1.5px solid ${on ? 'var(--clubs-ink)' : 'var(--line)'};background:${on ? 'var(--clubs-ink)' : 'transparent'};flex:none;position:relative">${on ? '<span style="position:absolute;left:5px;top:1.5px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)"></span>' : ''}</span>`;
const mem = (i, on) => `<div class="mrow" style="border:0">${cb(on)}${av(i, 30)}<span class="grow">${people[i][0]}</span></div>`;
const membersList = `${sub('Members')}${search('Search Sims')}<div class="sec2">Selected</div>${[0, 1, 2, 3, 4].map((i) => mem(i, true)).join('')}<div class="sec2">Everyone</div>${mem(5, false)}`;
const leaderList = `${sub('Leader')}<div class="sec2" style="margin-top:2px">Pick from the members</div>${[0, 1, 2, 3, 4].map((i) => `<div class="mrow">${av(i, 30)}<span class="grow">${people[i][0]}</span><span style="width:22px">${i === 0 ? tick : ''}</span></div>`).join('')}`;
const lotRow = (t, s, on) => `<div class="mrow"><span class="grow">${t}${s ? `<small>${s}</small>` : ''}</span><span style="width:22px">${on ? tick : ''}</span></div>`;
const lotList = `${sub('Meets at')}${search('Search lots and lot types')}<div style="max-height:600px;overflow:hidden">${lotRow('None yet', '', false)}<div class="sec2">Your lots</div>${lotRow('Plaza Park', 'Windenburg · Community lot', true)}${lotRow('Willow Creek Greenhouse', 'Willow Creek · Community lot', false)}${lotRow('The Brew Café', 'Windenburg · Community lot', false)}<div class="sec2">Any lot of a type</div>${lotRow('Bar', 'Community lot type', false)}${lotRow('Cafe', 'Community lot type', false)}${lotRow('Karaoke Bar', 'Community lot type', false)}${lotRow('Library', 'Community lot type', false)}</div>`;

// ---- sim profile / photos / search
const simClubs = `<section class="card"><div class="card-head"><h2><span class="obj clubs">${ICON}</span>Clubs · 2</h2></div><div class="mrow"><span class="grow">Saturday Chess Club<small>Chess · Leader</small></span></div><div class="mrow" style="border:0"><span class="grow">Garden Gossips<small>Gardening · Member</small></span></div></section>`;
const photoForm = `<div style="font-family:var(--font-head);font-weight:800;font-size:20px;margin-bottom:10px">Add a photo</div>
<div style="height:120px;border-radius:14px;background:linear-gradient(#bcd,#dbc);margin-bottom:10px"></div>
<div class="fl" style="margin-top:6px">Caption</div><input class="input" value="Checkmate in four!">
<div class="fl">Sims in this photo (optional)</div><div class="fld"><span>Adaeze Okafor, Tobi Okafor</span><small>Change</small></div>
<div class="fl">Club (optional)</div><div class="fld"><span>Saturday Chess Club</span><small>Change</small></div>
<div class="fl">Game date</div><div class="fld"><span>Spring 14 · Year 1</span></div>`;
const photoPage = `<div class="back">${back} Photos</div><img src="ph-land.png" style="display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px"><h1 style="font-size:22px;margin:12px 0 2px">Checkmate in four!</h1><div class="row-sub" style="margin-bottom:10px"><b style="color:var(--text)">Year 1 · Spring · Day 14</b> &nbsp; Added Nov 4</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="tag clubs" style="padding:6px 12px">Adaeze Okafor</span><span class="tag clubs" style="padding:6px 12px">Tobi Okafor</span></div><div style="color:var(--accent);font-weight:700;font-size:14px">Club: Saturday Chess Club</div>`;
const sg = (ic, t, n) => `<div class="mrow"><span style="width:34px;height:34px;border-radius:9px;background:var(--clubs-tint);color:var(--clubs-ink);display:flex;align-items:center;justify-content:center;flex:none">${ic}</span><span class="grow">${t}</span><span style="font-size:13px;color:var(--muted);font-weight:600">${n}</span></div>`;
const searchPanel = `<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><div style="flex:1;height:44px;border-radius:12px;background:var(--surface);outline:2px solid var(--photos-ink);display:flex;align-items:center;gap:10px;padding:0 14px;font-size:15px">${srch}chess</div><b style="color:var(--accent);font-size:15px">Cancel</b></div><div class="sec2">Clubs</div>${sg('<span style="display:flex;width:18px">' + ICON.replace('width="24" height="24"', 'width="18" height="18"') + '</span>', 'Saturday Chess Club', '3 photos')}<div class="sec2">Captions</div>${sg('≡', '“Checkmate in four!”', '')}${sg('≡', '“Chess night”', '')}`;

const empty = `<div class="empty" style="margin-top:24px">${obj(true)}<h2 style="font-size:18px;margin:0">No clubs yet</h2><p>Add a club to keep track of who’s in it, who leads it and where it meets.</p><button class="btn primary">+ New club</button></div>`;

const P = {
  list: phone('Clubs', `${phoneTop('Clubs', '+ New club')}<div class="stack" style="gap:12px">${CARDS.join('')}</div>`),
  empty: phone('No clubs yet', `${phoneTop('Clubs')}${empty}`),
  clubTop: phone('A club', `${clubHead(true)}<div class="stack" style="gap:12px">${membersCard}${meetsCard}</div>`),
  clubBottom: phone('A club, further down', `<div class="stack" style="gap:12px">${rulesCard}${notesCard}${photosCard}</div>`),
  form: phone('New club', `${phoneTop('Clubs', '+ New club')}`, sheetOver(formScroll, bigbtn('Add club'))),
  members: phone('Tap Members', `${phoneTop('Clubs', '+ New club')}`, sheetOver(membersList, bigbtn('Done'))),
  leader: phone('Tap Leader', `${phoneTop('Clubs', '+ New club')}`, sheetOver(leaderList, '')),
  spot: phone('Tap Meets at', `${phoneTop('Clubs', '+ New club')}`, sheetOver(lotList, '')),
  sim: phone('On a Sim’s page', `<div class="back">${back} Sims</div><div class="page-head" style="margin-bottom:14px"><div class="row" style="gap:14px">${av(0, 56)}<div><h1 style="font-size:24px">Adaeze Okafor</h1><div class="sub">Young adult</div></div></div></div><div class="stack" style="gap:12px">${simClubs}</div>`),
  photoForm: phone('Add a photo', `${phoneTop('Photos', '+ Add photo')}`, sheetOver(`<div style="max-height:600px;overflow:hidden">${photoForm}</div>`, bigbtn('Add photo'))),
  photoPage: phone('Photo page', photoPage),
  search: phone('Search “chess”', `${phoneTop('Photos', '+ Add')}${searchPanel}`),
};
const D = {
  list: `<div class="wrap" style="width:1100px;padding:28px"><div class="page-head" style="margin-bottom:18px"><div class="row" style="gap:14px;align-items:flex-start">${obj(true)}<div><h1>Clubs</h1><div class="sub">3 clubs</div></div></div><button class="btn primary">+ New club</button></div><div class="hh-cards">${CARDS.join('')}</div></div>`,
  club: `<div class="wrap" style="width:1100px;padding:28px">${clubHead(false)}<div class="hh-grid">${`<div class="stack" style="gap:14px">${membersCard}${photosCard}</div><div class="stack" style="gap:14px">${meetsCard}${rulesCard}${notesCard}</div>`}</div></div>`,
  form: `<div class="wrap" style="width:1100px"><div class="page-head"><div class="row" style="gap:14px">${obj(true)}<div><h1>Clubs</h1><div class="sub">3 clubs</div></div></div></div></div><div style="position:absolute;inset:0;background:rgba(30,18,26,.38)"></div><div class="mdl"><div style="position:absolute;right:30px;top:28px;font-size:22px">✕</div>${formBody.replace('<h3 style="margin:0 0 4px;font-size:19px">New club</h3>', '<h3>New club</h3>')}<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px"><div class="btn">Cancel</div><div class="btn primary">Add club</div></div></div>`,
  pick: `<div class="wrap" style="width:1100px"><div class="page-head"><div class="row" style="gap:14px">${obj(true)}<div><h1>Clubs</h1><div class="sub">3 clubs</div></div></div></div></div><div style="position:absolute;inset:0;background:rgba(30,18,26,.38)"></div><div class="mdl" style="top:60px"><div style="position:absolute;right:30px;top:28px;font-size:22px">✕</div>${membersList}<div style="display:flex;justify-content:flex-end;margin-top:18px"><div class="btn primary">Done</div></div></div>`,
};
(async () => {
  const b = await chromium.launch();
  const shoot = async (html, w, h, out) => { fs.writeFileSync('t4.html', html); const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 }); const p = await c.newPage(); await p.goto('file://' + process.cwd() + '/t4.html'); await p.waitForTimeout(1500); await p.screenshot({ path: out }); await c.close(); };
  const row = (...xs) => page(`<div class="sidebyside">${xs.join('')}</div>`);
  await shoot(row(P.list, P.clubTop, P.clubBottom), 1260, 900, 'mock/m-clubs-a.png');
  await shoot(row(P.form, P.members, P.spot), 1260, 900, 'mock/m-clubs-b.png');
  await shoot(row(P.sim, P.photoForm, P.photoPage, P.search), 1680, 900, 'mock/m-clubs-c.png');
  await shoot(row(P.empty, P.leader), 860, 900, 'mock/m-clubs-d.png');
  await shoot(page(`<div style="position:relative;height:640px;overflow:hidden">${D.list}</div>`), 1180, 560, 'mock/m-clubs-desk-list.png');
  await shoot(page(`<div style="position:relative;height:900px;overflow:hidden">${D.club}</div>`), 1180, 900, 'mock/m-clubs-desk-page.png');
  await shoot(page(`<div style="position:relative;height:960px;overflow:hidden">${D.form}</div>`), 1180, 960, 'mock/m-clubs-desk-form.png');
  await shoot(page(`<div style="position:relative;height:820px;overflow:hidden">${D.pick}</div>`), 1180, 820, 'mock/m-clubs-desk-pick.png');
  await b.close();
})();
