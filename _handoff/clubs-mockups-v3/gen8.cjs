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


// ================= v3: clubs as they work in the game =================
const css3 = `.ph-seg.three button{padding:10px 4px}.hint{font-size:13px;color:var(--muted);margin:6px 2px 0}
.cnt{font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.02em;margin-left:6px;text-transform:none}
.sub2{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin:14px 0 4px}
.kv{display:flex;gap:10px;align-items:baseline;padding:9px 0;border-bottom:1px solid var(--line)}.kv:last-child{border:0}
.kv b{font-weight:600;font-size:13px;color:var(--muted);width:78px;flex:none}.kv span{font-weight:600;font-size:15px}
.sug{border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:0 8px 24px rgba(36,25,31,.12);margin:-4px 0 8px;overflow:hidden}
.sug div{padding:10px 14px;font-weight:600;font-size:15px}.sug div+div{border-top:1px solid var(--line)}
.sug small{color:var(--muted);font-weight:500;margin-left:6px}
.dis{opacity:.5}`;
const C = {
  m: ['Adaeze Okafor', 'Tobi Okafor', 'Ngozi Banks', 'Marcus Hale', 'Priya Raman'],
};
const card3 = (idx, more, name, l1, l2) => `<div class="hh-card" style="gap:4px"><h3 style="margin:0">${name}</h3><div class="ln" style="margin:0">${l1}</div><div class="ln" style="margin:0">${l2}</div><div style="margin-top:8px">${faces(idx, more, 34)}</div></div>`;
const CARDS3 = [
  card3([0, 1, 2, 3], 1, 'Page Turners', 'Read · Tell Jokes · Cook', 'Any Library · Open invitation · 5 of 8'),
  card3([4, 5], 0, 'Clean Sweep', 'Clean · Repair', 'Priya’s house · Invite only · 2 of 6'),
  card3([1, 3, 5], 0, 'Night Owls', 'Sing · Dance', 'Moonlit Lounge · Open invitation · 3 of 6')];
const ch3 = (t, c) => `<div class="card-head"><h2>${t}${c ? `<span class="cnt">${c}</span>` : ''}</h2></div>`;
const bullets = (a) => `<ul class="ul">${a.map((x) => `<li>${x}</li>`).join('')}</ul>`;
const membersCard3 = `<section class="card">${ch3('Members', '5 of 8')}${memberRows2}</section>`;
const meetsCard3 = `<section class="card">${ch3('Meets at')}<div class="mrow" style="border:0;padding:2px 0"><span class="grow">Any Library<small>Lot type</small></span>${chev}</div></section>`;
const aimed = (act, club) => `${act} <span style="color:var(--muted)">→</span> <span style="color:var(--accent);font-weight:700">${club}</span>`;
const rulesCard3 = `<section class="card">${ch3('Rules')}<div class="sub2" style="margin-top:0">Encouraged <span class="cnt">3 of 5</span></div>${bullets(['Read', 'Tell Jokes', aimed('Be Nice', 'Night Owls')])}<div class="sub2">Banned <span class="cnt">2 of 5</span></div>${bullets(['Fight', aimed('Be Mean', 'Clean Sweep')])}</section>`;
const reqCard = `<section class="card">${ch3('Requirements', '2 of 5')}<div class="kv"><b>Trait</b><span>Bookworm</span></div><div class="kv"><b>Age</b><span>Teen, Young Adult, Adult</span></div></section>`;
const perkCard = `<section class="card">${ch3('Perks')}<div class="kv"><b>Vibe</b><span>Focused</span></div><div class="kv"><b>Status</b><span>Secret handshake</span></div></section>`;
const notesCard3 = `<section class="card">${ch3('Notes')}<p style="margin:0">Meets every Saturday after lunch. Adaeze brings the tea.</p></section>`;
const photosCard3 = `<section class="card">${ch3('Photos', '3')}<div class="ph-strip">${tilesImg(3)}</div><button class="btn sm" style="margin-top:2px">+ Add photo</button></section>`;
const clubHead3 = (ph) => `<div class="back">${back} Clubs</div><div style="display:flex;gap:14px;align-items:flex-start;margin-bottom:6px"><span style="flex:none">${obj(true)}</span><div style="flex:1;min-width:0"><h1 style="margin:0;${ph ? 'font-size:24px' : ''}">Page Turners</h1><div class="sub" style="margin-top:4px">A calm corner for people who love a good book.</div></div><button class="btn" style="flex:none">Edit</button></div><div style="display:flex;gap:6px;margin:10px 0 14px"><span class="tag outline-soft">Open invitation</span></div>`;

