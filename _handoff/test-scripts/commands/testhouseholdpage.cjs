// Household page (desktop compact layout, Nov 2026): 25 checks, desktop + 8 Sims + phone unchanged. Run with the preview on 4173: node testhouseholdpage.cjs <outdir>
const { chromium } = require('playwright');
const { mock, newState, logIn } = require('./mockdb.cjs');
const { seed, SID, PORTRAIT_IDS } = require('./seed.cjs'); const photos=require('./photos.json');
const out=process.argv[2];
const P='5056d802-6c5e-a304-9c79-671c6a49385d', A='2ba8ae06-801b-34f8-1c6c-2bd8d57f92dd', C='4782e179-bd45-4205-a681-5306199d4c7d', F='f9b9b9c1-35c2-a19a-b78c-8253484322a9';
const J='852aa94c-ca2c-ce85-0ab1-1995fa7d69e7', K='538f4ec2-615e-1317-7437-204043514362', BR='9b473440-f7af-5fc4-b96e-cf7b227aef66', BL='e529183f-9423-d09d-41fe-6ce56deba361';
const it=(id,type,owners,amount,name='',note='')=>({id,type,name,owners,amount,note});
let pass=0,fail=0; const ok=(c,m)=>{ if(c) pass++; else {fail++; console.log('FAIL',m);} };
(async()=>{const b=await chromium.launch();
 for(const [n,w,h,eight,nohome] of [['desktop',1440,900,false,true],['desktop-8sims',1440,900,true,true],['desktop-home',1440,900,false,false],['phone',390,844,false,true]]){
  const phone=w<500;
  const st=newState(); seed(st); PORTRAIT_IDS.forEach((id,i)=>{const ph=photos[i%photos.length]; st.files['u1/'+id+'.webp']={data:Buffer.from(ph.full,'base64'),type:'image/webp'}; st.files['u1/'+id+'_t.webp']={data:Buffer.from(ph.thumb,'base64'),type:'image/webp'}; st.photos[id]={id,save_id:SID,bytes:1};});
  const sd=st.saves[SID].data; sd.money={snb:true,simfin:true}; sd.modules={rotation:true,funds:true};
  sd.rotation={order:[P,A,C,F],lengths:{[C]:5,[F]:2},current:P,startDay:sd.today-2,round:2,roundStart:P};
  const now=new Date().toISOString(); const today=sd.today;
  const items=[it('i1','snb-main',[J],412000),it('i2','snb-savings',[J,K],295000,'Joint'),it('i3','snb-edu',[BL],38500),it('i4','sf-retire',[K],64200),it('i5','sf-trust',[BR],25000),it('i6','sf-simco',[J],148800),it('i7','snb-plaque',[K],100000),it('i8','sf-loan',[K],18600),it('i9','sf-card',[J],3000)];
  st.records[SID]['money:'+P]={id:'money:'+P,save_id:SID,kind:'money',data:{household:P,funds:86400,items,lastCheck:today-3,log:[[today-14,1052000],[today-9,1077000],[today-3,1121400]].map(([day,net])=>({day,net,by:{}}))},edited_at:now,deleted_at:null,created_at:now};
  const H=st.records[SID][P]; H.data.notes="143 Lakeside Dr, Willow Creek\nJamar keeps “working late.” He is not working late.\nSecret baby with a girl over in Oasis Springs?? Kendra has NO idea… yet\nBlair is finally over her tonsillitis. Bryson lost a tooth!";
  if(!nohome) H.data.home={id:'7e70ee8e-9871-45ed-9990-ee33b1baa4c8',kind:'lot',unit:'fba05f95-a7e6-4e45-86c4-b21998d86753'};
  if(eight){ ['Aaliyah','Marcus','Nia','Tobi'].forEach((f,i)=>{const id='x'+i; st.records[SID][id]={id,save_id:SID,kind:'sim',data:{first:f,last:'Priestley',gender:'female',bornDay:-300-i*200,addedDay:0,stage:null,career:'',occult:null,traits:[],deceased:null,portrait:null,pronouns:'',aspiration:null,careerLevel:null,householdId:P,orientation:'',stagePhotos:[],genderSettings:{},notes:''},edited_at:now,deleted_at:null,created_at:now};});}
  const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block',deviceScaleFactor:2,isMobile:phone,hasTouch:phone});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await mock(p,st); await logIn(p); await p.waitForURL(/#\/s\//); await p.waitForTimeout(6000);
  await p.goto(`http://localhost:4173/#/s/${SID}/households/${P}`); await p.waitForTimeout(2500);
  const hgt=await p.evaluate(()=>document.scrollingElement.scrollHeight); if(phone) await p.setViewportSize({width:w,height:hgt}); else await p.setViewportSize({width:w,height:Math.max(h,hgt)});
  await p.mouse.move(2,2); await p.waitForTimeout(500);
  await p.screenshot({path:`${out}/real-${n}.png`}); console.log(n,hgt);
  if(!phone){
   const g=await p.evaluate(()=>{const c=[...document.querySelectorAll('.hh-grid > .stack')].map(e=>Math.round(e.getBoundingClientRect().bottom)); const small=[...document.querySelectorAll('.page button,.page a')].filter(e=>{const r=e.getBoundingClientRect(); return r.width&&r.height&&r.height<32 && !e.closest('.mny-chart')}).map(e=>Math.round(e.getBoundingClientRect().height)+':'+(e.textContent.trim()||e.getAttribute('aria-label')||'').slice(0,20)); return {c,small, rows:document.querySelectorAll('.hh-srow').length, nets:[...document.querySelectorAll('.hh-net')].map(e=>e.textContent), crumbHit:(()=>{const a=document.querySelector('.crumbs a'); const r=a.getBoundingClientRect(); const s=getComputedStyle(a,'::after'); return [r.height,s.top,s.bottom]})(), cu:[...document.querySelectorAll('.cu-compact .cal-cu-row')].map(e=>e.textContent), grid:getComputedStyle(document.querySelector('.hh-grid')).gridTemplateColumns};});
   console.log(JSON.stringify(g));
   ok(g.rows===(eight?8:4),'sims rows '+g.rows); ok(g.nets.length===(eight?8:4),'net per sim '+g.nets.length);
   ok(Math.abs(g.c[0]-g.c[1])<(eight?80:(n==='desktop-home'?260:200)),'columns close '+g.c);
   if(n==='desktop'){ ok(await p.locator('.hh-pick').count()===1,'dashed pick a home'); ok(await p.locator('text=Home and lots').count()===1,'Home and lots title');
     await p.getByRole('button',{name:'More'}).click(); ok(await p.getByRole('menuitem',{name:/Edit household/}).count()===1,'Edit in menu'); ok(await p.getByRole('menuitem',{name:/Delete household/}).count()===1,'Delete in menu');
     await p.getByRole('menuitem',{name:/Edit household/}).click(); await p.waitForTimeout(400); ok(await p.locator('.modal input.input').first().isVisible(),'rename opens'); await p.getByRole('button',{name:'Cancel'}).click(); await p.waitForTimeout(300);
     await p.getByRole('button',{name:/Move Sims in/}).click(); await p.waitForTimeout(400); ok(await p.getByText('Move Sims into').count()>=1,'move sims in opens'); await p.goto(`http://localhost:4173/#/s/${SID}/households/${P}`); await p.reload(); await p.waitForTimeout(2500);
     await p.locator('.hh-pick').click(); await p.waitForTimeout(500); ok(await p.locator('.hp-opt').count()>0,'pick home opens'); await p.getByRole('button',{name:'Cancel'}).click(); await p.waitForTimeout(300);
     await p.locator('.mny-open').click(); await p.waitForTimeout(500); ok(await p.locator('.mny-modal').count()===1,'money details open from compact card'); const tx=await p.locator('.mny-modal').textContent(); ok(tx.includes('Jamar')&&tx.includes('§1,148,300'),'details still list each Sim'); await p.goto(`http://localhost:4173/#/s/${SID}/households/${P}`); await p.reload(); await p.waitForTimeout(2500);
     const ta=p.locator('.hh-notescard textarea'); await ta.click(); await ta.press('Control+End'); await ta.type(' Test.'); await p.waitForTimeout(900); await p.locator('h1').click(); await p.waitForTimeout(400);
     ok((await ta.inputValue()).endsWith(' Test.'),'notes edit works');
     await p.locator('.hh-srow').first().click(); await p.waitForTimeout(800); ok(/sims\//.test(p.url()),'sim row opens profile');
   }
  } else { console.log('phone has .hh-grid:',await p.locator('.hh-grid').count(),' hh-rows:',await p.locator('.hh-rows').count()); ok(await p.locator('.hh-grid').count()===0 && await p.locator('.hh-rows').count()===0,'phone layout unchanged'); }
  ok(errs.length===0,'no page errors '+errs.join('|'));
  await ctx.close();}
 console.log('pass',pass,'fail',fail); await b.close();})();
