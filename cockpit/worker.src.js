// Worker "painel-timeline" na Cloudflare da revista: serve painel.revistatimeline.com.
// Fica atrás do Cloudflare Access (login com Google ou código no e-mail), e este código confere o
// crachá assinado do Access em toda requisição, para nada funcionar fora dele.
//
// Variáveis do Worker (Settings > Variables and Secrets):
//   ACCESS_TEAM     nome da equipe no Zero Trust (o "xxx" de xxx.cloudflareaccess.com)
//   ACCESS_AUD      "Application Audience (AUD) Tag" da aplicação no Access (segredo)
//   COCKPIT_TOKEN   o mesmo valor colocado na Netlify da Editora e dos Eventos (segredo)
//   NOMES           opcional, apelidos por e-mail: "rogeriotpires@gmail.com=Rogerio,aline@revistatimeline.com=Aline"
// Ligação (Bindings): KV namespace SITE, o mesmo ligado ao Worker site-timeline.
//
// Este arquivo é gerado por build.py a partir de worker.src.js + app.html. Edite os dois e rode o build.

const APP_HTML = __APP_HTML__;

const EVENTOS = 'https://timeline-eventos.netlify.app/api/cockpit';
const EDITORA = 'https://editora-timeline.netlify.app/api/cockpit';
const FISCALIZE = 'https://fiscalize.revistatimeline.com/data/bus/painel.json';

// ---------------- configuração do site (mesmos padrões do Worker site-timeline) ----------------
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
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const url = (v) => { const s = str(v, 400); if (!s) return ''; try { const u = new URL(s); return ['https:', 'http:'].includes(u.protocol) ? u.toString() : ''; } catch { return ''; } };
const oneOf = (v, list, def) => (list.includes(v) ? v : def);
function cleanConfig(c) {
  const v = c && typeof c === 'object' ? c : {};
  const ids = DEFAULTS.cartoes.map((x) => x.id);
  const cards = (Array.isArray(v.cartoes) ? v.cartoes : []).filter((x) => x && ids.includes(x.id))
    .filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).map((x) => ({ id: x.id, mostrar: x.mostrar !== false }));
  for (const d of DEFAULTS.cartoes) if (!cards.find((x) => x.id === d.id)) cards.push({ ...d });
  const a = v.aviso || {}, l = v.livro || {}, e = v.evento || {}, lj = v.loja || {}, af = v.artigo_fixado || {};
  return {
    aviso: { ativo: a.ativo === true, texto: str(a.texto, 160), link: url(a.link), botao: str(a.botao, 30), tom: oneOf(a.tom, ['ambar', 'vermelho'], 'ambar') },
    cartoes: cards,
    livro: { slug: str(l.slug, 80).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || DEFAULTS.livro.slug, etiqueta: str(l.etiqueta ?? 'auto', 24) },
    evento: { etiqueta: str(e.etiqueta, 24) },
    loja: { preco_min: str(lj.preco_min, 10).replace(/[^0-9.,]/g, '') },
    artigo_fixado: { url: url(af.url), ate: /^\d{4}-\d{2}-\d{2}$/.test(af.ate || '') ? af.ate : '' },
  };
}

// ---------------- crachá do Cloudflare Access ----------------
let certs = null, certsAt = 0;
const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
async function verifyAccess(request, env) {
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) return { error: 'O Worker ainda não foi ligado ao Cloudflare Access (faltam ACCESS_TEAM e ACCESS_AUD).' };
  const cookie = (request.headers.get('cookie') || '').match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  const token = request.headers.get('cf-access-jwt-assertion') || (cookie && cookie[1]);
  if (!token) return { error: 'Sem login do Access.' };
  const [h, p, sig] = token.split('.');
  if (!sig) return { error: 'Login inválido.' };
  const header = JSON.parse(new TextDecoder().decode(b64url(h)));
  const team = `https://${String(env.ACCESS_TEAM).replace(/\.cloudflareaccess\.com.*$/, '').replace(/^https?:\/\//, '')}.cloudflareaccess.com`;
  if (!certs || Date.now() - certsAt > 3600e3) {
    const r = await fetch(`${team}/cdn-cgi/access/certs`);
    if (!r.ok) return { error: 'Não consegui conferir o login (certificados do Access).' };
    certs = (await r.json()).keys || []; certsAt = Date.now();
  }
  const jwk = certs.find((k) => k.kid === header.kid);
  if (!jwk) { certs = null; return { error: 'Login com chave desconhecida. Recarregue a página.' }; }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) return { error: 'Assinatura do login inválida.' };
  const claims = JSON.parse(new TextDecoder().decode(b64url(p)));
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.ACCESS_AUD)) return { error: 'Login de outra aplicação.' };
  if (claims.iss !== team) return { error: 'Login de outra equipe do Access.' };
  if (!claims.exp || claims.exp * 1000 < Date.now()) return { error: 'Login expirado. Recarregue a página.' };
  return { email: String(claims.email || '').toLowerCase() };
}

