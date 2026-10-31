// Worker "site-timeline" na Cloudflare da revista.
// Serve o novo site (publicado no GitHub Pages) e entrega os artigos do Substack ao vivo em /api/posts.
const PAGES = 'https://rogeriotpires-spec.github.io/apuracao-timeline/novo-site';
const SUBSTACK = 'https://www.revistatimeline.com';

async function posts(ctx) {
  const cache = caches.default;
  const key = new Request('https://cache.local/api/posts');
  const hit = await cache.match(key);
  if (hit) return hit;
  const r = await fetch(`${SUBSTACK}/api/v1/archive?sort=new&offset=0&limit=16`, { headers: { 'user-agent': 'site-timeline/1.0' } });
  if (!r.ok) return new Response(JSON.stringify({ posts: [] }), { status: 502, headers: { 'content-type': 'application/json' } });
  const list = await r.json();
  const out = {
    updated: new Date().toISOString(),
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
    if (url.pathname === '/api/posts') return posts(ctx);
    const path = url.pathname === '/' ? '/index.html' : url.pathname;
    const r = await fetch(PAGES + path, { cf: { cacheTtl: 120 } });
    const out = new Response(r.body, r);
    out.headers.set('cache-control', 'public, max-age=120');
    return out;
  },
};
