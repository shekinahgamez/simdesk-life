const { chromium } = require('playwright');
const imgs = ['ph-land.png','ph-square.png','ph-tall.png'];
const tile = (i) => `<div class="ph-tile"><img src="${imgs[i%3]}" style="display:block;width:100%;aspect-ratio:1;object-fit:cover;filter:hue-rotate(${(i*47)%360}deg)"></div>`;
const tiles = (a,b) => Array.from({length:b-a},(_,k)=>tile(a+k)).join('');
const css = `
body{margin:0;background:var(--bg);font-family:var(--font-body);color:var(--text)}
.wrap{padding:24px 28px}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.top h1{margin:0;font-size:30px}
.fbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;position:relative;margin-bottom:16px}
.dd{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 12px 0 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);font:inherit;font-weight:600;font-size:14px;color:var(--text)}
.dd small{color:var(--muted);font-weight:500}
.dd.on{background:var(--photos-tint);border-color:transparent;color:var(--photos-ink)}
.dd svg{width:14px;height:14px;opacity:.6}
.clear{color:var(--accent);font-weight:700;font-size:14px;margin-left:4px}
.count{margin-left:auto;color:var(--muted);font-size:13px;font-weight:600}
.pop{position:absolute;top:46px;left:0;width:300px;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:0 12px 32px rgba(36,25,31,.16);padding:10px;z-index:3}
.pop input{width:100%;box-sizing:border-box;height:38px;border:1px solid var(--line);border-radius:9px;padding:0 12px;font:inherit;font-size:14px;background:var(--bg);margin-bottom:6px}
.opt{display:flex;align-items:center;gap:10px;padding:8px 6px;border-radius:8px;font-size:14px;font-weight:600}
.opt:hover{background:var(--sidebar)}
.opt .cb{width:18px;height:18px;border-radius:5px;border:1.5px solid var(--line);flex:none}
.opt .cb.x{background:var(--photos-ink);border-color:var(--photos-ink);position:relative}
.opt .cb.x::after{content:'';position:absolute;left:5px;top:1.5px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
.opt .av{width:26px;height:26px;border-radius:50%;background:var(--photos-tint);color:var(--photos-ink);font-size:11px;display:flex;align-items:center;justify-content:center;flex:none}
.opt em{margin-left:auto;font-style:normal;font-size:12px;color:var(--muted)}
.pop .sec{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700;padding:8px 6px 2px}
.pop .foot{display:flex;justify-content:space-between;border-top:1px solid var(--line);margin-top:6px;padding:8px 6px 0;font-size:13px;font-weight:700}
.ph-tiles{grid-template-columns:repeat(6,1fr)}
.ph-group{margin-bottom:14px}
.phone{width:393px;box-sizing:border-box;background:var(--bg);border:1px solid var(--line);position:relative;overflow:hidden;height:852px}
.phone .wrap{padding:16px 14px}
.phone .top h1{font-size:26px}
.phone .fbar{flex-wrap:nowrap;overflow:hidden}
.phone .dd{height:38px;padding:0 10px 0 12px}
.sheet{position:absolute;left:0;right:0;bottom:0;background:var(--surface);border-radius:22px 22px 0 0;box-shadow:0 -10px 40px rgba(36,25,31,.25);padding:10px 16px 20px}
.scrim{position:absolute;inset:0;background:rgba(30,18,26,.38)}
.grab{width:40px;height:4px;border-radius:9px;background:var(--line);margin:0 auto 12px}
.sheet h3{margin:0 0 10px;font-size:19px}
.lbl{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin:12px 0 6px}
.fld{display:flex;justify-content:space-between;align-items:center;height:46px;border:1px solid var(--line);border-radius:10px;padding:0 14px;font-weight:600;font-size:15px}
.fld small{color:var(--muted);font-weight:500}
.bigbtn{height:48px;border-radius:12px;background:var(--accent);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;font-weight:700;margin-top:18px}
.cap{position:absolute;top:0;left:0;right:0;background:var(--photos-tint);color:var(--photos-ink);font-weight:700;font-size:13px;padding:6px 10px;text-align:center;z-index:5}
.sidebyside{display:flex;gap:28px;padding:20px;background:#ddd}
.m-stack .ph-tiles{grid-template-columns:repeat(3,1fr)}
.sm{font-size:13px;color:var(--muted);font-weight:600;margin:10px 0 4px}
.wide2{grid-template-columns:repeat(2,1fr)!important;gap:3px}
`;
const chev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>';
const people = [['Adaeze Okafor','AO',14,1],['Tobi Okafor','TO',9,1],['Ngozi Banks','NB',7,0],['Marcus Hale','MH',5,0],['Priya Raman','PR',4,0],['Lena Voss','LV',3,0]];
const opts = people.map(([n,a,c,x])=>`<div class="opt"><span class="cb ${x?'x':''}"></span><span class="av">${a}</span>${n}<em>${c}</em></div>`).join('');
const desk = `<div class="wrap"><div class="top"><h1>Photos</h1><button class="btn primary">+ Add photo</button></div>
<div class="fbar"><span class="dd on">Sims <small>· 2</small>${chev}</span><span class="dd">When ${chev}</span><span class="dd">From ${chev}</span><span class="dd">Sort: Newest ${chev}</span><span class="clear">Clear</span><span class="count">23 photos</span>
<div class="pop"><input placeholder="Search Sims"><div class="sec">Selected</div>${opts.split('</div>').slice(0,2).join('</div>')}</div><div class="sec">Everyone</div>${opts.split('</div>').slice(2).join('</div>')}<div class="foot"><span style="color:var(--muted)">2 selected</span><span style="color:var(--accent)">Clear</span></div></div></div>
<div class="ph-group"><h2>Winter · Year 1 <span>9 photos</span></h2><div class="ph-tiles">${tiles(0,9)}</div></div>
<div class="ph-group"><h2>Autumn · Year 1 <span>14 photos</span></div><div class="ph-tiles">${tiles(9,15)}</div></div></div>`.replace('<div class="sec">Selected</div>','<div class="sec">Selected</div>');
// fix popover structure properly
const deskHtml = `<div class="wrap"><div class="top"><h1>Photos</h1><button class="btn primary">+ Add photo</button></div>
<div class="fbar"><span class="dd on">Sims <small>· 2</small>${chev}</span><span class="dd">When ${chev}</span><span class="dd">From ${chev}</span><span class="dd">Sort: Newest ${chev}</span><span class="clear">Clear</span><span class="count">23 photos</span>
<div class="pop"><input placeholder="Search Sims"><div class="sec">Selected</div>${people.slice(0,2).map(([n,a,c])=>`<div class="opt"><span class="cb x"></span><span class="av">${a}</span>${n}<em>${c}</em></div>`).join('')}<div class="sec">Everyone</div>${people.slice(2).map(([n,a,c])=>`<div class="opt"><span class="cb"></span><span class="av">${a}</span>${n}<em>${c}</em></div>`).join('')}<div class="foot"><span style="color:var(--muted)">2 selected</span><span style="color:var(--accent)">Clear</span></div></div></div>
<div class="ph-group"><h2>Winter · Year 1 <span>9 photos</span></h2><div class="ph-tiles">${tiles(0,9)}</div></div>
<div class="ph-group"><h2>Autumn · Year 1 <span>14 photos</span></h2><div class="ph-tiles">${tiles(9,15)}</div></div></div>`;
const phoneBar = `<div class="fbar"><span class="dd">Sims ${chev}</span><span class="dd">When ${chev}</span><span class="dd">From ${chev}</span></div>`;
const phoneBarOn = `<div class="fbar"><span class="dd on">Sims <small>· 2</small>${chev}</span><span class="dd">When ${chev}</span><span class="dd">From ${chev}</span></div>`;
const phoneTop = `<div class="top"><h1>Photos</h1><button class="btn primary" style="height:38px">+ Add</button></div>`;
const sheet = `<div class="phone m-stack"><div class="wrap">${phoneTop}${phoneBarOn}<div class="ph-tiles">${tiles(0,9)}</div></div><div class="scrim"></div>
<div class="sheet"><div class="grab"></div><h3>Sims</h3><input style="width:100%;box-sizing:border-box;height:44px;border:1px solid var(--line);border-radius:10px;padding:0 14px;font:inherit;background:var(--bg)" placeholder="Search Sims">
${people.slice(0,5).map(([n,a,c,x])=>`<div class="opt" style="padding:11px 4px;font-size:16px"><span class="cb ${x?'x':''}"></span><span class="av">${a}</span>${n}<em>${c}</em></div>`).join('')}
<div class="bigbtn">Show 18 photos</div></div></div>`;
const A = `<div class="phone m-stack"><div class="cap">A · One continuous grid</div><div class="wrap" style="padding-top:42px">${phoneTop}${phoneBar}<div class="sm">Newest first</div><div class="ph-tiles">${tiles(0,24)}</div></div></div>`;
const B = `<div class="phone m-stack"><div class="cap">B · Seasons, tiles fill the row</div><div class="wrap" style="padding-top:42px">${phoneTop}${phoneBar}
<div class="ph-group"><h2>Winter · Year 1 <span>1 photo</span></h2><div class="ph-tiles" style="grid-template-columns:1fr"><div class="ph-tile"><img src="ph-land.png" style="display:block;width:100%;aspect-ratio:16/9;object-fit:cover"></div></div></div>
<div class="ph-group"><h2>Autumn · Year 1 <span>2 photos</span></h2><div class="ph-tiles wide2">${tiles(1,3).replaceAll('aspect-ratio:1','aspect-ratio:1')}</div></div>
<div class="ph-group"><h2>Summer · Year 1 <span>9 photos</span></h2><div class="ph-tiles">${tiles(3,12)}</div></div></div></div>`;
const cur = `<div class="phone m-stack"><div class="cap">Now · for comparison</div><div class="wrap" style="padding-top:42px">${phoneTop}<div style="display:flex;gap:6px;margin-bottom:14px;overflow:hidden">${['All','Adaeze','Tobi','Ngozi','Marcus','Priya'].map((n,i)=>`<span class="ph-chip" ${i==0?'aria-pressed="true"':''}>${n}</span>`).join('')}</div>
<div class="ph-group"><h2>Winter · Year 1 <span>1 photo</span></h2><div class="ph-tiles">${tiles(0,1)}</div></div><div class="ph-group"><h2>Autumn · Year 1 <span>2 photos</span></h2><div class="ph-tiles">${tiles(1,3)}</div></div><div class="ph-group"><h2>Summer · Year 1 <span>9 photos</span></h2><div class="ph-tiles">${tiles(3,12)}</div></div></div></div>`;
const page = (body, cls='') => `<!doctype html><html><head><meta charset=utf-8><link rel=stylesheet href="app.css"><link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Gabarito:wght@600;700;800&family=Rethink+Sans:wght@400;500;600;700&display=swap"><style>${css}</style></head><body class="${cls}">${body}</body></html>`;

