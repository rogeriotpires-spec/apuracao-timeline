// Worker "site-timeline" na Cloudflare da revista.
// Serve o novo site (publicado no GitHub Pages) em revistatimeline.com e entrega os artigos do Substack ao vivo em /api/posts.
// Desde 02/nov/2026 o Substack responde em assine.revistatimeline.com. O endereço timelinemedia.substack.com
// passou a bloquear acesso de servidores (tela "Just a moment"), por isso o Worker usa o domínio próprio.
const PAGES = 'https://rogeriotpires-spec.github.io/apuracao-timeline/novo-site';
const SUBSTACK = 'https://assine.revistatimeline.com';

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
  const key = new Request(`https://cache.local/api/posts?v=2&o=${offset}&s=${encodeURIComponent(search)}&pin=${pin}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const q = new URLSearchParams({ sort: 'new', offset: String(offset), limit: '12' });
  if (search) q.set('search', search);
  const r = await fetch(`${SUBSTACK}/api/v1/archive?${q}`, { headers: { 'user-agent': 'site-timeline/1.0' } });
  if (!r.ok) return new Response(JSON.stringify({ posts: [] }), { status: 502, headers: { 'content-type': 'application/json' } });
  // O Substack passou a responder { posts: [...], nextCursor } em vez de uma lista simples; aceitamos os dois formatos
  const raw = await r.json().catch(() => null);
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.posts) ? raw.posts : []);
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

// /api/programas : para o Conversa Timeline e o Ponto Final, o próximo programa (agendado ou ao vivo) e os últimos gravados
// e a próxima live agendada (ou a que está no ar). Precisa do segredo YT_KEY (chave da API do YouTube)
// configurado no Worker. Sem a chave, responde vazio e a seção some da página.
const YT_HANDLE = '@conversatimeline';
const YT_MIN_SEG = 2 * 3600;
const ytSeg = (d) => { const m = String(d || '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? ((+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0)) : 0; };
const ytThumb = (t) => (t && (t.maxres || t.standard || t.high || t.medium || t.default) || {}).url || '';
async function programas(env, ctx) {
  const json = (o, ttl) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${ttl}` } });
  if (!env.YT_KEY) return json({ sem_chave: true }, 60);
  const cache = caches.default;
  const key = new Request('https://cache.local/api/programas?v=7');
  const hit = await cache.match(key);
  if (hit) return hit;
  const yt = (path, q) => fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...q, key: env.YT_KEY })}`, { signal: AbortSignal.timeout(8000) })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const ch = await yt('channels', { part: 'contentDetails', forHandle: YT_HANDLE });
  const uploads = ch?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return json({ videos: [], proximo: null, erro: 'canal' }, 60);
  // até 100 envios recentes (2 páginas), para achar o Ponto Final mesmo com muitos cortes na semana
  const ids = [];
  let token = '';
  for (let i = 0; i < 2; i++) {
    const pl = await yt('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: '50', ...(token ? { pageToken: token } : {}) });
    (pl?.items || []).forEach((it) => it.contentDetails?.videoId && ids.push(it.contentDetails.videoId));
    token = pl?.nextPageToken || '';
    if (!token) break;
  }
  if (!ids.length) return json({ videos: [], proximo: null }, 60);
  const lotes = [ids.slice(0, 50), ids.slice(50, 100)].filter((l) => l.length);
  const vsAll = await Promise.all(lotes.map((l) => yt('videos', { part: 'snippet,contentDetails,liveStreamingDetails,statistics', id: l.join(','), maxResults: '50' })));
  const itens = vsAll.flatMap((vs) => vs?.items || []).map((v) => ({
    id: v.id, titulo: v.snippet?.title || '', thumb: ytThumb(v.snippet?.thumbnails),
    data: v.liveStreamingDetails?.actualStartTime || v.snippet?.publishedAt || '',
    estado: v.snippet?.liveBroadcastContent || 'none', inicio: v.liveStreamingDetails?.scheduledStartTime || '',
    seg: ytSeg(v.contentDetails?.duration),
    views: +(v.statistics?.viewCount || 0), assistindo: +(v.liveStreamingDetails?.concurrentViewers || 0),
  }));
  const agora = Date.now();
  const ehPF = (v) => /ponto\s*final/i.test(v.titulo);
  // fora da vitrine: a Análise das 22h com o Roveran e o Na Brasa com o Italo Lorenzon
  const fora = (v) => /an[aá]lise\s+das\s+22|roveran|na\s+brasa|[ií]talo\s+lorenzon/i.test(v.titulo);
  const enxuto = ({ id, titulo, thumb, data, seg, views }) => ({ id, titulo, thumb, data, seg, views });
  const proxDe = (filtro) => {
    const lista = itens.filter(filtro);
    const vivo = lista.find((v) => v.estado === 'live');
    const ag = lista.filter((v) => v.estado === 'upcoming' && v.inicio && new Date(v.inicio).getTime() > agora - 2 * 3600e3)
      .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))[0];
    const p = vivo || ag;
    return p ? { id: p.id, titulo: p.titulo, thumb: p.thumb, inicio: p.inicio, ao_vivo: p.estado === 'live', assistindo: p.assistindo } : null;
  };
  const prontos = itens.filter((v) => v.estado === 'none').sort((a, b) => new Date(b.data) - new Date(a.data));
  // só o programa: título com "Conversa Timeline" (ex.: "30/10/2026 - CONVERSA TIMELINE") e mais de 30 min, para deixar de fora cortes e outros vídeos do canal
  const ehCT = (v) => /conversa\s*timeline/i.test(v.titulo);
  const isCT = (v) => ehCT(v) && !ehPF(v) && !fora(v) && (v.estado !== 'none' || v.seg >= 1800);
  const out = {
    atualizado: new Date().toISOString(),
    conversa: { proximo: proxDe(isCT), videos: prontos.filter(isCT).slice(0, 5).map(enxuto) },
    ponto_final: { proximo: proxDe(ehPF), videos: prontos.filter((v) => ehPF(v) && v.seg >= 600).slice(0, 5).map(enxuto) },
  };
  const prox = out.conversa.proximo || out.ponto_final.proximo;
  const videos = [...out.conversa.videos, ...out.ponto_final.videos];
  const ttl = prox ? 120 : 600;
  const resp = json(out, ttl);
  if (videos.length || prox) ctx.waitUntil(cache.put(key, resp.clone()));
  return resp;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/config') {
      return new Response(JSON.stringify(await getConfig(env)), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=30' } });
    }
    if (url.pathname === '/api/inscrever') return inscrever(request);
    if (url.pathname === '/api/programas') return programas(env, ctx);
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