// form
const seg3 = (a, ls) => `<div class="ph-seg ${ls.length === 3 ? 'three' : ''}" role="group">${ls.map((l, i) => `<button aria-pressed="${a === i}">${l}</button>`).join('')}</div>`;
const actRow = (v) => `<div class="rule"><input class="input" value="${v}"><span class="x" style="width:40px;height:40px">✕</span></div>`;
const reqRow = (cat, v) => `<div class="fld" style="margin-bottom:8px"><span><span style="color:var(--muted);font-weight:500">${cat} · </span>${v}</span><small style="font-size:16px">✕</small></div>`;
const stepper = (n) => `<div style="display:flex;gap:8px;align-items:center"><div class="btn icon" style="width:46px;height:46px;font-size:22px;flex:none">−</div><input class="input" value="${n}" style="text-align:center;font-weight:700;font-size:17px"><div class="btn icon" style="width:46px;height:46px;font-size:22px;flex:none">+</div></div>`;
const part1 = `<h3 style="margin:0 0 4px;font-size:19px">New club</h3>
<div class="fl">Club name</div><input class="input" value="Page Turners">
<div class="fl">Description</div><textarea class="textarea" rows="2">A calm corner for people who love a good book.</textarea>
<div class="fl">Who can join</div>${seg3(0, ['Open invitation', 'Invite only'])}
<div class="fl">Members <span class="cnt">5 of 8</span></div><div class="fld"><span>Adaeze, Tobi, Ngozi +2</span><small>Change</small></div>
<div class="fl">Member limit</div>${stepper(8)}<div class="hint">The game starts clubs at 6. Type any number if you use a mod.</div>
<div class="fl">Leader</div><div class="fld"><span>Adaeze Okafor</span><small>Change</small></div>
<div class="fl">Meets at</div><div class="fld"><span>Any Library <span style="color:var(--muted);font-weight:500">· lot type</span></span><small>Change</small></div>`;
const part2 = `<div class="fl" style="margin-top:2px">Encouraged activities <span class="cnt">3 of 5</span></div>${actRow('Read')}${actRow('Tell Jokes')}${actRow('Be Nice')}
<div class="fld" style="margin:-2px 0 10px 14px;height:42px"><span><span style="color:var(--muted);font-weight:500">Aimed at · </span>Night Owls</span><small>Change</small></div>
<div class="btn sm">+ Add activity</div>
<div class="fl" style="margin-top:18px">Banned activities <span class="cnt">2 of 5</span></div>${actRow('Fight')}${actRow('Be Mean')}
<div class="fld" style="margin:-2px 0 10px 14px;height:42px"><span><span style="color:var(--muted);font-weight:500">Aimed at · </span>Clean Sweep</span><small>Change</small></div>
<div class="btn sm">+ Add activity</div>`;
const part3 = `<div class="fl" style="margin-top:2px">Requirements <span class="cnt">2 of 5</span></div>${reqRow('Trait', 'Bookworm')}${reqRow('Age', 'Teen, Young Adult, Adult')}<div class="btn sm">+ Add a requirement</div>
<div class="fl" style="margin-top:18px">Perks</div>${reqRow('Vibe', 'Focused')}${reqRow('Status', 'Secret handshake')}<div class="btn sm">+ Add a perk</div>
<div class="fl" style="margin-top:18px">Notes</div><textarea class="textarea" rows="2" placeholder="Anything worth remembering…"></textarea>`;
const formPanel = (cap, inner, btn) => phone(cap, `${phoneTop('Clubs', '+ New club')}`, sheetOver(`<div style="max-height:640px;overflow:hidden">${inner}</div>`, bigbtn(btn)));

// pickers
const rowS = (i, on, dis, note) => `<div class="mrow ${dis ? 'dis' : ''}" style="border:0">${cb(on)}${av(i, 30)}<span class="grow">${people[i][0]}</span><span style="font-size:13px;color:var(--muted);font-weight:500">${note || hh[i]}</span></div>`;
const membersList3 = `${subt('Members <span class="cnt" style="font-family:var(--font-body)">5 of 8</span>')}${search('Search Sims')}<div class="sec2">Selected</div>${[0, 1, 2, 3, 4].map((i) => rowS(i, true)).join('')}<div class="sec2">Everyone</div>${rowS(5, false, true, 'In 3 clubs')}`;
const hang = (a, body) => `${subt('Meets at', 'Clear')}${seg3(a, ['A lot', 'Lot type', 'No place'])}${body}`;
const hangType = hang(1, `${search('Search lot types')}${['Bar', 'Cafe', 'Gym', 'Karaoke Bar', 'Library', 'Lounge', 'Museum'].map((t) => row1(t, t === 'Library')).join('')}`);
const hangNone = hang(2, `<p style="margin:16px 4px;font-size:16px">No specific place. The club meets wherever the leader is.</p>`);
const cat = (t, on) => `<div class="mrow"><span class="grow">${t}</span>${chev}</div>`;
const reqCats = `${subt('Add a requirement')}<div class="sec2" style="margin-top:2px">Who can join, by <span class="cnt">2 of 5 used</span></div>${['Age', 'Career', 'Marital status', 'Wealth', 'Trait', 'Skill'].map(cat).join('')}`;
const traitList = `${subt('Trait')}${search('Search traits')}${['Ambitious', 'Art Lover', 'Bookworm', 'Foodie', 'Geek', 'Genius', 'Music Lover'].map((t) => row1(t, t === 'Bookworm')).join('')}`;

