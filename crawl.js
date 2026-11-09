const {chromium}=require('playwright');
const ID='1656844419573895';
const START=['https://www.revistatimeline.com/','https://site-timeline.marketing-b9d.workers.dev/','https://editora.revistatimeline.com/','https://eventos.revistatimeline.com/','https://observatorio.revistatimeline.com/','https://fiscalize.revistatimeline.com/','https://loja.revistatimeline.com/','https://lp.revistatimeline.com/','https://assine.revistatimeline.com/','https://assine.revistatimeline.com/subscribe','https://assine.revistatimeline.com/archive'];
const ok=h=>/(^|\.)revistatimeline\.com$/.test(h)||h==='site-timeline.marketing-b9d.workers.dev';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'});
const seen=new Set(),fila=START.map(u=>[u,0]),out=[];
while(fila.length&&out.length<160){const [u,d]=fila.shift();const k=u.split('#')[0].replace(/\/$/,'');if(seen.has(k))continue;seen.add(k);
 const p=await ctx.newPage();let tr=[];p.on('request',r=>{const x=r.url();if(/facebook\.com\/tr|connect\.facebook\.net/.test(x))tr.push(x)});
 let st='',title='',links=[],fb={};
 try{const r=await p.goto(u,{waitUntil:'domcontentloaded',timeout:30000});st=r?r.status():'';await p.waitForTimeout(1500);await p.mouse.move(200,200);await p.mouse.wheel(0,600);await p.waitForTimeout(3500);
  title=(await p.title()).slice(0,70);
  fb=await p.evaluate(()=>({fbq:typeof window.fbq,tl:!!window.__tlPixel,html:document.documentElement.outerHTML.match(/fbq\('init',\s*'(\d+)'/g)||[],ch:/Just a moment|challenge-platform/.test(document.documentElement.outerHTML.slice(0,3000))}));
  if(d<2) links=await p.$$eval('a[href]',as=>as.map(a=>a.href));}catch(e){st='ERRO '+e.message.slice(0,60)}
 await p.close();
 const ids=[...new Set(tr.map(x=>(x.match(/[?&]id=(\d+)/)||[])[1]).filter(Boolean))];
 out.push({u,st,title,fbq:fb.fbq,tl:fb.tl,ch:fb.ch,ids,ourPixel:ids.includes(ID)||tr.some(x=>x.includes(ID)),inits:fb.html});
 for(const l of links){try{const x=new URL(l);if(!ok(x.hostname))continue;if(/\.(pdf|jpg|png|zip|mp4)$/i.test(x.pathname))continue;x.hash='';
  if(x.hostname.startsWith('assine.')&&/^\/p\//.test(x.pathname)&&[...seen].filter(s=>s.includes('assine.revistatimeline.com/p/')).length>2)continue;
  fila.push([x.href,d+1]);}catch(e){}}}
console.log(JSON.stringify(out));await b.close();})();
