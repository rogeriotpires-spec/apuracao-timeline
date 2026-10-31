// Worker "site-timeline" na Cloudflare da revista.
// Serve o novo site (publicado no GitHub Pages) e entrega os artigos do Substack ao vivo em /api/posts.
const PAGES = 'https://rogeriotpires-spec.github.io/apuracao-timeline/novo-site';
const SUBSTACK = 'https://www.revistatimeline.com';

// /api/posts?offset=0&search=termo : página de 12 artigos (busca e "carregar mais" usam o mesmo caminho)
async function posts(url, ctx) {
  const offset = Math.max(0, Math.min(5000, parseInt(url.searchParams.get('offset') || '0', 10) || 0));
  const search = (url.searchParams.get('search') || '').trim().slice(0, 80);
  const cache = caches.default;
  const key = new Request(`https://cache.local/api/posts?o=${offset}&s=${encodeURIComponent(search)}`);
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
    posts: list.filter((p) => p.type !== 'podcast' || p.title).map((p) => ({
      title: p.title,
      subtitle: p.subtitle || p.description || '',
      author: p.publishedBylines?.[0]?.name || 'Redação Timeline',
      date: p.post_date,
      url: p.canonical_url,
      image: p.cover_image || '',
      likes: p.reaction_count ?? (p.reactions ? Object.values(p.reactions).reduce((a, b) => a + b, 0) : null),
      comments: p.comment_count ?? null,
      restacks: p.restacks ?? null,
    })),
  };
  const resp = new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' } });
  ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}

// /api/destaques : o livro em destaque da Editora e o próximo evento, para a vitrine da página inicial
const EDITORA = 'https://editora-timeline.netlify.app';
const EVENTOS = 'https://timeline-eventos.netlify.app';
const getJson = (u) => fetch(u, { headers: { 'user-agent': 'site-timeline/1.0' }, signal: AbortSignal.timeout(6000) })
  .then((r) => (r.ok ? r.json() : null)).catch(() => null);

async function destaques(ctx) {
  const cache = caches.default;
  const key = new Request('https://cache.local/api/destaques');
  const hit = await cache.match(key);
  if (hit) return hit;
  const [cat, evs] = await Promise.all([getJson(`${EDITORA}/api/public?action=catalog`), getJson(`${EVENTOS}/api/public?action=events`)]);
  const books = cat?.books || [];
  const b = books.find((x) => x.slug === 'almanaque-timeline') || books.find((x) => x.featured) || books[0] || null;
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/posts') return posts(url, ctx);
    if (url.pathname === '/api/destaques') return destaques(ctx);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const r = await fetch(PAGES + path, { cf: { cacheTtl: 120 } });
    const out = new Response(r.body, r);
    out.headers.set('cache-control', 'public, max-age=120');
    return out;
  },
};
