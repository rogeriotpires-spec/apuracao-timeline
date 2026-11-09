const {chromium}=require('playwright');const ID='1656844419573895';
const U=process.argv.slice(2);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext();const out=[];
for(const u of U){const p=await ctx.newPage();let tr=[];p.on('request',r=>{const x=r.url();if(/facebook\.com\/tr|connect\.facebook\.net/.test(x))tr.push(x)});let st='',t='',extra={};
try{const r=await p.goto(u,{waitUntil:'domcontentloaded',timeout:30000});st=r.status();await p.waitForTimeout(1500);await p.mouse.move(200,200);await p.mouse.wheel(0,600);await p.waitForTimeout(3500);t=await p.title();
extra=await p.evaluate(()=>({gen:(document.querySelector('meta[name=generator]')||{}).content||'',fbsrc:[...document.scripts].map(s=>s.src).filter(s=>/facebook|fbevents|pixel/i.test(s)),inl:[...document.scripts].map(s=>s.textContent).join(' ').match(/fbq\(['"]init['"],\s*['"]?\d+/g)}));}catch(e){st='ERRO '+e.message.slice(0,50)}
await p.close();out.push({u,st,t:t.slice(0,50),ids:[...new Set(tr.map(x=>(x.match(/[?&]id=(\d+)/)||[])[1]).filter(Boolean))],ok:tr.some(x=>x.includes(ID)),extra});}
console.log(JSON.stringify(out));await b.close();})();
