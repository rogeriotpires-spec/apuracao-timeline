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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/posts') return posts(url, ctx);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const r = await fetch(PAGES + path, { cf: { cacheTtl: 120 } });
    const out = new Response(r.body, r);
    out.headers.set('cache-control', 'public, max-age=120');
    return out;
  },
};