const bar2 = (open) => `<div class="fbar" style="gap:6px"><span class="dd">Sims ${chev}</span><span class="dd">When ${chev}</span><span class="dd">Occasion ${chev}</span></div><div style="display:flex;justify-content:space-between;align-items:center;margin:-4px 0 10px;position:relative"><span class="sm" style="margin:0">23 photos</span><span class="dd" style="height:34px;font-size:13px">Sort: ${open===2?'Date added':'Game date'} ${chev}</span>${open===1?`<div class="pop" style="top:40px;left:auto;right:0;width:210px"><div class="opt"><span style="width:18px;color:var(--photos-ink)">✓</span>Game date</div><div class="opt"><span style="width:18px"></span>Date added</div></div>`:''}</div>`;
const S1 = `<div class="phone m-stack"><div class="cap">Sort menu open</div><div class="wrap" style="padding-top:42px">${phoneTop}${bar2(1)}<div class="ph-group"><h2>Winter · Year 1 <span>1 photo</span></h2><img src="ph-land.png" style="display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px"></div><div class="ph-group"><h2>Autumn · Year 1 <span>2 photos</span></h2><div class="ph-tiles wide2">${tiles(1,3)}</div></div></div></div>`;
const S2 = `<div class="phone m-stack"><div class="cap">Sort: Game date (the default)</div><div class="wrap" style="padding-top:42px">${phoneTop}${bar2(0)}<div class="ph-group"><h2>Winter · Year 1 <span>1 photo</span></h2><img src="ph-land.png" style="display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px"></div><div class="ph-group"><h2>Autumn · Year 1 <span>2 photos</span></h2><div class="ph-tiles wide2">${tiles(1,3)}</div></div><div class="ph-group"><h2>No game date <span>4 photos</span></h2><div class="ph-tiles">${tiles(3,7)}</div></div></div></div>`;
const S3 = `<div class="phone m-stack"><div class="cap">Sort: Date added</div><div class="wrap" style="padding-top:42px">${phoneTop}${bar2(2)}<div class="ph-group"><h2>November 2026 <span>5 photos</span></h2><div class="ph-tiles">${tiles(3,8)}</div></div><div class="ph-group"><h2>October 2026 <span>18 photos</span></h2><div class="ph-tiles">${tiles(8,17)}</div></div></div></div>`;

