/*
 * Menu padrão da Revista Timeline: um único arquivo usado por todos os sites da Timeline.
 * Uso: <script src="https://rogeriotpires-spec.github.io/apuracao-timeline/menu/timeline-menu.js"></script>
 * O cabeçalho é desenhado no lugar exato do <script> (ou dentro de <div id="timeline-menu">, se existir).
 * Para mudar o menu em todos os sites, edite só a lista ITENS abaixo.
 */
(function () {
  if (document.getElementById('tlm')) return;
  var host = location.hostname.replace(/^www\./, '');
  // A página inicial nova vive em novo.revistatimeline.com até o domínio principal sair do Substack.
  // Na troca, basta mudar SITE para 'https://www.revistatimeline.com/'.
  var SITE = 'https://novo.revistatimeline.com/';
  var naHomeNova = host === SITE.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');
  var HOME = naHomeNova ? '/' : SITE;
  var BUSCA = HOME + '#busca';
  var ASSINE = 'https://lp.revistatimeline.com/';

  var ITENS = [
    { t: 'Início', u: HOME, h: ['revistatimeline.com', 'novo.revistatimeline.com'] },
    { t: 'Assine', aba: true, u: ASSINE, h: ['lp.revistatimeline.com'] },
    { t: 'Editora', aba: true, u: 'https://editora.revistatimeline.com/', h: ['editora.revistatimeline.com'], novo: true },
    { t: 'Eventos', aba: true, u: 'https://eventos.revistatimeline.com/', h: ['eventos.revistatimeline.com'], novo: true },
    { t: 'Loja', aba: true, u: 'https://loja.revistatimeline.com/', h: ['loja.revistatimeline.com'] },
    { t: 'Observatório', aba: true, u: 'https://observatorio.revistatimeline.com/', h: ['observatorio.revistatimeline.com'], title: 'Observatório Eleitoral' },
    { t: 'Fiscalize seu voto', aba: true, u: 'https://fiscalize.revistatimeline.com/', h: ['fiscalize.revistatimeline.com'] },
    { t: 'YouTube', u: 'https://www.youtube.com/@conversatimeline', ext: true },
    { t: 'Instagram', u: 'https://www.instagram.com/_revistatimeline/', ext: true },
    { t: 'Facebook', u: 'https://www.facebook.com/profile.php?id=61572807617119', ext: true },
    { t: 'Caderno de Cultura', u: 'https://www.revistatimeline.com/s/caderno-de-cultura', path: '/s/caderno-de-cultura' },
    { t: 'Sobre', u: 'https://www.revistatimeline.com/about', path: '/about' },
  ];

  function atual(i) {
    if (i.path) return host === 'revistatimeline.com' && location.pathname.indexOf(i.path) === 0;
    if (!i.h || i.h.indexOf(host) < 0) return false;
    // na revista, "Início" só vale na página inicial
    return i.t !== 'Início' || location.pathname === '/' || naHomeNova;
  }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var css = '' +
    '.tlm,.tlm *{box-sizing:border-box}' +
    '.tlm{--tlm-ink:#f6f2ee;--tlm-soft:#ddd5cf;--tlm-cream:#f4a65a;--tlm-orange:#e07a2c;--tlm-line:#2c221c;background:#050403;border-bottom:1px solid var(--tlm-line);color:var(--tlm-ink);font:16px/1.4 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;position:relative;z-index:50}' +
    '.tlm a{color:inherit;text-decoration:none}' +
    '.tlm a:focus-visible{outline:2px solid var(--tlm-cream);outline-offset:3px;border-radius:3px}' +
    '.tlm-mast{max-width:1380px;margin:auto;min-height:91px;padding:13px 20px;display:flex;align-items:center;justify-content:center;position:relative;border-bottom:1px solid var(--tlm-line)}' +
    '.tlm-brand{font-family:"Playfair Display",Georgia,serif;font-size:50px;line-height:1;letter-spacing:.025em;color:var(--tlm-ink)!important}' +
    '.tlm-tools{position:absolute;right:20px;top:50%;transform:translateY(-50%);display:flex;gap:10px;align-items:center}' +
    '.tlm-btn{display:inline-flex;align-items:center;justify-content:center;border-radius:7px;font:800 13px/1 Inter,system-ui,sans-serif;white-space:nowrap}' +
    '.tlm-lupa{width:38px;height:38px;border:1px solid rgba(255,255,255,.3);color:var(--tlm-ink)!important}' +
    '.tlm-lupa:hover{border-color:var(--tlm-cream);color:var(--tlm-cream)!important}' +
    '.tlm-lupa svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round}' +
    '.tlm-assine{position:relative;padding:12px 14px;background:linear-gradient(90deg,#b5361f,#e07a2c 55%,#f4a65a);color:#140a04!important;box-shadow:0 4px 18px rgba(214,96,30,.26)}' +
    '.tlm-assine:hover{filter:brightness(1.07)}' +
    '.tlm-assine::after{content:"";position:absolute;inset:0;border-radius:7px;pointer-events:none;animation:tlm-anel 3.6s ease-out infinite}' +
    '.tlm-hand{position:absolute;right:-12px;bottom:-17px;width:26px;height:26px;fill:#fff;stroke:#140a04;stroke-width:1.4;stroke-linejoin:round;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));transform-origin:30% 10%;animation:tlm-toque 3.6s ease-in-out infinite;transition:opacity .2s}' +
    '.tlm-assine:hover .tlm-hand{opacity:0}' +
    '@keyframes tlm-toque{0%,55%{transform:translate(7px,7px)}68%{transform:translate(0,0)}73%{transform:translate(0,0) scale(.86)}79%{transform:translate(0,0) scale(1)}100%{transform:translate(7px,7px)}}' +
    '@keyframes tlm-anel{0%,72%{box-shadow:0 0 0 0 rgba(244,166,90,.75)}100%{box-shadow:0 0 0 12px rgba(244,166,90,0)}}' +
    '.tlm-links{display:flex;align-items:center;justify-content:safe center;gap:clamp(14px,1.3vw,22px);max-width:1600px;margin:0 auto;padding:0 18px;min-height:56px;white-space:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}' +
    '.tlm-links::-webkit-scrollbar{display:none}' +
    '.tlm-links a{position:relative;flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;padding:17px 0 15px;font:600 15px/1 "Barlow Condensed","Arial Narrow",Inter,sans-serif;letter-spacing:.03em;text-transform:uppercase;color:var(--tlm-soft);transition:color .18s}' +
    '.tlm-links a::after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;border-radius:2px 2px 0 0;background:var(--tlm-orange);transform:scaleX(0);transition:transform .22s ease}' +
    '.tlm-links a:hover,.tlm-links a:focus-visible{color:var(--tlm-cream)}' +
    '.tlm-links a:hover::after,.tlm-links a:focus-visible::after,.tlm-links a[aria-current="page"]::after{transform:scaleX(1)}' +
    '.tlm-links a[aria-current="page"]{color:#fff}' +
    '.tlm-novo{align-self:flex-start;margin:-3px 0 0 -3px;font:700 10px/1 Inter,system-ui,sans-serif;letter-spacing:.02em;text-transform:lowercase;color:var(--tlm-orange)}' +
    '@media(max-width:1400px){.tlm-links{gap:15px}.tlm-links a{font-size:14px}}' +
    '@media(max-width:1000px){.tlm-mast{min-height:75px}.tlm-brand{font-size:44px}.tlm-links{justify-content:flex-start}}' +
    '@media(max-width:600px){.tlm-mast{min-height:62px;padding:10px}.tlm-brand{font-size:34px}.tlm-tools{right:10px;gap:8px}.tlm-lupa{width:34px;height:34px}.tlm-assine{padding:10px 11px;font-size:12px}.tlm-links{gap:22px;min-height:50px}.tlm-links a{font-size:15px;padding:15px 0 13px}}' +
    '@media(prefers-reduced-motion:reduce){.tlm-assine::after,.tlm-hand{animation:none}.tlm-links a,.tlm-links a::after{transition:none}}';

  var links = ITENS.map(function (i) {
    return '<a href="' + esc(i.u) + '"' + (atual(i) ? ' aria-current="page"' : '') + (i.title ? ' title="' + esc(i.title) + '"' : '') +
      (i.ext || (i.aba && !atual(i)) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(i.t) + (i.novo ? '<span class="tlm-novo">novo</span>' : '') + '</a>';
  }).join('');

  var html = '<header class="tlm" id="tlm">' +
    '<div class="tlm-mast"><a class="tlm-brand" href="' + esc(HOME) + '" aria-label="Revista Timeline, página inicial">Timeline</a>' +
    '<div class="tlm-tools"><a class="tlm-btn tlm-lupa" id="tlm-lupa" href="' + esc(BUSCA) + '" aria-label="Buscar artigos" title="Buscar artigos"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></a>' +
    '<a class="tlm-btn tlm-assine" href="' + ASSINE + '"' + (host === 'lp.revistatimeline.com' ? '' : ' target="_blank" rel="noopener"') + '>Assine<svg class="tlm-hand" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10V9a1.5 1.5 0 0 1 3 0v1.5a1.5 1.5 0 0 1 3 0V12a1.5 1.5 0 0 1 3 0v4.5c0 3.6-2.6 6.5-6.5 6.5h-1.6c-2 0-3.4-.8-4.6-2.3L4.6 16.2a1.6 1.6 0 0 1 2.4-2.1L9 16z"/></svg></a></div></div>' +
    '<nav class="tlm-links" aria-label="Menu principal da Revista Timeline">' + links + '</nav></header>';

  if (!document.getElementById('tlm-fonts')) {
    var f = document.createElement('link');
    f.id = 'tlm-fonts'; f.rel = 'stylesheet';
    f.href = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600&family=Inter:wght@600;700;800&family=Playfair+Display:wght@400&display=swap';
    document.head.appendChild(f);
  }
  var st = document.createElement('style');
  st.id = 'tlm-style'; st.textContent = css;
  document.head.appendChild(st);

  var alvo = document.getElementById('timeline-menu');
  var me = document.currentScript;
  if (alvo) alvo.outerHTML = html;
  else if (me && me.parentNode && me.parentNode !== document.head) me.insertAdjacentHTML('beforebegin', html);
  else {
    var put = function () { document.body.insertAdjacentHTML('afterbegin', html); };
    if (document.body) put(); else document.addEventListener('DOMContentLoaded', put);
  }
  // o item atual fica visível quando o menu rola de lado (celular)
  setTimeout(function () {
    var a = document.querySelector('.tlm-links a[aria-current="page"]');
    if (a && a.offsetLeft > a.parentNode.clientWidth - 60) a.parentNode.scrollLeft = a.offsetLeft - 18;
  }, 0);
})();
