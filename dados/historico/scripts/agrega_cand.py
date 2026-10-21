import csv, sys, json, collections
src, out = sys.argv[1], sys.argv[2]
T = {}
nomes = {}
for r in csv.DictReader(open(src, encoding='latin1'), delimiter=';'):
    if r['CD_CARGO'] != '1': continue
    t = 't' + r['NR_TURNO']; uf = r['SG_UF']; mun = r['CD_MUNICIPIO']; n = r['NR_CANDIDATO']; v = int(r['QT_VOTOS_NOMINAIS'])
    nomes[n] = [r['NM_URNA_CANDIDATO'], r['SG_PARTIDO']]
    d = T.setdefault(t, {'br': collections.Counter(), 'uf': {}, 'mun': {}})
    d['br'][n] += v
    d['uf'].setdefault(uf, collections.Counter())[n] += v
    m = d['mun'].setdefault(mun, [uf, r['NM_MUNICIPIO'], collections.Counter()])
    m[2][n] += v
res = {'cand': nomes}
for t, d in T.items():
    res[t] = {'br': dict(d['br']), 'uf': {k: dict(v) for k, v in d['uf'].items()}, 'mun': {k: [a, b, dict(c)] for k, (a, b, c) in d['mun'].items()}}
json.dump(res, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
for t in sorted(T):
    tot = sum(T[t]['br'].values())
    print(t, len(T[t]['mun']), 'municípios', tot, 'válidos nominais', sorted(((v, nomes[k][0]) for k, v in T[t]['br'].items()), reverse=True)[:4])