const filt = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M7 12h10M10 17h4"/></svg>';
const srch = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="opacity:.55"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const pbar = (on) => `<div style="display:flex;gap:8px;margin-bottom:14px"><div style="flex:1;height:44px;border-radius:12px;background:var(--sidebar);display:flex;align-items:center;gap:10px;padding:0 14px;color:var(--muted);font-size:15px">${srch}Search photos</div><div style="position:relative;width:44px;height:44px;border-radius:12px;border:1px solid ${on?'transparent':'var(--line)'};background:${on?'var(--photos-tint)':'var(--surface)'};color:${on?'var(--photos-ink)':'var(--text)'};display:flex;align-items:center;justify-content:center">${filt}${on?'<span style="position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;border-radius:9px;background:var(--photos-ink);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center">2</span>':''}</div></div>`;
const grpB = `<div class="ph-group"><h2>Winter · Year 1 <span>1 photo</span></h2><img src="ph-land.png" style="display:block;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px"></div><div class="ph-group"><h2>Autumn · Year 1 <span>2 photos</span></h2><div class="ph-tiles wide2">${tiles(1,3)}</div></div>`;
const P1 = `<div class="phone m-stack"><div class="cap">Photos, closed</div><div class="wrap" style="padding-top:42px">${phoneTop}${pbar(false)}${grpB}</div></div>`;
const P2 = `<div class="phone m-stack"><div class="cap">With filters on</div><div class="wrap" style="padding-top:42px">${phoneTop}${pbar(true)}<div class="sm" style="margin-top:-4px">Adaeze, Tobi · Autumn Year 1 · 3 photos</div>${grpB}</div></div>`;
const seg = (a) => `<div style="display:flex;background:var(--sidebar);border-radius:12px;padding:3px"><div style="flex:1;text-align:center;padding:10px;border-radius:10px;font-weight:700;font-size:14px;${a===0?'background:var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.12)':'color:var(--muted)'}">Game date</div><div style="flex:1;text-align:center;padding:10px;border-radius:10px;font-weight:700;font-size:14px;${a===1?'background:var(--surface);box-shadow:0 1px 3px rgba(0,0,0,.12)':'color:var(--muted)'}">Date added</div></div>`;
const sheetBody = `<h3>Filter</h3>
<div class="lbl" style="margin-top:4px">Sims</div><div class="fld"><span>Adaeze Okafor, Tobi Okafor</span><small>Change</small></div>
<div class="lbl">When</div><div class="fld"><span>Autumn · Year 1</span><small>${chev}</small></div>
<div class="lbl">Occasion</div><div class="fld"><span style="color:var(--muted)">Any</span><small>${chev}</small></div>
<div class="lbl">Sort by</div>${seg(0)}`;
const P3 = `<div class="phone m-stack"><div class="wrap">${phoneTop}${pbar(true)}${grpB}</div><div class="scrim"></div><div class="sheet" style="padding-bottom:16px"><div class="grab"></div>${sheetBody}<div class="bigbtn">Show 3 photos</div><div style="text-align:center;font-weight:700;padding:14px 0 2px">Clear all</div></div></div>`;
const D1 = `<div class="wrap" style="width:1100px"><div class="top"><h1>Photos</h1><button class="btn primary">+ Add photo</button></div><div style="display:flex;gap:10px;margin-bottom:18px"><div style="flex:1;height:44px;border-radius:12px;background:var(--surface);border:1px solid var(--line);display:flex;align-items:center;gap:10px;padding:0 14px;color:var(--muted);font-size:15px">${srch}Search photos</div><div class="dd" style="height:44px;border-radius:12px">${filt} Filter</div></div><div class="ph-group"><h2>Winter · Year 1 <span>9 photos</span></h2><div class="ph-tiles">${tiles(0,6)}</div></div><div style="position:absolute;inset:0;background:rgba(30,18,26,.38)"></div>
<div style="position:absolute;left:50%;top:70px;transform:translateX(-50%);width:540px;background:var(--surface);border-radius:24px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.3)"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0;font-size:22px">Filter</h3><span style="font-size:22px">✕</span></div>
<div class="lbl">Sims</div><div class="fld"><span>Adaeze Okafor, Tobi Okafor</span><small>Change</small></div>
<div class="lbl">When</div><div class="fld"><span>Autumn · Year 1</span><small>${chev}</small></div>
<div class="lbl">Occasion</div><div class="fld"><span style="color:var(--muted)">Any</span><small>${chev}</small></div>
<div class="lbl">Sort by</div>${seg(0)}
<div style="display:flex;justify-content:space-between;align-items:center;margin-top:24px"><b>Clear all</b><div class="btn primary" style="height:46px;padding:0 22px">Show 3 photos</div></div></div></div>`;

