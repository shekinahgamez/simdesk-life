// Public home + beta application pages (signed out). Run with the dev server up: BASE=http://localhost:5199 node testlanding.cjs
// Expect: no "log in" text on home, Features scrolls, The beta opens #/beta, Other opens the type-in, forms say sign-ups are not open until a Kit URL is set (src/config/landing.ts), #/login shows Welcome back.
const {chromium}=require('/opt/node-tools/node_modules/playwright');
let bad=0;function check(...a){console.log(...a)}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:900}});
await p.goto((process.env.BASE||'http://localhost:5199')+'/');await p.waitForTimeout(2000);
check('login text on home:',await p.evaluate(()=>/log in/i.test(document.body.innerText)));
await p.click('text=Features');await p.waitForTimeout(800);check('scrollY after Features',await p.evaluate(()=>Math.round(scrollY)));
await p.fill('.hero form input[type=email]','a@b.co');await p.click('.hero form button');await p.waitForTimeout(300);
check('waitlist msg:',await p.textContent('.hero form .lp-status'));
await p.click('nav a:has-text("The beta")');await p.waitForTimeout(800);check('hash',await p.evaluate(()=>location.hash));
const box=p.locator('[data-other]');check('other hidden',await box.isHidden());
await p.click('[data-value="Other"][data-field="fields[how_you_play]"]');check('other visible',await box.isVisible());
await p.click('[data-value="Legacy challenge"]');check('chips',await p.locator('[aria-checked=true]').count());
await p.click('button[type=submit]');check('empty:',await p.textContent('.lp-status'));
await p.fill('[name=first_name]','T');await p.fill('input[type=email]','t@t.co');await p.selectOption('select','51 to 100');await p.fill('textarea','x');
await p.click('button[type=submit]');check('filled:',await p.textContent('.lp-status'));
await p.click('text=Back to home');await p.waitForTimeout(500);check('back hash',await p.evaluate(()=>location.hash));
await p.goto((process.env.BASE||'http://localhost:5199')+'/#/login');await p.waitForTimeout(2000);check('login heading',await p.textContent('h1'));
await b.close()})();
