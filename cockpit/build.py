# Gera worker.js (o arquivo para colar na Cloudflare) a partir de worker.src.js + app.html
import json, pathlib
d = pathlib.Path(__file__).parent
src = (d / 'worker.src.js').read_text()
html = (d / 'app.html').read_text()
out = src.replace('__APP_HTML__', json.dumps(html, ensure_ascii=False)).replace(
    '// Este arquivo é gerado por build.py a partir de worker.src.js + app.html. Edite os dois e rode o build.',
    '// ARQUIVO GERADO por build.py (não edite aqui): fonte em worker.src.js e app.html.')
(d / 'worker.js').write_text(out)
print('worker.js', len(out), 'bytes')
