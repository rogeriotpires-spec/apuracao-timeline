import csv, sys, json, collections
src, out = sys.argv[1], sys.argv[2]
K = ['QT_APTOS','QT_COMPARECIMENTO','QT_ABSTENCOES','QT_VOTOS_BRANCOS','QT_TOTAL_VOTOS_NULOS','QT_TOTAL_VOTOS_VALIDOS']
res = {}
for r in csv.DictReader(open(src, encoding='latin1'), delimiter=';'):
    if r['CD_CARGO'] != '1': continue
    t = 't' + r['NR_TURNO']; d = res.setdefault(t, {'br': [0]*6, 'uf': {}, 'mun': {}})
    v = [int(r[k]) for k in K]
    for tgt in (d['br'], d['uf'].setdefault(r['SG_UF'], [0]*6), d['mun'].setdefault(r['CD_MUNICIPIO'], [0]*6)):
        for i in range(6): tgt[i] += v[i]
res['campos'] = ['aptos','comparecimento','abstencoes','brancos','nulos','validos']
json.dump(res, open(out, 'w'), separators=(',', ':'))
for t in ('t1','t2'): print(t, dict(zip(res['campos'], res[t]['br'])), len(res[t]['mun']))