const aimList = `${subt('Aimed at', 'Clear')}${search('Search your clubs')}<div class="sec2" style="margin-top:2px">Other clubs</div>${[['Clean Sweep', '2 members'], ['Night Owls', '3 members']].map(([n, m]) => `<div class="mrow"><span class="grow">${n}<small>${m}</small></span><span style="width:22px">${n === 'Night Owls' ? tick : ''}</span></div>`).join('')}<p class="hint">Not this club. Pick one to aim “Be Nice” at it, or Clear to aim it at nobody in particular.</p>`;
const perkSeg = `<div class="ph-seg" role="group"><button aria-pressed="false">Status</button><button aria-pressed="true">Vibe</button><button aria-pressed="false">Skill</button><button aria-pressed="false">Other</button></div>`;
const addPerk = `${subt('Add a perk')}<div class="fl" style="margin-top:2px">Kind</div>${perkSeg}<div class="fl">Perk</div><input class="input" value="Focused">`;
const P3 = {
  list: phone('Clubs', `${phoneTop('Clubs', '+ New club')}<div class="stack" style="gap:12px">${CARDS3.join('')}</div>`),
  clubA: phone('A club', `${clubHead3(true)}<div class="stack" style="gap:12px">${membersCard3}${meetsCard3}</div>`),
  clubB: phone('A club, further down', `<div class="stack" style="gap:12px">${rulesCard3}${reqCard}${perkCard}${notesCard3}</div>`),
  f1: formPanel('New club (1 of 3)', part1, 'Add club'),
  f2: formPanel('New club (2 of 3)', part2, 'Add club'),
  f3: formPanel('New club (3 of 3)', part3, 'Add club'),
  members: phone('Tap Members', `${phoneTop('Clubs', '+ New club')}`, sheetOver(membersList3, bigbtn('Done · 5 of 8'))),
  aim: phone('Tap “Aimed at”', `${phoneTop('Clubs', '+ New club')}`, sheetOver(aimList, '')),
  addPerk: phone('Tap “Add a perk”', `${phoneTop('Clubs', '+ New club')}`, sheetOver(addPerk, bigbtn('Add perk'))),
  hangType: phone('Meets at: lot type', `${phoneTop('Clubs', '+ New club')}`, sheetOver(hangType, '')),
  hangNone: phone('Meets at: no place', `${phoneTop('Clubs', '+ New club')}`, sheetOver(hangNone, '')),
  reqCats: phone('Add a requirement', `${phoneTop('Clubs', '+ New club')}`, sheetOver(reqCats, '')),
  trait: phone('Requirement: Trait', `${phoneTop('Clubs', '+ New club')}`, sheetOver(traitList, bigbtn('Add requirement'))),
};
const D3 = {
  list: `<div class="wrap" style="width:1100px;padding:28px"><div class="page-head" style="margin-bottom:18px"><div class="row" style="gap:14px;align-items:flex-start">${obj(true)}<div><h1>Clubs</h1><div class="sub">3 clubs</div></div></div><button class="btn primary">+ New club</button></div><div class="hh-cards">${CARDS3.join('')}</div></div>`,
  club: `<div class="wrap" style="width:1100px;padding:28px">${clubHead3(false)}<div class="hh-grid"><div class="stack" style="gap:14px">${membersCard3}${rulesCard3}${photosCard3}</div><div class="stack" style="gap:14px">${meetsCard3}${reqCard}${perkCard}${notesCard3}</div></div></div>`,
};
(async () => {
  const b = await chromium.launch();
  const shoot = async (html, w, h, out) => { fs.writeFileSync('t8.html', html.replace('</style>', css2 + css3 + '</style>')); const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 }); const p = await c.newPage(); await p.goto('file://' + process.cwd() + '/t8.html'); await p.waitForTimeout(1500); await p.screenshot({ path: out }); await c.close(); };
  const row = (...xs) => page(`<div class="sidebyside">${xs.join('')}</div>`);
  await shoot(row(P3.f1, P3.f3, P3.addPerk), 1260, 900, 'mock/v5-a.png');
  await shoot(page(`<div style="position:relative;height:1000px;overflow:hidden">${D3.club}</div>`), 1180, 1000, 'mock/v5-desk-page.png');
  await b.close();
})();
