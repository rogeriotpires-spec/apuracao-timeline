// Worker "site-timeline" na Cloudflare da revista.
// Serve o novo site (publicado no GitHub Pages) em revistatimeline.com e entrega os artigos do Substack ao vivo em /api/posts.
// Desde 01/nov/2026 o Substack responde em antigo.revistatimeline.com; o endereço timelinemedia.substack.com
// funciona sempre (o Substack o encaminha para o domínio próprio que estiver ativo).
const PAGES = 'https://rogeriotpires-spec.github.io/apuracao-timeline/novo-site';
const SUBSTACK = 'https://timelinemedia.substack.com';

// Configuração editável pelo Painel de Controle (painel.revistatimeline.com), guardada no KV ligado como SITE.
// Sem o KV, o site segue com estes padrões.
const DEFAULTS = {
  aviso: { ativo: false, texto: '', link: '', botao: '', tom: 'ambar' },
  cartoes: [
    { id: 'livro', mostrar: true }, { id: 'evento', mostrar: true }, { id: 'assine', mostrar: true },
    { id: 'boletim', mostrar: true }, { id: 'loja', mostrar: true },
  ],
  livro: { slug: 'almanaque-timeline', etiqueta: 'auto' },
  evento: { etiqueta: '' },
  loja: { preco_min: '29,90' },
  artigo_fixado: { url: '', ate: '' },
};
function mergeConfig(c) {
  const v = c && typeof c === 'object' ? c : {};
  const ids = DEFAULTS.cartoes.map((x) => x.id);
  const cards = Array.isArray(v.cartoes) ? v.cartoes.filter((x) => x && ids.includes(x.id)) : [];
  for (const d of DEFAULTS.cartoes) if (!cards.find((x) => x.id === d.id)) cards.push({ ...d });
  return {
    aviso: { ...DEFAULTS.aviso, ...(v.aviso || {}) },
    cartoes: cards.map((x) => ({ id: x.id, mostrar: x.mostrar !== false })),
    livro: { ...DEFAULTS.livro, ...(v.livro || {}) },
    evento: { ...DEFAULTS.evento, ...(v.evento || {}) },
    loja: { ...DEFAULTS.loja, ...(v.loja || {}) },
    artigo_fixado: { ...DEFAULTS.artigo_fixado, ...(v.artigo_fixado || {}) },
  };
}
async function getConfig(env) {
  try { return mergeConfig(env.SITE ? await env.SITE.get('config', 'json') : null); } catch { return mergeConfig(null); }
}
// artigo fixado vale até a data "ate" (inclusive), se houver
function pinnedSlug(cfg) {
  const a = cfg.artigo_fixado;
  if (!a.url) return '';
  if (a.ate && new Date(a.ate + 'T23:59:59-03:00') < new Date()) return '';
  const m = String(a.url).match(/\/p\/([a-z0-9-]+)/i);
  return m ? m[1] : '';
}
const mapPost = (p) => ({
  title: p.title,
  subtitle: p.subtitle || p.description || '',
  author: p.publishedBylines?.[0]?.name || 'Redação Timeline',
  date: p.post_date,
  url: p.canonical_url,
  image: p.cover_image || '',
  likes: p.reaction_count ?? (p.reactions ? Object.values(p.reactions).reduce((a, b) => a + b, 0) : null),
  comments: p.comment_count ?? null,
  restacks: p.restacks ?? null,
});

