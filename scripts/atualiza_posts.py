# Robô do site (a cada 15 min, GitHub Actions):
# 1. copia os artigos mais recentes do Substack para novo-site/data/posts.json
# 2. copia o livro em destaque da Editora e o próximo evento para novo-site/data/destaques.json
# 3. baixa as imagens do topo da página e grava versões leves (WebP) em novo-site/img/c/
# 4. grava tudo isso dentro do index.html (bloco "seed"), para a página abrir pronta, sem esperar a internet
import json, subprocess, datetime, os, sys, re, hashlib, io, glob, shutil
SUB = "https://assine.revistatimeline.com"
EDITORA = "https://editora-timeline.netlify.app"
EVENTOS = "https://timeline-eventos.netlify.app"
LIVRO = "almanaque-timeline"
SITE = "novo-site"

def baixa(u, binario=False):
    r = subprocess.run(["curl", "-sSL", "-m", "40", "-A", "site-timeline/1.0", "-w", "\n%{http_code}", u], capture_output=True)
    body, _, code = r.stdout.rpartition(b"\n")
    if code != b"200": raise RuntimeError(f"HTTP {code.decode()} em {u}: {body[:200]!r}")
    return body if binario else json.loads(body)

# 0. o menu padrão vai embutido no index.html (sem um pedido a mais na abertura)
_ix = f"{SITE}/index.html"; _s = open(_ix).read(); _menu = open("menu/timeline-menu.js").read().replace("</script", "<\\/script")
_novo = re.sub(r'<!-- menu-robo -->.*?<!-- /menu-robo -->', lambda m_: '<!-- menu-robo --><script>' + _menu + '</script><!-- /menu-robo -->', _s, flags=re.S)
if _novo != _s: open(_ix, "w").write(_novo); print("menu embutido atualizado")

# 1. artigos (o Substack pagina por "cursor")
posts, cur = [], ""
for _ in range(10):
    d = baixa(f"{SUB}/api/v1/archive?sort=new&limit=12" + (f"&cursor={cur}" if cur else ""))
    lst = d if isinstance(d, list) else d.get("posts", [])
    posts += lst
    cur = (d.get("nextCursor") if isinstance(d, dict) else "") or ""
    if len(lst) < 12 or not cur: break
def m(p):
    reac = p.get("reaction_count")
    if reac is None and p.get("reactions"): reac = sum(p["reactions"].values())
    by = p.get("publishedBylines") or []
    return {"title": p.get("title"), "subtitle": p.get("subtitle") or p.get("description") or "",
            "author": by[0].get("name") if by else "Redação Timeline", "date": p.get("post_date"),
            "url": p.get("canonical_url"), "image": p.get("cover_image") or "",
            "likes": reac, "comments": p.get("comment_count"), "restacks": p.get("restacks")}
posts = [m(p) for p in posts if p.get("type") != "podcast" or p.get("title")]
if not posts: sys.exit("nenhum artigo; mantendo os arquivos atuais")

# 2. vitrine
def tenta(u):
    try: return baixa(u)
    except Exception as e: print("aviso:", e, file=sys.stderr); return None
cat, evs = tenta(f"{EDITORA}/api/public?action=catalog"), tenta(f"{EVENTOS}/api/public?action=events")
books = (cat or {}).get("books") or []
b = next((x for x in books if x.get("slug") == LIVRO), None) or next((x for x in books if x.get("featured")), None) or (books[0] if books else None)
agora = datetime.datetime.now(datetime.timezone.utc)
def futuro(x):
    t = x.get("ends_at") or x.get("starts_at")
    try: return datetime.datetime.fromisoformat(t.replace("Z", "+00:00")) > agora
    except Exception: return False
e = next((x for x in ((evs or {}).get("events") or []) if futuro(x)), None)
dest = {
  "book": b and {k: b.get(k) for k in ["slug","title","subtitle","author","cover_url","price_digital","price_digital_old","price_rental","rental_days","has_sample","sample_pages","pages"]},
  "event": e and {"slug": e.get("slug"), "title": e.get("title_pt") or e.get("title_en"), "description": e.get("description_pt") or "",
    "cover_url": e.get("cover_url") or "", "starts_at": e.get("starts_at"), "ends_at": e.get("ends_at"), "timezone": e.get("timezone") or "America/Sao_Paulo",
    "venue": e.get("venue"), "address": e.get("address"), "online": bool(e.get("online_enabled")), "in_person": (e.get("capacity_in_person") or 0) > 0,
    "price_in_person": e.get("price_in_person_brl"), "price_online": e.get("price_online_brl")},
}
if cat is None and evs is None and os.path.exists(f"{SITE}/data/destaques.json"):
    dest = json.load(open(f"{SITE}/data/destaques.json"))  # Editora e Eventos fora do ar: mantém a última cópia

# 2b. programas do YouTube (pelo Worker, que guarda a chave da API): a página já abre com a grade montada
prog = tenta("https://site-timeline.marketing-b9d.workers.dev/api/programas")
if not (prog and prog.get("conversa")): prog = None

