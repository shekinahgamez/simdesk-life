// Household funds: real-app checks + proof shots (desktop 1440x900, phone 390x844).
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
const { seed, SID } = require('./seed.cjs');
const out = process.argv[2];
const P='5056d802-6c5e-a304-9c79-671c6a49385d', A='2ba8ae06-801b-34f8-1c6c-2bd8d57f92dd', C='4782e179-bd45-4205-a681-5306199d4c7d', F='f9b9b9c1-35c2-a19a-b78c-8253484322a9';
const J='852aa94c-ca2c-ce85-0ab1-1995fa7d69e7', K='538f4ec2-615e-1317-7437-204043514362', BR='9b473440-f7af-5fc4-b96e-cf7b227aef66', BL='e529183f-9423-d09d-41fe-6ce56deba361';
let pass=0, fail=0; const ok=(c,m)=>{ if(c) pass++; else { fail++; console.log('FAIL', m); } };
const it=(id,type,owners,amount,name='',note='')=>({id,type,name,owners,amount,note});
function money(today){
  const items=[it('i1','snb-main',[J],412000),it('i2','snb-savings',[J,K],295000,'Joint'),it('i3','snb-edu',[BL],38500),it('i4','sf-retire',[K],64200),
    it('i5','sf-trust',[BR],25000),it('i6','sf-simco',[J],148800,'1,200 shares'),it('i7','snb-plaque',[K],100000,'40 shares'),
    it('i8','sf-loan',[K],18600,'Priestley Foundation','§1,550 a week · 12 weeks left'),it('i9','sf-card',[J],3000)];
  const hist=[[today-14,1052000],[today-11,1081000],[today-9,1077000],[today-6,1098000],[today-3,1121400]];
  return {household:P,funds:86400,items,lastCheck:today-3,log:hist.map(([day,net])=>({day,net,by:{[J]:690000,funds:80000}}))};
}
(async()=>{const b=await chromium.launch();
 for(const [n,w,h] of [['desktop',1440,900],['phone',390,844]]){
  const phone=n==='phone';
  const st=newState(); seed(st,{mods:{funds:true,rotation:true}});
  const sd=st.saves[SID].data; sd.money={snb:true,simfin:true};
  sd.rotation={order:[P,A,C,F],lengths:{[C]:5,[F]:2},current:P,startDay:sd.today-2,round:2,roundStart:P};
  const now=new Date().toISOString();
  st.records[SID]['money:'+P]={id:'money:'+P,save_id:SID,kind:'money',data:money(sd.today),edited_at:now,deleted_at:null,created_at:now};
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,serviceWorkers:'block'});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await mock(p,st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(1500);
  const shot=async(f)=>{await p.mouse.move(2,2); await p.waitForTimeout(350); await p.screenshot({path:`${out}/${n}-${f}.png`}); console.log('shot',n,f);};
  const noOverflow=async(m)=>ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), m+' no sideways scroll');
  await p.goto(`http://localhost:4173/#/s/${SID}/households/${P}`); await p.waitForTimeout(1200);
  const entry = phone ? p.locator('.mny-strip') : p.locator('.mny-open');
  ok(await entry.count()===1, 'money entry shows');
  ok((await entry.textContent()).includes('§1,148,300'), 'net worth = §1,148,300');
  ok((await entry.textContent()).includes('Ultra Wealthy'), 'class Ultra Wealthy');
  ok((await entry.textContent()).includes('§26,900'), 'change §26,900');
  if(!phone) for(const nm of ['Jamar','Kendra','Bryson','Blair']) ok((await entry.textContent()).includes(nm), 'card names '+nm);
  await noOverflow('household'); await shot('1-household');
  await entry.click(); await p.waitForTimeout(500);
  const dlg = p.locator(phone?'.m-sheet':'.mny-modal');
  ok(await dlg.count()===1, 'details open');
  ok((await dlg.textContent()).includes('Top class · §148,300 above the Ultra Wealthy line'), 'class line');
  if(!phone){ const sc=await p.evaluate(()=>{const c=document.querySelector('.mny-cols');return c.scrollHeight-c.clientHeight}); console.log('details desktop scroll px', sc); }
  await shot('2-details');
  if(phone){ await p.evaluate(()=>{document.querySelector('.m-sheet').scrollTop=620}); await shot('2b-details-lower'); await p.evaluate(()=>{document.querySelector('.m-sheet').scrollTop=0}); }
  // filter by Sim
  await dlg.locator('button.mny-sim', {hasText:'Kendra'}).click(); await p.waitForTimeout(200);
  ok((await dlg.textContent()).includes('Showing Kendra’s share'), 'filter by Kendra');
  ok(!(await dlg.locator('.mny-row', {hasText:'Main account'}).count()), 'filter hides Jamar account');
  ok((await dlg.locator('.mny-total').textContent()).includes('§293,100'), 'Kendra net §293,100');
  await dlg.getByRole('button',{name:'Show everyone'}).click();
  // edit funds
  await dlg.locator('.mny-row',{hasText:'Household funds'}).click(); await p.waitForTimeout(300);
  await p.locator('#mny-funds').fill('90k'); await p.locator('button.btn.primary',{hasText:/^Save$/}).last().click(); await p.waitForTimeout(300);
  ok((await dlg.locator('.mny-total').textContent()).includes('§1,151,900'), 'funds edit updates net');
  // add an account
  await dlg.locator('.mny-sec',{hasText:'What they have'}).getByRole('button',{name:'Add'}).click(); await p.waitForTimeout(300);
  await p.getByRole('radio',{name:/Checking account/}).click();
  await p.locator('#mny-amt').fill('§5,000');
  if(!phone) await shot('6-add-account');
  await p.locator('button.btn.primary',{hasText:/^Add$/}).click(); await p.waitForTimeout(300);
  ok((await dlg.locator('.mny-total').textContent()).includes('§1,156,900'), 'add account updates net');
  // edit then delete it, with undo
  await dlg.locator('.mny-row',{hasText:'Checking account'}).click(); await p.waitForTimeout(300);
  await p.getByRole('button',{name:'Delete'}).click(); await p.waitForTimeout(300);
  ok((await dlg.locator('.mny-total').textContent()).includes('§1,151,900'), 'delete updates net');
  await p.getByRole('button',{name:'Undo'}).click(); await p.waitForTimeout(300);
  ok((await dlg.locator('.mny-total').textContent()).includes('§1,156,900'), 'undo brings it back');
  // money check from details
  await dlg.getByRole('button',{name:'Money check'}).click(); await p.waitForTimeout(500);
  const fund = p.locator('.mny-cf',{hasText:'Household funds'}).locator('input');
  ok(await fund.inputValue()==='§90,000', 'money check prefilled');
  await fund.fill('100000'); await fund.blur(); await p.waitForTimeout(150);
  ok((await p.locator('.mny-cf.ch').count())===1, 'changed row marked');
  await shot('7-money-check');
  await p.locator('button.btn.primary',{hasText:/^Save$/}).last().click(); await p.waitForTimeout(400);
  ok((await entry.textContent()).includes('§1,166,900'), 'money check saved');
  // end turn sheet
  await p.locator('.rot-hh').getByRole('button',{name:/End turn/}).click(); await p.waitForTimeout(600);
  ok(await p.locator('.mny-check').count()===1, 'money check in End turn');
  await noOverflow('end turn'); await shot('4-end-turn');
  if(phone){ await p.evaluate(()=>{document.querySelector('.m-sheet').scrollTop=9999}); await shot('4b-end-turn-lower'); }
  const k = p.locator('.mny-cf',{hasText:'Retirement'}).locator('input'); await k.fill('70000'); await k.blur();
  await p.getByRole('button',{name:/Start the/}).click(); await p.waitForTimeout(600);
  await p.goto(`http://localhost:4173/#/s/${SID}/households/${P}`); await p.waitForTimeout(900);
  ok((await p.locator(phone?'.mny-strip':'.mny-open').textContent()).includes('§1,172,700'), 'End turn saved money check');
  // Sim page
  await p.goto(`http://localhost:4173/#/s/${SID}/sims/${J}`); await p.waitForTimeout(1200);
  const sc = p.locator('.mny-simcard');
  ok(await sc.count()===1, 'Sim money card');
  ok((await sc.textContent()).includes('§710,300'), 'Jamar net §710,300 (705,300 + new checking)');
  await sc.scrollIntoViewIfNeeded(); await p.evaluate(()=>window.scrollBy(0,-120)); await shot('3-sim');
  // settings
  await p.goto(`http://localhost:4173/#/s/${SID}/settings`); await p.waitForTimeout(1200);
  ok(await p.locator('.mny-srow').count()===3, 'settings: 3 funds rows');
  await p.locator('.mny-srow',{hasText:'Wealth classes'}).scrollIntoViewIfNeeded(); await p.evaluate((ph)=>window.scrollBy(0,ph?-200:-260),phone);
  await p.locator('.mny-srow',{hasText:'Wealth classes'}).getByRole('button',{name:'Edit'}).click(); await p.waitForTimeout(400);
  const first=p.locator('input[aria-label="Class 8 name"]'); ok(await first.inputValue()==='Ultra Wealthy','classes editor');
  await first.fill('Old Money'); await p.waitForTimeout(150);
  await shot('5-settings');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.goto(`http://localhost:4173/#/s/${SID}/households/${P}`); await p.waitForTimeout(900);
  ok((await p.locator(phone?'.mny-strip':'.mny-open').textContent()).includes('Old Money'), 'renamed class shows');
  // small tap targets inside money UI
  const small = await p.evaluate(()=>[...document.querySelectorAll('.mny-card button, .mny-strip')].filter(e=>{const r=e.getBoundingClientRect();return r.height&&r.height<32}).map(e=>e.textContent.slice(0,20)));
  ok(!small.length, 'tap targets >=32: '+small.join('|'));
  ok(!errs.length, 'no page errors '+errs.join(' | '));
  await ctx.close();
 }
 await b.close(); console.log(`pass ${pass} fail ${fail}`); process.exit(fail?1:0);})();
