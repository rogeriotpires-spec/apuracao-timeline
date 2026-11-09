const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1350,height:940}});
await p.addInitScript(()=>{window.__s=[];new PerformanceObserver(l=>{for(const e of l.getEntries()){window.__s.push({v:e.value,t:Math.round(e.startTime),src:e.sources.map(s=>({n:s.node?(s.node.id||s.node.className||s.node.nodeName):'?',tag:s.node&&s.node.nodeName,pr:[s.previousRect.y,s.previousRect.height],cr:[s.currentRect.y,s.currentRect.height]}))})}}).observe({type:'layout-shift',buffered:true});
 document.fonts.addEventListener('loadingdone',e=>window.__s.push({fonts:Math.round(performance.now()),f:e.fontfaces.map(f=>f.family+f.weight)}));});
await p.goto('https://site-timeline.marketing-b9d.workers.dev/');await p.waitForTimeout(6000);
console.log(JSON.stringify(await p.evaluate(()=>window.__s),null,0));await b.close();})();