# 3. imagens leves: cada original vira img/c/<código>-<largura>.webp
from PIL import Image
os.makedirs(f"{SITE}/img/c", exist_ok=True)
imgs, usados = {}, set()
def leve(url, larguras):
    if not url: return
    cod = hashlib.sha1(url.encode()).hexdigest()[:14]
    alvo = [f"{SITE}/img/c/{cod}-{w}.webp" for w in larguras]
    if not all(os.path.exists(a) for a in alvo):
        try:
            im = Image.open(io.BytesIO(baixa(url, True))); im.load()
            im = im.convert("RGB")
            for w, a in zip(larguras, alvo):
                x = im.copy()
                if x.width > w: x = x.resize((w, round(x.height * w / x.width)), Image.LANCZOS)
                x.save(a, "WEBP", quality=72, method=6)
        except Exception as ex:
            print("imagem ignorada:", url[:90], ex, file=sys.stderr); return
    usados.update(alvo)
    w0 = Image.open(alvo[-1]).size
    imgs[url] = {"b": f"img/c/{cod}", "w": larguras, "r": round(w0[0] / w0[1], 4)}
if dest.get("book"): leve(dest["book"].get("cover_url"), [200, 300])
if dest.get("event"): leve(dest["event"].get("cover_url"), [480, 800])
for i, p in enumerate(posts[:12]): leve(p["image"], [480, 800, 1200] if i == 0 else [400, 800])
for f in glob.glob(f"{SITE}/img/c/*.webp"):
    if f not in usados: os.remove(f)

# 4. arquivos de dados e bloco "seed" do index.html
agora_txt = agora.strftime("%Y-%m-%dT%H:%M:%SZ")
def grava(path, obj, chave):
    old = json.load(open(path)) if os.path.exists(path) else {}
    if old.get(chave) == obj.get(chave): return False
    json.dump(obj, open(path, "w"), ensure_ascii=False, indent=1); return True
grava(f"{SITE}/data/posts.json", {"updated": agora_txt, "posts": posts}, "posts")
grava(f"{SITE}/data/destaques.json", {"updated": agora_txt, **dest}, "book")
ix = f"{SITE}/index.html"; s = open(ix).read()
mt = re.search(r'(<script type="application/json" id="seed">\n)(.*?)(\n</script>)', s, re.S)
velho = json.loads(mt.group(2))
seed = {"updated": velho.get("updated"), "subscribers": velho.get("subscribers", "46 mil"), "posts": posts[:12], "destaques": dest, "img": imgs,
        "programas": prog or velho.get("programas")}
# a contagem de visualizações muda o tempo todo; só regrava a página quando os programas mudam de verdade
def chave_prog(pg):
    if not pg: return None
    f = lambda x: x and {k: x.get(k) for k in ("id", "titulo", "ao_vivo", "inicio")}
    return [[f(pg[k].get("proximo")), [v.get("id") for v in pg[k].get("videos") or []]] for k in ("conversa", "ponto_final") if pg.get(k)]
comp = lambda x: {**{k: v for k, v in x.items() if k not in ("updated", "programas")}, "prog": chave_prog(x.get("programas"))}
if comp(seed) != comp(velho):
    seed["updated"] = agora_txt
    s = s[:mt.start(2)] + json.dumps(seed, ensure_ascii=False).replace("</", "<\\/") + s[mt.end(2):]
    # cartão do livro já escrito no HTML: a capa (maior imagem do topo no celular) aparece sem esperar o JavaScript
    from html import escape as E
    def brl(c): return "R$ " + f"{(c or 0)/100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    bk = dest.get("book")
    if bk:
        ED = "https://editora.revistatimeline.com"
        href = f"{ED}/livro.html?l={bk['slug']}&src=site"
        c = imgs.get(bk.get("cover_url"))
        if c:
            ws = c["w"]; h = round(ws[-1] / c["r"])
            capa = f'<img alt="" src="{c["b"]}-{ws[-1]}.webp" srcset="{", ".join(f"{c['b']}-{x}.webp {x}w" for x in ws)}" sizes="122px" width="{ws[-1]}" height="{h}" fetchpriority="high">'
        elif bk.get("cover_url"): capa = f'<img alt="" src="{E(bk["cover_url"])}">'
        else: capa = f'<span class="fake">{E(bk["title"] or "")}</span>'
        old = bk.get("price_digital_old")
        info = ""
        if bk.get("price_digital"):
            info = '<p class="info">' + (f"<s>{brl(old)}</s> " if old else "") + f"<b>{brl(bk['price_digital'])}</b> para sempre" + \
                   (f" ou {brl(bk['price_rental'])} por {bk.get('rental_days') or 30} dias" if bk.get("price_rental") else "") + "</p>"
        amostra = f'<a class="lnk" href="{E(ED + "/ler.html?l=" + bk["slug"] + "&amostra=1")}">Ler amostra grátis</a>' if bk.get("has_sample") else ""
        art = (f'<span class="placa" aria-hidden="true">{"Promoção" if old else "Lançamento"}</span><a class="pic p-livro" href="{E(href)}" tabindex="-1" aria-hidden="true"><span class="sombra"></span><span class="flutua"><span class="book">{capa}</span></span></a>'
               f'<div class="txt"><span class="eyebrow">Editora Timeline</span><h3>{E(bk["title"] or "")}</h3>{info}'
               f'<div class="acts"><a class="btn primary" href="{E(href)}">Comprar</a>{amostra}</div></div>')
        s = re.sub(r'(<article class="feat" id="v-livro"[^>]*>).*?(</article>)', lambda m_: '<article class="feat" id="v-livro" data-robo="1">' + art + m_.group(2), s, count=1, flags=re.S)
    # pré-carrega a capa do livro (primeira imagem grande da página)
    pre = ""
    s = re.sub(r'<!-- preload-robo -->.*?<!-- /preload-robo -->', f'<!-- preload-robo -->{pre}<!-- /preload-robo -->', s, flags=re.S)
    open(ix, "w").write(s)
    print("site atualizado:", posts[0]["title"])
else:
    print("sem mudança")
