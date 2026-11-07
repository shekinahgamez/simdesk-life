const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
const { seed, SID } = require('./seed.cjs');
const U='http://localhost:4173/#/s/'+SID+'/';
const KEEP=['Brindleton Bay','Lennox Park','San Sequoia','Windenburg'];
let ok=0,bad=0; const t=(c,m)=>{ if(c) ok++; else { bad++; console.log('FAIL',m);} };
(async()=>{ const b=await chromium.launch();
 for (const [n,w,h] of [['desktop',1280,860],['phone',390,844]]) {
  const phone=n==='phone'; const st=newState(); seed(st); const errs=[];
  const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block',hasTouch:phone,deviceScaleFactor:2});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message)); await mock(p,st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1200);
  await p.goto(U+'worlds'); await p.waitForTimeout(1200);
  const all=await p.locator('.world-tile').count(); t(all>10,'all worlds show at first '+all);
  await p.getByRole('button',{name:/Choose your worlds/}).click(); await p.waitForTimeout(400);
  // hide every world not in KEEP
  for(let i=0;i<60;i++){ const rows=p.locator('.choose-world[aria-checked="true"]'); const c=await rows.count(); let clicked=false;
    for(let j=0;j<c;j++){ const r=rows.nth(j); const nm=(await r.locator('.cw-name').textContent()).trim(); if(!KEEP.includes(nm)){ await r.click(); clicked=true; break; } }
    if(!clicked) break; }
  t(await p.locator('.choose-world[aria-checked="true"]').count()===4,'4 showing');
  await p.locator('.choose-worlds input').fill('brit'); await p.waitForTimeout(200);
  t(await p.locator('.choose-world').count()===1,'search finds Britechester');
  await p.locator('.choose-worlds input').fill(''); await p.waitForTimeout(200);
  t(await p.locator('.choose-world[aria-checked="false"]').count()===8,'hidden folded to 8');
  await p.screenshot({path:`${process.env.SHOTS||'/tmp'}/${n}-2-choose-worlds.png`});
  await p.getByRole('button',{name:'Done'}).click(); await p.waitForTimeout(400);
  await p.addStyleTag({content:'.m-tabbar,[class*=tabbar]{display:none!important}'});
  t(await p.locator('.world-tile').count()===4,'4 tiles');
  t(await p.locator('.worlds-hidden-row').isVisible(),'hidden row');
  await p.screenshot({path:`${process.env.SHOTS||'/tmp'}/${n}-1-worlds-home.png`,fullPage:!phone});
  // settings
  await p.goto(U+'settings'); await p.reload(); await p.waitForTimeout(1500);
  if(!phone){ const card=p.locator('section.card',{hasText:'Worlds you play'}); t(/4 of \d+/.test(await card.textContent()),'settings summary'); await card.scrollIntoViewIfNeeded(); await p.evaluate(()=>window.scrollBy(0,-120)); }
  else { const r=p.getByText('Worlds you play'); await r.scrollIntoViewIfNeeded(); t(await r.isVisible(),'phone row'); }
  await p.screenshot({path:`${process.env.SHOTS||'/tmp'}/${n}-3-settings.png`});
  // rename a neighborhood in Lennox Park (newcrest)
  await p.goto(U+'worlds/newcrest'); await p.waitForTimeout(1500);
  const card=p.locator('.hood-card').first(); const game=(await card.locator('h2').textContent()).trim();
  await card.locator('.hood-pencil').click(); await card.locator('input').fill('Lennox Heights');
  await p.addStyleTag({content:'.m-tabbar,[class*=tabbar]{display:none!important}'});
  await card.scrollIntoViewIfNeeded(); await p.screenshot({path:`${process.env.SHOTS||'/tmp'}/${n}-4-renaming.png`});
  await card.getByRole('button',{name:'Save'}).click(); await p.waitForTimeout(500);
  await p.reload(); await p.waitForTimeout(1500);
  const names=await p.locator('.hood-card h2').allTextContents();
  t(names.includes('Lennox Heights') && !names.includes(game),'renamed and kept after reload '+game);
  await p.addStyleTag({content:'.m-tabbar,[class*=tabbar]{display:none!important}'});
  await p.locator('.hood-card',{hasText:'Lennox Heights'}).scrollIntoViewIfNeeded(); await p.screenshot({path:`${process.env.SHOTS||'/tmp'}/${n}-5-renamed.png`});
  // putting the game's name back clears it
  const idx=(await p.locator('.hood-card h2').allTextContents()).indexOf('Lennox Heights'); const c2=p.locator('.hood-card').nth(idx); await c2.locator('.hood-pencil').click(); await c2.locator('input').fill(''); await c2.getByRole('button',{name:'Save'}).click(); await p.waitForTimeout(400);
  t((await p.locator('.hood-card h2').allTextContents()).includes(game),'blank puts the game name back');
  t(errs.length===0,'no page errors '+errs.join('|'));
  await ctx.close(); }
 console.log(ok+' passed, '+bad+' failed'); await b.close(); })();
