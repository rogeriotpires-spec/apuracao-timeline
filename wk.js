const pw=require('playwright');(async()=>{const b=await pw.webkit.launch();const ctx=await b.newContext({...pw.devices['iPhone 13']});const p=await ctx.newPage();
const log=[];p.on('pageerror',e=>log.push('ERR '+e.message));p.on('console',m=>{if(m.type()==='error')log.push('console '+m.text().slice(0,200))});
await p.goto('https://site-timeline.marketing-b9d.workers.dev/?nc='+Date.now());await p.waitForTimeout(4000);
log.push('itens '+await p.$$eval('#programas .tv-item',e=>e.length)+' esq '+await p.$$eval('#programas .esq',e=>e.length)+' cls '+await p.evaluate(()=>document.documentElement.className));
await p.screenshot({path:'wk-topo.png'});
const el=await p.$('#programas');if(el){await el.scrollIntoViewIfNeeded();await p.waitForTimeout(2500);await p.screenshot({path:'wk-prog.png'});}
log.push(JSON.stringify(await p.$$eval('#programas .tv-item',e=>e.slice(0,4).map(x=>({c:x.className,t:x.innerText.slice(0,60),h:x.getBoundingClientRect().height})))));
require('fs').writeFileSync('resultado.txt',log.join('\n'));await b.close();})();