const sbar = (txt, focus) => `<div style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><div style="flex:1;height:44px;border-radius:12px;background:var(--sidebar);display:flex;align-items:center;gap:10px;padding:0 14px;font-size:15px;${focus?'outline:2px solid var(--photos-ink);background:var(--surface)':''}">${srch}<span style="${txt?'':'color:var(--muted)'}">${txt||'Search photos'}</span></div>${focus?'<b style="color:var(--accent);font-size:15px">Cancel</b>':`<div style="width:44px;height:44px;border-radius:12px;border:1px solid var(--line);background:var(--surface);display:flex;align-items:center;justify-content:center">${filt}</div>`}</div>`;
const ico = (t,c) => `<span style="width:34px;height:34px;border-radius:${c==='sim'?'50%':'9px'};background:var(--photos-tint);color:var(--photos-ink);display:flex;align-items:center;justify-content:center;font-size:${c==='sim'?'12':'16'}px;font-weight:700;flex:none">${t}</span>`;
const row = (i,t,sub,n) => `<div style="display:flex;align-items:center;gap:12px;padding:10px 2px;border-bottom:1px solid var(--line)">${i}<div style="min-width:0;flex:1"><div style="font-weight:600;font-size:15px">${t}</div>${sub?`<div style="font-size:12.5px;color:var(--muted)">${sub}</div>`:''}</div><span style="font-size:13px;color:var(--muted);font-weight:600">${n}</span></div>`;
const hd = (t) => `<div class="lbl" style="margin:14px 0 2px">${t}</div>`;
const calI = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>';
const txtI = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h9"/></svg>';
const Q1 = `<div class="phone m-stack"><div class="cap">Type “ada”</div><div class="wrap" style="padding-top:42px">${phoneTop}${sbar('ada',true)}${hd('Sims')}${row(ico('AO','sim'),'Adaeze Okafor','','14 photos')}${hd('Occasions')}${row(ico(calI),'Adaeze’s graduation party','Spring · Year 1 · Day 13','4 photos')}${hd('Captions')}${row(ico(txtI),'“Adaeze blowing out her candles”','','')}${row(ico(txtI),'“Tobi and Adaeze at the park”','','')}</div></div>`;
const Q2 = `<div class="phone m-stack"><div class="cap">Type “party”</div><div class="wrap" style="padding-top:42px">${phoneTop}${sbar('party',true)}${hd('Occasions')}${row(ico(calI),'Adaeze’s graduation party','Spring · Year 1 · Day 13','4 photos')}${row(ico(calI),'Housewarming party','Summer · Year 1 · Day 2','6 photos')}${hd('Captions')}${row(ico(txtI),'“Pool party chaos”','','')}${row(ico(txtI),'“After the party”','','')}</div></div>`;
const Q3 = `<div class="phone m-stack"><div class="cap">Tap a suggestion</div><div class="wrap" style="padding-top:42px">${phoneTop}${sbar('',false).replace('Search photos','Adaeze Okafor')}<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted);font-weight:600;margin:-2px 2px 8px"><span>Sim: Adaeze Okafor · 14 photos</span><b style="color:var(--accent)">Clear</b></div><div class="ph-group"><h2>Winter · Year 1 <span>3 photos</span></h2><div class="ph-tiles">${tiles(0,3)}</div></div><div class="ph-group"><h2>Autumn · Year 1 <span>6 photos</span></h2><div class="ph-tiles">${tiles(3,9)}</div></div></div></div>`;
(async()=>{
  const fs=require('fs'); const b=await chromium.launch();
  const shoot = async (html, w, h, out, full) => { fs.writeFileSync('mock/t.html', html); const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2}); const p=await c.newPage(); await p.goto('file://'+process.cwd()+'/mock/t.html'); await p.waitForTimeout(1200); await p.screenshot({path:out,fullPage:!!full}); await c.close(); };
  await shoot(page(deskHtml), 1180, 760, 'mock/m-desk-filter.png');
  await shoot(page(`<div class="sidebyside">${cur}${A}${B}</div>`), 1260, 900, 'mock/m-phone-layouts.png');
  await shoot(page(`<div class="sidebyside" style="justify-content:center">${sheet}</div>`), 460, 900, 'mock/m-phone-sheet.png');
  await shoot(page(`<div class="sidebyside">${S1}${S2}${S3}</div>`), 1260, 900, 'mock/m-sort.png');
  await shoot(page(`<div class="sidebyside">${P1}${P2}${P3}</div>`), 1260, 900, 'mock/m-new-phone.png');
  await shoot(page(`<div style="position:relative;height:800px;overflow:hidden">${D1}</div>`), 1180, 800, 'mock/m-new-desk.png');
  await shoot(page(`<div class="sidebyside">${Q1}${Q2}${Q3}</div>`), 1260, 900, 'mock/m-search.png');
  await b.close();
})();