// ---------------- respostas ----------------
const json = (d, status = 200) => new Response(JSON.stringify(d), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const SECURITY = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'cache-control': 'no-store',
};
async function getJson(u, headers) {
  try {
    const r = await fetch(u, { headers: { 'user-agent': 'painel-timeline/1.0', ...headers }, signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const code = j && j.error;
      const msg = code === 'cockpit_not_configured' ? 'Falta a variável COCKPIT_TOKEN na Netlify.'
        : code === 'unauthorized' ? 'O COCKPIT_TOKEN do painel não bate com o da Netlify.'
        : r.status === 404 ? 'O resumo ainda não foi publicado neste sistema.' : `Erro ${r.status}`;
      return { erro: msg };
    }
    return j;
  } catch { return { erro: 'O sistema não respondeu a tempo.' }; }
}

export default {
  async fetch(request, env) {
    const u = new URL(request.url);
    const who = await verifyAccess(request, env).catch(() => ({ error: 'Falha ao conferir o login.' }));
    if (who.error) {
      if (u.pathname.startsWith('/api/')) return json({ error: who.error }, 401);
      return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Painel Timeline</title><body style="background:#060504;color:#f6f2ee;font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0;text-align:center;padding:16px"><div><h1 style="font-size:22px">Acesso restrito</h1><p>${who.error}</p><p><a style="color:#f4a65a" href="/">Tentar de novo</a></p></div>`,
        { status: 401, headers: { 'content-type': 'text/html; charset=utf-8', ...SECURITY } });
    }

    if (u.pathname === '/api/me') {
      const nomes = Object.fromEntries(String(env.NOMES || '').split(',').map((x) => x.split('=').map((y) => y.trim())).filter((x) => x[0] && x[1]).map(([e, n]) => [e.toLowerCase(), n]));
      return json({ email: who.email, nome: nomes[who.email] || '' });
    }

    if (u.pathname === '/api/resumo') {
      const h = { 'x-cockpit-token': env.COCKPIT_TOKEN || '' };
      const [eventos, editora, fiscalize] = await Promise.all([
        env.COCKPIT_TOKEN ? getJson(EVENTOS, h) : { erro: 'Falta a variável COCKPIT_TOKEN no Worker do painel.' },
        env.COCKPIT_TOKEN ? getJson(EDITORA, h) : { erro: 'Falta a variável COCKPIT_TOKEN no Worker do painel.' },
        getJson(`${FISCALIZE}?t=${Math.floor(Date.now() / 60000)}`, {}),
      ]);
      return json({ eventos, editora, fiscalize });
    }

    if (u.pathname === '/api/config') {
      if (!env.SITE) return json({ error: 'O KV SITE não está ligado ao Worker do painel.' }, 500);
      if (request.method === 'GET') return json(cleanConfig(await env.SITE.get('config', 'json')));
      if (request.method === 'PUT') {
        // só aceita pedidos vindos da própria página do painel
        const origin = request.headers.get('origin');
        if (origin && origin !== u.origin) return json({ error: 'Origem não permitida.' }, 403);
        let body;
        try { body = await request.json(); } catch { return json({ error: 'Dados inválidos.' }, 400); }
        const config = cleanConfig(body);
        await env.SITE.put('config', JSON.stringify(config));
        // histórico das últimas 30 alterações, com quem e quando
        const hist = (await env.SITE.get('config_historico', 'json')) || [];
        hist.unshift({ em: new Date().toISOString(), por: who.email, config });
        await env.SITE.put('config_historico', JSON.stringify(hist.slice(0, 30)));
        return json({ ok: true, config });
      }
      return json({ error: 'Método não permitido.' }, 405);
    }

    if (u.pathname.startsWith('/api/')) return json({ error: 'Não encontrado.' }, 404);
    return new Response(APP_HTML, { headers: { 'content-type': 'text/html; charset=utf-8', ...SECURITY } });
  },
};
