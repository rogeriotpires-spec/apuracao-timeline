/* Ordenação por clique no título da coluna, para todas as tabelas dos sites da Timeline.
   Uso: <script src="https://rogeriotpires-spec.github.io/apuracao-timeline/menu/ordena-tabelas.js" defer></script>
   Entende reais (R$ 1.234,56), datas dd/mm/aaaa (com hora), porcentagens, números e texto.
   Para desligar numa tabela: <table data-nosort>. Para desligar numa coluna: <th data-nosort>. */
(function () {
  if (window.__tlOrdena) return;
  window.__tlOrdena = true;

  var css = 'table:not([data-nosort]) thead th.tl-ord{cursor:pointer;user-select:none;-webkit-user-select:none}' +
    'table:not([data-nosort]) thead th.tl-ord:hover{opacity:.8;text-decoration:underline;text-underline-offset:3px}' +
    'th.tl-ord[aria-sort]::after{content:" \\25B2";color:#e07a2c;font-size:.85em}' +
    'th.tl-ord[aria-sort="descending"]::after{content:" \\25BC"}';
  var st = document.createElement('style');
  st.id = 'tl-ordena-style';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  function chave(td) {
    if (!td) return '';
    if (td.hasAttribute('data-sort')) {
      var v = td.getAttribute('data-sort');
      return v !== '' && !isNaN(v) ? Number(v) : v.toLowerCase();
    }
    var t = (td.textContent || '').replace(/\s+/g, ' ').trim();
    var d = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s*(?:às\s*)?(\d{1,2})[:h](\d{2}))?/);
    if (d) return Date.UTC(+d[3], d[2] - 1, +d[1], +(d[4] || 0), +(d[5] || 0));
    var m = t.match(/^(-?)\s*(?:R\$|US\$|\$|€)\s*(-?)([\d.]+(?:,\d+)?)/);
    if (m) return (m[1] || m[2] ? -1 : 1) * Number(m[3].replace(/\./g, '').replace(',', '.'));
    var n = t.match(/^([+-]?[\d.]*\d(?:,\d+)?)\s*(%|p\.?p\.?|votos?|mil)?$/i);
    if (n) {
      var s = n[1];
      // "1.234" com ponto de milhar; "12,5" com vírgula decimal
      s = /,/.test(s) ? s.replace(/\./g, '').replace(',', '.') : (/^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s);
      if (!isNaN(s)) return Number(s);
    }
    return t.toLowerCase();
  }

  function aplicar(tbl, th, dir) {
    var tb = tbl.tBodies[0];
    if (!tb) return;
    var col = th.cellIndex;
    var linhas = Array.prototype.map.call(tb.rows, function (r, i) { return { r: r, i: i, k: chave(r.cells[col]) }; });
    linhas.sort(function (a, b) {
      if (a.k === b.k) return a.i - b.i;
      if (a.k === '') return 1;
      if (b.k === '') return -1;
      if (typeof a.k === 'number' && typeof b.k === 'number') return (a.k - b.k) * dir;
      return String(a.k).localeCompare(String(b.k), 'pt-BR', { numeric: true }) * dir;
    });
    // já está nessa ordem? não mexe (evita laço com o observador)
    var igual = true;
    for (var i = 0; i < linhas.length; i++) if (linhas[i].i !== i) { igual = false; break; }
    if (igual) return;
    tbl.__tlMexendo = true;
    linhas.forEach(function (x) { tb.appendChild(x.r); });
    setTimeout(function () { tbl.__tlMexendo = false; }, 0);
  }

  function ordenavel(th) {
    var tbl = th.closest('table');
    if (!tbl || tbl.hasAttribute('data-nosort') || th.hasAttribute('data-nosort')) return false;
    if (!th.closest('thead') || th.closest('thead').rows.length > 1 || th.colSpan > 1) return false;
    if (!th.textContent.trim() || th.querySelector('input,button,select,a,textarea')) return false;
    var tb = tbl.tBodies[0];
    if (!tb || tb.rows.length < 2) return false;
    for (var i = 0; i < tb.rows.length; i++) {
      var c = tb.rows[i].cells;
      for (var j = 0; j < c.length; j++) if (c[j].rowSpan > 1 || c[j].colSpan > 1) return false;
    }
    return true;
  }

  // marca os títulos clicáveis (com cursor de mãozinha)
  function marcar() {
    var ths = document.querySelectorAll('table thead th');
    for (var i = 0; i < ths.length; i++) {
      var ok = ordenavel(ths[i]);
      ths[i].classList.toggle('tl-ord', ok);
      if (ok && !ths[i].title) ths[i].title = 'Clique para ordenar';
    }
  }

  document.addEventListener('click', function (e) {
    var th = e.target.closest && e.target.closest('table thead th');
    if (!th || !ordenavel(th)) return;
    var tbl = th.closest('table');
    var dir = th.getAttribute('aria-sort') === 'ascending' ? -1 : 1;
    var outros = tbl.querySelectorAll('th[aria-sort]');
    for (var i = 0; i < outros.length; i++) outros[i].removeAttribute('aria-sort');
    th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
    tbl.__tlOrdem = { col: th.cellIndex, dir: dir };
    aplicar(tbl, th, dir);
  });

  // quando a página redesenha as linhas (busca, atualização ao vivo), mantém a ordem escolhida
  var pendente = null;
  new MutationObserver(function (muts) {
    if (pendente) return;
    pendente = setTimeout(function () {
      pendente = null;
      marcar();
      var tbls = document.querySelectorAll('table');
      for (var i = 0; i < tbls.length; i++) {
        var t = tbls[i], o = t.__tlOrdem;
        if (!o || t.__tlMexendo || !t.tHead) continue;
        var th = t.tHead.rows[0] && t.tHead.rows[0].cells[o.col];
        if (!th) continue;
        if (!th.hasAttribute('aria-sort')) th.setAttribute('aria-sort', o.dir === 1 ? 'ascending' : 'descending');
        aplicar(t, th, o.dir);
      }
    }, 60);
  }).observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', marcar); else marcar();
})();