// /api/posts?offset=0&search=termo : página de 12 artigos (busca e "carregar mais" usam o mesmo caminho)
async function posts(url, ctx, cfg) {
  const offset = Math.max(0, Math.min(5000, parseInt(url.searchParams.get('offset') || '0', 10) || 0));
  const search = (url.searchParams.get('search') || '').trim().slice(0, 80);
  const cache = caches.default;
  const pin = offset === 0 && !search ? pinnedSlug(cfg) : '';
  const key = new Request(`https://cache.local/api/posts?o=${offset}&s=${encodeURIComponent(search)}&pin=${pin}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const q = new URLSearchParams({ sort: 'new', offset: String(offset), limit: '12' });
  if (search) q.set('search', search);
  const r = await fetch(`${SUBSTACK}/api/v1/archive?${q}`, { headers: { 'user-agent': 'site-timeline/1.0' } });
  if (!r.ok) return new Response(JSON.stringify({ posts: [] }), { status: 502, headers: { 'content-type': 'application/json' } });
  const list = await r.json();
  const out = {
    updated: new Date().toISOString(),
    more: list.length === 12,
    posts: list.filter((p) => p.type !== 'podcast' || p.title).map(mapPost),
  };
  if (pin) {
    const pr = await fetch(`${SUBSTACK}/api/v1/posts/${pin}`, { headers: { 'user-agent': 'site-timeline/1.0' } }).catch(() => null);
    const p = pr && pr.ok ? await pr.json().catch(() => null) : null;
    if (p && p.title) {
      out.posts = [{ ...mapPost(p), pinned: true }, ...out.posts.filter((x) => x.url !== p.canonical_url)];
    }
  }
  const resp = new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' } });
  ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}

// /api/destaques : o livro em destaque da Editora e o próximo evento, para a vitrine da página inicial
const EDITORA = 'https://editora-timeline.netlify.app';
const EVENTOS = 'https://timeline-eventos.netlify.app';
const getJson = (u) => fetch(u, { headers: { 'user-agent': 'site-timeline/1.0' }, signal: AbortSignal.timeout(6000) })
  .then((r) => (r.ok ? r.json() : null)).catch(() => null);

async function destaques(ctx, cfg) {
  const cache = caches.default;
  const slug = cfg.livro.slug || 'almanaque-timeline';
  const key = new Request(`https://cache.local/api/destaques?l=${encodeURIComponent(slug)}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const [cat, evs] = await Promise.all([getJson(`${EDITORA}/api/public?action=catalog`), getJson(`${EVENTOS}/api/public?action=events`)]);
  const books = cat?.books || [];
  const b = books.find((x) => x.slug === slug) || books.find((x) => x.featured) || books[0] || null;
  const e = (evs?.events || []).find((x) => new Date(x.ends_at || x.starts_at) > new Date()) || null;
  const out = {
    book: b && { slug: b.slug, title: b.title, subtitle: b.subtitle, author: b.author, cover_url: b.cover_url,
      price_digital: b.price_digital, price_digital_old: b.price_digital_old, price_rental: b.price_rental,
      rental_days: b.rental_days, has_sample: b.has_sample, sample_pages: b.sample_pages, pages: b.pages },
    event: e && { slug: e.slug, title: e.title_pt || e.title_en, description: e.description_pt || '', cover_url: e.cover_url || '',
      starts_at: e.starts_at, ends_at: e.ends_at, timezone: e.timezone || 'America/Sao_Paulo', venue: e.venue, address: e.address,
      online: Boolean(e.online_enabled), in_person: (e.capacity_in_person || 0) > 0,
      price_in_person: e.price_in_person_brl, price_online: e.price_online_brl },
  };
  const resp = new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' } });
  if (b || e) ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}

// /api/inscrever : inscreve o e-mail no plano grátis do Substack sem tirar o leitor do site.
// Se o Substack recusar (proteção anti-robô), responde ok:false e a página manda para a inscrição do Substack.
async function inscrever(request) {
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  if (request.method !== 'POST') return json({ ok: false }, 405);
  let email = '';
  try { email = String((await request.json()).email || '').trim().toLowerCase(); } catch {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) return json({ ok: false, erro: 'email' }, 400);
  try {
    const r = await fetch(`${SUBSTACK}/api/v1/free`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 site-timeline/1.0', origin: SUBSTACK, referer: SUBSTACK + '/' },
      body: JSON.stringify({ email, first_url: 'https://www.revistatimeline.com/', first_referrer: '', current_url: 'https://www.revistatimeline.com/',
        current_referrer: '', referral_code: '', source: 'embed', referring_pub_id: '', additional_referring_pub_ids: '' }),
      signal: AbortSignal.timeout(8000),
    });
    const txt = await r.text();
    let d = null; try { d = JSON.parse(txt); } catch {}
    const ok = r.ok && d && !d.errors && !d.error && !/captcha/i.test(txt);
    return json({ ok, status: r.status });
  } catch { return json({ ok: false }); }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/config') {
      return new Response(JSON.stringify(await getConfig(env)), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=30' } });
    }
    if (url.pathname === '/api/inscrever') return inscrever(request);
    if (url.pathname === '/api/posts') return posts(url, ctx, await getConfig(env));
    if (url.pathname === '/api/destaques') return destaques(ctx, await getConfig(env));
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const r = await fetch(PAGES + path, { cf: { cacheTtl: 120 } });
    // O que não existe no site novo é endereço antigo do Substack (/p/artigo, /archive, /subscribe, /about, /s/...):
    // manda para o Substack no mesmo caminho, para nenhum link já compartilhado quebrar.
    if (r.status === 404) return Response.redirect(SUBSTACK + url.pathname + url.search, 301);
    const out = new Response(r.body, r);
    out.headers.set('cache-control', 'public, max-age=120');
    return out;
  },
};
