# Copia os artigos mais recentes do Substack para novo-site/data/posts.json (reserva usada pelo site quando o Worker não alcança o Substack)
import json, urllib.request, datetime, os
SUB = "https://assine.revistatimeline.com"
def get(u):
    req = urllib.request.Request(u, headers={"user-agent": "site-timeline/1.0", "accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)
posts = []
for off in range(0, 60, 12):
    d = get(f"{SUB}/api/v1/archive?sort=new&offset={off}&limit=12")
    lst = d if isinstance(d, list) else d.get("posts", [])
    posts += lst
    if len(lst) < 12: break
def m(p):
    reac = p.get("reaction_count")
    if reac is None and p.get("reactions"): reac = sum(p["reactions"].values())
    by = p.get("publishedBylines") or []
    return {"title": p.get("title"), "subtitle": p.get("subtitle") or p.get("description") or "",
            "author": by[0].get("name") if by else "Redação Timeline", "date": p.get("post_date"),
            "url": p.get("canonical_url"), "image": p.get("cover_image") or "",
            "likes": reac, "comments": p.get("comment_count"), "restacks": p.get("restacks")}
out = [m(p) for p in posts if p.get("type") != "podcast" or p.get("title")]
if not out: raise SystemExit("nenhum artigo; mantendo o arquivo atual")
path = "novo-site/data/posts.json"
old = json.load(open(path)) if os.path.exists(path) else {}
if old.get("posts") == out: print("sem mudança"); raise SystemExit(0)
json.dump({"updated": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"), "posts": out}, open(path, "w"), ensure_ascii=False, indent=1)
print("atualizado:", out[0]["title"])
