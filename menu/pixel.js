/*
 * Pixel da Meta da Revista Timeline (conjunto de dados 1656844419573895), usado em todos os sites da Timeline.
 * O menu padrão (timeline-menu.js) carrega este arquivo sozinho; páginas sem o menu podem incluí-lo direto:
 * <script src="https://rogeriotpires-spec.github.io/apuracao-timeline/menu/pixel.js" async></script>
 * Áreas internas (admin, painel, staff, check-in, cockpit) ficam de fora.
 */
(function () {
  if (window.__tlPixel) return; window.__tlPixel = true;
  if (/\/(admin|painel|staff|cockpit|checkin)(\/|\.html|$)/i.test(location.pathname)) return;
  var ID = '1656844419573895';
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  // E-mail que o leitor já deixou no site (newsletter): a Meta recebe só a versão criptografada, para reconhecer melhor o público
  var em = '';
  try { var l = JSON.parse(localStorage.getItem('tl_leitor') || 'null'); if (l && l.email) em = String(l.email).trim().toLowerCase(); } catch (e) {}
  if (em) fbq('init', ID, { em: em }); else fbq('init', ID);
  fbq('track', 'PageView');
  // Atalho para as páginas registrarem ações: tlPixel('Lead'), tlPixel('Purchase', {value: 30, currency: 'BRL'})
  window.tlPixel = function (ev, dados) { try { fbq('track', ev, dados || {}); } catch (e) {} };

  // Aviso discreto de cookies (LGPD), mostrado uma vez por aparelho
  var K = 'tl_cookies_ok';
  try { if (localStorage.getItem(K)) return; } catch (e) { return; }
  function aviso() {
    if (document.getElementById('tl-cookies')) return;
    var d = document.createElement('div'); d.id = 'tl-cookies'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', 'Aviso de cookies');
    d.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483000;max-width:min(420px,calc(100vw - 32px));background:#100d0b;color:#f6f2ee;border:1px solid #2c221c;border-radius:12px;padding:12px 14px;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.35);display:flex;gap:12px;align-items:center';
    d.innerHTML = '<span>Usamos cookies para medir a audiência e melhorar nossos anúncios. <a href="https://editora.revistatimeline.com/privacidade.html" style="color:#f4a65a">Privacidade</a></span>' +
      '<button type="button" style="flex:none;background:linear-gradient(135deg,#ff6a3d,#c53b26);color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer">Ok</button>';
    d.querySelector('button').onclick = function () { try { localStorage.setItem(K, '1'); } catch (e) {} d.remove(); };
    document.body.appendChild(d);
  }
  if (document.body) aviso(); else document.addEventListener('DOMContentLoaded', aviso);
})();
